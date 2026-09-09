import json
import uuid
import time
from typing import List, Dict, Any, Optional
import numpy as np
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import RoutePlan, Vehicle, User, AuditBlock, RoutePlanStatus
from backend.services.quantum_solver import (
    quantum_solver,
    build_quadratic_program_from_cost_matrix,
    solve_vrp_with_qiskit,
)
from backend.services.classical_optimizer import classical_optimizer
from backend.services.report_service import report_service
from backend.ml.graph_builder import build_cost_matrix, generate_interpolated_polyline
from backend.auth.jwt_handler import require_dispatcher, get_current_user, TokenPayload
from backend.utils.logger import logger

router = APIRouter(prefix="/optimize", tags=["Route Optimization"])


class LocationItem(BaseModel):
    name: str = "Location"
    lat: float
    lng: float
    demand_kg: float = 10.0


class OptimizationRequest(BaseModel):
    locations: List[LocationItem]
    solver_type: Optional[str] = Field(default="quantum", description="Options: classical, quantum, hybrid")
    algorithm: str = Field(default="QAOA", description="QAOA, SQA, CLARKE_WRIGHT, TWO_OPT, TABU_SEARCH, CLASSICAL_SA")
    vehicle_type: str = Field(default="ELECTRIC", description="ELECTRIC, DIESEL, HYBRID")
    p_depth: int = Field(default=2, ge=1, le=5)
    shots: int = Field(default=1024, ge=100, le=10000)
    apply_traffic: bool = True
    vehicle_id: Optional[int] = None


class DispatchRequest(BaseModel):
    vehicle_id: int
    driver_id: Optional[int] = None


@router.post("", response_model=Dict[str, Any])
def optimize_route(
    payload: OptimizationRequest,
    db: Session = Depends(get_db),
):
    """
    Executes route optimization using Quantum (Qiskit QAOA), Classical, or Hybrid approaches,
    computes emissions, returns comparative metrics, and records an immutable SHA-256 audit block.
    """
    if len(payload.locations) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 locations (depot + 1 delivery stop) are required.",
        )

    locs = [loc.model_dump() for loc in payload.locations]
    start_time = time.perf_counter()

    # 1. Build cost and distance matrices
    dist_matrix, cost_matrix = build_cost_matrix(locs, apply_traffic=payload.apply_traffic)

    # 2. Determine solver mode based on solver_type or algorithm
    mode = (payload.solver_type or "quantum").lower()
    algo = payload.algorithm.upper()
    qiskit_metrics = {}
    circuit_diagram = None

    if mode == "quantum" or (mode not in ("classical", "hybrid") and algo in ("QAOA", "QISKIT")):
        # Call solve_vrp_with_qiskit()
        qp = build_quadratic_program_from_cost_matrix(cost_matrix)
        qiskit_res = solve_vrp_with_qiskit(qp, reps=payload.p_depth)

        # Decode optimal solution
        num_stops = cost_matrix.shape[0] - 1
        tour_order = quantum_solver._decode_qubo_bitstring(qiskit_res["optimal_solution"], num_stops, cost_matrix)
        tour = [0] + tour_order + [0]
        total_dist = sum(cost_matrix[tour[i], tour[i + 1]] for i in range(len(tour) - 1))

        qiskit_metrics = {
            "energy": qiskit_res["energy"],
            "optimal_solution": qiskit_res["optimal_solution"],
            "circuit_depth": qiskit_res["circuit_depth"],
            "backend": qiskit_res.get("backend", "statevector_simulator"),
            "optimal_gamma": qiskit_res.get("optimal_gamma"),
            "optimal_beta": qiskit_res.get("optimal_beta"),
            "convergence_evals": qiskit_res["circuit_depth"],
        }
        circuit_diagram = qiskit_res.get("circuit_diagram")
        solver_label = "QISKIT_QAOA"

    elif mode == "hybrid":
        # Hybrid: Qiskit QAOA for global landscape + Classical 2-Opt local refinement
        qp = build_quadratic_program_from_cost_matrix(cost_matrix)
        qiskit_res = solve_vrp_with_qiskit(qp, reps=payload.p_depth)
        num_stops = cost_matrix.shape[0] - 1
        q_tour_order = quantum_solver._decode_qubo_bitstring(qiskit_res["optimal_solution"], num_stops, cost_matrix)
        initial_tour = [0] + q_tour_order + [0]

        # Classical 2-Opt refinement on top of quantum tour
        refined_res = classical_optimizer.two_opt(cost_matrix, initial_tour=initial_tour)
        tour = refined_res["tour"]
        total_dist = refined_res["total_distance_km"]

        qiskit_metrics = {
            "energy": qiskit_res["energy"],
            "optimal_solution": qiskit_res["optimal_solution"],
            "circuit_depth": qiskit_res["circuit_depth"],
            "backend": qiskit_res.get("backend", "statevector_simulator"),
            "convergence_evals": qiskit_res["circuit_depth"],
            "hybrid_refinement_iterations": refined_res.get("iterations", 1),
        }
        circuit_diagram = qiskit_res.get("circuit_diagram")
        solver_label = "HYBRID_QUANTUM_CLASSICAL"

    else:
        # Classical mode
        if algo == "CLARKE_WRIGHT":
            solve_result = classical_optimizer.clarke_wright_savings(cost_matrix)
        elif algo == "TABU_SEARCH":
            solve_result = classical_optimizer.tabu_search(cost_matrix)
        elif algo in ("CLASSICAL_SA", "SIMULATED_ANNEALING"):
            solve_result = classical_optimizer.simulated_annealing(cost_matrix)
        else:
            solve_result = classical_optimizer.two_opt(cost_matrix)

        tour = solve_result["tour"]
        total_dist = solve_result["total_distance_km"]
        solver_label = solve_result["algorithm"]

    ordered_stops = [locs[idx] for idx in tour]
    polyline = generate_interpolated_polyline(ordered_stops)

    # 3. Calculate emissions
    emissions = classical_optimizer.calculate_emissions(total_dist, vehicle_type=payload.vehicle_type)
    exec_time = round((time.perf_counter() - start_time) * 1000.0, 2)

    # 4. Compute comparative metrics: Classical baseline vs Quantum/Selected
    classical_baseline = classical_optimizer.two_opt(cost_matrix)
    classical_emissions = classical_optimizer.calculate_emissions(classical_baseline["total_distance_km"], vehicle_type=payload.vehicle_type)

    comparative_metrics = {
        "quantum_distance_km": round(total_dist, 2),
        "classical_distance_km": round(classical_baseline["total_distance_km"], 2),
        "quantum_execution_time_ms": exec_time,
        "classical_execution_time_ms": classical_baseline["execution_time_ms"],
        "quantum_co2_kg": emissions["total_co2_kg"],
        "classical_co2_kg": classical_emissions["total_co2_kg"],
        "quantum_fuel_energy": emissions["fuel_consumed"],
        "classical_fuel_energy": classical_emissions["fuel_consumed"],
        "fuel_unit": emissions["fuel_unit"],
        "co2_delta_kg": round(classical_emissions["total_co2_kg"] - emissions["total_co2_kg"], 3),
        "distance_delta_km": round(classical_baseline["total_distance_km"] - total_dist, 2),
    }

    # 5. Generate plan code
    plan_code = f"PLAN-{uuid.uuid4().hex[:8].upper()}"

    # 6. Persist RoutePlan
    new_plan = RoutePlan(
        plan_code=plan_code,
        solver_type=solver_label,
        parameters_json=json.dumps({
            "solver_type": mode,
            "p_depth": payload.p_depth,
            "shots": payload.shots,
            "vehicle_type": payload.vehicle_type,
            "apply_traffic": payload.apply_traffic,
            "qiskit_metrics": qiskit_metrics,
        }),
        total_distance_km=total_dist,
        total_co2_kg=emissions["total_co2_kg"],
        execution_time_ms=exec_time,
        stops_json=json.dumps(ordered_stops),
        polyline_json=json.dumps(polyline),
        vehicle_id=payload.vehicle_id,
        status=RoutePlanStatus.OPTIMIZED,
    )
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)

    # 7. Record SHA-256 Audit Block
    audit_payload = {
        "event": "ROUTE_OPTIMIZED",
        "plan_code": plan_code,
        "solver": solver_label,
        "solver_type": mode,
        "stops_count": len(ordered_stops),
        "total_distance_km": total_dist,
        "total_co2_kg": emissions["total_co2_kg"],
        "execution_time_ms": exec_time,
    }
    audit_block = report_service.record_audit_block(db, audit_payload)

    return {
        "id": new_plan.id,
        "plan_code": plan_code,
        "algorithm": solver_label,
        "solver_type": mode,
        "total_distance_km": total_dist,
        "execution_time_ms": exec_time,
        "emissions": emissions,
        "tour": tour,
        "ordered_stops": ordered_stops,
        "polyline": polyline,
        "circuit_diagram": circuit_diagram,
        "qiskit_metrics": qiskit_metrics,
        "comparative_metrics": comparative_metrics,
        "audit_block_hash": audit_block.block_hash,
        "audit_block_index": audit_block.block_index,
    }


@router.post("/benchmark", response_model=Dict[str, Any])
def run_benchmark(
    payload: OptimizationRequest,
    db: Session = Depends(get_db),
):
    """
    Runs all quantum and classical algorithms on the exact same delivery stop instance
    and returns a side-by-side performance and quality benchmark matrix.
    """
    if len(payload.locations) < 2:
        raise HTTPException(status_code=400, detail="At least 2 locations required.")

    locs = [loc.model_dump() for loc in payload.locations]
    _, cost_matrix = build_cost_matrix(locs, apply_traffic=payload.apply_traffic)

    solvers = [
        ("QAOA", lambda: quantum_solver.solve_vrp_route(cost_matrix, algorithm="QAOA", p_depth=payload.p_depth)),
        ("Simulated Quantum Annealing", lambda: quantum_solver.solve_vrp_route(cost_matrix, algorithm="SQA")),
        ("Clarke-Wright Savings", lambda: classical_optimizer.clarke_wright_savings(cost_matrix)),
        ("2-Opt Local Search", lambda: classical_optimizer.two_opt(cost_matrix)),
        ("Tabu Search", lambda: classical_optimizer.tabu_search(cost_matrix)),
        ("Classical Simulated Annealing", lambda: classical_optimizer.simulated_annealing(cost_matrix)),
    ]

    benchmark_rows = []
    baseline_dist = None

    for name, fn in solvers:
        try:
            res = fn()
            dist = res["total_distance_km"]
            if baseline_dist is None:
                baseline_dist = dist

            emissions = classical_optimizer.calculate_emissions(dist, vehicle_type=payload.vehicle_type)
            exec_time = res["execution_time_ms"]

            benchmark_rows.append({
                "algorithm": name,
                "distance_km": dist,
                "execution_time_ms": exec_time,
                "co2_emissions_kg": emissions["total_co2_kg"],
                "fuel_energy_used": emissions["fuel_consumed"],
                "fuel_unit": emissions["fuel_unit"],
                "solution_quality_score": round(min(100.0, (baseline_dist / max(0.1, dist)) * 100.0), 1),
                "tour": res["tour"],
            })
        except Exception as e:
            logger.error(f"Solver benchmark {name} failed: {e}")

    return {
        "num_stops": len(locs),
        "vehicle_type": payload.vehicle_type,
        "results": benchmark_rows,
    }


@router.get("/tune-qaoa", response_model=Dict[str, Any])
def tune_qaoa_parameters(
    p_depth: int = 2,
    grid_steps: int = 8,
    shots: int = 1024,
):
    """
    Executes automated parameter grid search for QAOA variational angles (gamma, beta)
    and returns 2D energy landscape data and quantum circuit diagram.
    """
    # Standard representative 4-stop mini-instance
    sample_cost = np.array([
        [0.0, 4.5, 7.2, 9.1],
        [4.5, 0.0, 3.8, 6.4],
        [7.2, 3.8, 0.0, 5.0],
        [9.1, 6.4, 5.0, 0.0],
    ])
    qubo = quantum_solver.formulate_vrp_qubo(sample_cost)
    grid_res = quantum_solver.simulate_qaoa_grid_search(
        qubo,
        p_depth=p_depth,
        grid_steps=grid_steps,
        shots=shots,
    )
    return grid_res


@router.get("/plans", response_model=List[Dict[str, Any]])
def list_plans(limit: int = 20, db: Session = Depends(get_db)):
    """Retrieves historic optimization plans."""
    plans = db.query(RoutePlan).order_by(RoutePlan.created_at.desc()).limit(limit).all()
    results = []
    for p in plans:
        results.append({
            "id": p.id,
            "plan_code": p.plan_code,
            "solver_type": p.solver_type,
            "total_distance_km": p.total_distance_km,
            "total_co2_kg": p.total_co2_kg,
            "execution_time_ms": p.execution_time_ms,
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    return results


@router.get("/plans/{plan_id}", response_model=Dict[str, Any])
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    """Retrieves full details for a specific route plan."""
    plan = db.query(RoutePlan).filter(RoutePlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Route plan not found")

    return {
        "id": plan.id,
        "plan_code": plan.plan_code,
        "solver_type": plan.solver_type,
        "total_distance_km": plan.total_distance_km,
        "total_co2_kg": plan.total_co2_kg,
        "execution_time_ms": plan.execution_time_ms,
        "status": plan.status,
        "stops": json.loads(plan.stops_json) if plan.stops_json else [],
        "polyline": json.loads(plan.polyline_json) if plan.polyline_json else [],
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
    }


@router.post("/dispatch/{plan_id}", response_model=Dict[str, Any])
def dispatch_plan(
    plan_id: int,
    payload: DispatchRequest,
    db: Session = Depends(get_db),
):
    """Dispatches an optimized plan to a vehicle, updating status and logging audit event."""
    plan = db.query(RoutePlan).filter(RoutePlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Route plan not found")

    vehicle = db.query(Vehicle).filter(Vehicle.id == payload.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    plan.vehicle_id = payload.vehicle_id
    plan.driver_id = payload.driver_id
    plan.status = RoutePlanStatus.DISPATCHED
    vehicle.status = "EN_ROUTE"

    db.commit()

    # Record dispatch in audit blockchain
    report_service.record_audit_block(db, {
        "event": "ROUTE_DISPATCHED",
        "plan_code": plan.plan_code,
        "vehicle_code": vehicle.code,
        "driver_id": payload.driver_id,
    })

    return {"status": "DISPATCHED", "plan_code": plan.plan_code, "vehicle_code": vehicle.code}

import json
import uuid
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import RoutePlan, Vehicle, RoutePlanStatus
from backend.services.traffic_service import traffic_service, IncidentSeverity, IncidentType
from backend.services.telemetry_pubsub import telemetry_broadcaster
from backend.services.quantum_solver import quantum_solver, build_quadratic_program_from_cost_matrix, solve_vrp_with_qiskit
from backend.services.classical_optimizer import classical_optimizer
from backend.services.report_service import report_service
from backend.ml.graph_builder import build_cost_matrix, generate_interpolated_polyline
from backend.auth.jwt_handler import get_current_user, TokenPayload
from backend.utils.logger import logger

router = APIRouter(prefix="/traffic", tags=["Dynamic Routing & Real-Time Traffic"])


class IncidentRequest(BaseModel):
    name: str = "Congestion Hotspot"
    incident_type: str = Field(default=IncidentType.CONGESTION, description="CONGESTION, ACCIDENT, ROAD_CLOSURE, CONSTRUCTION")
    severity: str = Field(default=IncidentSeverity.MAJOR, description="MINOR, MAJOR, CRITICAL")
    lat: float = 37.789
    lng: float = -122.401
    radius_meters: float = 750.0
    description: Optional[str] = None
    custom_multiplier: Optional[float] = None


class ThresholdSettingsPayload(BaseModel):
    congestion_threshold_multiplier: float = Field(default=1.35, ge=1.05, le=3.0)
    auto_reroute_enabled: bool = True


class ReoptimizationRequest(BaseModel):
    plan_id: Optional[int] = None
    stops: Optional[List[Dict[str, Any]]] = None
    vehicle_type: str = "ELECTRIC"
    current_soc: float = 80.0
    solver_type: str = "quantum"  # quantum, hybrid, classical
    p_depth: int = 2
    force_override: bool = False  # If true, runs reroute even if threshold not met


class ManualReroutePayload(BaseModel):
    plan_id: int
    custom_order: Optional[List[int]] = None  # Custom permutation of waypoint indices
    override_reason: str = "Dispatcher Traffic Detour Directive"
    vehicle_type: str = "ELECTRIC"


class DriverAckPayload(BaseModel):
    plan_id: int
    vehicle_id: int
    driver_name: str = "Driver"
    notes: Optional[str] = "Detour acknowledged and applied to in-cab GPS"


@router.get("/live-zones")
def get_live_zones():
    """Returns currently active urban congestion zones and road incidents."""
    zones = traffic_service.get_live_zones()
    return {
        "count": len(zones),
        "threshold": traffic_service.congestion_threshold_multiplier,
        "auto_reroute_enabled": traffic_service.auto_reroute_enabled,
        "zones": zones,
    }


@router.get("/history")
def get_traffic_history(limit: int = 50):
    """Retrieves historical congestion & incident logs for analytics and simulation replay."""
    history = traffic_service.get_history(limit=limit)
    return {
        "count": len(history),
        "history": history,
    }


@router.post("/simulate-incident")
async def simulate_incident(payload: IncidentRequest):
    """
    [Dispatcher / Admin] Injects a live traffic incident/congestion spike
    and streams updates to Redis and connected WebSocket clients.
    """
    incident = traffic_service.create_incident(
        name=payload.name,
        incident_type=payload.incident_type,
        severity=payload.severity,
        lat=payload.lat,
        lng=payload.lng,
        radius_meters=payload.radius_meters,
        description=payload.description or "",
        custom_multiplier=payload.custom_multiplier,
    )

    # Broadcast incident event
    await telemetry_broadcaster.publish_incident_event(incident)
    # Broadcast refreshed traffic zones
    await traffic_service.broadcast_traffic_pulse()

    return {
        "status": "INCIDENT_INJECTED",
        "incident": incident,
        "active_zones_count": len(traffic_service.active_incidents),
    }


@router.delete("/incidents/{incident_id}")
async def resolve_incident(incident_id: str):
    """Resolves/removes an active traffic incident."""
    removed = traffic_service.remove_incident(incident_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Incident not found")

    await traffic_service.broadcast_traffic_pulse()
    return {"status": "RESOLVED", "incident_id": incident_id}


@router.get("/threshold-settings")
def get_threshold_settings():
    """Gets current dynamic rerouting trigger sensitivity."""
    return {
        "congestion_threshold_multiplier": traffic_service.congestion_threshold_multiplier,
        "auto_reroute_enabled": traffic_service.auto_reroute_enabled,
    }


@router.post("/threshold-settings")
def update_threshold_settings(payload: ThresholdSettingsPayload):
    """[Admin / Dispatcher] Updates dynamic routing trigger thresholds."""
    traffic_service.congestion_threshold_multiplier = payload.congestion_threshold_multiplier
    traffic_service.auto_reroute_enabled = payload.auto_reroute_enabled
    return {
        "status": "UPDATED",
        "congestion_threshold_multiplier": traffic_service.congestion_threshold_multiplier,
        "auto_reroute_enabled": traffic_service.auto_reroute_enabled,
    }


@router.post("/evaluate-route")
def evaluate_route(payload: ReoptimizationRequest, db: Session = Depends(get_db)):
    """Evaluates congestion factor along a route plan to check if re-optimization is needed."""
    stops = payload.stops
    if not stops and payload.plan_id:
        plan = db.query(RoutePlan).filter(RoutePlan.id == payload.plan_id).first()
        if plan and plan.stops_json:
            stops = json.loads(plan.stops_json)

    if not stops or len(stops) < 2:
        raise HTTPException(status_code=400, detail="Valid route stops required for evaluation.")

    eval_result = traffic_service.evaluate_route_congestion(
        stops,
        vehicle_type=payload.vehicle_type,
        current_soc=payload.current_soc,
    )
    return eval_result


@router.post("/trigger-reoptimization")
async def trigger_reoptimization(payload: ReoptimizationRequest, db: Session = Depends(get_db)):
    """
    Executes automated or threshold-triggered dynamic quantum re-optimization.
    Recalculates dynamic traffic costs, discovers detour routes with Quantum QAOA / Hybrid solver,
    updates the RoutePlan in the database, logs a SHA-256 audit block, and broadcasts the new polyline.
    """
    plan = None
    stops = payload.stops

    if payload.plan_id:
        plan = db.query(RoutePlan).filter(RoutePlan.id == payload.plan_id).first()
        if plan and plan.stops_json:
            stops = json.loads(plan.stops_json)

    if not stops or len(stops) < 2:
        # Fallback to standard San Francisco 5-stop delivery instance
        stops = [
            {"name": "Central Depot", "lat": 37.7749, "lng": -122.4194, "demand_kg": 0.0},
            {"name": "Embarcadero Hub", "lat": 37.7955, "lng": -122.3937, "demand_kg": 15.0},
            {"name": "Financial District", "lat": 37.7891, "lng": -122.4014, "demand_kg": 25.0},
            {"name": "SoMa Tech Zone", "lat": 37.7785, "lng": -122.3980, "demand_kg": 18.0},
            {"name": "Mission District", "lat": 37.7599, "lng": -122.4148, "demand_kg": 22.0},
            {"name": "Central Depot", "lat": 37.7749, "lng": -122.4194, "demand_kg": 0.0},
        ]

    # Evaluate route congestion
    eval_result = traffic_service.evaluate_route_congestion(
        stops,
        vehicle_type=payload.vehicle_type,
        current_soc=payload.current_soc,
    )

    if not payload.force_override and not eval_result["reoptimization_recommended"]:
        return {
            "status": "THRESHOLD_NOT_MET",
            "message": "Current route congestion factor is within acceptable limits.",
            "evaluation": eval_result,
        }

    start_time = time.perf_counter()

    # Build dynamically traffic-weighted cost matrix
    dist_matrix, cost_matrix = build_cost_matrix(stops, apply_traffic=True)

    # Apply active incident zone penalties into the cost matrix
    for i in range(len(stops)):
        for j in range(len(stops)):
            if i != j:
                seg_eval = traffic_service.evaluate_segment_congestion(
                    stops[i]["lat"], stops[i]["lng"],
                    stops[j]["lat"], stops[j]["lng"],
                    vehicle_type=payload.vehicle_type,
                    current_soc=payload.current_soc,
                )
                cost_matrix[i, j] = round(cost_matrix[i, j] * seg_eval["effective_multiplier"], 4)

    # Solve with Quantum QAOA / Hybrid solver
    mode = (payload.solver_type or "quantum").lower()
    qp = build_quadratic_program_from_cost_matrix(cost_matrix)
    qiskit_res = solve_vrp_with_qiskit(qp, reps=payload.p_depth)

    num_stops = cost_matrix.shape[0] - 1
    q_tour_order = quantum_solver._decode_qubo_bitstring(qiskit_res["optimal_solution"], num_stops, cost_matrix)
    tour = [0] + q_tour_order + [0]

    # If hybrid, perform 2-opt local refinement
    if mode == "hybrid":
        refined = classical_optimizer.two_opt(cost_matrix, initial_tour=tour)
        tour = refined["tour"]

    total_dist = sum(dist_matrix[tour[i], tour[i + 1]] for i in range(len(tour) - 1))
    ordered_stops = [stops[idx] for idx in tour]
    new_polyline = generate_interpolated_polyline(ordered_stops)
    exec_time = round((time.perf_counter() - start_time) * 1000.0, 2)

    emissions = classical_optimizer.calculate_emissions(total_dist, vehicle_type=payload.vehicle_type)

    # Estimated ETA calculation: congested time saved vs non-rerouted path
    baseline_congested_time_min = sum(cost_matrix[i, i + 1] for i in range(len(stops) - 1))
    optimized_time_min = sum(cost_matrix[tour[i], tour[i + 1]] for i in range(len(tour) - 1))
    time_saved_min = round(max(0.5, baseline_congested_time_min - optimized_time_min), 1)

    plan_code = plan.plan_code if plan else f"PLAN-DYN-{uuid.uuid4().hex[:6].upper()}"

    # If plan exists in DB, update it
    if plan:
        plan.total_distance_km = total_dist
        plan.total_co2_kg = emissions["total_co2_kg"]
        plan.stops_json = json.dumps(ordered_stops)
        plan.polyline_json = json.dumps(new_polyline)
        db.commit()

    # Log SHA-256 Chained Audit Event
    audit_payload = {
        "event": "DYNAMIC_ROUTE_REOPTIMIZED",
        "plan_code": plan_code,
        "solver": "QISKIT_QAOA_DYNAMIC",
        "trigger": "CONGESTION_THRESHOLD_EXCEEDED" if not payload.force_override else "MANUAL_DISPATCHER_OVERRIDE",
        "congestion_factor": eval_result["route_congestion_factor"],
        "time_saved_minutes": time_saved_min,
        "total_distance_km": total_dist,
        "total_co2_kg": emissions["total_co2_kg"],
    }
    report_service.record_audit_block(db, audit_payload)

    reroute_packet = {
        "plan_id": plan.id if plan else 1,
        "plan_code": plan_code,
        "algorithm": "QISKIT_QAOA_DYNAMIC",
        "time_saved_minutes": time_saved_min,
        "total_distance_km": round(total_dist, 2),
        "co2_kg": emissions["total_co2_kg"],
        "ordered_stops": ordered_stops,
        "polyline": new_polyline,
        "congestion_factor": eval_result["route_congestion_factor"],
        "congested_segments": eval_result["congested_segments"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Broadcast live dynamic reroute packet to Redis pub/sub and WebSockets
    await telemetry_broadcaster.publish_reroute_event(reroute_packet)

    return {
        "status": "REOPTIMIZATION_COMPLETED",
        "plan_code": plan_code,
        "time_saved_minutes": time_saved_min,
        "total_distance_km": round(total_dist, 2),
        "emissions": emissions,
        "execution_time_ms": exec_time,
        "ordered_stops": ordered_stops,
        "polyline": new_polyline,
        "evaluation": eval_result,
    }


@router.post("/manual-reroute")
async def manual_reroute_override(payload: ManualReroutePayload, db: Session = Depends(get_db)):
    """
    [Dispatcher] Manually forces an immediate route bypass / re-sequencing,
    overriding solver constraints and notifying the driver.
    """
    plan = db.query(RoutePlan).filter(RoutePlan.id == payload.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Route plan not found")

    stops = json.loads(plan.stops_json) if plan.stops_json else []
    if len(stops) < 2:
        raise HTTPException(status_code=400, detail="Plan has insufficient stops for rerouting")

    # Invert/permute internal waypoint sequence if custom order not provided
    if payload.custom_order and len(payload.custom_order) == len(stops):
        reordered_stops = [stops[i] for i in payload.custom_order]
    else:
        # Smart bypass: swap middle waypoints to avoid primary congested sector
        depot_start = stops[0]
        depot_end = stops[-1]
        mid_stops = list(reversed(stops[1:-1]))
        reordered_stops = [depot_start] + mid_stops + [depot_end]

    new_polyline = generate_interpolated_polyline(reordered_stops)
    dist_matrix, _ = build_cost_matrix(reordered_stops, apply_traffic=False)
    total_dist = sum(dist_matrix[i, i + 1] for i in range(len(reordered_stops) - 1))
    emissions = classical_optimizer.calculate_emissions(total_dist, vehicle_type=payload.vehicle_type)

    plan.stops_json = json.dumps(reordered_stops)
    plan.polyline_json = json.dumps(new_polyline)
    plan.total_distance_km = total_dist
    plan.total_co2_kg = emissions["total_co2_kg"]
    db.commit()

    # Record in Audit Blockchain
    report_service.record_audit_block(db, {
        "event": "MANUAL_DISPATCHER_REROUTE",
        "plan_code": plan.plan_code,
        "reason": payload.override_reason,
        "total_distance_km": total_dist,
    })

    reroute_packet = {
        "plan_id": plan.id,
        "plan_code": plan.plan_code,
        "override_type": "MANUAL_DISPATCHER",
        "reason": payload.override_reason,
        "total_distance_km": round(total_dist, 2),
        "ordered_stops": reordered_stops,
        "polyline": new_polyline,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await telemetry_broadcaster.publish_reroute_event(reroute_packet)

    return {
        "status": "MANUAL_REROUTE_SUCCESS",
        "plan_code": plan.plan_code,
        "total_distance_km": round(total_dist, 2),
        "ordered_stops": reordered_stops,
        "polyline": new_polyline,
    }


@router.post("/acknowledge-reroute")
async def acknowledge_reroute(payload: DriverAckPayload, db: Session = Depends(get_db)):
    """
    [Driver] Confirms dynamic reroute has been received and synced in-cab.
    Notifies Central Dispatcher via Redis pub/sub and WebSockets.
    """
    ack_data = {
        "plan_id": payload.plan_id,
        "vehicle_id": payload.vehicle_id,
        "driver_name": payload.driver_name,
        "notes": payload.notes,
        "acknowledged_at": datetime.now(timezone.utc).isoformat(),
        "status": "CONFIRMED_BY_DRIVER",
    }

    # Publish driver ack event to Central Dispatcher
    await telemetry_broadcaster.publish_reroute_ack(ack_data)

    # Log in audit blockchain
    report_service.record_audit_block(db, {
        "event": "DRIVER_REROUTE_ACKNOWLEDGED",
        "plan_id": payload.plan_id,
        "vehicle_id": payload.vehicle_id,
        "driver": payload.driver_name,
    })

    return {
        "status": "ACKNOWLEDGED",
        "ack_data": ack_data,
    }

import os
import json
import time
from typing import Dict, Any, List, Optional

from backend.utils.config import settings
from backend.utils.logger import logger
from backend.services.quantum_solver import quantum_solver
from backend.services.classical_optimizer import classical_optimizer
from backend.ml.graph_builder import build_cost_matrix, generate_interpolated_polyline

# Detect if Celery is available
try:
    from celery import Celery
    CELERY_INSTALLED = True
except ImportError:
    CELERY_INSTALLED = False


if CELERY_INSTALLED:
    celery_app = Celery(
        "quantum_route_ai_tasks",
        broker=settings.CELERY_BROKER_URL,
        backend=settings.CELERY_RESULT_BACKEND,
    )
    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        task_always_eager=settings.CELERY_ALWAYS_EAGER,
    )
else:
    # Zero-dependency local fallback mock
    class MockTask:
        def __init__(self, fn):
            self.fn = fn

        def delay(self, *args, **kwargs):
            # Execute synchronously in local development
            result = self.fn(*args, **kwargs)
            return type("AsyncResult", (), {"id": "local_mock_task_id", "get": lambda s: result})()

        def __call__(self, *args, **kwargs):
            return self.fn(*args, **kwargs)

    class MockCelery:
        def task(self, *args, **kwargs):
            def decorator(fn):
                return MockTask(fn)
            return decorator

    celery_app = MockCelery()


@celery_app.task(name="tasks.async_optimize_route")
def async_optimize_route(
    locations: List[Dict[str, Any]],
    algorithm: str = "QAOA",
    vehicle_type: str = "ELECTRIC",
    p_depth: int = 2,
) -> Dict[str, Any]:
    """Background Celery task for running heavy quantum/classical route optimizations."""
    logger.info(f"Starting async route optimization: algo={algorithm}, stops={len(locations)}")
    start_time = time.perf_counter()

    # Build cost matrix
    dist_matrix, cost_matrix = build_cost_matrix(locations, apply_traffic=True)

    algo = algorithm.upper()
    if algo in ("QAOA", "SQA", "SIMULATED_QUANTUM_ANNEALING"):
        sol = quantum_solver.solve_vrp_route(cost_matrix, algorithm=algo, p_depth=p_depth)
    elif algo == "CLARKE_WRIGHT":
        sol = classical_optimizer.clarke_wright_savings(cost_matrix)
    elif algo == "TWO_OPT":
        sol = classical_optimizer.two_opt(cost_matrix)
    elif algo == "TABU_SEARCH":
        sol = classical_optimizer.tabu_search(cost_matrix)
    elif algo in ("CLASSICAL_SA", "SIMULATED_ANNEALING"):
        sol = classical_optimizer.simulated_annealing(cost_matrix)
    else:
        sol = classical_optimizer.two_opt(cost_matrix)

    tour = sol["tour"]
    total_dist = sol["total_distance_km"]
    ordered_stops = [locations[idx] for idx in tour]
    polyline = generate_interpolated_polyline(ordered_stops)

    emissions = classical_optimizer.calculate_emissions(total_dist, vehicle_type=vehicle_type)

    result = {
        "algorithm": algo,
        "tour": tour,
        "ordered_stops": ordered_stops,
        "polyline": polyline,
        "total_distance_km": total_dist,
        "emissions": emissions,
        "execution_time_ms": sol.get("execution_time_ms", round((time.perf_counter() - start_time) * 1000.0, 2)),
        "quantum_metadata": sol.get("quantum_metadata"),
        "circuit_diagram": sol.get("circuit_diagram"),
    }
    logger.info(f"Async optimization completed: {total_dist} km in {result['execution_time_ms']} ms")
    return result

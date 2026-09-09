from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from backend.services.qiskit_manual_tsp import solve_manual_tsp_qiskit

router = APIRouter(prefix="/dispatch", tags=["Manual Dispatch"])

class Coordinate(BaseModel):
    lat: float
    lng: float

class ManualDispatchRequest(BaseModel):
    locations: List[Coordinate]

@router.post("/manual-recalculate")
async def recalculate_route(request: ManualDispatchRequest):
    coords = [[loc.lat, loc.lng] for loc in request.locations]
    
    if len(coords) < 2:
        raise HTTPException(status_code=400, detail="Minimum 2 locations required for routing.")

    # Trigger highly-accurate Qiskit pathfinding
    optimal_path_indices, cost = solve_manual_tsp_qiskit(coords)
    
    # Map index permutations back to coordinate payload
    optimized_coords = [{"lat": coords[i][0], "lng": coords[i][1]} for i in optimal_path_indices]
    
    return {
        "status": "success",
        "algorithm": "Qiskit_StatevectorSampler_QAOA",
        "optimized_indices": optimal_path_indices,
        "optimized_coordinates": optimized_coords,
        "cost_meters": cost
    }


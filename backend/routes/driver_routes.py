import json
import time
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Vehicle, RoutePlan, GeofenceEvent, RoutePlanStatus
from backend.services.fleet_service import fleet_service
from backend.services.audit_service import audit_service
from backend.utils.logger import logger

router = APIRouter(prefix="/driver", tags=["Driver Tier Execution"])

class DriverTelemetryPayload(BaseModel):
    vehicle_id: int
    lat: float
    lng: float
    speed_kmh: float = 35.0
    distance_step_km: float = 1.5
    ambient_temp_c: float = 22.0
    payload_kg: float = 200.0

class IncidentReportPayload(BaseModel):
    vehicle_id: int
    incident_type: str = Field(..., description="TRAFFIC_DELAY, FAILED_DELIVERY, BREAKDOWN, ROAD_CLOSED")
    description: str
    lat: Optional[float] = 37.7749
    lng: Optional[float] = -122.4194

# In-memory storage for driver incident reports & stop completions
INCIDENT_REPORTS = []
COMPLETED_STOPS_MAP = {}

@router.get("/assigned-route")
def get_driver_assigned_route(vehicle_id: int = 1, db: Session = Depends(get_db)):
    """[Driver] Retrieves active navigation route, turn-by-turn waypoints, and stop manifest."""
    plan = db.query(RoutePlan).filter(
        (RoutePlan.vehicle_id == vehicle_id) | (RoutePlan.status == RoutePlanStatus.DISPATCHED)
    ).order_by(RoutePlan.created_at.desc()).first()

    if not plan:
        plan = db.query(RoutePlan).order_by(RoutePlan.created_at.desc()).first()

    if not plan:
        return {"assigned": False, "message": "No active route plan assigned."}

    stops = json.loads(plan.stops_json) if plan.stops_json else []
    polyline = json.loads(plan.polyline_json) if plan.polyline_json else []
    completed_indices = COMPLETED_STOPS_MAP.get(plan.id, [])

    return {
        "assigned": True,
        "plan_id": plan.id,
        "plan_code": plan.plan_code,
        "vehicle_id": vehicle_id,
        "status": plan.status,
        "total_distance_km": plan.total_distance_km,
        "total_co2_kg": plan.total_co2_kg,
        "stops_manifest": [
            {
                "stop_index": idx,
                "name": s.get("name", f"Stop #{idx}"),
                "lat": s.get("lat"),
                "lng": s.get("lng"),
                "demand_kg": s.get("demand_kg", 15.0),
                "completed": idx in completed_indices,
            }
            for idx, s in enumerate(stops)
        ],
        "polyline": polyline,
    }

@router.post("/stops/{plan_id}/{stop_idx}/complete")
def mark_stop_completed(plan_id: int, stop_idx: int, db: Session = Depends(get_db)):
    """[Driver] Marks a delivery waypoint as completed upon parcel drop-off."""
    if plan_id not in COMPLETED_STOPS_MAP:
        COMPLETED_STOPS_MAP[plan_id] = []
    if stop_idx not in COMPLETED_STOPS_MAP[plan_id]:
        COMPLETED_STOPS_MAP[plan_id].append(stop_idx)

    audit_service.record_event(db, {
        "event": "STOP_DELIVERED",
        "plan_id": plan_id,
        "stop_index": stop_idx,
    })

    return {
        "status": "STOP_COMPLETED",
        "plan_id": plan_id,
        "completed_stops": COMPLETED_STOPS_MAP[plan_id],
    }

@router.post("/telemetry")
def submit_driver_telemetry(payload: DriverTelemetryPayload, db: Session = Depends(get_db)):
    """[Driver] Broadcasts live vehicle telemetry (GPS, battery SoC, speed) and runs geofence validation."""
    result = fleet_service.process_telemetry_tick(
        db=db,
        vehicle_id=payload.vehicle_id,
        lat=payload.lat,
        lng=payload.lng,
        speed_kmh=payload.speed_kmh,
        distance_step_km=payload.distance_step_km,
        ambient_temp_c=payload.ambient_temp_c,
        payload_kg=payload.payload_kg,
    )
    return result

@router.post("/incidents")
def report_driver_incident(payload: IncidentReportPayload, db: Session = Depends(get_db)):
    """[Driver] Reports on-road exceptions (traffic jam, customer absent, vehicle fault)."""
    incident_entry = {
        "id": len(INCIDENT_REPORTS) + 1,
        "vehicle_id": payload.vehicle_id,
        "type": payload.incident_type,
        "description": payload.description,
        "lat": payload.lat,
        "lng": payload.lng,
        "timestamp": time.time(),
    }
    INCIDENT_REPORTS.append(incident_entry)

    audit_service.record_event(db, {
        "event": "INCIDENT_REPORTED",
        **incident_entry,
    })

    return {"status": "RECORDED", "incident": incident_entry}

@router.get("/incidents")
def list_driver_incidents():
    """[Driver] Lists recent on-road incident alerts."""
    return INCIDENT_REPORTS[-20:]

@router.get("/performance")
def get_driver_performance(vehicle_id: int = 1, db: Session = Depends(get_db)):
    """[Driver] Returns personal delivery score, completed stops, and eco-driving index."""
    return {
        "driver_name": "Marcus Vance",
        "assigned_vehicle": "EV-VAN-01",
        "completed_deliveries_today": 18,
        "on_time_rate": "98.5%",
        "eco_driving_score": 94,
        "co2_saved_kg": 14.8,
    }

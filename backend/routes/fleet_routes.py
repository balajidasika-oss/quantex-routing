import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Vehicle, GeofenceEvent, RoutePlan, VehicleType, VehicleStatus
from backend.services.fleet_service import fleet_service
from backend.services.telemetry_pubsub import telemetry_broadcaster
from backend.ml.demand_forecast import demand_forecaster
from backend.utils.logger import logger

router = APIRouter(prefix="/fleet", tags=["Fleet Intelligence & Telemetry"])


class VehicleCreate(BaseModel):
    code: str
    name: str
    vehicle_type: str = "ELECTRIC"
    capacity_kg: float = 1000.0
    current_lat: float = 37.7749
    current_lng: float = -122.4194


class TelemetryUpdate(BaseModel):
    vehicle_id: int
    lat: float
    lng: float
    speed_kmh: float = 40.0
    distance_step_km: float = 1.5
    ambient_temp_c: float = 22.0
    payload_kg: float = 250.0


def seed_demo_vehicles_if_needed(db: Session):
    """Seeds realistic commercial delivery vehicles if the fleet table is empty."""
    if db.query(Vehicle).count() == 0:
        demo_vehicles = [
            Vehicle(
                code="EV-VAN-01",
                name="Quantum Volt Van #1",
                vehicle_type="ELECTRIC",
                capacity_kg=1200.0,
                current_soc=88.5,
                battery_degradation=1.2,
                current_lat=37.7749,
                current_lng=-122.4194,
                speed_kmh=42.0,
                status=VehicleStatus.EN_ROUTE,
            ),
            Vehicle(
                code="EV-VAN-02",
                name="Quantum Volt Van #2",
                vehicle_type="ELECTRIC",
                capacity_kg=1200.0,
                current_soc=74.0,
                battery_degradation=2.8,
                current_lat=37.7833,
                current_lng=-122.4167,
                speed_kmh=35.0,
                status=VehicleStatus.EN_ROUTE,
            ),
            Vehicle(
                code="HYB-SPRINT-03",
                name="Eco-Hybrid Cargo #3",
                vehicle_type="HYBRID",
                capacity_kg=1500.0,
                current_soc=95.0,
                battery_degradation=0.5,
                current_lat=37.7600,
                current_lng=-122.4300,
                speed_kmh=48.0,
                status=VehicleStatus.IDLE,
            ),
            Vehicle(
                code="DSL-HEAVY-04",
                name="Titan Diesel Freight #4",
                vehicle_type="DIESEL",
                capacity_kg=2500.0,
                current_soc=100.0,
                battery_degradation=0.0,
                current_lat=37.7500,
                current_lng=-122.4100,
                speed_kmh=0.0,
                status=VehicleStatus.IDLE,
            ),
        ]
        db.add_all(demo_vehicles)
        db.commit()


@router.get("/vehicles", response_model=List[Dict[str, Any]])
def list_vehicles(db: Session = Depends(get_db)):
    """Retrieves all fleet vehicles with real-time battery and location telemetry."""
    vehicles = db.query(Vehicle).all()
    results = []
    for v in vehicles:
        results.append({
            "id": v.id,
            "code": v.code,
            "name": v.name,
            "vehicle_type": v.vehicle_type,
            "capacity_kg": v.capacity_kg,
            "current_soc": v.current_soc,
            "battery_degradation": v.battery_degradation,
            "current_lat": v.current_lat,
            "current_lng": v.current_lng,
            "speed_kmh": v.speed_kmh,
            "status": v.status,
        })
    return results


@router.post("/vehicles", status_code=status.HTTP_201_CREATED)
def create_vehicle(payload: VehicleCreate, db: Session = Depends(get_db)):
    """Registers a new vehicle in the fleet."""
    existing = db.query(Vehicle).filter(Vehicle.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Vehicle code already exists.")

    vehicle = Vehicle(
        code=payload.code,
        name=payload.name,
        vehicle_type=payload.vehicle_type.upper(),
        capacity_kg=payload.capacity_kg,
        current_lat=payload.current_lat,
        current_lng=payload.current_lng,
    )
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return {"status": "CREATED", "vehicle_id": vehicle.id, "code": vehicle.code}


@router.post("/telemetry", response_model=Dict[str, Any])
async def update_telemetry(payload: TelemetryUpdate, db: Session = Depends(get_db)):
    """
    Ingests live telemetry from vehicle:
    1. Updates GPS position and speed.
    2. Simulates EV battery discharge and degradation physics step.
    3. Checks dynamic corridor geofence deviation against active route.
    4. Emits geofence alert if deviation exceeds threshold.
    5. Streams live update over Redis and WebSockets.
    """
    vehicle = db.query(Vehicle).filter(Vehicle.id == payload.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Update physical location
    vehicle.current_lat = payload.lat
    vehicle.current_lng = payload.lng
    vehicle.speed_kmh = payload.speed_kmh

    # EV Battery Step simulation
    battery_update = {}
    if vehicle.vehicle_type == "ELECTRIC":
        battery_step = fleet_service.simulate_telemetry_step(
            current_soc=vehicle.current_soc,
            current_degradation=vehicle.battery_degradation,
            distance_km=payload.distance_step_km,
            speed_kmh=payload.speed_kmh,
            payload_kg=payload.payload_kg,
            ambient_temp_c=payload.ambient_temp_c,
        )
        vehicle.current_soc = battery_step["new_soc"]
        vehicle.battery_degradation = battery_step["battery_degradation_pct"]
        battery_update = battery_step

    # Check active route corridor geofence
    active_plan = db.query(RoutePlan).filter(
        RoutePlan.vehicle_id == vehicle.id,
        RoutePlan.status == "DISPATCHED",
    ).first()

    geofence_result = {"in_corridor": True, "deviation_meters": 0.0, "severity": "NORMAL", "alert_triggered": False}
    if active_plan and active_plan.polyline_json:
        try:
            polyline = json.loads(active_plan.polyline_json)
            geofence_result = fleet_service.check_corridor_deviation(payload.lat, payload.lng, polyline)

            if geofence_result["alert_triggered"]:
                event = GeofenceEvent(
                    vehicle_id=vehicle.id,
                    route_id=active_plan.id,
                    deviation_distance_meters=geofence_result["deviation_meters"],
                    location_lat=payload.lat,
                    location_lng=payload.lng,
                    severity=geofence_result["severity"],
                )
                db.add(event)
                # Broadcast geofence alert
                await telemetry_broadcaster.publish_geofence_alert({
                    "vehicle_code": vehicle.code,
                    "plan_code": active_plan.plan_code,
                    "deviation_meters": geofence_result["deviation_meters"],
                    "severity": geofence_result["severity"],
                    "lat": payload.lat,
                    "lng": payload.lng,
                })
        except Exception as e:
            logger.error(f"Geofence check error: {e}")

    db.commit()

    # Broadcast live telemetry packet
    telemetry_packet = {
        "vehicle_id": vehicle.id,
        "code": vehicle.code,
        "lat": payload.lat,
        "lng": payload.lng,
        "speed_kmh": payload.speed_kmh,
        "soc": vehicle.current_soc,
        "degradation": vehicle.battery_degradation,
        "status": vehicle.status,
        "geofence": geofence_result,
        "battery_details": battery_update,
    }
    await telemetry_broadcaster.publish_telemetry(vehicle.id, telemetry_packet)

    return telemetry_packet


@router.get("/alerts", response_model=List[Dict[str, Any]])
def list_geofence_alerts(limit: int = 25, db: Session = Depends(get_db)):
    """Retrieves recent geofence deviation events."""
    alerts = db.query(GeofenceEvent).order_by(GeofenceEvent.timestamp.desc()).limit(limit).all()
    results = []
    for a in alerts:
        results.append({
            "id": a.id,
            "vehicle_id": a.vehicle_id,
            "vehicle_code": a.vehicle.code if a.vehicle else "UNKNOWN",
            "deviation_meters": a.deviation_distance_meters,
            "severity": a.severity,
            "lat": a.location_lat,
            "lng": a.location_lng,
            "acknowledged": a.acknowledged,
            "timestamp": a.timestamp.isoformat() if a.timestamp else None,
        })
    return results


@router.post("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    """Marks a geofence deviation alert as acknowledged by dispatcher."""
    alert = db.query(GeofenceEvent).filter(GeofenceEvent.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = True
    db.commit()
    return {"status": "ACKNOWLEDGED", "alert_id": alert_id}


@router.get("/forecast", response_model=Dict[str, Any])
def get_demand_forecast(
    hour: int = 10,
    day_of_week: int = 2,
    zone_density: float = 3.5,
    rain_mm: float = 0.0,
):
    """Predicts parcel delivery volume for the specified time and zone."""
    return demand_forecaster.forecast_zone_demand(
        hour=hour,
        day_of_week=day_of_week,
        zone_density=zone_density,
        rain_mm=rain_mm,
    )

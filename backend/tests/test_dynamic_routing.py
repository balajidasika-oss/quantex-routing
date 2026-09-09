import pytest
import json
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.traffic_service import traffic_service, IncidentSeverity, IncidentType
from backend.services.telemetry_pubsub import telemetry_broadcaster

client = TestClient(app)


def test_traffic_service_severity_multipliers():
    """Verify incident severity scaling."""
    assert traffic_service.get_severity_multiplier(IncidentSeverity.MINOR) == 1.30
    assert traffic_service.get_severity_multiplier(IncidentSeverity.MAJOR) == 1.85
    assert traffic_service.get_severity_multiplier(IncidentSeverity.CRITICAL) == 3.50


def test_vehicle_specific_penalties():
    """Verify EV low battery penalty vs Diesel emissions penalty."""
    # EV with low battery (<20%) gets severe penalty
    ev_low_soc_penalty = traffic_service.compute_vehicle_penalty("ELECTRIC", current_soc=15.0)
    assert ev_low_soc_penalty > 1.6

    # EV with high battery (>50%) gets normal factor
    ev_normal_penalty = traffic_service.compute_vehicle_penalty("ELECTRIC", current_soc=85.0)
    assert ev_normal_penalty == 1.0

    # Diesel penalty for emissions
    diesel_penalty = traffic_service.compute_vehicle_penalty("DIESEL")
    assert diesel_penalty == 1.25


def test_live_zones_and_simulate_incident():
    """Test incident simulation and active zones list."""
    res = client.get("/api/traffic/live-zones")
    assert res.status_code == 200
    data = res.json()
    assert "zones" in data
    initial_count = data["count"]

    # Ingest a major incident
    payload = {
        "name": "Bay Bridge Bottleneck",
        "incident_type": "ACCIDENT",
        "severity": "CRITICAL",
        "lat": 37.798,
        "lng": -122.378,
        "radius_meters": 900.0,
        "description": "Multi-car collision blocking 3 lanes",
    }
    sim_res = client.post("/api/traffic/simulate-incident", json=payload)
    assert sim_res.status_code == 200
    sim_data = sim_res.json()
    assert sim_data["status"] == "INCIDENT_INJECTED"
    assert sim_data["incident"]["severity"] == "CRITICAL"
    assert sim_data["incident"]["delay_multiplier"] == 3.5

    # Check updated live zones
    res2 = client.get("/api/traffic/live-zones")
    assert res2.status_code == 200
    assert res2.json()["count"] == initial_count + 1


def test_traffic_history_logging():
    """Test historical congestion event retrieval for analytics and replay."""
    res = client.get("/api/traffic/history?limit=10")
    assert res.status_code == 200
    data = res.json()
    assert "history" in data
    assert len(data["history"]) >= 1


def test_evaluate_route_congestion():
    """Test route congestion evaluation against threshold."""
    stops = [
        {"name": "Central Depot", "lat": 37.7749, "lng": -122.4194, "demand_kg": 0.0},
        {"name": "Financial District", "lat": 37.7891, "lng": -122.4014, "demand_kg": 25.0},
        {"name": "Mission District", "lat": 37.7599, "lng": -122.4148, "demand_kg": 22.0},
    ]
    res = client.post("/api/traffic/evaluate-route", json={
        "stops": stops,
        "vehicle_type": "ELECTRIC",
        "current_soc": 75.0,
    })
    assert res.status_code == 200
    data = res.json()
    assert "route_congestion_factor" in data
    assert "reoptimization_recommended" in data


def test_trigger_dynamic_reoptimization():
    """Test dynamic quantum reoptimization trigger and polyline generation."""
    stops = [
        {"name": "Depot", "lat": 37.7749, "lng": -122.4194, "demand_kg": 0.0},
        {"name": "Stop 1", "lat": 37.7891, "lng": -122.4014, "demand_kg": 20.0},
        {"name": "Stop 2", "lat": 37.7785, "lng": -122.3980, "demand_kg": 15.0},
        {"name": "Depot", "lat": 37.7749, "lng": -122.4194, "demand_kg": 0.0},
    ]
    res = client.post("/api/traffic/trigger-reoptimization", json={
        "stops": stops,
        "vehicle_type": "ELECTRIC",
        "solver_type": "quantum",
        "p_depth": 2,
        "force_override": True,
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "REOPTIMIZATION_COMPLETED"
    assert "ordered_stops" in data
    assert "polyline" in data
    assert "time_saved_minutes" in data
    assert len(data["polyline"]) > 0


def test_manual_dispatcher_reroute():
    """Test dispatcher manual route bypass override."""
    # First create a plan in DB via optimize endpoint
    opt_res = client.post("/api/optimize", json={
        "locations": [
            {"name": "Depot", "lat": 37.7749, "lng": -122.4194, "demand_kg": 0.0},
            {"name": "Stop A", "lat": 37.7955, "lng": -122.3937, "demand_kg": 15.0},
            {"name": "Stop B", "lat": 37.7600, "lng": -122.4200, "demand_kg": 20.0},
        ],
        "solver_type": "classical",
        "algorithm": "TWO_OPT",
    })
    assert opt_res.status_code == 200
    plan_id = opt_res.json()["id"]

    # Dispatcher forces manual reroute
    res = client.post("/api/traffic/manual-reroute", json={
        "plan_id": plan_id,
        "override_reason": "Severe storm detour",
        "vehicle_type": "ELECTRIC",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "MANUAL_REROUTE_SUCCESS"
    assert len(data["polyline"]) > 0


def test_driver_reroute_acknowledgement():
    """Test driver acknowledgement flow notifying dispatcher."""
    res = client.post("/api/traffic/acknowledge-reroute", json={
        "plan_id": 1,
        "vehicle_id": 1,
        "driver_name": "Marcus Vance",
        "notes": "Detour confirmed and synced",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ACKNOWLEDGED"
    assert data["ack_data"]["status"] == "CONFIRMED_BY_DRIVER"


def test_threshold_settings_get_and_update():
    """Test reading and adjusting dynamic rerouting sensitivity."""
    res = client.get("/api/traffic/threshold-settings")
    assert res.status_code == 200
    initial_threshold = res.json()["congestion_threshold_multiplier"]

    update_res = client.post("/api/traffic/threshold-settings", json={
        "congestion_threshold_multiplier": 1.45,
        "auto_reroute_enabled": True,
    })
    assert update_res.status_code == 200
    assert update_res.json()["congestion_threshold_multiplier"] == 1.45


def test_stress_multiple_concurrent_incidents():
    """Stress test creating multiple concurrent incidents across urban sectors."""
    for idx in range(5):
        payload = {
            "name": f"Incident Zone {idx}",
            "incident_type": "CONSTRUCTION" if idx % 2 == 0 else "ACCIDENT",
            "severity": "MAJOR",
            "lat": 37.770 + (idx * 0.005),
            "lng": -122.410 - (idx * 0.004),
            "radius_meters": 500.0 + (idx * 50),
        }
        r = client.post("/api/traffic/simulate-incident", json=payload)
        assert r.status_code == 200
        assert r.json()["status"] == "INCIDENT_INJECTED"

    zones_res = client.get("/api/traffic/live-zones")
    assert zones_res.status_code == 200
    assert zones_res.json()["count"] >= 5

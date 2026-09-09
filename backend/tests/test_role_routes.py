from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_admin_endpoints():
    # 1. List users
    res = client.get("/api/admin/users")
    assert res.status_code == 200
    users = res.json()
    assert len(users) >= 3

    # 2. Solver settings
    res = client.get("/api/admin/solver-settings")
    assert res.status_code == 200
    assert "default_solver" in res.json()

    # 3. Audit verification
    res = client.get("/api/admin/audit/verify")
    assert res.status_code == 200
    assert res.json()["verified"] is True

    # 4. Compliance report
    res = client.get("/api/admin/compliance-report")
    assert res.status_code == 200
    assert res.json()["governance_status"] == "COMPLIANT"

def test_dispatcher_endpoints():
    # 1. Fleet overview
    res = client.get("/api/dispatcher/fleet-overview")
    assert res.status_code == 200
    assert "vehicles" in res.json()

    # 2. Operational summary
    res = client.get("/api/dispatcher/operational-summary")
    assert res.status_code == 200
    assert "fleet_efficiency_score" in res.json()

def test_driver_endpoints():
    # 1. Assigned route
    res = client.get("/api/driver/assigned-route?vehicle_id=1")
    assert res.status_code == 200

    # 2. Performance metrics
    res = client.get("/api/driver/performance?vehicle_id=1")
    assert res.status_code == 200
    assert "eco_driving_score" in res.json()

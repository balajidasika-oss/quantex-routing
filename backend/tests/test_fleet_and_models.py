import pytest
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import AuditBlock, User, Vehicle, RoutePlan
from backend.services.fleet_service import fleet_service
from backend.services.report_service import report_service, CryptographicAuditService


@pytest.fixture
def in_memory_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()


def test_geofence_point_to_segment_distance():
    """Verifies perpendicular distance projection in meters."""
    # Horizontal line from (37.7749, -122.42) to (37.7749, -122.40)
    lat1, lng1 = 37.7749, -122.4200
    lat2, lng2 = 37.7749, -122.4000

    # Point directly on the segment
    dist_on = fleet_service.point_to_segment_distance_meters(37.7749, -122.4100, lat1, lng1, lat2, lng2)
    assert dist_on < 1.0  # within 1 meter

    # Point 0.001 degrees North (~111 meters away)
    dist_off = fleet_service.point_to_segment_distance_meters(37.7759, -122.4100, lat1, lng1, lat2, lng2)
    assert 100.0 < dist_off < 125.0


def test_corridor_deviation_alerts():
    """Tests corridor deviation severity classification (NORMAL, WARNING, CRITICAL)."""
    polyline = [
        {"lat": 37.7700, "lng": -122.4100},
        {"lat": 37.7800, "lng": -122.4100},
        {"lat": 37.7900, "lng": -122.4100},
    ]

    # Inside corridor: ~30 meters off
    normal_res = fleet_service.check_corridor_deviation(37.7750, -122.4103, polyline)
    assert normal_res["severity"] == "NORMAL"
    assert normal_res["alert_triggered"] is False

    # Warning deviation: ~200 meters off (0.002 deg lng at lat 37 is ~175m)
    warning_res = fleet_service.check_corridor_deviation(37.7750, -122.4125, polyline)
    assert warning_res["severity"] in ("WARNING", "CRITICAL")
    assert warning_res["alert_triggered"] is True

    # Critical deviation: ~500 meters off
    crit_res = fleet_service.check_corridor_deviation(37.7750, -122.4160, polyline)
    assert crit_res["severity"] == "CRITICAL"
    assert crit_res["alert_triggered"] is True


def test_ev_battery_discharge_and_degradation():
    """Tests battery discharge physics and capacity fade modeling."""
    initial_soc = 90.0
    initial_deg = 1.0

    step = fleet_service.simulate_telemetry_step(
        current_soc=initial_soc,
        current_degradation=initial_deg,
        distance_km=10.0,
        speed_kmh=45.0,
        payload_kg=300.0,
        ambient_temp_c=22.0,
    )

    # SoC must drop
    assert step["new_soc"] < initial_soc
    assert step["energy_consumed_kwh"] > 0.0
    # Degradation must increase or stay non-negative
    assert step["battery_degradation_pct"] >= initial_deg
    assert step["state_of_health_pct"] <= 99.0


def test_cryptographic_audit_blockchain(in_memory_db):
    """Tests SHA-256 chained audit logs and tampering detection."""
    # 1. Record 3 blocks
    b0 = report_service.record_audit_block(in_memory_db, {"event": "GENESIS", "value": 100})
    b1 = report_service.record_audit_block(in_memory_db, {"event": "DISPATCH_ROUTE", "plan": "P-1"})
    b2 = report_service.record_audit_block(in_memory_db, {"event": "DELIVERY_COMPLETE", "order": "O-99"})

    assert b0.block_index == 0
    assert b1.block_index == 1
    assert b2.block_index == 2

    # Verify link: b1.prev_hash == b0.block_hash
    assert b1.prev_hash == b0.block_hash
    assert b2.prev_hash == b1.block_hash

    # Chain verification should succeed
    verify_res = report_service.verify_audit_chain(in_memory_db)
    assert verify_res["valid"] is True
    assert verify_res["chain_length"] == 3

    # Tamper with block 1 payload
    b1.payload_json = json.dumps({"event": "ILLEGAL_MUTATION", "stolen_data": True})
    in_memory_db.commit()

    # Chain verification must now detect tampering
    tampered_res = report_service.verify_audit_chain(in_memory_db)
    assert tampered_res["valid"] is False
    assert tampered_res["tampered_index"] == 1
    assert tampered_res["status"] == "TAMPERED_PAYLOAD"

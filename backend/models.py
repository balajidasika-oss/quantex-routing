import json
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    Enum as SQLEnum,
)
from sqlalchemy.orm import relationship

from backend.database import Base
from backend.auth.user_model import UserRole


class VehicleType(str):
    DIESEL = "DIESEL"
    ELECTRIC = "ELECTRIC"
    HYBRID = "HYBRID"


class VehicleStatus(str):
    IDLE = "IDLE"
    EN_ROUTE = "EN_ROUTE"
    CHARGING = "CHARGING"
    MAINTENANCE = "MAINTENANCE"


class OrderStatus(str):
    PENDING = "PENDING"
    ASSIGNED = "ASSIGNED"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"


class RoutePlanStatus(str):
    OPTIMIZED = "OPTIMIZED"
    DISPATCHED = "DISPATCHED"
    COMPLETED = "COMPLETED"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default=UserRole.DISPATCHER.value, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    route_plans = relationship("RoutePlan", back_populates="driver")


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    vehicle_type = Column(String(20), default=VehicleType.ELECTRIC, nullable=False)
    capacity_kg = Column(Float, default=1000.0)
    current_soc = Column(Float, default=100.0)  # 0.0 - 100.0%
    battery_degradation = Column(Float, default=0.0)  # 0.0 - 100.0%
    current_lat = Column(Float, nullable=True)
    current_lng = Column(Float, nullable=True)
    speed_kmh = Column(Float, default=0.0)
    status = Column(String(20), default=VehicleStatus.IDLE)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    route_plans = relationship("RoutePlan", back_populates="vehicle")
    geofence_events = relationship("GeofenceEvent", back_populates="vehicle")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    tracking_number = Column(String(60), unique=True, index=True, nullable=False)
    customer_name = Column(String(100), nullable=False)
    address = Column(String(255), nullable=False)
    destination_lat = Column(Float, nullable=False)
    destination_lng = Column(Float, nullable=False)
    weight_kg = Column(Float, default=10.0)
    time_window_start = Column(String(10), default="09:00")
    time_window_end = Column(String(10), default="17:00")
    status = Column(String(20), default=OrderStatus.PENDING)
    priority = Column(Integer, default=1)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class RoutePlan(Base):
    __tablename__ = "route_plans"

    id = Column(Integer, primary_key=True, index=True)
    plan_code = Column(String(60), unique=True, index=True, nullable=False)
    solver_type = Column(String(50), nullable=False)  # QAOA, SIMULATED_QUANTUM_ANNEALING, TABU_SEARCH, etc.
    parameters_json = Column(Text, default="{}")
    total_distance_km = Column(Float, default=0.0)
    total_co2_kg = Column(Float, default=0.0)
    execution_time_ms = Column(Float, default=0.0)
    stops_json = Column(Text, default="[]")        # Ordered sequence of stops
    polyline_json = Column(Text, default="[]")     # Interpolated lat/lng path
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default=RoutePlanStatus.OPTIMIZED)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    vehicle = relationship("Vehicle", back_populates="route_plans")
    driver = relationship("User", back_populates="route_plans")
    geofence_events = relationship("GeofenceEvent", back_populates="route_plan")


class GeofenceEvent(Base):
    __tablename__ = "geofence_events"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=False)
    route_id = Column(Integer, ForeignKey("route_plans.id"), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    deviation_distance_meters = Column(Float, nullable=False)
    location_lat = Column(Float, nullable=False)
    location_lng = Column(Float, nullable=False)
    severity = Column(String(20), default="WARNING")  # WARNING, CRITICAL
    acknowledged = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    vehicle = relationship("Vehicle", back_populates="geofence_events")
    route_plan = relationship("RoutePlan", back_populates="geofence_events")


class AuditBlock(Base):
    __tablename__ = "audit_blocks"

    id = Column(Integer, primary_key=True, index=True)
    block_index = Column(Integer, unique=True, index=True, nullable=False)
    timestamp = Column(String(40), nullable=False)
    prev_hash = Column(String(64), nullable=False)
    block_hash = Column(String(64), nullable=False, unique=True)
    payload_json = Column(Text, nullable=False)
    signature = Column(String(128), default="QUANTUM_CHAIN_SHA256_VERIFIED")
    is_verified = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

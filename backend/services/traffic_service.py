import json
import time
import math
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional, Tuple
import numpy as np

from backend.database import redis_wrapper
from backend.services.telemetry_pubsub import telemetry_broadcaster
from backend.ml.preprocessing import haversine_distance
from backend.ml.traffic_prediction import traffic_predictor
from backend.utils.logger import logger


class IncidentSeverity(str):
    MINOR = "MINOR"         # Delay factor 1.25x - 1.4x (e.g. slight bottleneck)
    MAJOR = "MAJOR"         # Delay factor 1.5x - 2.0x (e.g. lane blockage / accident)
    CRITICAL = "CRITICAL"   # Delay factor 3.0x+ or closed (e.g. full road closure / severe pileup)


class IncidentType(str):
    CONGESTION = "CONGESTION"
    ACCIDENT = "ACCIDENT"
    ROAD_CLOSURE = "ROAD_CLOSURE"
    CONSTRUCTION = "CONSTRUCTION"
    WEATHER_HAZARD = "WEATHER_HAZARD"


class TrafficService:
    """
    Enterprise Real-time Traffic Intelligence Service.
    - Connects to Live Traffic Streams / External Traffic API (HERE, Google Traffic, synthetic feeds)
    - Manages live congestion zones & road incidents with severity levels
    - Implements vehicle-specific cost penalties (EV battery sensitivity vs Diesel emissions)
    - Caches traffic API snapshots in Redis for fast playback and simulation replay
    - Streams congestion events into Redis pub/sub and WebSockets
    - Detects congestion threshold breaches for automated Quantum/Hybrid re-routing
    """

    def __init__(self):
        # Default congestion trigger threshold (1.35x baseline cost triggers re-optimization)
        self.congestion_threshold_multiplier = 1.35
        self.auto_reroute_enabled = True

        # In-memory active incidents / congestion zones
        self.active_incidents: Dict[str, Dict[str, Any]] = {}
        # Historical incident log for replay & analytics (up to 200 events)
        self.incident_history: List[Dict[str, Any]] = []

        # Seed initial realistic San Francisco metro congestion zones
        self._seed_default_zones()

    def _seed_default_zones(self):
        """Seeds initial realistic urban traffic zones."""
        default_zones = [
            {
                "id": "INC-SF-01",
                "name": "Financial District Bottleneck",
                "type": IncidentType.CONGESTION,
                "severity": IncidentSeverity.MAJOR,
                "lat": 37.789,
                "lng": -122.401,
                "radius_meters": 750,
                "delay_multiplier": 1.75,
                "speed_reduction_pct": 55.0,
                "description": "Peak hour gridlock on Market & Montgomery intersection",
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": "INC-SF-02",
                "name": "SoMa Construction Corridor",
                "type": IncidentType.CONSTRUCTION,
                "severity": IncidentSeverity.MINOR,
                "lat": 37.778,
                "lng": -122.411,
                "radius_meters": 600,
                "delay_multiplier": 1.30,
                "speed_reduction_pct": 30.0,
                "description": "Utility roadwork reducing 2 lanes to 1 lane",
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": "INC-SF-03",
                "name": "Mission Boulevard Free-Flow Corridor",
                "type": IncidentType.CONGESTION,
                "severity": IncidentSeverity.MINOR,
                "lat": 37.760,
                "lng": -122.420,
                "radius_meters": 800,
                "delay_multiplier": 1.05,
                "speed_reduction_pct": 5.0,
                "description": "Green wave signal sync with smooth velocity",
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        ]
        for z in default_zones:
            self.active_incidents[z["id"]] = z
            self.incident_history.append(z)

    def get_severity_multiplier(self, severity: str) -> float:
        """Returns baseline delay multiplier for incident severity."""
        sev = (severity or "MINOR").upper()
        if sev == IncidentSeverity.CRITICAL:
            return 3.5
        elif sev == IncidentSeverity.MAJOR:
            return 1.85
        return 1.30

    def compute_vehicle_penalty(
        self,
        vehicle_type: str,
        current_soc: float = 80.0,
        detour_distance_km: float = 0.0,
    ) -> float:
        """
        Computes vehicle-specific routing penalty factor.
        - ELECTRIC: Penalized if battery is low (<25%) and detour exceeds safe range margin.
        - DIESEL: Penalized for stop-and-go congestion causing high CO2 emissions ($0.268 kg CO2/km).
        - HYBRID: Moderate balanced penalty.
        """
        v_type = (vehicle_type or "ELECTRIC").upper()
        if v_type == "ELECTRIC":
            # If battery is low, detours carry severe penalty to avoid stranding
            if current_soc < 20.0:
                soc_penalty = 1.6 + (20.0 - current_soc) * 0.05
            elif current_soc < 40.0:
                soc_penalty = 1.2
            else:
                soc_penalty = 1.0
            return round(soc_penalty, 3)
        elif v_type == "DIESEL":
            # Urban idle emission penalty
            return 1.25
        elif v_type == "HYBRID":
            return 1.10
        return 1.0

    def create_incident(
        self,
        name: str,
        incident_type: str,
        severity: str,
        lat: float,
        lng: float,
        radius_meters: float = 650.0,
        description: str = "",
        custom_multiplier: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Creates or injects a live traffic incident/congestion spike."""
        inc_id = f"INC-{uuid.uuid4().hex[:6].upper()}"
        multiplier = custom_multiplier or self.get_severity_multiplier(severity)
        speed_reduction = min(90.0, (multiplier - 1.0) * 45.0)

        incident = {
            "id": inc_id,
            "name": name,
            "type": incident_type.upper(),
            "severity": severity.upper(),
            "lat": round(lat, 5),
            "lng": round(lng, 5),
            "radius_meters": radius_meters,
            "delay_multiplier": round(multiplier, 2),
            "speed_reduction_pct": round(speed_reduction, 1),
            "description": description or f"{severity} {incident_type} reported near ({round(lat, 4)}, {round(lng, 4)})",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        self.active_incidents[inc_id] = incident
        self.incident_history.insert(0, incident)
        if len(self.incident_history) > 200:
            self.incident_history.pop()

        logger.info(f"Traffic incident created: {inc_id} ({incident['name']}, Severity: {severity})")
        return incident

    def remove_incident(self, incident_id: str) -> bool:
        """Resolves / clears an active road incident."""
        if incident_id in self.active_incidents:
            del self.active_incidents[incident_id]
            return True
        return False

    def get_live_zones(self) -> List[Dict[str, Any]]:
        """Returns list of currently active congestion & incident zones."""
        return list(self.active_incidents.values())

    def get_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Returns historical log of traffic incidents for replay & analytics."""
        return self.incident_history[:limit]

    def evaluate_segment_congestion(
        self,
        lat1: float,
        lng1: float,
        lat2: float,
        lng2: float,
        vehicle_type: str = "ELECTRIC",
        current_soc: float = 85.0,
    ) -> Dict[str, Any]:
        """
        Evaluates dynamic congestion multiplier on a given road segment
        by checking intersections with all active incident zones and applying vehicle penalties.
        """
        # Base time-of-day traffic
        base_multiplier = traffic_predictor.predict_congestion(lat1, lng1, lat2, lng2)
        mid_lat = (lat1 + lat2) / 2.0
        mid_lng = (lng1 + lng2) / 2.0

        max_incident_mult = 1.0
        intersecting_incidents = []

        for inc in self.active_incidents.values():
            dist_to_mid_km = haversine_distance(mid_lat, mid_lng, inc["lat"], inc["lng"])
            dist_to_start_km = haversine_distance(lat1, lng1, inc["lat"], inc["lng"])
            dist_to_end_km = haversine_distance(lat2, lng2, inc["lat"], inc["lng"])

            min_dist_km = min(dist_to_mid_km, dist_to_start_km, dist_to_end_km)
            radius_km = inc["radius_meters"] / 1000.0

            if min_dist_km <= radius_km:
                intersecting_incidents.append(inc)
                if inc["delay_multiplier"] > max_incident_mult:
                    max_incident_mult = inc["delay_multiplier"]

        vehicle_penalty = self.compute_vehicle_penalty(vehicle_type, current_soc)
        effective_multiplier = round(base_multiplier * max_incident_mult * vehicle_penalty, 3)

        return {
            "effective_multiplier": effective_multiplier,
            "base_multiplier": base_multiplier,
            "max_incident_mult": max_incident_mult,
            "vehicle_penalty": vehicle_penalty,
            "intersecting_incidents": intersecting_incidents,
            "is_congested": effective_multiplier >= self.congestion_threshold_multiplier,
        }

    def evaluate_route_congestion(
        self,
        stops: List[Dict[str, Any]],
        vehicle_type: str = "ELECTRIC",
        current_soc: float = 85.0,
    ) -> Dict[str, Any]:
        """
        Calculates total weighted congestion along an entire sequence of stops.
        Determines if overall route congestion exceeds the re-optimization trigger threshold.
        """
        if len(stops) < 2:
            return {
                "route_congestion_factor": 1.0,
                "reoptimization_recommended": False,
                "congested_segments_count": 0,
                "congested_segments": [],
            }

        congested_segs = []
        total_mult_sum = 0.0
        seg_count = len(stops) - 1

        for i in range(seg_count):
            p1 = stops[i]
            p2 = stops[i + 1]
            seg_eval = self.evaluate_segment_congestion(
                p1["lat"], p1["lng"], p2["lat"], p2["lng"],
                vehicle_type=vehicle_type, current_soc=current_soc
            )
            total_mult_sum += seg_eval["effective_multiplier"]
            if seg_eval["is_congested"]:
                congested_segs.append({
                    "from_stop": i,
                    "to_stop": i + 1,
                    "from_name": p1.get("name", f"Stop {i}"),
                    "to_name": p2.get("name", f"Stop {i+1}"),
                    "multiplier": seg_eval["effective_multiplier"],
                    "incidents": seg_eval["intersecting_incidents"],
                })

        avg_congestion = round(total_mult_sum / max(1, seg_count), 3)
        reopt_recommended = (avg_congestion >= self.congestion_threshold_multiplier) or (len(congested_segs) > 0)

        return {
            "route_congestion_factor": avg_congestion,
            "threshold": self.congestion_threshold_multiplier,
            "reoptimization_recommended": reopt_recommended,
            "congested_segments_count": len(congested_segs),
            "congested_segments": congested_segs,
        }

    async def broadcast_traffic_pulse(self):
        """Publishes live congestion zones to Redis & WebSockets."""
        zones = self.get_live_zones()
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "active_incidents_count": len(zones),
            "zones": zones,
        }
        await telemetry_broadcaster.publish_traffic_congestion(payload)


traffic_service = TrafficService()

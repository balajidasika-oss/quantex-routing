import math
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timezone

from backend.utils.constants import (
    EV_SPECS,
    GEOFENCE_CORRIDOR_WIDTH_METERS,
    GEOFENCE_WARNING_METERS,
    GEOFENCE_CRITICAL_METERS,
)
from backend.ml.preprocessing import haversine_distance


class FleetIntelligenceService:
    """Provides corridor geofence deviation detection and EV battery discharge/degradation physics."""

    def __init__(self):
        self.specs = EV_SPECS

    # -----------------------------------------------------------------
    # Dynamic Corridor Geofencing
    # -----------------------------------------------------------------
    def point_to_segment_distance_meters(
        self,
        lat: float,
        lng: float,
        lat1: float,
        lng1: float,
        lat2: float,
        lng2: float,
    ) -> float:
        """
        Calculates the minimum distance in meters from a point (lat, lng) to
        a line segment between (lat1, lng1) and (lat2, lng2).
        """
        # Convert degrees to local meters around (lat, lng)
        # 1 deg lat ~ 111,139 m, 1 deg lng ~ 111,139 * cos(lat) m
        mean_lat_rad = math.radians((lat1 + lat2) / 2.0)
        m_per_deg_lat = 111139.0
        m_per_deg_lng = 111139.0 * max(0.1, math.cos(mean_lat_rad))

        px = (lng - lng1) * m_per_deg_lng
        py = (lat - lat1) * m_per_deg_lat

        bx = (lng2 - lng1) * m_per_deg_lng
        by = (lat2 - lat1) * m_per_deg_lat

        segment_len_sq = bx * bx + by * by

        if segment_len_sq < 1e-6:
            # Segment is a single point
            return math.hypot(px, py)

        # Projection parameter t clamped to [0, 1]
        t = max(0.0, min(1.0, (px * bx + py * by) / segment_len_sq))

        # Closest point on segment
        proj_x = t * bx
        proj_y = t * by

        return math.hypot(px - proj_x, py - proj_y)

    def check_corridor_deviation(
        self,
        vehicle_lat: float,
        vehicle_lng: float,
        polyline: List[Dict[str, float]],
    ) -> Dict[str, Any]:
        """
        Computes minimum distance from vehicle to the route corridor polyline.
        Triggers alerts if deviation exceeds safety thresholds.
        """
        if not polyline or len(polyline) < 2:
            return {
                "in_corridor": True,
                "deviation_meters": 0.0,
                "severity": "NORMAL",
                "alert_triggered": False,
            }

        min_dist_m = float("inf")
        closest_segment_idx = 0

        for i in range(len(polyline) - 1):
            p1 = polyline[i]
            p2 = polyline[i + 1]
            dist_m = self.point_to_segment_distance_meters(
                vehicle_lat, vehicle_lng,
                p1["lat"], p1["lng"],
                p2["lat"], p2["lng"],
            )
            if dist_m < min_dist_m:
                min_dist_m = dist_m
                closest_segment_idx = i

        deviation = round(min_dist_m, 1)

        if deviation > GEOFENCE_CRITICAL_METERS:
            severity = "CRITICAL"
            alert = True
        elif deviation > GEOFENCE_WARNING_METERS:
            severity = "WARNING"
            alert = True
        else:
            severity = "NORMAL"
            alert = False

        return {
            "in_corridor": not alert,
            "deviation_meters": deviation,
            "closest_segment_index": closest_segment_idx,
            "severity": severity,
            "alert_triggered": alert,
            "warning_threshold_meters": GEOFENCE_WARNING_METERS,
            "critical_threshold_meters": GEOFENCE_CRITICAL_METERS,
        }

    # -----------------------------------------------------------------
    # EV Battery Discharge & Degradation Physics Model
    # -----------------------------------------------------------------
    def calculate_energy_consumption_kwh(
        self,
        distance_km: float,
        speed_kmh: float = 40.0,
        payload_kg: float = 250.0,
        road_slope_deg: float = 0.0,
        ambient_temp_c: float = 22.0,
    ) -> Dict[str, float]:
        """
        Physical vehicle dynamics model:
        Rolling resistance + Aerodynamic drag + Grade resistance + Auxiliary load.
        """
        v_ms = max(1.0, speed_kmh / 3.6)
        total_mass = self.specs["CURB_WEIGHT_KG"] + min(payload_kg, self.specs["MAX_PAYLOAD_KG"])
        g = self.specs["GRAVITY_M_S2"]
        theta = math.radians(road_slope_deg)

        # 1. Rolling Resistance (N)
        f_roll = self.specs["ROLLING_RESISTANCE_COEFF"] * total_mass * g * math.cos(theta)

        # 2. Aerodynamic Drag (N)
        f_aero = 0.5 * self.specs["AIR_DENSITY"] * self.specs["DRAG_COEFFICIENT"] * self.specs["FRONTAL_AREA_M2"] * (v_ms ** 2)

        # 3. Gravitational Grade Force (N)
        f_grade = total_mass * g * math.sin(theta)

        total_tractive_force = f_roll + f_aero + f_grade  # Newtons

        # Travel duration (hours)
        duration_hours = distance_km / max(1.0, speed_kmh)

        # Mechanical Energy at wheels (kWh)
        # Power = Force * Velocity (Watts) -> (kW)
        if total_tractive_force >= 0:
            power_wheels_kw = (total_tractive_force * v_ms) / 1000.0
            # Powertrain electrical efficiency
            electrical_energy_kwh = (power_wheels_kw / self.specs["POWERTRAIN_EFFICIENCY"]) * duration_hours
        else:
            # Regenerative braking
            power_regen_kw = abs(total_tractive_force * v_ms) / 1000.0
            electrical_energy_kwh = -(power_regen_kw * self.specs["REGEN_BRAKING_EFFICIENCY"]) * duration_hours

        # Auxiliary loads (HVAC, lights, electronics)
        # Extra HVAC penalty if ambient temp deviates significantly from 22C
        temp_delta = abs(ambient_temp_c - self.specs["OPTIMAL_TEMP_C"])
        hvac_extra = min(2.0, temp_delta * 0.08)  # up to +2 kW in extreme cold or heat
        aux_power_kw = self.specs["AUXILIARY_POWER_KW"] + hvac_extra
        aux_energy_kwh = aux_power_kw * duration_hours

        total_energy_kwh = max(0.01, electrical_energy_kwh + aux_energy_kwh)

        return {
            "total_energy_kwh": round(total_energy_kwh, 4),
            "energy_per_km_kwh": round(total_energy_kwh / max(0.01, distance_km), 4),
            "duration_hours": round(duration_hours, 3),
            "tractive_force_n": round(total_tractive_force, 1),
            "aux_power_kw": round(aux_power_kw, 2),
        }

    def simulate_telemetry_step(
        self,
        current_soc: float,
        current_degradation: float,
        distance_km: float,
        speed_kmh: float = 40.0,
        payload_kg: float = 250.0,
        ambient_temp_c: float = 22.0,
    ) -> Dict[str, Any]:
        """
        Simulates one vehicle drive step:
        Updates SoC % and cumulative battery degradation %.
        """
        pack_capacity_kwh = self.specs["BATTERY_CAPACITY_KWH"]
        # Effective capacity taking degradation into account
        effective_capacity = pack_capacity_kwh * (1.0 - current_degradation / 100.0)

        consumption = self.calculate_energy_consumption_kwh(
            distance_km=distance_km,
            speed_kmh=speed_kmh,
            payload_kg=payload_kg,
            ambient_temp_c=ambient_temp_c,
        )
        kwh_used = consumption["total_energy_kwh"]

        # SoC drop
        soc_drop = (kwh_used / max(1.0, effective_capacity)) * 100.0
        new_soc = max(0.0, min(100.0, round(current_soc - soc_drop, 2)))

        # Degradation increments per cycle equivalent:
        # Standard Li-ion cell degrades ~20% over 2000 full equivalent cycles (0.01% per 100% throughput)
        # Accelerated by temperature extreme (> 30C or < 0C)
        temp_stress = 1.0 + max(0.0, (ambient_temp_c - 28.0) * 0.05) if ambient_temp_c > 28.0 else 1.0
        throughput_ratio = (soc_drop / 100.0)
        cycle_fade = 0.005 * throughput_ratio * temp_stress
        new_degradation = min(100.0, round(current_degradation + cycle_fade, 4))
        state_of_health = round(100.0 - new_degradation, 2)

        return {
            "previous_soc": current_soc,
            "new_soc": new_soc,
            "energy_consumed_kwh": round(kwh_used, 3),
            "battery_degradation_pct": new_degradation,
            "state_of_health_pct": state_of_health,
            "estimated_remaining_range_km": round((new_soc / 100.0) * effective_capacity / max(0.15, consumption["energy_per_km_kwh"]), 1),
        }


fleet_service = FleetIntelligenceService()

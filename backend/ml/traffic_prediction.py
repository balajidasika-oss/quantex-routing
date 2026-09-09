import math
import time
from datetime import datetime, timezone
from typing import Dict, Tuple, Optional
import numpy as np


class TrafficPredictor:
    """Predicts traffic congestion multipliers and segment speeds with an adaptive learning loop."""

    def __init__(self):
        # Learned multiplier calibration offset per segment key (e.g. "lat1_lng1->lat2_lng2")
        self.segment_offsets: Dict[str, float] = {}
        # Count of observations for moving average updates
        self.segment_counts: Dict[str, int] = {}
        # Global feedback calibration factor
        self.global_calibration_factor = 1.0

    def _get_segment_key(self, lat1: float, lng1: float, lat2: float, lng2: float) -> str:
        return f"{round(lat1, 3)},{round(lng1, 3)}->{round(lat2, 3)},{round(lng2, 3)}"

    def get_time_congestion_factor(self, dt: Optional[datetime] = None) -> float:
        """Computes diurnal traffic curve based on hour and day of week."""
        if dt is None:
            dt = datetime.now(timezone.utc)

        hour = dt.hour + dt.minute / 60.0
        is_weekend = dt.weekday() >= 5

        if is_weekend:
            # Weekend curve: mild peak around midday
            congestion = 1.0 + 0.35 * math.exp(-0.5 * ((hour - 13.0) / 3.0) ** 2)
            return round(congestion, 3)

        # Weekday: dual rush hour peaks (morning ~08:30, evening ~17:30)
        morning_rush = 0.85 * math.exp(-0.5 * ((hour - 8.5) / 1.4) ** 2)
        evening_rush = 0.95 * math.exp(-0.5 * ((hour - 17.5) / 1.6) ** 2)
        midday_base = 0.20 * math.exp(-0.5 * ((hour - 13.0) / 2.5) ** 2)

        base_multiplier = 1.0 + morning_rush + evening_rush + midday_base
        return round(base_multiplier, 3)

    def predict_congestion(
        self,
        lat1: float,
        lng1: float,
        lat2: float,
        lng2: float,
        dt: Optional[datetime] = None,
        weather_rain_mm: float = 0.0,
    ) -> float:
        """Returns overall congestion multiplier >= 1.0 combining time, weather, and segment history."""
        time_factor = self.get_time_congestion_factor(dt)

        # Weather factor: heavy rain increases congestion multiplier by up to 30%
        weather_factor = 1.0 + min(0.30, weather_rain_mm * 0.03)

        segment_key = self._get_segment_key(lat1, lng1, lat2, lng2)
        learned_offset = self.segment_offsets.get(segment_key, 0.0)

        total_multiplier = (time_factor * weather_factor * self.global_calibration_factor) + learned_offset
        return max(1.0, round(total_multiplier, 3))

    def predict_speed_kmh(
        self,
        lat1: float,
        lng1: float,
        lat2: float,
        lng2: float,
        free_flow_speed_kmh: float = 45.0,
        dt: Optional[datetime] = None,
    ) -> float:
        """Estimates vehicle operating speed given predicted congestion."""
        congestion = self.predict_congestion(lat1, lng1, lat2, lng2, dt=dt)
        congested_speed = free_flow_speed_kmh / congestion
        # Minimum crawl speed is 10 km/h in urban environments
        return max(10.0, round(congested_speed, 1))

    def record_actual_travel_time(
        self,
        lat1: float,
        lng1: float,
        lat2: float,
        lng2: float,
        predicted_duration_sec: float,
        actual_duration_sec: float,
    ):
        """Adaptive online feedback loop: updates segment multiplier based on actual telemetry."""
        if predicted_duration_sec <= 0 or actual_duration_sec <= 0:
            return

        ratio = actual_duration_sec / predicted_duration_sec
        segment_key = self._get_segment_key(lat1, lng1, lat2, lng2)

        current_offset = self.segment_offsets.get(segment_key, 0.0)
        n = self.segment_counts.get(segment_key, 0)

        # Exponential moving average update
        error = (ratio - 1.0) * 0.25
        updated_offset = current_offset + (error / (n + 1))

        self.segment_offsets[segment_key] = round(updated_offset, 4)
        self.segment_counts[segment_key] = n + 1

        # Global calibration adjustment
        global_error = (ratio - 1.0) * 0.05
        self.global_calibration_factor = max(0.8, min(1.6, self.global_calibration_factor + global_error))


traffic_predictor = TrafficPredictor()

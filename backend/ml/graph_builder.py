from typing import List, Dict, Any, Tuple
import numpy as np
from datetime import datetime

from backend.ml.preprocessing import haversine_distance
from backend.ml.traffic_prediction import traffic_predictor


def build_cost_matrix(
    locations: List[Dict[str, Any]],
    apply_traffic: bool = True,
    dt: datetime = None,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Builds:
    1. Distance matrix (km)
    2. Cost / travel time matrix (minutes) with traffic congestion weighting.
    locations[0] is assumed to be the Depot.
    """
    n = len(locations)
    distance_matrix = np.zeros((n, n), dtype=float)
    cost_matrix = np.zeros((n, n), dtype=float)

    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            lat1, lng1 = locations[i]["lat"], locations[i]["lng"]
            lat2, lng2 = locations[j]["lat"], locations[j]["lng"]

            dist_km = haversine_distance(lat1, lng1, lat2, lng2)
            distance_matrix[i, j] = dist_km

            if apply_traffic:
                congestion = traffic_predictor.predict_congestion(lat1, lng1, lat2, lng2, dt=dt)
                speed_kmh = traffic_predictor.predict_speed_kmh(lat1, lng1, lat2, lng2, dt=dt)
                # Duration in minutes
                travel_time_min = (dist_km / max(1.0, speed_kmh)) * 60.0
                cost = dist_km * congestion
            else:
                travel_time_min = (dist_km / 40.0) * 60.0
                cost = dist_km

            cost_matrix[i, j] = round(cost, 4)

    return distance_matrix, cost_matrix


def generate_interpolated_polyline(
    ordered_stops: List[Dict[str, Any]],
    points_per_segment: int = 15,
) -> List[Dict[str, float]]:
    """
    Generates a dense, smooth polyline path between sequential waypoints
    with a slight realistic curved path (Catmull-Rom or Bézier interpolation).
    """
    if len(ordered_stops) < 2:
        return [{"lat": s["lat"], "lng": s["lng"]} for s in ordered_stops]

    path = []
    for idx in range(len(ordered_stops) - 1):
        p1 = ordered_stops[idx]
        p2 = ordered_stops[idx + 1]

        lat1, lng1 = p1["lat"], p1["lng"]
        lat2, lng2 = p2["lat"], p2["lng"]

        # Perpendicular deflection for natural road curvature simulation
        dlat = lat2 - lat1
        dlng = lng2 - lng1
        perp_lat = -dlng * 0.05
        perp_lng = dlat * 0.05

        for step in range(points_per_segment):
            t = step / float(points_per_segment)
            # Quadratic curve offset
            curve_factor = 4.0 * t * (1.0 - t)
            lat = lat1 + t * dlat + curve_factor * perp_lat
            lng = lng1 + t * dlng + curve_factor * perp_lng
            path.append({"lat": round(lat, 6), "lng": round(lng, 6)})

    # Append the destination
    path.append({
        "lat": round(ordered_stops[-1]["lat"], 6),
        "lng": round(ordered_stops[-1]["lng"], 6),
    })
    return path

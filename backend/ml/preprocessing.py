import math
from typing import List, Dict, Tuple, Any
import numpy as np
from scipy.cluster.vq import kmeans2


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates the great-circle distance between two points in kilometers."""
    R = 6371.0  # Earth radius in kilometers

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return round(R * c, 4)


def normalize_coordinates(coords: List[Tuple[float, float]]) -> Tuple[np.ndarray, Dict[str, float]]:
    """Normalizes (lat, lng) pairs into the [0, 1] range and returns scale parameters."""
    arr = np.array(coords, dtype=float)
    min_vals = arr.min(axis=0)
    max_vals = arr.max(axis=0)
    range_vals = max_vals - min_vals
    range_vals[range_vals == 0.0] = 1.0  # prevent division by zero

    normalized = (arr - min_vals) / range_vals
    metadata = {
        "min_lat": float(min_vals[0]),
        "max_lat": float(max_vals[0]),
        "min_lng": float(min_vals[1]),
        "max_lng": float(max_vals[1]),
    }
    return normalized, metadata


def calculate_bounding_box(locations: List[Dict[str, float]], margin_km: float = 1.0) -> Dict[str, float]:
    """Calculates geographical bounding box containing all locations with a margin."""
    if not locations:
        return {"min_lat": 0.0, "max_lat": 0.0, "min_lng": 0.0, "max_lng": 0.0}

    lats = [loc["lat"] for loc in locations]
    lngs = [loc["lng"] for loc in locations]

    # ~1 deg lat ~ 111 km
    lat_margin = margin_km / 111.0
    # ~1 deg lng ~ 111 * cos(mean_lat)
    mean_lat = math.radians(sum(lats) / len(lats))
    lng_margin = margin_km / (111.0 * max(0.1, math.cos(mean_lat)))

    return {
        "min_lat": min(lats) - lat_margin,
        "max_lat": max(lats) + lat_margin,
        "min_lng": min(lngs) - lng_margin,
        "max_lng": max(lngs) + lng_margin,
    }


def cluster_locations(locations: List[Dict[str, Any]], num_clusters: int) -> List[List[Dict[str, Any]]]:
    """Partitions delivery stops into K spatial clusters using K-Means."""
    if num_clusters <= 1 or len(locations) <= num_clusters:
        return [locations]

    coords = np.array([[loc["lat"], loc["lng"]] for loc in locations], dtype=float)

    try:
        _, labels = kmeans2(coords, num_clusters, minit="points", iter=20)
    except Exception:
        # Fallback to index-based round-robin partitioning if clustering fails
        labels = [i % num_clusters for i in range(len(locations))]

    clusters = [[] for _ in range(num_clusters)]
    for idx, loc in enumerate(locations):
        cluster_idx = int(labels[idx])
        clusters[cluster_idx].append(loc)

    # Filter out empty clusters
    return [c for c in clusters if c]

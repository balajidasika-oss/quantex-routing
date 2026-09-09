import math
import time
import random
from typing import List, Dict, Any, Tuple, Optional
import numpy as np

from backend.utils.constants import CO2_FACTORS, CONSUMPTION_PER_KM


class ClassicalOptimizer:
    """Suite of extended classical routing heuristics and environmental emission calculators."""

    def __init__(self):
        pass

    def compute_tour_distance(self, tour: List[int], cost_matrix: np.ndarray) -> float:
        """Calculates total cost / distance along a sequential tour."""
        dist = sum(cost_matrix[tour[i], tour[i + 1]] for i in range(len(tour) - 1))
        return round(float(dist), 4)

    def calculate_emissions(
        self,
        distance_km: float,
        vehicle_type: str = "ELECTRIC",
    ) -> Dict[str, float]:
        """Calculates fuel/electricity consumption and kg CO2 emissions."""
        vtype = vehicle_type.upper()
        co2_factor = CO2_FACTORS.get(vtype, CO2_FACTORS["ELECTRIC"])
        consumption_factor = CONSUMPTION_PER_KM.get(vtype, CONSUMPTION_PER_KM["ELECTRIC"])

        total_co2 = round(distance_km * co2_factor, 3)
        total_consumption = round(distance_km * consumption_factor, 3)
        unit = "kWh" if vtype == "ELECTRIC" else "liters"

        # Comparison against standard diesel baseline
        diesel_baseline_co2 = round(distance_km * CO2_FACTORS["DIESEL"], 3)
        co2_savings = max(0.0, round(diesel_baseline_co2 - total_co2, 3))

        return {
            "distance_km": round(distance_km, 2),
            "vehicle_type": vtype,
            "total_co2_kg": total_co2,
            "fuel_consumed": total_consumption,
            "fuel_unit": unit,
            "diesel_baseline_co2_kg": diesel_baseline_co2,
            "co2_saved_kg": co2_savings,
        }

    # -----------------------------------------------------------------
    # 1. Clarke-Wright Savings Algorithm
    # -----------------------------------------------------------------
    def clarke_wright_savings(
        self,
        cost_matrix: np.ndarray,
        demands: Optional[List[float]] = None,
        vehicle_capacity: float = 1000.0,
    ) -> Dict[str, Any]:
        """
        Clarke-Wright parallel savings algorithm for vehicle routing.
        0 is depot, 1..N-1 are delivery stops.
        """
        start_time = time.perf_counter()
        n = cost_matrix.shape[0]
        if demands is None:
            demands = [0.0] + [10.0] * (n - 1)

        # 1. Compute pairwise savings s_ij = d(0, i) + d(0, j) - d(i, j)
        savings = []
        for i in range(1, n):
            for j in range(i + 1, n):
                s = cost_matrix[0, i] + cost_matrix[0, j] - cost_matrix[i, j]
                savings.append((s, i, j))

        savings.sort(key=lambda x: x[0], reverse=True)

        # Initialize single-customer round trips: [0, i, 0]
        routes = [[0, i, 0] for i in range(1, n)]
        route_demands = [demands[i] for i in range(1, n)]

        def find_route_end(customer: int):
            for r_idx, route in enumerate(routes):
                if route[1] == customer:
                    return r_idx, "START"
                if route[-2] == customer:
                    return r_idx, "END"
            return None, None

        for s, i, j in savings:
            r_i, pos_i = find_route_end(i)
            r_j, pos_j = find_route_end(j)

            if r_i is not None and r_j is not None and r_i != r_j:
                combined_demand = route_demands[r_i] + route_demands[r_j]
                if combined_demand <= vehicle_capacity:
                    route_i = routes[r_i]
                    route_j = routes[r_j]

                    # Merge depending on customer positions
                    if pos_i == "END" and pos_j == "START":
                        merged = route_i[:-1] + route_j[1:]
                    elif pos_i == "START" and pos_j == "END":
                        merged = route_j[:-1] + route_i[1:]
                    elif pos_i == "END" and pos_j == "END":
                        merged = route_i[:-1] + list(reversed(route_j[1:-1])) + [0]
                    elif pos_i == "START" and pos_j == "START":
                        merged = [0] + list(reversed(route_i[1:-1])) + route_j[1:]
                    else:
                        continue

                    # Update routes
                    routes[r_i] = merged
                    route_demands[r_i] = combined_demand
                    routes.pop(r_j)
                    route_demands.pop(r_j)

        # Concatenate routes into one full Hamiltonian cycle for single-vehicle TSP benchmark
        all_stops = []
        for r in routes:
            all_stops.extend(r[1:-1])
        full_tour = [0] + all_stops + [0]
        total_dist = self.compute_tour_distance(full_tour, cost_matrix)
        exec_time = round((time.perf_counter() - start_time) * 1000.0, 2)

        return {
            "algorithm": "CLARKE_WRIGHT",
            "tour": full_tour,
            "routes": routes,
            "total_distance_km": round(total_dist, 2),
            "execution_time_ms": exec_time,
        }

    # -----------------------------------------------------------------
    # 2. 2-Opt Local Search Improvement
    # -----------------------------------------------------------------
    def two_opt(
        self,
        cost_matrix: np.ndarray,
        initial_tour: Optional[List[int]] = None,
        max_iterations: int = 500,
    ) -> Dict[str, Any]:
        """Iterative 2-Opt edge swap heuristic."""
        start_time = time.perf_counter()
        n = cost_matrix.shape[0]

        if initial_tour is None:
            # Nearest neighbor start
            tour = self._nearest_neighbor(cost_matrix)
        else:
            tour = list(initial_tour)

        improved = True
        iteration = 0

        while improved and iteration < max_iterations:
            improved = False
            iteration += 1
            best_delta = 0.0
            best_i, best_k = None, None

            for i in range(1, len(tour) - 2):
                for k in range(i + 1, len(tour) - 1):
                    # delta = (dist(i-1, k) + dist(i, k+1)) - (dist(i-1, i) + dist(k, k+1))
                    node_prev = tour[i - 1]
                    node_i = tour[i]
                    node_k = tour[k]
                    node_next = tour[k + 1]

                    curr_cost = cost_matrix[node_prev, node_i] + cost_matrix[node_k, node_next]
                    new_cost = cost_matrix[node_prev, node_k] + cost_matrix[node_i, node_next]
                    delta = new_cost - curr_cost

                    if delta < best_delta - 1e-6:
                        best_delta = delta
                        best_i, best_k = i, k
                        improved = True

            if improved and best_i is not None and best_k is not None:
                # Reverse sub-segment tour[best_i : best_k + 1]
                tour[best_i : best_k + 1] = reversed(tour[best_i : best_k + 1])

        total_dist = self.compute_tour_distance(tour, cost_matrix)
        exec_time = round((time.perf_counter() - start_time) * 1000.0, 2)

        return {
            "algorithm": "TWO_OPT",
            "tour": tour,
            "total_distance_km": round(total_dist, 2),
            "iterations": iteration,
            "execution_time_ms": exec_time,
        }

    # -----------------------------------------------------------------
    # 3. Tabu Search
    # -----------------------------------------------------------------
    def tabu_search(
        self,
        cost_matrix: np.ndarray,
        tabu_tenure: int = 10,
        max_iterations: int = 200,
    ) -> Dict[str, Any]:
        """
        Tabu Search with 2-exchange neighborhood and aspiration criterion.
        """
        start_time = time.perf_counter()
        curr_tour = self._nearest_neighbor(cost_matrix)
        best_tour = list(curr_tour)

        curr_cost = self.compute_tour_distance(curr_tour, cost_matrix)
        best_cost = curr_cost

        # Tabu memory: maps (nodeA, nodeB) -> expiration iteration
        tabu_list: Dict[Tuple[int, int], int] = {}

        for it in range(max_iterations):
            best_candidate_tour = None
            best_candidate_cost = float("inf")
            best_move = None

            # Explore 2-opt neighborhood
            for i in range(1, len(curr_tour) - 2):
                for k in range(i + 1, min(i + 15, len(curr_tour) - 1)):
                    cand_tour = list(curr_tour)
                    cand_tour[i : k + 1] = reversed(cand_tour[i : k + 1])
                    cand_cost = self.compute_tour_distance(cand_tour, cost_matrix)

                    node_i, node_k = curr_tour[i], curr_tour[k]
                    move = (min(node_i, node_k), max(node_i, node_k))

                    is_tabu = tabu_list.get(move, 0) > it
                    # Aspiration criterion: override tabu if strictly better than global best
                    aspiration = cand_cost < best_cost

                    if (not is_tabu or aspiration) and cand_cost < best_candidate_cost:
                        best_candidate_cost = cand_cost
                        best_candidate_tour = cand_tour
                        best_move = move

            if best_candidate_tour is None:
                break

            curr_tour = best_candidate_tour
            curr_cost = best_candidate_cost

            # Update tabu list
            if best_move:
                tabu_list[best_move] = it + tabu_tenure

            # Update global best
            if curr_cost < best_cost:
                best_cost = curr_cost
                best_tour = list(curr_tour)

        exec_time = round((time.perf_counter() - start_time) * 1000.0, 2)

        return {
            "algorithm": "TABU_SEARCH",
            "tour": best_tour,
            "total_distance_km": round(best_cost, 2),
            "tabu_tenure": tabu_tenure,
            "iterations": max_iterations,
            "execution_time_ms": exec_time,
        }

    # -----------------------------------------------------------------
    # 4. Classical Simulated Annealing
    # -----------------------------------------------------------------
    def simulated_annealing(
        self,
        cost_matrix: np.ndarray,
        initial_temp: float = 100.0,
        cooling_rate: float = 0.985,
        min_temp: float = 0.05,
    ) -> Dict[str, Any]:
        """Classical simulated annealing using Metropolis-Hastings criterion."""
        start_time = time.perf_counter()
        curr_tour = self._nearest_neighbor(cost_matrix)
        best_tour = list(curr_tour)

        curr_cost = self.compute_tour_distance(curr_tour, cost_matrix)
        best_cost = curr_cost

        T = initial_temp
        steps = 0

        while T > min_temp:
            steps += 1
            # Random 2-opt swap
            n_inner = len(curr_tour) - 2
            if n_inner >= 2:
                i = random.randint(1, n_inner)
                k = random.randint(1, n_inner)
                if i > k:
                    i, k = k, i
                if i != k:
                    cand_tour = list(curr_tour)
                    cand_tour[i : k + 1] = reversed(cand_tour[i : k + 1])
                    cand_cost = self.compute_tour_distance(cand_tour, cost_matrix)

                    delta_E = cand_cost - curr_cost
                    if delta_E < 0.0 or random.random() < math.exp(-delta_E / T):
                        curr_tour = cand_tour
                        curr_cost = cand_cost
                        if curr_cost < best_cost:
                            best_cost = curr_cost
                            best_tour = list(curr_tour)

            T *= cooling_rate

        exec_time = round((time.perf_counter() - start_time) * 1000.0, 2)

        return {
            "algorithm": "CLASSICAL_SA",
            "tour": best_tour,
            "total_distance_km": round(best_cost, 2),
            "cooling_rate": cooling_rate,
            "steps": steps,
            "execution_time_ms": exec_time,
        }

    def _nearest_neighbor(self, cost_matrix: np.ndarray) -> List[int]:
        n = cost_matrix.shape[0]
        unvisited = set(range(1, n))
        tour = [0]
        curr = 0
        while unvisited:
            next_stop = min(unvisited, key=lambda s: cost_matrix[curr, s])
            tour.append(next_stop)
            unvisited.remove(next_stop)
            curr = next_stop
        tour.append(0)
        return tour


classical_optimizer = ClassicalOptimizer()

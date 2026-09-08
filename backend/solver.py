import numpy as np
from sklearn.cluster import KMeans
from qiskit_optimization.applications import Tsp
from qiskit_optimization.algorithms import MinimumEigenOptimizer
from qiskit_algorithms import QAOA
from qiskit_algorithms.optimizers import COBYLA
from qiskit.primitives import Sampler
import time
import math

class QuantumRoutingSolver:
    def __init__(self):
        # We will use QAOA with a local Sampler primitive for the prototype
        self.sampler = Sampler()
        self.optimizer = COBYLA(maxiter=100)
        self.qaoa = QAOA(sampler=self.sampler, optimizer=self.optimizer, reps=1)
        self.optimizer_algo = MinimumEigenOptimizer(self.qaoa)

    def calculate_distance_matrix(self, nodes):
        """Calculates a distance matrix (Euclidean) for a list of nodes."""
        n = len(nodes)
        matrix = np.zeros((n, n))
        for i in range(n):
            for j in range(n):
                if i != j:
                    # In a real app, use Haversine or routing API. 
                    # For prototype, Euclidean on lat/lng scaled by an approximation factor.
                    dist = math.sqrt((nodes[i]['lat'] - nodes[j]['lat'])**2 + 
                                     (nodes[i]['lng'] - nodes[j]['lng'])**2)
                    matrix[i][j] = dist * 111  # Approximate degrees to km
        return matrix

    def cluster_nodes(self, nodes, num_vehicles):
        """Uses K-Means to divide nodes into clusters for each vehicle."""
        coords = np.array([[n['lat'], n['lng']] for n in nodes])
        kmeans = KMeans(n_clusters=num_vehicles, random_state=42, n_init='auto')
        kmeans.fit(coords)
        
        clusters = {i: [] for i in range(num_vehicles)}
        for idx, label in enumerate(kmeans.labels_):
            clusters[label].append(nodes[idx])
        return clusters

    def solve_tsp_quantum(self, nodes):
        """Solves the TSP for a given set of nodes using QAOA."""
        n = len(nodes)
        if n <= 2:
            return nodes, 0.0  # Trivial solution
        
        # Cap the nodes to 5 for the hackathon prototype due to QAOA qubit requirements (O(N^2))
        # In a real scenario with >5 nodes per cluster, we would fallback to classical or use advanced hardware.
        if n > 5:
            return self.solve_tsp_classical(nodes)

        dist_matrix = self.calculate_distance_matrix(nodes)
        tsp = Tsp(dist_matrix)
        qp = tsp.to_quadratic_program()
        
        start_time = time.time()
        result = self.optimizer_algo.solve(qp)
        elapsed_time = time.time() - start_time
        
        z = tsp.interpret(result.x)
        
        # Return reordered nodes
        optimized_nodes = [nodes[i] for i in z]
        return optimized_nodes, elapsed_time

    def solve_tsp_classical(self, nodes):
        """Fallback simulated annealing or nearest neighbor solver for larger clusters."""
        # A simple nearest neighbor for the prototype fallback
        if not nodes:
            return [], 0.0
        
        start_time = time.time()
        unvisited = nodes.copy()
        current = unvisited.pop(0)
        route = [current]
        
        while unvisited:
            next_node = min(unvisited, key=lambda n: math.sqrt((current['lat'] - n['lat'])**2 + (current['lng'] - n['lng'])**2))
            route.append(next_node)
            unvisited.remove(next_node)
            current = next_node
            
        elapsed_time = time.time() - start_time
        return route, elapsed_time

    def calculate_metrics(self, unoptimized_routes, optimized_routes):
        """Compare routes and estimate savings."""
        # For prototype, we'll simulate calculating distances and standard savings
        def get_total_distance(routes):
            total = 0
            for route in routes.values():
                dist_matrix = self.calculate_distance_matrix(route)
                for i in range(len(route)-1):
                    total += dist_matrix[i][i+1]
                if len(route) > 1:
                    total += dist_matrix[-1][0] # Return to start
            return total

        unopt_dist = get_total_distance(unoptimized_routes)
        opt_dist = get_total_distance(optimized_routes)
        
        # Mock calculations for demonstration
        fuel_savings_percent = ((unopt_dist - opt_dist) / unopt_dist * 100) if unopt_dist > 0 else 0
        emissions_reduced_kg = (unopt_dist - opt_dist) * 0.25 # Approx 0.25kg CO2 per km saved

        return {
            "unoptimized_distance_km": round(unopt_dist, 2),
            "optimized_distance_km": round(opt_dist, 2),
            "estimated_fuel_saved_percent": round(fuel_savings_percent, 1),
            "emissions_reduced_co2_kg": round(emissions_reduced_kg, 2)
        }

    def process_fleet_routing(self, all_nodes, num_vehicles):
        """Main entry point for routing logic."""
        clusters = self.cluster_nodes(all_nodes, num_vehicles)
        
        unoptimized_routes = {}
        optimized_routes = {}
        
        for v_id, cluster_nodes_list in clusters.items():
            unoptimized_routes[v_id] = cluster_nodes_list # Original arbitrary order
            
            opt_route, _ = self.solve_tsp_quantum(cluster_nodes_list)
            optimized_routes[v_id] = opt_route
            
        metrics = self.calculate_metrics(unoptimized_routes, optimized_routes)
        
        return {
            "unoptimized": unoptimized_routes,
            "optimized": optimized_routes,
            "metrics": metrics
        }

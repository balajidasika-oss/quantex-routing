import math
import numpy as np
from typing import List, Tuple

try:
    from qiskit_optimization import QuadraticProgram
    from qiskit_optimization.algorithms import MinimumEigenOptimizer
    from qiskit_algorithms import QAOA
    from qiskit_algorithms.optimizers import COBYLA
    from qiskit.primitives import StatevectorSampler
    QISKIT_AVAILABLE = True
except ImportError:
    QISKIT_AVAILABLE = False

def haversine(coord1: List[float], coord2: List[float]) -> float:
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(coord1[0]), math.radians(coord2[0])
    dphi = math.radians(coord2[0] - coord1[0])
    dlambda = math.radians(coord2[1] - coord1[1])
    a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def solve_manual_tsp_qiskit(locations: List[List[float]]) -> Tuple[List[int], float]:
    n = len(locations)
    if n <= 1:
        return [0], 0.0
    if n == 2:
        return [0, 1], haversine(locations[0], locations[1])
        
    # Build exact distance matrix
    dist_matrix = np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            if i != j:
                dist_matrix[i][j] = haversine(locations[i], locations[j])

    if not QISKIT_AVAILABLE:
        # Fallback to nearest neighbor if Qiskit environment drops
        return _classical_fallback(dist_matrix, n)

    # Explicit QUBO Formulation for TSP
    qp = QuadraticProgram("Manual_TSP_Recalculation")
    for v in range(n):
        for t in range(n):
            qp.binary_var(f"x_{v}_{t}")
            
    # Constraints: each node visited exactly once
    for v in range(n):
        qp.linear_constraint(linear={f"x_{v}_{t}": 1 for t in range(n)}, sense="==", rhs=1, name=f"visit_{v}")
    
    # Constraints: each time step has exactly one node
    for t in range(n):
        qp.linear_constraint(linear={f"x_{v}_{t}": 1 for v in range(n)}, sense="==", rhs=1, name=f"step_{t}")

    # Objective: minimize total Haversine distance
    objective = {}
    for i in range(n):
        for j in range(n):
            if i != j:
                for t in range(n - 1):
                    objective[(f"x_{i}_{t}", f"x_{j}_{t+1}")] = dist_matrix[i][j]
                # Return trip to origin
                objective[(f"x_{i}_{n-1}", f"x_{j}_{0}")] = dist_matrix[i][j]
                
    qp.minimize(quadratic=objective)

    # Solve using QAOA and StatevectorSampler
    qaoa = QAOA(sampler=StatevectorSampler(), optimizer=COBYLA(maxiter=100), reps=1)
    optimizer = MinimumEigenOptimizer(qaoa)
    result = optimizer.solve(qp)

    # Decode Hamiltonian binary string back to geographic path
    path = [-1] * n
    for i, var in enumerate(result.variables):
        if result.x[i] == 1:
            _, v, t = var.name.split('_')
            path[int(t)] = int(v)
            
    # Calculate exact final cost
    cost = 0.0
    for i in range(n - 1):
        cost += dist_matrix[path[i]][path[i+1]]
    cost += dist_matrix[path[-1]][path[0]]
    
    return path, cost

def _classical_fallback(dist_matrix: np.ndarray, n: int) -> Tuple[List[int], float]:
    visited = [False] * n
    path = [0]
    visited[0] = True
    total_cost = 0.0
    curr = 0
    for _ in range(n - 1):
        next_node = -1
        min_dist = float('inf')
        for j in range(n):
            if not visited[j] and dist_matrix[curr][j] < min_dist:
                min_dist = dist_matrix[curr][j]
                next_node = j
        path.append(next_node)
        visited[next_node] = True
        total_cost += min_dist
        curr = next_node
    total_cost += dist_matrix[path[-1]][path[0]]
    return path, total_cost

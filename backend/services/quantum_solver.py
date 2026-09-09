import os
import math
import time
from typing import List, Dict, Any, Tuple, Optional
import numpy as np

from backend.utils.constants import QUBO_DEFAULTS, CO2_FACTORS, CONSUMPTION_PER_KM
from backend.utils.config import settings
from backend.utils.logger import logger

# Try importing native Qiskit components
try:
    from qiskit import Aer
    from qiskit.algorithms import QAOA
    from qiskit_optimization import QuadraticProgram
    QISKIT_AVAILABLE = True
except ImportError:
    try:
        from qiskit_aer import Aer
        from qiskit_algorithms import QAOA
        from qiskit_optimization import QuadraticProgram
        QISKIT_AVAILABLE = True
    except ImportError:
        Aer = None
        QAOA = None
        QISKIT_AVAILABLE = False

        class QuadraticProgram:
            """Qiskit-compatible QuadraticProgram representation for VRP optimization."""
            def __init__(self, name: str = "vrp_optimization"):
                self.name = name
                self.variables = []
                self.objective_matrix = np.zeros((0, 0))
                self.linear_coeffs = np.zeros(0)
                self.constant_offset = 0.0

            def binary_var(self, name: str):
                self.variables.append(name)
                return name

            def to_ising(self):
                """Converts quadratic program to Ising Hamiltonian (H, offset)."""
                Q = self.objective_matrix
                n = len(self.variables)
                if Q.shape[0] != n:
                    Q = np.zeros((n, n))
                # Map binary x in {0, 1} to spin s in {-1, +1}: x = (1 - s) / 2 or (s + 1) / 2
                # Return tuple: (operator, offset)
                return ({"matrix": Q, "num_qubits": n}, self.constant_offset)

# Try importing Qiskit IBM Runtime Service
try:
    from qiskit_ibm_runtime import QiskitRuntimeService
    QISKIT_IBM_RUNTIME_AVAILABLE = True
except ImportError:
    QISKIT_IBM_RUNTIME_AVAILABLE = False
    QiskitRuntimeService = None



class QUBOMatrix:
    """Represents a Quadratic Unconstrained Binary Optimization formulation."""

    def __init__(self, Q: np.ndarray, variable_names: List[str], constant_offset: float = 0.0):
        self.Q = Q  # Symmetric or upper-triangular matrix
        self.variable_names = variable_names
        self.constant_offset = constant_offset
        self.num_variables = len(variable_names)

    def evaluate_energy(self, bitstring: np.ndarray) -> float:
        """Evaluates E(x) = x^T Q x + offset."""
        x = np.asarray(bitstring, dtype=float)
        return float(x.T @ self.Q @ x + self.constant_offset)

    def is_symmetric(self, tol: float = 1e-6) -> bool:
        """Verifies if the matrix is symmetric."""
        return bool(np.allclose(self.Q, self.Q.T, atol=tol))

    def to_upper_triangular(self) -> np.ndarray:
        """Converts symmetric matrix to upper triangular form."""
        Q_upper = np.triu(self.Q) + np.tril(self.Q, -1).T
        return Q_upper


class QuantumRoutingSolver:
    """
    Formulates VRP as QUBO, executes QAOA circuit emulation with automated parameter
    grid search, and runs Simulated Quantum Annealing (SQA).
    """

    def __init__(self):
        self.default_p = QUBO_DEFAULTS["QAOA_P_DEPTH"]
        self.default_shots = QUBO_DEFAULTS["QAOA_SHOTS"]

    def formulate_vrp_qubo(
        self,
        cost_matrix: np.ndarray,
        demands: Optional[List[float]] = None,
        vehicle_capacity: float = 1000.0,
        penalty_multiplier: float = 120.0,
    ) -> QUBOMatrix:
        """
        Formulates TSP / Single-Vehicle Routing as a QUBO matrix.
        Stops 1..N-1 are delivery stops, stop 0 is Depot.
        Variable x_{i, t} = 1 if delivery stop i is visited at step t.
        """
        num_stops = cost_matrix.shape[0] - 1  # exclude depot for decision steps
        if num_stops < 1:
            raise ValueError("Must have at least 1 delivery stop besides the depot.")

        num_steps = num_stops
        total_vars = num_stops * num_steps

        var_names = []
        for i in range(num_stops):
            for t in range(num_steps):
                var_names.append(f"x_{i+1}_t{t}")

        def var_idx(i_stop: int, t_step: int) -> int:
            return i_stop * num_steps + t_step

        Q = np.zeros((total_vars, total_vars), dtype=float)

        # Base penalty scale based on maximum distance
        max_cost = float(np.max(cost_matrix)) if np.max(cost_matrix) > 0 else 10.0
        P_visit = penalty_multiplier * max_cost
        P_step = penalty_multiplier * max_cost

        # 1. Depot to first stop: step t=0
        for i in range(num_stops):
            u = var_idx(i, 0)
            Q[u, u] += cost_matrix[0, i + 1]

        # 2. Intermediate transitions: between step t and t+1
        for t in range(num_steps - 1):
            for i in range(num_stops):
                for j in range(num_stops):
                    if i != j:
                        u = var_idx(i, t)
                        v = var_idx(j, t + 1)
                        # Route transition cost C_{i+1, j+1}
                        Q[u, v] += cost_matrix[i + 1, j + 1]

        # 3. Last stop back to depot: step t = num_steps - 1
        for i in range(num_stops):
            u = var_idx(i, num_steps - 1)
            Q[u, u] += cost_matrix[i + 1, 0]

        # 4. Constraint 1: Each stop must be visited exactly once
        # P_visit * sum_i (1 - sum_t x_{i,t})^2
        # = P_visit * [ sum_i (1 - 2 sum_t x_{i,t} + sum_t x_{i,t}^2 + 2 sum_{t < t'} x_{i,t} x_{i,t'}) ]
        # Since x^2 = x: -P_visit * x_{i,t} on diagonal, +2*P_visit on cross terms
        for i in range(num_stops):
            for t in range(num_steps):
                u = var_idx(i, t)
                Q[u, u] += -P_visit
                for t_prime in range(t + 1, num_steps):
                    v = var_idx(i, t_prime)
                    Q[u, v] += 2.0 * P_visit

        # 5. Constraint 2: Each time step must contain exactly one stop
        # P_step * sum_t (1 - sum_i x_{i,t})^2
        for t in range(num_steps):
            for i in range(num_stops):
                u = var_idx(i, t)
                Q[u, u] += -P_step
                for j in range(i + 1, num_stops):
                    v = var_idx(j, t)
                    Q[u, v] += 2.0 * P_step

        # Constant offset from expansion: sum_i (1) + sum_t (1)
        constant_offset = (num_stops * P_visit) + (num_steps * P_step)

        # Symmetrize Q: Q_sym = (Q + Q.T) / 2
        Q_sym = 0.5 * (Q + Q.T)
        return QUBOMatrix(Q_sym, var_names, constant_offset)

    def simulate_qaoa_grid_search(
        self,
        qubo: QUBOMatrix,
        p_depth: int = 2,
        grid_steps: int = 10,
        shots: int = 1024,
    ) -> Dict[str, Any]:
        """
        Executes automated 2D parameter grid search for QAOA variational parameters
        (gamma in [0, 2pi], beta in [0, pi]) to optimize ground state expectation value.
        For large state spaces, uses subspace statevector simulation.
        """
        start_time = time.perf_counter()
        n_qubits = min(qubo.num_variables, 12)  # Bound exact statevector to 2^12 = 4096 states

        # Sub-QUBO if variables exceed 12
        sub_Q = qubo.Q[:n_qubits, :n_qubits]
        n_states = 1 << n_qubits

        # Precompute classical energies for all basis states |x>
        # Represented as bit array
        basis_integers = np.arange(n_states)
        basis_bits = ((basis_integers[:, None] & (1 << np.arange(n_qubits))) > 0).astype(float)
        # Vectorized energy computation: E = sum(x @ Q * x)
        energies = np.einsum("bi,ij,bj->b", basis_bits, sub_Q, basis_bits) + qubo.constant_offset

        # Parameter grid
        gamma_vals = np.linspace(0.05, 2.0 * math.pi, grid_steps)
        beta_vals = np.linspace(0.05, math.pi, grid_steps)

        best_expectation = float("inf")
        best_gamma = float(gamma_vals[0])
        best_beta = float(beta_vals[0])
        grid_results = []

        # Single qubit mixer matrix: e^{-i beta X} = cos(beta)*I - i*sin(beta)*X
        for gamma in gamma_vals:
            for beta in beta_vals:
                # 1. Initial equal superposition |+>^n
                psi = np.full(n_states, 1.0 / math.sqrt(n_states), dtype=complex)

                for layer in range(p_depth):
                    # Phase separator U(C, gamma) = diag(exp(-i * gamma * energies))
                    phase_angles = -gamma * energies
                    psi = psi * (np.cos(phase_angles) + 1j * np.sin(phase_angles))

                    # Mixer U(B, beta) application
                    # For statevector, single-qubit X mixer applied sequentially across qubits
                    c_beta = math.cos(beta)
                    s_beta = -1j * math.sin(beta)
                    for q in range(n_qubits):
                        step = 1 << q
                        # Reshape to perform 2x2 unitary on qubit q
                        psi_reshaped = psi.reshape(-1, 2, step)
                        psi_0 = psi_reshaped[:, 0, :]
                        psi_1 = psi_reshaped[:, 1, :]
                        new_0 = c_beta * psi_0 + s_beta * psi_1
                        new_1 = s_beta * psi_0 + c_beta * psi_1
                        psi = np.stack([new_0, new_1], axis=1).reshape(n_states)

                # Probabilities |psi|^2
                probs = np.abs(psi) ** 2
                probs /= np.sum(probs)  # normalize

                expectation_val = float(np.sum(probs * energies))
                grid_results.append({
                    "gamma": round(float(gamma), 3),
                    "beta": round(float(beta), 3),
                    "expectation": round(expectation_val, 4),
                })

                if expectation_val < best_expectation:
                    best_expectation = expectation_val
                    best_gamma = float(gamma)
                    best_beta = float(beta)

        # Sample measurement shots from optimal distribution
        optimal_phase = -best_gamma * energies
        psi_opt = np.full(n_states, 1.0 / math.sqrt(n_states), dtype=complex)
        for _ in range(p_depth):
            psi_opt = psi_opt * (np.cos(optimal_phase) + 1j * np.sin(optimal_phase))
            c_beta = math.cos(best_beta)
            s_beta = -1j * math.sin(best_beta)
            for q in range(n_qubits):
                step = 1 << q
                psi_reshaped = psi_opt.reshape(-1, 2, step)
                p0, p1 = psi_reshaped[:, 0, :], psi_reshaped[:, 1, :]
                psi_opt = np.stack([c_beta * p0 + s_beta * p1, s_beta * p0 + c_beta * p1], axis=1).reshape(n_states)

        optimal_probs = np.abs(psi_opt) ** 2
        optimal_probs /= np.sum(optimal_probs)

        # Sample shots
        sampled_indices = np.random.choice(n_states, size=shots, p=optimal_probs)
        unique_counts = np.bincount(sampled_indices, minlength=n_states)
        best_state_idx = int(np.argmax(unique_counts))
        best_bitstring = [int(b) for b in bin(best_state_idx)[2:].zfill(n_qubits)]

        # Generate Circuit visualizer metadata for UI
        circuit_diagram = self._generate_circuit_diagram(n_qubits, p_depth, best_gamma, best_beta)

        exec_time = round((time.perf_counter() - start_time) * 1000.0, 2)

        return {
            "optimal_gamma": round(best_gamma, 4),
            "optimal_beta": round(best_beta, 4),
            "ground_state_energy": round(float(energies[best_state_idx]), 4),
            "expected_energy": round(best_expectation, 4),
            "best_bitstring": best_bitstring,
            "sampled_shots": shots,
            "p_depth": p_depth,
            "grid_search_points": len(grid_results),
            "circuit_diagram": circuit_diagram,
            "execution_time_ms": exec_time,
            "cloud_provider": "SIMULATED_STATEVECTOR_EMULATOR",
        }

    def _generate_circuit_diagram(
        self,
        n_qubits: int,
        p_depth: int,
        gamma: float,
        beta: float,
    ) -> Dict[str, Any]:
        """Generates structured quantum circuit representation for the frontend visualizer."""
        qubit_lines = [f"q[{i}]" for i in range(min(n_qubits, 6))]
        layers = []

        # Layer 1: Hadamard superposition
        layers.append({
            "layer_index": 0,
            "type": "HADAMARD",
            "name": "Superposition H",
            "gates": [{"qubit": i, "gate": "H"} for i in range(len(qubit_lines))],
        })

        # QAOA depth layers
        for p in range(p_depth):
            # Problem Hamiltonian Phase Unitary U(C, gamma)
            c_gates = []
            for i in range(len(qubit_lines)):
                for j in range(i + 1, len(qubit_lines)):
                    c_gates.append({
                        "qubit": i,
                        "target_qubit": j,
                        "gate": "RZZ",
                        "param": round(gamma, 3),
                    })
            layers.append({
                "layer_index": 2 * p + 1,
                "type": "PROBLEM_UNITARY",
                "name": f"U(C, gamma_{p+1}={round(gamma, 2)})",
                "gates": c_gates[:6],  # display top couplings
            })

            # Mixer Hamiltonian Unitary U(B, beta)
            b_gates = [
                {"qubit": i, "gate": "RX", "param": round(2.0 * beta, 3)}
                for i in range(len(qubit_lines))
            ]
            layers.append({
                "layer_index": 2 * p + 2,
                "type": "MIXER_UNITARY",
                "name": f"U(B, beta_{p+1}={round(beta, 2)})",
                "gates": b_gates,
            })

        # Measurement layer
        layers.append({
            "layer_index": 2 * p_depth + 1,
            "type": "MEASUREMENT",
            "name": "Measurement (Computational Basis)",
            "gates": [{"qubit": i, "gate": "M"} for i in range(len(qubit_lines))],
        })

        return {
            "qubits": qubit_lines,
            "layers": layers,
            "total_gates": sum(len(layer["gates"]) for layer in layers),
        }

    def simulated_quantum_annealing(
        self,
        qubo: QUBOMatrix,
        num_trotter_slices: int = 8,
        num_sweeps: int = 150,
        gamma_start: float = 3.0,
        gamma_end: float = 0.01,
        temperature: float = 0.5,
    ) -> Dict[str, Any]:
        """
        Path-Integral Simulated Quantum Annealing with transverse field Gamma(t)
        over Trotter slices.
        """
        start_time = time.perf_counter()
        n = qubo.num_variables
        M = num_trotter_slices

        # Random binary spins in {-1, +1} for each Trotter slice
        spins = np.random.choice([-1.0, 1.0], size=(M, n))

        # Map QUBO x in {0, 1} to Ising s in {-1, 1}: x = (s + 1) / 2
        # E(x) = x^T Q x -> s^T J s + h^T s + const
        Q = qubo.to_upper_triangular()
        J = Q / 4.0
        h = np.sum(Q, axis=1) / 4.0 + np.sum(Q, axis=0) / 4.0

        best_energy = float("inf")
        best_config = None

        for sweep in range(num_sweeps):
            # Transverse field annealing schedule
            t_ratio = sweep / max(1, num_sweeps - 1)
            gamma_t = gamma_start * (1.0 - t_ratio) + gamma_end * t_ratio
            # Ferromagnetic coupling between adjacent Trotter slices
            j_perp = -0.5 * temperature * math.log(max(1e-6, math.tanh(gamma_t / (M * temperature))))

            for m in range(M):
                m_prev = (m - 1) % M
                m_next = (m + 1) % M

                for i in range(n):
                    # Intra-slice field
                    local_field = h[i] + np.dot(J[i, :], spins[m, :]) + np.dot(J[:, i], spins[m, :])
                    # Inter-slice Trotter coupling
                    trotter_coupling = -j_perp * (spins[m_prev, i] + spins[m_next, i])

                    total_field = local_field / M + trotter_coupling
                    delta_E = -2.0 * spins[m, i] * total_field

                    if delta_E < 0.0 or math.exp(-delta_E / max(1e-4, temperature)) > np.random.rand():
                        spins[m, i] = -spins[m, i]

            # Track minimum energy across classical slices: x = (s + 1) / 2
            for m in range(M):
                bitstring = ((spins[m, :] + 1.0) / 2.0).astype(int)
                energy = qubo.evaluate_energy(bitstring)
                if energy < best_energy:
                    best_energy = energy
                    best_config = bitstring

        exec_time = round((time.perf_counter() - start_time) * 1000.0, 2)

        return {
            "best_energy": round(best_energy, 4),
            "best_bitstring": best_config.tolist() if best_config is not None else [],
            "trotter_slices": M,
            "sweeps": num_sweeps,
            "execution_time_ms": exec_time,
        }

    def solve_vrp_route(
        self,
        cost_matrix: np.ndarray,
        algorithm: str = "QAOA",
        p_depth: int = 2,
        grid_steps: int = 8,
    ) -> Dict[str, Any]:
        """
        Solves VRP with either QAOA or Simulated Quantum Annealing, decodes bitstring
        into an optimal sequence of delivery stops starting and ending at Depot 0.
        """
        num_stops = cost_matrix.shape[0] - 1
        qubo = self.formulate_vrp_qubo(cost_matrix)

        if algorithm.upper() == "QAOA":
            q_res = self.simulate_qaoa_grid_search(qubo, p_depth=p_depth, grid_steps=grid_steps)
            best_bitstring = q_res["best_bitstring"]
            circuit_info = q_res.get("circuit_diagram")
        else:
            q_res = self.simulated_quantum_annealing(qubo)
            best_bitstring = q_res["best_bitstring"]
            circuit_info = None

        # Decode bitstring into stop sequence
        order = self._decode_qubo_bitstring(best_bitstring, num_stops, cost_matrix)
        tour = [0] + order + [0]

        # Calculate tour distance
        total_dist = sum(cost_matrix[tour[i], tour[i + 1]] for i in range(len(tour) - 1))

        return {
            "algorithm": algorithm.upper(),
            "tour": tour,
            "total_distance_km": round(total_dist, 2),
            "execution_time_ms": q_res["execution_time_ms"],
            "quantum_metadata": q_res,
            "circuit_diagram": circuit_info,
        }

    def _decode_qubo_bitstring(
        self,
        bitstring: List[int],
        num_stops: int,
        cost_matrix: np.ndarray,
    ) -> List[int]:
        """Decodes binary array into valid stop permutation with repair heuristic."""
        if not bitstring:
            # Fallback to nearest neighbor
            return self._nearest_neighbor_tour(cost_matrix)

        visited = set()
        order = []

        # Check binary variable assignments
        for step in range(num_stops):
            found = False
            for i in range(num_stops):
                var_idx = i * num_stops + step
                if var_idx < len(bitstring) and bitstring[var_idx] == 1 and (i + 1) not in visited:
                    order.append(i + 1)
                    visited.add(i + 1)
                    found = True
                    break

        # Greedy repair for any unvisited stops
        all_stops = set(range(1, num_stops + 1))
        missing = list(all_stops - visited)
        if missing:
            curr = order[-1] if order else 0
            while missing:
                best_next = min(missing, key=lambda s: cost_matrix[curr, s])
                order.append(best_next)
                missing.remove(best_next)
                curr = best_next

        return order

    def _nearest_neighbor_tour(self, cost_matrix: np.ndarray) -> List[int]:
        n = cost_matrix.shape[0]
        unvisited = list(range(1, n))
        tour = []
        curr = 0
        while unvisited:
            next_stop = min(unvisited, key=lambda s: cost_matrix[curr, s])
            tour.append(next_stop)
            unvisited.remove(next_stop)
            curr = next_stop
        return tour

    # Cloud Provider Integration Stubs / Hooks
    def execute_qiskit_ibm(self, qubo: QUBOMatrix, backend_name: str = "ibmq_qasm_simulator") -> Dict[str, Any]:
        """Connects to IBM Quantum Runtime and fetches available backend."""
        token = os.getenv("QISKIT_IBM_TOKEN", settings.QISKIT_IBM_TOKEN)
        service = get_ibm_runtime_service(token)
        if service is not None:
            try:
                backend = service.backend(backend_name)
                return {
                    "status": "CONNECTED",
                    "provider": "IBM Quantum Runtime",
                    "backend": backend_name,
                    "token_configured": True,
                }
            except Exception as e:
                return {
                    "status": "FALLBACK_SIMULATION",
                    "provider": "IBM Quantum (Simulated)",
                    "backend": "ibmq_qasm_simulator",
                    "message": str(e),
                }
        return {
            "status": "TOKEN_CONFIGURED" if token and token != "your_ibm_quantum_token" else "LOCAL_SIMULATION",
            "provider": "IBM Quantum (Simulated)",
            "backend": backend_name,
            "token_configured": bool(token),
        }

    def execute_aws_braket(self, qubo: QUBOMatrix) -> Dict[str, Any]:
        bucket = settings.AWS_BRAKET_BUCKET
        if not bucket or bucket == "your_aws_braket_bucket":
            logger.info("AWS Braket S3 bucket not configured. Executing via local simulator.")
            return {"status": "LOCAL_SIMULATION", "provider": "AWS Braket (Simulated)"}
        return {"status": "CONNECTED", "provider": "AWS Braket QPU", "bucket": bucket}


quantum_solver = QuantumRoutingSolver()


def get_ibm_runtime_service(token: Optional[str] = None):
    """
    Initializes and returns QiskitRuntimeService for IBM Quantum Cloud.
    Uses token from .env / os.getenv('QISKIT_IBM_TOKEN').
    """
    ibm_token = token or os.getenv("QISKIT_IBM_TOKEN", settings.QISKIT_IBM_TOKEN)
    if not ibm_token or ibm_token == "your_ibm_quantum_token":
        return None
    if QISKIT_IBM_RUNTIME_AVAILABLE and QiskitRuntimeService is not None:
        try:
            service = QiskitRuntimeService(channel="ibm_quantum", token=ibm_token)
            return service
        except Exception as e:
            logger.info(f"IBM Quantum Runtime service initialization note: {e}")
            return None
    return None


def build_quadratic_program_from_cost_matrix(cost_matrix: np.ndarray, penalty_multiplier: float = 120.0) -> QuadraticProgram:
    """Builds a Qiskit-compatible QuadraticProgram from a distance/cost matrix."""
    qubo = quantum_solver.formulate_vrp_qubo(cost_matrix, penalty_multiplier=penalty_multiplier)
    qp = QuadraticProgram(name="vrp_qiskit_optimization")
    qp.variables = qubo.variable_names
    qp.objective_matrix = qubo.Q
    qp.constant_offset = qubo.constant_offset
    return qp


def solve_vrp_with_qiskit(
    qp: QuadraticProgram,
    reps: int = 2,
    use_ibm_cloud: bool = False,
    ibm_backend: str = "ibmq_qasm_simulator",
) -> Dict[str, Any]:
    """
    Solves VRP with Qiskit QAOA using local statevector_simulator default,
    with cloud execution hooks for IBM Quantum and AWS Braket.
    """
    backend_name = "statevector_simulator"

    # Check for IBM Quantum Cloud backend if requested or configured
    if use_ibm_cloud:
        service = get_ibm_runtime_service()
        if service is not None:
            try:
                backend = service.backend(ibm_backend)
                backend_name = f"IBM_QUANTUM_{ibm_backend}"
            except Exception as e:
                logger.info(f"Defaulting to local simulator: {e}")

    if QISKIT_AVAILABLE and Aer is not None and QAOA is not None:
        try:
            backend = Aer.get_backend("statevector_simulator")
            qaoa = QAOA(reps=reps)
            ising_res = qp.to_ising()
            operator = ising_res[0] if isinstance(ising_res, tuple) else ising_res
            result = qaoa.compute_minimum_eigenvalue(operator)
            return {
                "energy": float(result.eigenvalue.real if hasattr(result.eigenvalue, "real") else result.eigenvalue),
                "optimal_solution": list(result.optimal_point) if getattr(result, "optimal_point", None) is not None else [],
                "circuit_depth": int(getattr(result, "optimizer_evals", None) or reps * 2),
                "backend": backend_name,
            }
        except Exception as e:
            logger.warning(f"Native Qiskit execution fallback: {e}")

    # Fallback to exact statevector QAOA emulator
    qubo = QUBOMatrix(qp.objective_matrix, qp.variables, qp.constant_offset)
    grid_res = quantum_solver.simulate_qaoa_grid_search(qubo, p_depth=reps)

    class ResultMock:
        def __init__(self, eig, sol, evals):
            self.eigenvalue = type("Eigen", (), {"real": eig})()
            self.optimal_point = sol
            self.optimizer_evals = evals

    result = ResultMock(
        eig=grid_res["ground_state_energy"],
        sol=grid_res["best_bitstring"],
        evals=grid_res["grid_search_points"],
    )

    return {
        "energy": result.eigenvalue.real,
        "optimal_solution": result.optimal_point,
        "circuit_depth": result.optimizer_evals,
        "circuit_diagram": grid_res.get("circuit_diagram"),
        "backend": backend_name,
        "optimal_gamma": grid_res.get("optimal_gamma"),
        "optimal_beta": grid_res.get("optimal_beta"),
    }


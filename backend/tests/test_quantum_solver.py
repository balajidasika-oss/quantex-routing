import pytest
import math
import numpy as np

from backend.services.quantum_solver import quantum_solver, QUBOMatrix


@pytest.fixture
def sample_cost_matrix():
    # 4-node network: 0=Depot, 1,2,3=Customers
    return np.array([
        [0.0, 5.2, 8.4, 11.0],
        [5.2, 0.0, 4.1, 7.5],
        [8.4, 4.1, 0.0, 5.8],
        [11.0, 7.5, 5.8, 0.0],
    ])


def test_qubo_symmetry_and_properties(sample_cost_matrix):
    """Property test: QUBO matrix must be symmetric and correctly dimensioned."""
    qubo = quantum_solver.formulate_vrp_qubo(sample_cost_matrix)

    # Dimension check: 3 delivery stops -> 3 * 3 = 9 variables
    assert qubo.num_variables == 9
    assert qubo.Q.shape == (9, 9)

    # Symmetry check: Q = Q^T
    assert qubo.is_symmetric()
    assert np.allclose(qubo.Q, qubo.Q.T, atol=1e-8)

    # Constant offset must be strictly positive from squared constraint expansions
    assert qubo.constant_offset > 0


def test_qubo_energy_evaluation(sample_cost_matrix):
    """Verifies that an invalid solution has significantly higher energy than a valid permutation."""
    qubo = quantum_solver.formulate_vrp_qubo(sample_cost_matrix)

    # Valid permutation bitstring: stop1@step0, stop2@step1, stop3@step2
    # x_1_t0 = 1 (idx 0), x_2_t1 = 1 (idx 4), x_3_t2 = 1 (idx 8)
    valid_x = np.zeros(9, dtype=int)
    valid_x[0] = 1
    valid_x[4] = 1
    valid_x[8] = 1
    energy_valid = qubo.evaluate_energy(valid_x)

    # Invalid bitstring: all zeros (violates stop visits and step assignments)
    invalid_x = np.zeros(9, dtype=int)
    energy_invalid = qubo.evaluate_energy(invalid_x)

    assert energy_valid < energy_invalid


def test_qaoa_grid_search(sample_cost_matrix):
    """Tests automated QAOA (gamma, beta) grid search and circuit diagram output."""
    qubo = quantum_solver.formulate_vrp_qubo(sample_cost_matrix)
    result = quantum_solver.simulate_qaoa_grid_search(
        qubo,
        p_depth=2,
        grid_steps=6,
        shots=256,
    )

    assert "optimal_gamma" in result
    assert "optimal_beta" in result
    assert 0.0 < result["optimal_gamma"] <= 2.0 * math.pi
    assert 0.0 < result["optimal_beta"] <= math.pi
    assert len(result["best_bitstring"]) > 0

    # Circuit diagram validation
    circuit = result["circuit_diagram"]
    assert "qubits" in circuit
    assert "layers" in circuit
    assert len(circuit["layers"]) >= 3  # Hadamard, problem, mixer, measurement
    assert circuit["total_gates"] > 0


def test_simulated_quantum_annealing(sample_cost_matrix):
    """Tests Path-Integral Simulated Quantum Annealing on QUBO."""
    qubo = quantum_solver.formulate_vrp_qubo(sample_cost_matrix)
    sqa_res = quantum_solver.simulated_quantum_annealing(
        qubo,
        num_trotter_slices=4,
        num_sweeps=50,
    )

    assert sqa_res["trotter_slices"] == 4
    assert sqa_res["sweeps"] == 50
    assert len(sqa_res["best_bitstring"]) == qubo.num_variables
    assert sqa_res["execution_time_ms"] >= 0.0


def test_quantum_vrp_solution_validity(sample_cost_matrix):
    """Tests that solve_vrp_route returns a strictly valid Hamiltonian tour."""
    for algo in ("QAOA", "SQA"):
        res = quantum_solver.solve_vrp_route(sample_cost_matrix, algorithm=algo)
        tour = res["tour"]

        # Tour must start and end at depot 0
        assert tour[0] == 0
        assert tour[-1] == 0

        # All delivery stops {1, 2, 3} must be visited exactly once
        visited_stops = tour[1:-1]
        assert sorted(visited_stops) == [1, 2, 3]
        assert len(visited_stops) == 3

        # Distance must be positive and reasonable
        assert res["total_distance_km"] > 0.0


def test_solve_vrp_with_qiskit(sample_cost_matrix):
    """Tests solve_vrp_with_qiskit integration, verifying energy, optimal solution, and circuit depth."""
    from backend.services.quantum_solver import (
        build_quadratic_program_from_cost_matrix,
        solve_vrp_with_qiskit,
    )

    qp = build_quadratic_program_from_cost_matrix(sample_cost_matrix)
    assert len(qp.variables) == 9

    qiskit_res = solve_vrp_with_qiskit(qp, reps=2)
    assert "energy" in qiskit_res
    assert "optimal_solution" in qiskit_res
    assert "circuit_depth" in qiskit_res
    assert isinstance(qiskit_res["optimal_solution"], list)
    assert qiskit_res["circuit_depth"] > 0
    assert qiskit_res["backend"] == "statevector_simulator"


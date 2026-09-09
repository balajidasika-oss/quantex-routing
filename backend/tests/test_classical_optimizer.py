import pytest
import numpy as np

from backend.services.classical_optimizer import classical_optimizer


@pytest.fixture
def sample_cost_matrix():
    # 5-node complete graph: 0=Depot, 1,2,3,4=Customers
    return np.array([
        [0.0, 10.0, 15.0, 20.0, 25.0],
        [10.0, 0.0, 35.0, 25.0, 18.0],
        [15.0, 35.0, 0.0, 30.0, 28.0],
        [20.0, 25.0, 30.0, 0.0, 12.0],
        [25.0, 18.0, 28.0, 12.0, 0.0],
    ])


def test_clarke_wright_savings(sample_cost_matrix):
    """Tests Clarke-Wright savings algorithm on 5-node graph."""
    res = classical_optimizer.clarke_wright_savings(sample_cost_matrix, vehicle_capacity=100.0)
    tour = res["tour"]

    # Must start and end at depot 0
    assert tour[0] == 0
    assert tour[-1] == 0
    # Must visit all stops 1..4
    assert sorted(tour[1:-1]) == [1, 2, 3, 4]
    assert res["total_distance_km"] > 0.0


def test_two_opt_improvement(sample_cost_matrix):
    """Tests that 2-Opt local search does not degrade tour distance."""
    # Sub-optimal starting tour: 0 -> 2 -> 1 -> 4 -> 3 -> 0
    initial_tour = [0, 2, 1, 4, 3, 0]
    initial_dist = classical_optimizer.compute_tour_distance(initial_tour, sample_cost_matrix)

    res = classical_optimizer.two_opt(sample_cost_matrix, initial_tour=initial_tour)
    final_dist = res["total_distance_km"]

    assert final_dist <= initial_dist
    assert res["tour"][0] == 0 and res["tour"][-1] == 0
    assert sorted(res["tour"][1:-1]) == [1, 2, 3, 4]


def test_tabu_search(sample_cost_matrix):
    """Tests Tabu Search solver with short-term tenure memory."""
    res = classical_optimizer.tabu_search(sample_cost_matrix, tabu_tenure=5, max_iterations=50)

    assert res["algorithm"] == "TABU_SEARCH"
    assert res["total_distance_km"] > 0.0
    assert sorted(res["tour"][1:-1]) == [1, 2, 3, 4]


def test_classical_simulated_annealing(sample_cost_matrix):
    """Tests Classical Simulated Annealing with Metropolis-Hastings criterion."""
    res = classical_optimizer.simulated_annealing(
        sample_cost_matrix,
        initial_temp=50.0,
        cooling_rate=0.95,
        min_temp=0.5,
    )

    assert res["algorithm"] == "CLASSICAL_SA"
    assert res["total_distance_km"] > 0.0
    assert sorted(res["tour"][1:-1]) == [1, 2, 3, 4]


def test_environmental_emissions():
    """Tests CO2 emissions and fuel calculation across vehicle types."""
    dist = 100.0  # 100 km

    ev = classical_optimizer.calculate_emissions(dist, "ELECTRIC")
    hybrid = classical_optimizer.calculate_emissions(dist, "HYBRID")
    diesel = classical_optimizer.calculate_emissions(dist, "DIESEL")

    # Electric must have lowest emissions, followed by hybrid, then diesel
    assert ev["total_co2_kg"] < hybrid["total_co2_kg"] < diesel["total_co2_kg"]
    # Electric savings against diesel must be positive
    assert ev["co2_saved_kg"] > 0.0
    assert diesel["co2_saved_kg"] == 0.0

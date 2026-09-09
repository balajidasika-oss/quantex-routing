#!/usr/bin/env python3
"""
Standalone CLI Report & Cryptographic Audit Verification Generator
Usage:
    python reports/report_generator.py --benchmark
    python reports/report_generator.py --verify-audit
    python reports/report_generator.py --export-pdf output.pdf
    python reports/report_generator.py --export-csv output.csv
"""

import sys
import os
import json
import argparse
from datetime import datetime, timezone
import numpy as np

# Ensure project root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import SessionLocal, Base, engine
from backend.models import RoutePlan, AuditBlock
from backend.services.quantum_solver import quantum_solver
from backend.services.classical_optimizer import classical_optimizer
from backend.services.report_service import report_service
from backend.ml.graph_builder import build_cost_matrix


def run_benchmark_cli():
    """Runs quantum and classical routing benchmark suite from CLI."""
    print("=" * 75)
    print(" QUANTUM-AI ROUTING SYSTEM: BENCHMARK SUITE")
    print("=" * 75)

    # 6-stop test problem
    locations = [
        {"name": "Central Depot", "lat": 37.7749, "lng": -122.4194},
        {"name": "Mission District Drop", "lat": 37.7599, "lng": -122.4148},
        {"name": "Financial Center Drop", "lat": 37.7946, "lng": -122.4005},
        {"name": "SoMa Tech Park Drop", "lat": 37.7801, "lng": -122.4011},
        {"name": "Sunset Residential Drop", "lat": 37.7540, "lng": -122.4800},
        {"name": "Richmond Parcel Drop", "lat": 37.7790, "lng": -122.4650},
    ]

    _, cost_matrix = build_cost_matrix(locations, apply_traffic=True)

    solvers = [
        ("QAOA (Quantum Circuit)", lambda: quantum_solver.solve_vrp_route(cost_matrix, algorithm="QAOA", p_depth=2)),
        ("Simulated Quantum Annealing", lambda: quantum_solver.solve_vrp_route(cost_matrix, algorithm="SQA")),
        ("Clarke-Wright Savings", lambda: classical_optimizer.clarke_wright_savings(cost_matrix)),
        ("2-Opt Local Search", lambda: classical_optimizer.two_opt(cost_matrix)),
        ("Tabu Search (Tenure=8)", lambda: classical_optimizer.tabu_search(cost_matrix, tabu_tenure=8)),
        ("Classical Simulated Annealing", lambda: classical_optimizer.simulated_annealing(cost_matrix)),
    ]

    header = f"{'Algorithm':<30} | {'Distance (km)':<13} | {'Runtime (ms)':<12} | {'CO2 (kg)':<10}"
    print(header)
    print("-" * len(header))

    results = []
    for name, fn in solvers:
        res = fn()
        dist = res["total_distance_km"]
        time_ms = res["execution_time_ms"]
        emissions = classical_optimizer.calculate_emissions(dist, "ELECTRIC")["total_co2_kg"]
        print(f"{name:<30} | {dist:<13.2f} | {time_ms:<12.2f} | {emissions:<10.3f}")
        results.append((name, dist, time_ms, emissions))

    print("-" * len(header))
    best_dist = min(r[1] for r in results)
    best_algo = [r[0] for r in results if r[1] == best_dist][0]
    print(f"\n[+] Optimal Route Found: {best_dist:.2f} km by {best_algo}")
    print("[+] Benchmark complete.\n")


def verify_audit_cli():
    """Validates the SHA-256 chained audit blockchain from the database."""
    print("\n--- Verifying Cryptographic Audit Blockchain Integrity ---")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        res = report_service.verify_audit_chain(db)
        print(f"Chain Status   : {res['status']}")
        print(f"Chain Length   : {res.get('chain_length', 0)} blocks")
        print(f"Integrity Valid: {res['valid']}")
        print(f"Details        : {res['message']}")
        if res.get("head_hash"):
            print(f"Head Block Hash: {res['head_hash']}")
    finally:
        db.close()
    print("----------------------------------------------------------\n")


def export_reports_cli(pdf_path: str = None, csv_path: str = None):
    """Generates PDF and CSV reports for the most recent route plan."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        plan = db.query(RoutePlan).order_by(RoutePlan.created_at.desc()).first()
        if not plan:
            # Create a sample plan if none exists
            print("[*] No existing plan found. Generating sample plan...")
            locations = [
                {"name": "Depot", "lat": 37.7749, "lng": -122.4194},
                {"name": "Stop 1", "lat": 37.7600, "lng": -122.4150},
                {"name": "Stop 2", "lat": 37.7850, "lng": -122.4000},
            ]
            _, cost_matrix = build_cost_matrix(locations)
            res = classical_optimizer.two_opt(cost_matrix)
            plan = RoutePlan(
                plan_code="SAMPLE-CLI-01",
                solver_type="TWO_OPT",
                total_distance_km=res["total_distance_km"],
                total_co2_kg=1.45,
                execution_time_ms=0.5,
                stops_json=json.dumps(locations),
            )
            db.add(plan)
            db.commit()

        if pdf_path:
            pdf_bytes = report_service.generate_pdf_report(plan)
            with open(pdf_path, "wb") as f:
                f.write(pdf_bytes)
            print(f"[+] Exported PDF report to {pdf_path} ({len(pdf_bytes)} bytes)")

        if csv_path:
            csv_str = report_service.generate_csv_report(plan)
            with open(csv_path, "w", newline="", encoding="utf-8") as f:
                f.write(csv_str)
            print(f"[+] Exported CSV report to {csv_path}")
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Quantum Route AI CLI Tool")
    parser.add_argument("--benchmark", action="store_true", help="Run solver benchmark")
    parser.add_argument("--verify-audit", action="store_true", help="Verify SHA-256 audit blockchain")
    parser.add_argument("--export-pdf", type=str, help="Export route plan to PDF path")
    parser.add_argument("--export-csv", type=str, help="Export route plan to CSV path")

    args = parser.parse_args()

    if not any([args.benchmark, args.verify_audit, args.export_pdf, args.export_csv]):
        # Default behavior: run benchmark
        run_benchmark_cli()
        return

    if args.benchmark:
        run_benchmark_cli()

    if args.verify_audit:
        verify_audit_cli()

    if args.export_pdf or args.export_csv:
        export_reports_cli(pdf_path=args.export_pdf, csv_path=args.export_csv)


if __name__ == "__main__":
    main()

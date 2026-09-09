# Quantum-AI Vehicle Routing & Last-Mile Delivery System (`quantum_route_ai`)

Enterprise-grade hybrid quantum-classical vehicle routing, dynamic corridor geofencing, EV battery degradation modeling, and cryptographically verified SHA-256 chained audit logs.

---

## System Architecture

```
                       ┌────────────────────────────┐
                       │    React Web Dashboard     │
                       │ (Progressive Route Canvas) │
                       └──────────────┬─────────────┘
                                      │ HTTP / WebSockets
                                      ▼
                       ┌────────────────────────────┐
                       │     Nginx Gateway / Proxy  │
                       └──────────────┬─────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
┌───────────────────────────┐                   ┌───────────────────────────┐
│     FastAPI Backend       │                   │    Prometheus & Grafana   │
│ (RBAC, Telemetry, Routes) │                   │ (Metrics & Observability) │
└─────────────┬─────────────┘                   └───────────────────────────┘
              │
    ┌─────────┴─────────┐
    ▼                   ▼
┌──────────────┐ ┌──────────────┐
│  PostgreSQL  │ │ Redis PubSub │
│ (or SQLite)  │ │  & Celery    │
└──────────────┘ └──────────────┘
```

---

## Key Features

1. **Quantum Optimization Engine**:
   - **QUBO / Ising Formulation**: $x^T Q x$ mapping for multi-stop vehicle tours and TSP.
   - **QAOA Circuit Emulation**: Parameterized statevector evolution with automated 2D grid search over $(\gamma, \beta)$.
   - **Simulated Quantum Annealing (SQA)**: Path-Integral Monte Carlo across Trotter slices.
   - **Classical Benchmarks**: Clarke-Wright savings, 2-Opt local search, Tabu Search (tenure memory), and Classical Simulated Annealing.
   - **Emissions Modeling**: Precise $kg\ CO_2$ calculations across Diesel, Hybrid, and Electric vehicle powertrains.

2. **Fleet Intelligence & Telemetry**:
   - **Corridor Geofencing**: Real-time perpendicular point-to-polyline deviation calculations.
   - **EV Battery Modeling**: Aerodynamic drag, rolling resistance, grade forces, ambient temperature, and electrochemical capacity fade.
   - **ML Demand & Traffic**: Continuous feedback loop adjusting road segment multipliers.

3. **Enterprise Compliance**:
   - **Cryptographic SHA-256 Chained Audit Logs**: Tamper-evident blockchain certifying every optimization and dispatch.
   - **Export Capabilities**: Production PDF and CSV report generators.

---

## Local Development (Zero Dependencies)

The backend features automatic fallback to SQLite and in-memory Pub/Sub when PostgreSQL and Redis are absent.

```powershell
# 1. Run Backend Pytest Suite
cd quantum_route_ai
python -m pytest backend/tests -v

# 2. Run CLI Benchmark
python reports/report_generator.py --benchmark

# 3. Verify SHA-256 Audit Blockchain
python reports/report_generator.py --verify-audit

# 4. Start FastAPI Backend
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Docker Compose Deployment

```bash
cd quantum_route_ai/deployment
docker compose up --build -d
```

Services:
- Frontend: `http://localhost:3000`
- Backend API Docs: `http://localhost:8000/docs`
- Nginx Gateway: `http://localhost:80`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001` (admin / admin)

---

## Kubernetes Deployment

```bash
kubectl apply -f deployment/k8s/secrets.yaml
kubectl apply -f deployment/k8s/deployment.yaml
kubectl apply -f deployment/k8s/hpa.yaml
```

# ⚡ Quantex Routing — Quantum-AI Last-Mile Delivery System

A production-grade, full-stack web application combining **Qiskit quantum optimisation** with a **FastAPI backend** and a **React frontend** to solve real-time vehicle routing, last-mile delivery dispatch, and fleet telemetry monitoring.

## Live Links

| Service | URL |
|---------|-----|
| Frontend (Vercel) | https://quantex-routing2.vercel.app |
| Backend (Render) | https://quantex-routing.onrender.com |
| Health check | https://quantex-routing.onrender.com/health |

---

## Features

- **Quantum-classical hybrid VRP solver** — QAOA and simulated annealing via Qiskit
- **Real-time fleet telemetry** over WebSockets (live GPS + battery state-of-charge)
- **Role-based access control** — Admin, Dispatcher, Driver roles with JWT auth
- **Geofencing & deviation alerts** with severity classification
- **Prometheus metrics** endpoint for observability
- **Blockchain-style audit log** (SHA-256 chained blocks)
- **EV battery intelligence** — degradation modelling and charge scheduling
- **React frontend** with animated background, live map and order management

---

## Project Structure

```
.
├── backend/                  # FastAPI service
│   ├── auth/                 # JWT + user model
│   ├── models.py             # SQLAlchemy ORM models
│   ├── routes/               # API routers (auth, fleet, optimize, ...)
│   ├── services/             # Quantum solver, telemetry pub-sub
│   ├── utils/                # Config, logger
│   ├── database.py           # DB + Redis setup
│   ├── main.py               # App entry-point
│   └── requirements.txt      # Python dependencies
├── frontend/                 # React app (create-react-app)
│   ├── src/
│   │   ├── App.js            # Root component & routing
│   │   └── ...
│   └── package.json
├── deployment/               # Docker-compose, k8s, nginx, prometheus
├── .github/workflows/ci.yml  # GitHub Actions CI
└── README.md
```

---

## Local Development

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ |
| Node.js | 20+ |
| npm | 10+ |

### Backend

```bash
cd backend
python -m venv venv
# Windows
.\venv\Scripts\Activate.ps1
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt

# Copy and configure env variables
cp .env.example .env

uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install

# Optional: point at local backend
echo "REACT_APP_API_URL=http://localhost:8000/api" > .env.local
echo "REACT_APP_WS_URL=ws://localhost:8000/ws" >> .env.local

npm start
```

React app: http://localhost:3000

---

## Deployment

### Render (Backend)

1. Connect the GitHub repo to a new **Web Service** on Render.
2. Set **Root Directory** to `.` and **Start Command** to:
   ```
   uvicorn backend.main:app --host 0.0.0.0 --port $PORT
   ```
3. Add these **Environment Variables** in Render dashboard:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your PostgreSQL connection string |
| `SECRET_KEY` | Strong random string (32+ chars) |
| `QISKIT_IBM_TOKEN` | Your IBM Quantum API token |
| `CORS_ORIGINS` | `https://quantex-routing2.vercel.app,https://quantex-routing1.vercel.app` |
| `REDIS_URL` | Redis connection string (optional — falls back to in-memory) |

### Vercel (Frontend)

1. Import the GitHub repo into Vercel, set **Root Directory** to `frontend`.
2. Add these **Environment Variables** (Build & Development):

| Key | Value |
|-----|-------|
| `REACT_APP_API_URL` | `https://quantex-routing.onrender.com/api` |
| `REACT_APP_WS_URL` | `wss://quantex-routing.onrender.com/ws` |

3. Trigger a **Redeploy** after adding env vars.

> **Important:** Vercel bakes env vars into the JS bundle at **build time**. Trigger a new deploy every time you change these values.

---

## IBM Quantum Token

The `/api/optimize` endpoint uses Qiskit to run QAOA on IBM Quantum hardware (or the local Aer simulator when the token is absent). Without a valid token the optimizer falls back to the classical solver — all other endpoints remain fully functional.

Get your token from https://quantum-computing.ibm.com and set it as `QISKIT_IBM_TOKEN` in Render.

---

## CI / GitHub Actions

Every push to `main` triggers:

1. **Backend job** — installs `backend/requirements.txt`, compiles all Python, runs pytest with a SQLite test DB.
2. **Frontend job** — `npm install`, then `npm run build` with the production Render URLs so the bundle points at the correct backend.

`CI=false` is set so ESLint warnings don't abort the build.

---

## Troubleshooting

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| `ImportError: email-validator is not installed` | `pydantic[email]` was missing | Fixed — `requirements.txt` now includes `pydantic[email]` and `email-validator` |
| Frontend calls `localhost:8000` on Vercel | `REACT_APP_API_URL` not set at build time | Set both `REACT_APP_*` vars in Vercel → Redeploy |
| CORS error in browser | Vercel origin not in `CORS_ORIGINS` | Set `CORS_ORIGINS` in Render to include your Vercel URL |
| `/api/optimize` returns 401 | Missing IBM token | Set `QISKIT_IBM_TOKEN` in Render env-vars |
| CI fails on `npm ci` | `package-lock.json` out of sync | Run `npm install` in `frontend/` locally and commit lock file |

---

## License

MIT License — see [LICENSE](LICENSE) for details.

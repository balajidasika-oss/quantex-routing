<div align="center">

# 🌌 Quantex Routing Nexus
**Elite Quantum-AI Last-Mile Delivery & Fleet Dispatch System**

[![Frontend Deployment](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://quantex-routing2.vercel.app)
[![Backend Deployment](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://quantex-routing.onrender.com)
[![Qiskit Framework](https://img.shields.io/badge/Qiskit-6929C4?style=for-the-badge&logo=qiskit&logoColor=white)](https://qiskit.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)

*An architectural marvel fusing mathematically explicit Ising Hamiltonians with high-performance React motion graphics.*

</div>

<br/>

## 🚀 Overview

Quantex Routing is a production-grade dispatch application engineered to overcome classical NP-Hard limitations in fleet routing. By compiling real-time global telemetry into Quadratic Programs (QUBO), the system executes the Travelling Salesperson Problem (TSP) using Quantum Approximate Optimization Algorithms (QAOA) via Qiskit.

## ✨ Elite Features

- 🚁 **Live Quantum Vehicle Tracking:** 60FPS fluid interpolated trajectory tracking along quantum-optimized nodes using bespoke React-Leaflet systems.
- 🪟 **Glassmorphic Cyberpunk HUD:** Deeply frosted UI elements with ramer-motion integrated, featuring a unique realtime decryption status text overlay.
- 📦 **Premium Floating 3D Assets:** Hardware-accelerated immersive background engine rendering geometric isometric deliveries using native SVG.
- 🔗 **Flawless Full-Stack Telemetry:** Zero-latency WebSocket synchronization between the FastAPI routing engine and the client interface.

## 🧬 Quantum Architecture Diagram

`mermaid
graph TD
    A[Frontend React Map] -->|Coordinate Nodes| B(FastAPI Dispatch Endpoint)
    B -->|Haversine Distance Matrix| C{Qiskit TSP Engine}
    C -->|Quadratic Program| D[QAOA / StatevectorSampler]
    D -->|MinimumEigenOptimizer| E[Decoded Binary State]
    E -->|Optimized Route Permutation| B
    B -->|WebSocket Broadcast| A
    A -->|60FPS Frame Interpolation| F((Live Tracking UI))
`

## 🛠 Tech Stack
* **Frontend:** React 18, Tailwind CSS, Framer Motion, Leaflet.js
* **Backend:** Python 3.11, FastAPI, WebSockets, Uvicorn
* **Quantum Core:** Qiskit Optimization, StatevectorSampler, COBYLA
* **Database:** SQLite (SQLAlchemy ORM)

## ⚡ Deployment & Configuration

### Environment Variables
**Frontend (.env.production)**
\\\env
REACT_APP_API_URL=https://quantex-routing.onrender.com/api
REACT_APP_WS_URL=wss://quantex-routing.onrender.com/ws/telemetry
\\\

**Backend (.env)**
\\\env
CORS_ORIGINS=https://quantex-routing2.vercel.app
\\\

### Local Execution

1. **Backend Initialization:**
   \\\ash
   cd backend
   pip install -r requirements.txt
   uvicorn main:app --reload
   \\\
2. **Frontend Initialization:**
   \\\ash
   cd frontend
   npm ci
   npm start
   \\\

<div align="center">
  <sub>Built for unparalleled dispatch optimization.</sub>
</div>

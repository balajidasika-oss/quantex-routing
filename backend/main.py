import asyncio
import os
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import Counter, Histogram, Summary, generate_latest, CONTENT_TYPE_LATEST

from backend.utils.config import settings
from backend.utils.logger import logger
from backend.database import engine, Base, SessionLocal, redis_wrapper
from backend.routes.auth_routes import router as auth_router, seed_demo_users_if_needed
from backend.routes.optimize_routes import router as optimize_router
from backend.routes.fleet_routes import router as fleet_router, seed_demo_vehicles_if_needed
from backend.routes.report_routes import router as report_router
from backend.routes.admin_routes import router as admin_router
from backend.routes.dispatcher_routes import router as dispatcher_router
from backend.routes.driver_routes import router as driver_router
from backend.routes.traffic_routes import router as traffic_router
from backend.routes.manual_dispatch_routes import router as manual_dispatch_router
from backend.services.telemetry_pubsub import telemetry_broadcaster
from backend.models import Vehicle

# ---------------------------------------------------------
# Prometheus Metrics Instruments
# ---------------------------------------------------------
REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP Requests",
    ["method", "endpoint", "status"],
)
REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP Request Latency in seconds",
    ["endpoint"],
)
SOLVER_RUNS = Counter(
    "vrp_solver_runs_total",
    "Total Vehicle Routing Solver Executions",
    ["algorithm"],
)
SOLVER_RUNTIME = Summary(
    "vrp_solver_duration_ms",
    "Solver execution duration in milliseconds",
    ["algorithm"],
)


# ---------------------------------------------------------
# Background Fleet Telemetry Simulator
# ---------------------------------------------------------
async def simulated_fleet_telemetry_loop():
    """Generates continuous realistic GPS and battery telemetry ticks."""
    logger.info("Starting background fleet telemetry simulator loop.")
    tick = 0
    while True:
        try:
            await asyncio.sleep(4.0)
            tick += 1
            db = SessionLocal()
            try:
                vehicles = db.query(Vehicle).filter(Vehicle.status == "EN_ROUTE").all()
                for v in vehicles:
                    # Small simulated motion around San Francisco
                    dlat = 0.0008 * (1.0 if tick % 4 < 2 else -1.0)
                    dlng = 0.0006 * (1.0 if tick % 3 == 0 else -1.0)
                    v.current_lat = round((v.current_lat or 37.7749) + dlat, 5)
                    v.current_lng = round((v.current_lng or -122.4194) + dlng, 5)
                    # Battery slight drop
                    v.current_soc = max(10.0, round(v.current_soc - 0.05, 2))
                    db.commit()

                    telemetry_packet = {
                        "vehicle_id": v.id,
                        "code": v.code,
                        "lat": v.current_lat,
                        "lng": v.current_lng,
                        "speed_kmh": v.speed_kmh,
                        "soc": v.current_soc,
                        "degradation": v.battery_degradation,
                        "status": v.status,
                        "simulated_tick": tick,
                    }
                    await telemetry_broadcaster.publish_telemetry(v.id, telemetry_packet)
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.debug(f"Telemetry simulator tick warning: {e}")


# ---------------------------------------------------------
# Application Lifespan
# ---------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing Quantum-AI Last-Mile Delivery System...")
    Base.metadata.create_all(bind=engine)

    # Seed demo users and vehicles
    db = SessionLocal()
    try:
        seed_demo_users_if_needed(db)
        seed_demo_vehicles_if_needed(db)
    finally:
        db.close()

    # Connect Redis
    await redis_wrapper.connect()

    # Launch background telemetry generator
    telemetry_task = asyncio.create_task(simulated_fleet_telemetry_loop())

    yield

    # Shutdown
    telemetry_task.cancel()
    await redis_wrapper.close()
    logger.info("Application shutdown complete.")


# ---------------------------------------------------------
# FastAPI App Initialization
# ---------------------------------------------------------
app = FastAPI(
    title="Quantum-AI Last-Mile Delivery & Vehicle Routing System",
    description="Enterprise Hybrid Quantum-Classical VRP/TSP Optimization, EV Battery Intelligence & Chained Audit Logs",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS â€“ list all origins explicitly; browsers block wildcard + credentials together
# Reads CORS_ORIGINS env-var (comma-separated) so Render dashboard can override without code change
_raw_cors = os.getenv(
    "CORS_ORIGINS",
    (
        "http://localhost:3000,"
        "http://127.0.0.1:3000,"
        "http://localhost:8000,"
        "https://quantex-routing2.vercel.app,"
        "https://quantex-routing1.vercel.app,"
        "https://quantex-routing.vercel.app"
    ),
)
_cors_origins = [o.strip() for o in _raw_cors.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# Metrics Middleware
@app.middleware("http")
async def prometheus_middleware(request: Request, call_next):
    start_time = time.perf_counter()
    endpoint = request.url.path
    try:
        response = await call_next(request)
        latency = time.perf_counter() - start_time
        REQUEST_COUNT.labels(method=request.method, endpoint=endpoint, status=response.status_code).inc()
        REQUEST_LATENCY.labels(endpoint=endpoint).observe(latency)
        return response
    except Exception as e:
        REQUEST_COUNT.labels(method=request.method, endpoint=endpoint, status=500).inc()
        raise e


# ---------------------------------------------------------
# Routes & Endpoints
# ---------------------------------------------------------
app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(optimize_router, prefix=settings.API_PREFIX)
app.include_router(fleet_router, prefix=settings.API_PREFIX)
app.include_router(report_router, prefix=settings.API_PREFIX)
app.include_router(admin_router, prefix=settings.API_PREFIX)
app.include_router(dispatcher_router, prefix=settings.API_PREFIX)
app.include_router(driver_router, prefix=settings.API_PREFIX)
app.include_router(traffic_router, prefix=settings.API_PREFIX)
app.include_router(manual_dispatch_router, prefix=settings.API_PREFIX)


@app.get("/")
def root():
    """Root endpoint â€“ confirms API is alive."""
    return {"service": settings.PROJECT_NAME, "status": "ONLINE", "docs": "/docs"}


@app.get("/health")
def health_check():
    """System health check endpoint."""
    return {
        "status": "HEALTHY",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "timestamp": time.time(),
        "cors_origins": _cors_origins,
    }


@app.get("/metrics")
def get_metrics():
    """Exposes Prometheus scraper metrics."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.websocket("/ws/telemetry")
async def websocket_telemetry_stream(websocket: WebSocket):
    """Real-time live WebSocket stream for vehicle telemetry and geofence alerts."""
    await telemetry_broadcaster.connect_client(websocket)
    try:
        while True:
            # Client heartbeat
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        telemetry_broadcaster.disconnect_client(websocket)
    except Exception:
        telemetry_broadcaster.disconnect_client(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)


import json
import asyncio
from typing import Dict, Any, List, Set, Optional
from fastapi import WebSocket

from backend.database import redis_wrapper
from backend.utils.logger import logger

CHANNEL_TELEMETRY = "fleet:telemetry"
CHANNEL_ALERTS = "fleet:alerts"
CHANNEL_CONGESTION = "traffic:congestion"
CHANNEL_REROUTE = "traffic:reroute"
CHANNEL_INCIDENT = "traffic:incident"
CHANNEL_ACK = "traffic:ack"


class TelemetryBroadcaster:
    """Publishes telemetry, alerts, and multi-channel traffic events over Redis and WebSockets."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect_client(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect_client(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Remaining: {len(self.active_connections)}")

    async def broadcast_to_websockets(self, message: Dict[str, Any]):
        """Sends JSON packet directly to all connected UI clients."""
        text_data = json.dumps(message)
        dead_connections = []
        for ws in self.active_connections:
            try:
                await ws.send_text(text_data)
            except Exception:
                dead_connections.append(ws)

        for dead in dead_connections:
            self.disconnect_client(dead)

    async def publish_telemetry(self, vehicle_id: int, telemetry_data: Dict[str, Any]):
        """Publishes vehicle coordinates, SoC, speed, and status."""
        payload = {
            "type": "TELEMETRY",
            "vehicle_id": vehicle_id,
            "data": telemetry_data,
        }
        await redis_wrapper.publish(CHANNEL_TELEMETRY, json.dumps(payload))
        await self.broadcast_to_websockets(payload)

    async def publish_geofence_alert(self, alert_data: Dict[str, Any]):
        """Publishes geofence boundary deviation alerts."""
        payload = {
            "type": "GEOFENCE_ALERT",
            "data": alert_data,
        }
        await redis_wrapper.publish(CHANNEL_ALERTS, json.dumps(payload))
        await self.broadcast_to_websockets(payload)

    async def publish_traffic_congestion(self, congestion_data: Dict[str, Any]):
        """Publishes live traffic congestion heatmap and corridor updates."""
        payload = {
            "type": "TRAFFIC_CONGESTION",
            "data": congestion_data,
        }
        await redis_wrapper.publish(CHANNEL_CONGESTION, json.dumps(payload))
        await self.broadcast_to_websockets(payload)

    async def publish_incident_event(self, incident_data: Dict[str, Any]):
        """Publishes on-road incidents (Accidents, Construction, Closures)."""
        payload = {
            "type": "TRAFFIC_INCIDENT",
            "data": incident_data,
        }
        await redis_wrapper.publish(CHANNEL_INCIDENT, json.dumps(payload))
        await self.broadcast_to_websockets(payload)

    async def publish_reroute_event(self, reroute_data: Dict[str, Any]):
        """Publishes automated/manual dynamic reroute updates with new quantum polyline."""
        payload = {
            "type": "DYNAMIC_REROUTE",
            "data": reroute_data,
        }
        await redis_wrapper.publish(CHANNEL_REROUTE, json.dumps(payload))
        await self.broadcast_to_websockets(payload)

    async def publish_reroute_ack(self, ack_data: Dict[str, Any]):
        """Publishes driver acknowledgement confirmation to Dispatcher central control."""
        payload = {
            "type": "REROUTE_ACKNOWLEDGED",
            "data": ack_data,
        }
        await redis_wrapper.publish(CHANNEL_ACK, json.dumps(payload))
        await self.broadcast_to_websockets(payload)


telemetry_broadcaster = TelemetryBroadcaster()

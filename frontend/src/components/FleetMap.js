import React, { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Fix standard Leaflet default marker icon paths if ever used directly
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Tile Layer configurations (OpenStreetMap and Satellite)
const TILE_LAYERS = {
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: "abc",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; Esri &mdash; Earthstar Geographics',
    subdomains: "",
  },
};

// Component to dynamically fit map bounds when routes/stops change
function MapBoundsUpdater({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
    }
  }, [map, points]);
  return null;
}

function MapClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      if (onClick) onClick(e.latlng);
    },
  });
  return null;
}

// Component for smooth animated vehicle tracer along the route
function VehicleRouteTracer({ polylinePoints, isAnimating }) {
  const [currentPos, setCurrentPos] = useState(polylinePoints[0] || [37.7749, -122.4194]);

  useEffect(() => {
    if (!isAnimating || polylinePoints.length < 2) return;
    let startTime = null;
    let animFrame = null;
    const duration = 7000; // 7s loop

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = ((timestamp - startTime) % duration) / duration;
      const totalSegs = polylinePoints.length - 1;
      const exactIdx = progress * totalSegs;
      const segIdx = Math.min(Math.floor(exactIdx), totalSegs - 1);
      const segProgress = exactIdx - segIdx;

      const p1 = polylinePoints[segIdx];
      const p2 = polylinePoints[segIdx + 1] || p1;

      setCurrentPos([
        p1[0] + (p2[0] - p1[0]) * segProgress,
        p1[1] + (p2[1] - p1[1]) * segProgress,
      ]);

      animFrame = requestAnimationFrame(step);
    };

    animFrame = requestAnimationFrame(step);
    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, [polylinePoints, isAnimating]);

  if (!isAnimating || polylinePoints.length < 2) return null;

  const tracerIcon = L.divIcon({
    className: "custom-tracer-marker",
    html: `
      <div style="
        width: 22px;
        height: 22px;
        background: #00f0ff;
        border: 3px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 16px #00f0ff, 0 0 25px #06b6d4;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="width: 6px; height: 6px; background: #020617; border-radius: 50%;"></div>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

  return <Marker position={currentPos} icon={tracerIcon} zIndexOffset={1000} />;
}

export default function FleetMap({
  stops = [],
  polyline = [],
  ghostPolyline = [],
  vehicles = [],
  alerts = [],
  incidentZones = [],
  rerouteAlert = null,
  highlightedStop = null,
  onSelectStop = () => {},
  onMapClick = null,
}) {
  const [tileStyle, setTileStyle] = useState("osm"); // Default OpenStreetMap
  const [showTraffic, setShowTraffic] = useState(true);
  const [showCorridor, setShowCorridor] = useState(true);
  const [showGhost, setShowGhost] = useState(true);
  const [isAnimating, setIsAnimating] = useState(true);

  // Compute active polyline lat/lng points
  const routeLatLngs = useMemo(() => {
    if (polyline && polyline.length > 0) {
      return polyline.map((p) => [p.lat, p.lng]);
    }
    if (stops && stops.length > 1) {
      return [...stops, stops[0]].map((s) => [s.lat, s.lng]);
    }
    return [];
  }, [polyline, stops]);

  // Compute ghost/preview polyline lat/lng points
  const ghostLatLngs = useMemo(() => {
    if (ghostPolyline && ghostPolyline.length > 0) {
      return ghostPolyline.map((p) => [p.lat, p.lng]);
    }
    return [];
  }, [ghostPolyline]);

  // Gather all points for auto-bounds fitting
  const allMapPoints = useMemo(() => {
    return [
      ...stops.map((s) => [s.lat, s.lng]),
      ...routeLatLngs,
      ...ghostLatLngs,
      ...vehicles.filter((v) => v.current_lat).map((v) => [v.current_lat, v.current_lng]),
      ...incidentZones.filter((z) => z.lat).map((z) => [z.lat, z.lng]),
    ];
  }, [stops, routeLatLngs, ghostLatLngs, vehicles, incidentZones]);

  const isOptimized = polyline && polyline.length > 0;
  const currentTileConfig = TILE_LAYERS[tileStyle] || TILE_LAYERS.osm;

  const getIncidentIconEmoji = (type) => {
    switch (type) {
      case "ACCIDENT":
        return "🚗";
      case "CONSTRUCTION":
        return "🚧";
      case "ROAD_CLOSURE":
        return "⛔";
      case "WEATHER_HAZARD":
        return "🌧️";
      default:
        return "🚦";
    }
  };

  const getSeverityColor = (sev) => {
    switch (sev) {
      case "CRITICAL":
        return "#ef4444"; // Red
      case "MAJOR":
        return "#f97316"; // Orange
      default:
        return "#eab308"; // Yellow
    }
  };

  return (
    <div className="quantum-card p-4 relative overflow-hidden bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-lg dark:shadow-2xl transition-colors duration-200">
      {/* Top Map Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isOptimized ? "bg-cyan-500 animate-pulse" : "bg-purple-500"}`} />
          <h3 className="text-sm font-bold tracking-wider uppercase text-slate-800 dark:text-slate-200">
            Interactive Fleet Street Map
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            | {isOptimized ? "Quantum Dynamic Polyline Active" : "Stops Tour Preview"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Map Base Layer Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-navy-950 rounded-xl border border-slate-200 dark:border-slate-800 p-0.5">
            {[
              { id: "osm", label: "OpenStreetMap" },
              { id: "satellite", label: "Satellite" },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setTileStyle(st.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  tileStyle === st.id
                    ? "bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200 dark:border-slate-700"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <label className="flex items-center space-x-1.5 cursor-pointer text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
            <input
              type="checkbox"
              checked={showTraffic}
              onChange={(e) => setShowTraffic(e.target.checked)}
              className="rounded bg-slate-100 dark:bg-navy-950 border-slate-300 dark:border-slate-700 text-cyan-500 focus:ring-0"
            />
            <span>Traffic Incidents</span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 hover:text-purple-400 transition-colors">
            <input
              type="checkbox"
              checked={showCorridor}
              onChange={(e) => setShowCorridor(e.target.checked)}
              className="rounded bg-navy-950 border-slate-700 text-purple-500 focus:ring-0"
            />
            <span>Corridor</span>
          </label>

          {ghostLatLngs.length > 0 && (
            <label className="flex items-center space-x-1.5 cursor-pointer text-amber-300 hover:text-amber-200 transition-colors">
              <input
                type="checkbox"
                checked={showGhost}
                onChange={(e) => setShowGhost(e.target.checked)}
                className="rounded bg-navy-950 border-slate-700 text-amber-500 focus:ring-0"
              />
              <span>Ghost Detour</span>
            </label>
          )}

          <button
            onClick={() => setIsAnimating(!isAnimating)}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
              isAnimating
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            {isAnimating ? "Simulation Active" : "Paused"}
          </button>
        </div>
      </div>

      {/* Reroute Alert Notification Banner */}
      {rerouteAlert && (
        <div className="p-3 bg-cyan-950/80 border border-cyan-500/50 rounded-lg flex items-center justify-between gap-3 text-xs text-cyan-200 backdrop-blur-md animate-pulse">
          <div className="flex items-center space-x-2.5">
            <span className="text-base">⚡</span>
            <div>
              <strong className="text-cyan-300 font-bold uppercase tracking-wide">
                Dynamic Quantum Reroute Active:
              </strong>{" "}
              <span>{rerouteAlert.message || "Congestion detected. Detour optimized with Quantum QAOA."}</span>
              {rerouteAlert.time_saved_minutes && (
                <span className="ml-2 font-mono font-bold text-emerald-400">
                  (ETA: -{rerouteAlert.time_saved_minutes} mins)
                </span>
              )}
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/40 text-[10px] font-mono text-cyan-300">
            AUTO-SYNCED
          </span>
        </div>
      )}

      {/* Real Interactive Leaflet Street Map Container */}
      <div className="relative w-full h-[470px] rounded-lg border border-slate-800/80 overflow-hidden shadow-2xl">
        <MapContainer
          center={[37.7749, -122.4194]}
          zoom={13}
          zoomControl={true}
          style={{ width: "100%", height: "100%" }}
        >
          {/* TileLayer with OpenStreetMap attribution and URL */}
          <TileLayer
            key={tileStyle}
            attribution={currentTileConfig.attribution}
            url={currentTileConfig.url}
          />

          {/* Map click listener for dynamic manual dispatch locations */}
          <MapClickHandler onClick={onMapClick} />

          {/* Auto-fit map viewport bounds */}
          <MapBoundsUpdater points={allMapPoints} />

          {/* Geofence Safety Corridor Buffer Zone */}
          {showCorridor && routeLatLngs.length > 1 && (
            <Polyline
              positions={routeLatLngs}
              pathOptions={{
                color: "#a855f7",
                weight: 32,
                opacity: 0.22,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          )}

          {/* Ghost Preview Detour Polyline */}
          {showGhost && ghostLatLngs.length > 1 && (
            <Polyline
              positions={ghostLatLngs}
              pathOptions={{
                color: "#f59e0b",
                weight: 4,
                opacity: 0.75,
                dashArray: "8, 10",
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          )}

          {/* Route Glow Underlay */}
          {routeLatLngs.length > 1 && (
            <Polyline
              positions={routeLatLngs}
              pathOptions={{
                color: "#06b6d4",
                weight: 7,
                opacity: 0.45,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          )}

          {/* Core Route Path */}
          {routeLatLngs.length > 1 && (
            <Polyline
              positions={routeLatLngs}
              pathOptions={{
                color: "#00f0ff",
                weight: 3.5,
                opacity: 0.95,
                lineCap: "round",
                lineJoin: "round",
                dashArray: polyline.length > 0 ? null : "6, 8",
              }}
            />
          )}

          {/* Animated Vehicle Tracer */}
          <VehicleRouteTracer polylinePoints={routeLatLngs} isAnimating={isAnimating} />

          {/* Live Incident Zones & Circles */}
          {showTraffic &&
            incidentZones.map((inc) => {
              if (!inc.lat || !inc.lng) return null;
              const color = getSeverityColor(inc.severity);
              const emoji = getIncidentIconEmoji(inc.type);

              const incIconHtml = `
                <div style="
                  width: 32px;
                  height: 32px;
                  background: ${color};
                  border: 2px solid #ffffff;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 15px;
                  box-shadow: 0 0 16px ${color};
                  cursor: pointer;
                ">${emoji}</div>
              `;

              const incIcon = L.divIcon({
                className: "custom-incident-marker",
                html: incIconHtml,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
                popupAnchor: [0, -16],
              });

              return (
                <React.Fragment key={`inc-${inc.id}`}>
                  <Circle
                    center={[inc.lat, inc.lng]}
                    radius={inc.radius_meters || 650}
                    pathOptions={{
                      color: color,
                      fillColor: color,
                      fillOpacity: inc.severity === "CRITICAL" ? 0.25 : 0.16,
                      weight: 1.5,
                    }}
                  />
                  <Marker position={[inc.lat, inc.lng]} icon={incIcon}>
                    <Popup>
                      <div className="text-xs leading-relaxed font-sans min-w-[200px]">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <strong className="text-slate-100 font-extrabold uppercase">{inc.name}</strong>
                          <span
                            className="px-1.5 py-0.5 rounded text-[9px] font-bold text-black"
                            style={{ backgroundColor: color }}
                          >
                            {inc.severity}
                          </span>
                        </div>
                        <p className="text-slate-300 text-[11px] mb-1.5">{inc.description}</p>
                        <div className="text-[10px] text-slate-400 border-t border-slate-700 pt-1 space-y-0.5">
                          <div>Delay Factor: <b className="text-amber-300">{inc.delay_multiplier}x</b></div>
                          <div>Speed Loss: <b className="text-rose-400">-{inc.speed_reduction_pct}%</b></div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                </React.Fragment>
              );
            })}

          {/* Waypoints & Depot Markers */}
          {stops.map((stop, idx) => {
            const isDepot = idx === 0 || idx === stops.length - 1;
            const isHighlighted = highlightedStop === idx;

            const markerHtml = isDepot
              ? `<div style="
                  width: 32px;
                  height: 32px;
                  background: linear-gradient(135deg, #0284c7, #0369a1);
                  border: 2px solid #38bdf8;
                  border-radius: 8px;
                  color: #ffffff;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-weight: 900;
                  font-size: 13px;
                  box-shadow: 0 0 16px rgba(56, 189, 248, 0.7);
                  cursor: pointer;
                ">D</div>`
              : `<div style="
                  width: 28px;
                  height: 28px;
                  background: ${isHighlighted ? "#38bdf8" : "#0f172a"};
                  border: 2px solid ${isHighlighted ? "#ffffff" : "#06b6d4"};
                  border-radius: 50%;
                  color: ${isHighlighted ? "#020617" : "#e2e8f0"};
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-weight: 800;
                  font-size: 11px;
                  box-shadow: 0 0 12px ${isHighlighted ? "rgba(56,189,248,0.9)" : "rgba(6,182,212,0.5)"};
                  cursor: pointer;
                ">${idx}</div>`;

            const icon = L.divIcon({
              className: "custom-stop-marker",
              html: markerHtml,
              iconSize: [32, 32],
              iconAnchor: [16, 16],
              popupAnchor: [0, -18],
            });

            return (
              <Marker
                key={`stop-${idx}-${stop.lat}-${stop.lng}`}
                position={[stop.lat, stop.lng]}
                icon={icon}
                eventHandlers={{
                  click: () => onSelectStop(idx),
                }}
              >
                <Popup>
                  <div className="text-xs leading-relaxed font-sans">
                    <div className={`font-extrabold mb-1 ${isDepot ? "text-sky-400" : "text-cyan-400"}`}>
                      {isDepot ? "CENTRAL METRO DEPOT" : `WAYPOINT #${idx}: ${stop.name}`}
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      📍 Lat: <b className="text-slate-200">{stop.lat.toFixed(4)}</b>, Lng: <b className="text-slate-200">{stop.lng.toFixed(4)}</b><br />
                      📦 Demand: <b className="text-emerald-400">{stop.demand_kg} kg</b>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Fleet Vehicles Markers */}
          {vehicles.map((v) => {
            if (!v.current_lat || !v.current_lng) return null;
            const isEv = v.vehicle_type === "ELECTRIC";
            const vHtml = `
              <div style="
                width: 32px;
                height: 32px;
                background: ${isEv ? "rgba(16, 185, 129, 0.9)" : "rgba(245, 158, 11, 0.9)"};
                border: 2px solid #ffffff;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                box-shadow: 0 0 14px ${isEv ? "rgba(16,185,129,0.8)" : "rgba(245,158,11,0.8)"};
              ">🚐</div>
            `;
            const vIcon = L.divIcon({
              className: "custom-veh-marker",
              html: vHtml,
              iconSize: [32, 32],
              iconAnchor: [16, 16],
              popupAnchor: [0, -16],
            });

            return (
              <Marker key={`veh-${v.id}`} position={[v.current_lat, v.current_lng]} icon={vIcon}>
                <Popup>
                  <div className="text-xs">
                    <b className="text-sky-400">{v.code} ({v.vehicle_type})</b><br />
                    Status: <b className="text-slate-200">{v.status}</b><br />
                    SoC Battery: <b className="text-emerald-400">{v.current_soc}%</b>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Geofence Alerts */}
          {alerts.map((alert, idx) => {
            if (!alert.lat || !alert.lng) return null;
            const alertHtml = `
              <div style="
                width: 24px;
                height: 24px;
                background: #f43f5e;
                border: 2px solid #ffffff;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 900;
                color: white;
                font-size: 12px;
                box-shadow: 0 0 20px #f43f5e;
              ">!</div>
            `;
            const aIcon = L.divIcon({
              className: "custom-alert-marker",
              html: alertHtml,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            });

            return (
              <Marker key={`alert-${idx}`} position={[alert.lat, alert.lng]} icon={aIcon}>
                <Popup>
                  <div className="text-rose-400 font-bold text-xs">
                    ⚠️ GEOFENCE VIOLATION<br />
                    Deviation: {Math.round(alert.deviation_meters)}m
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Floating Map Legend Overlay */}
        <div className="absolute bottom-4 left-4 z-[400] bg-white/95 dark:bg-navy-900/90 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl text-[11px] text-slate-700 dark:text-slate-300 backdrop-blur-md shadow-xl space-y-1.5 transition-colors">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-sm bg-sky-600 inline-flex items-center justify-center text-[8px] font-black text-white">D</span>
            <span className="font-semibold text-slate-900 dark:text-slate-200">Central Metro Depot</span>
            <span className="w-3 h-3 rounded-full border border-cyan-500 dark:border-cyan-400 bg-white dark:bg-slate-900 inline-flex items-center justify-center text-[8px] font-bold text-cyan-600 dark:text-cyan-400 ml-2">1</span>
            <span className="font-semibold text-slate-900 dark:text-slate-200">Delivery Waypoints</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-cyan-500 dark:bg-cyan-400 inline-block shadow-sm shadow-cyan-400" />
              <span>Active Route</span>
            </div>
            {ghostLatLngs.length > 0 && (
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-full border border-dashed border-amber-500 bg-amber-400/20 inline-block" />
                <span className="text-amber-600 dark:text-amber-300 font-semibold">Ghost Detour Preview</span>
              </div>
            )}
            <div className="flex items-center space-x-1.5">
              <span className="text-xs">🚧</span>
              <span>Live Traffic Hazards</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

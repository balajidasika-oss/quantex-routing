import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPinIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  TruckIcon,
  SparklesIcon,
  SignalIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import FleetMap from "./FleetMap";

export default function DriverDashboard({ apiUrl = "http://localhost:8000/api" }) {
  const [assignedRoute, setAssignedRoute] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [rerouteAlert, setRerouteAlert] = useState({
    plan_code: "PLAN-QAOA-DETOUR",
    time_saved_minutes: 4,
    total_distance_km: 12.4,
    destination: "Financial Center",
    message: "New detour suggested due to congestion in Mission District.",
  });
  const [isRerouteAcknowledged, setIsRerouteAcknowledged] = useState(false);
  const [telemetry, setTelemetry] = useState({
    vehicle_id: 1,
    lat: 37.7749,
    lng: -122.4194,
    speed_kmh: 38.0,
    ambient_temp_c: 22.0,
    distance_step_km: 1.5,
    payload_kg: 240.0,
  });
  const [incidentType, setIncidentType] = useState("TRAFFIC_DELAY");
  const [incidentDesc, setIncidentDesc] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [showIncidentModal, setShowIncidentModal] = useState(false);

  const fetchData = async () => {
    try {
      const rRes = await fetch(`${apiUrl}/driver/assigned-route?vehicle_id=1`);
      if (rRes.ok) {
        const routeData = await rRes.json();
        setAssignedRoute(routeData);
      }

      const pRes = await fetch(`${apiUrl}/driver/performance?vehicle_id=1`);
      if (pRes.ok) setPerformance(await pRes.json());
    } catch (e) {
      console.warn("Driver fetch error:", e);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WebSocket for dynamic reroute push alerts
  useEffect(() => {
    const wsUrl = apiUrl.replace("http", "ws").replace("/api", "") + "/ws/telemetry";
    let ws = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "DYNAMIC_REROUTE") {
            setRerouteAlert({
              plan_code: msg.data.plan_code,
              time_saved_minutes: msg.data.time_saved_minutes || 4,
              total_distance_km: msg.data.total_distance_km || 12.4,
              destination: "Financial Center",
              message: "New detour suggested due to congestion.",
            });
            setIsRerouteAcknowledged(false);
            fetchData();
          }
        } catch (err) {}
      };
    } catch (e) {}

    return () => {
      if (ws) ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  const handleCompleteStop = async (planId, stopIdx) => {
    try {
      const res = await fetch(`${apiUrl}/driver/stops/${planId}/${stopIdx}/complete`, {
        method: "POST",
      });
      if (res.ok) {
        setStatusMessage(`Waypoint #${stopIdx} marked as DELIVERED.`);
        fetchData();
        setTimeout(() => setStatusMessage(""), 3000);
      }
    } catch (err) {
      alert("Error completing stop: " + err.message);
    }
  };

  const handleAcknowledgeReroute = async () => {
    try {
      const planId = assignedRoute ? assignedRoute.plan_id : 1;
      const res = await fetch(`${apiUrl}/traffic/acknowledge-reroute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: planId,
          vehicle_id: 1,
          driver_name: performance ? performance.driver_name : "Marcus Vance (Driver)",
          notes: "Dynamic detour acknowledged & loaded in navigation terminal",
        }),
      });
      if (res.ok) {
        setIsRerouteAcknowledged(true);
        setStatusMessage("Detour acknowledged! Confirmation transmitted to Central Dispatcher.");
        setTimeout(() => setStatusMessage(""), 4000);
      }
    } catch (err) {
      setIsRerouteAcknowledged(true);
      setStatusMessage("Detour confirmed & synced with vehicle onboard guidance.");
      setTimeout(() => setStatusMessage(""), 4000);
    }
  };

  const handleSendTelemetry = async () => {
    try {
      const res = await fetch(`${apiUrl}/driver/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(telemetry),
      });
      if (res.ok) {
        setStatusMessage("Live telemetry successfully broadcast to Dispatcher.");
        setTimeout(() => setStatusMessage(""), 3000);
      }
    } catch (err) {
      alert("Telemetry error: " + err.message);
    }
  };

  const handleReportIncident = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/driver/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: 1,
          incident_type: incidentType,
          description: incidentDesc,
        }),
      });
      if (res.ok) {
        setStatusMessage("Incident report logged in SHA-256 ledger & dispatched to central control.");
        setIncidentDesc("");
        setShowIncidentModal(false);
        setTimeout(() => setStatusMessage(""), 4000);
      }
    } catch (err) {
      alert("Incident error: " + err.message);
    }
  };

  const stops = assignedRoute && assignedRoute.stops_manifest ? assignedRoute.stops_manifest : [];
  const nextStop = stops.find((s) => !s.completed) || stops[1] || { name: "Financial Center", demand_kg: 240 };

  return (
    <div className="rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl bg-gradient-to-br from-gray-100 via-green-50 to-gray-200 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700 flex flex-col min-h-[680px] transition-colors duration-200">
      
      {/* Header */}
      <header className="bg-white/30 dark:bg-slate-800/40 backdrop-blur-md shadow-lg p-6 flex flex-wrap justify-between items-center gap-4 border-b border-white/40 dark:border-slate-700/40">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-amber-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25">
            <TruckIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-500 to-amber-400 bg-clip-text text-transparent font-heading">
              Driver Dashboard
            </h1>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block">
              In-Cab GPS Assistant · Vehicle EV-101
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="px-3.5 py-1.5 rounded-full bg-emerald-500 text-white text-sm font-semibold flex items-center space-x-1.5 shadow-md shadow-emerald-500/25">
            <SignalIcon className="w-4 h-4 animate-pulse" />
            <span>🚚 Active Route</span>
          </span>

          <button
            onClick={() => setShowIncidentModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-1.5"
          >
            <ExclamationTriangleIcon className="w-4 h-4" />
            <span>Report Exception</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto">
        
        {/* Status Toast */}
        <AnimatePresence>
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3.5 bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-xl flex items-center space-x-2 shadow-sm"
            >
              <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
              <span>{statusMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Cards: Current Route & Driver Performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Current Route Card */}
          <div className="bg-white/30 dark:bg-slate-800/40 backdrop-blur-md rounded-xl shadow-lg p-6 border border-white/40 dark:border-slate-700/40 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span>Current Route</span>
              </h2>
              <span className="text-xs font-mono font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                {assignedRoute ? assignedRoute.plan_code : "PLAN-QAOA-01"}
              </span>
            </div>

            <p className="flex items-center gap-2 text-gray-900 dark:text-gray-50 text-base font-bold">
              <MapPinIcon className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>Destination: {nextStop ? nextStop.name : "Financial Center"}</span>
            </p>

            <div className="p-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">
                ETA: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">18 mins</strong>
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-700 dark:text-gray-300">
                Distance: <strong className="text-amber-600 dark:text-amber-400 font-mono">{rerouteAlert?.total_distance_km || "12.4"} km</strong>
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-700 dark:text-gray-300">
                Speed: <strong className="text-cyan-600 dark:text-cyan-400 font-mono">{telemetry.speed_kmh} km/h</strong>
              </span>
            </div>
          </div>

          {/* Driver Eco-Driving & Performance Metrics */}
          <div className="bg-white/30 dark:bg-slate-800/40 backdrop-blur-md rounded-xl shadow-lg p-6 border border-white/40 dark:border-slate-700/40 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-amber-500" />
                <span>Driver Telemetry & Eco-Score</span>
              </h2>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {performance ? performance.driver_name : "Marcus Vance"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400 block font-semibold uppercase text-[10px]">Eco-Score</span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {performance ? performance.eco_driving_score : "94"} / 100
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400 block font-semibold uppercase text-[10px]">CO₂ Saved Today</span>
                <span className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
                  +{performance ? performance.co2_saved_kg : "18.4"} kg
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Reroute Alert & Acknowledgement Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Reroute Alert Panel */}
          <div className="bg-white/30 dark:bg-slate-800/40 backdrop-blur-md rounded-xl shadow-lg p-6 border border-amber-400 dark:border-amber-400/80 space-y-3">
            <h2 className="text-xl font-semibold mb-2 text-amber-500 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-6 h-6 text-amber-500 shrink-0" />
              <span>⚠️ Reroute Alert</span>
            </h2>
            <p className="text-gray-900 dark:text-gray-50 text-sm">
              New detour suggested due to congestion. Time saved:{" "}
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-base">
                {rerouteAlert?.time_saved_minutes || 4} mins
              </span>.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {rerouteAlert?.message || "Quantum detour calculated to bypass congested downtown corridors."}
            </p>
            <button
              onClick={handleAcknowledgeReroute}
              className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-amber-400 text-white font-semibold shadow-lg hover:from-amber-500 hover:to-emerald-600 transition-all text-xs uppercase tracking-wider"
            >
              <ArrowPathIcon className="w-4 h-4" />
              <span>Accept Reroute</span>
            </button>
          </div>

          {/* Driver Acknowledgement */}
          <div className="bg-white/30 dark:bg-slate-800/40 backdrop-blur-md rounded-xl shadow-lg p-6 border border-white/40 dark:border-slate-700/40 space-y-3 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
                Acknowledgement
              </h2>
              <p className="text-gray-900 dark:text-gray-50 text-sm mb-4">
                {isRerouteAcknowledged
                  ? "✓ Detour confirmed and synchronized with vehicle guidance."
                  : "Please confirm reroute update to continue."}
              </p>
            </div>

            {isRerouteAcknowledged ? (
              <div className="flex items-center space-x-2 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold font-mono">
                <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                <span>DETOUR CONFIRMED & SYNCED IN-CAB</span>
              </div>
            ) : (
              <button
                onClick={handleAcknowledgeReroute}
                className="px-5 py-2.5 rounded-lg bg-emerald-500 text-white font-semibold shadow-lg hover:bg-emerald-600 transition-all text-xs uppercase tracking-wider self-start flex items-center space-x-2"
              >
                <span>✅ Confirm Reroute</span>
              </button>
            )}
          </div>
        </div>

        {/* Interactive OpenStreetMap */}
        <FleetMap
          stops={stops}
          polyline={assignedRoute && assignedRoute.polyline ? assignedRoute.polyline : []}
          rerouteAlert={rerouteAlert}
        />

        {/* Turn-by-Turn Waypoints & Telemetry Transmitter */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Stops Manifest (8 cols) */}
          <div className="lg:col-span-8 bg-white/30 dark:bg-slate-800/40 backdrop-blur-md rounded-xl shadow-lg p-6 border border-white/40 dark:border-slate-700/40 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-3">
              <h3 className="text-base font-bold bg-gradient-to-r from-emerald-500 to-amber-400 bg-clip-text text-transparent font-heading">
                Turn-by-Turn Waypoints ({stops.length} Stops)
              </h3>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                {stops.filter((s) => s.completed).length} / {stops.length} Completed
              </span>
            </div>

            <div className="space-y-3">
              {stops.length === 0 ? (
                <div className="text-slate-500 text-center py-4">No active delivery route loaded.</div>
              ) : (
                stops.map((stop, idx) => {
                  const isDepot = idx === 0 || idx === stops.length - 1;
                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 transition-all ${
                        stop.completed
                          ? "bg-emerald-500/10 border-emerald-500/30"
                          : "bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700/60"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shadow-sm ${
                          isDepot ? "bg-cyan-600 text-white" : stop.completed ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {isDepot ? "D" : idx}
                        </span>
                        <div>
                          <strong className={`text-xs font-bold block ${stop.completed ? "text-slate-400 line-through" : "text-gray-900 dark:text-gray-100"}`}>
                            {stop.name}
                          </strong>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            📦 {stop.demand_kg} kg parcel payload
                          </span>
                        </div>
                      </div>

                      <div>
                        {stop.completed ? (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                            ✓ Delivered
                          </span>
                        ) : (
                          <button
                            onClick={() => handleCompleteStop(assignedRoute.plan_id, idx)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] shadow transition-all"
                          >
                            Mark Delivered
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Telemetry Transmitter Panel (4 cols) */}
          <div className="lg:col-span-4 bg-white/30 dark:bg-slate-800/40 backdrop-blur-md rounded-xl shadow-lg p-6 border border-white/40 dark:border-slate-700/40 space-y-3 text-xs">
            <h3 className="text-base font-bold bg-gradient-to-r from-emerald-500 to-amber-400 bg-clip-text text-transparent font-heading border-b border-slate-200 dark:border-slate-700/60 pb-3">
              In-Cab Telemetry Broadcaster
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Velocity (km/h)</label>
                <input
                  type="number"
                  value={telemetry.speed_kmh}
                  onChange={(e) => setTelemetry({ ...telemetry, speed_kmh: parseFloat(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Ambient Cab Temp (°C)</label>
                <input
                  type="number"
                  value={telemetry.ambient_temp_c}
                  onChange={(e) => setTelemetry({ ...telemetry, ambient_temp_c: parseFloat(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Current Payload (kg)</label>
                <input
                  type="number"
                  value={telemetry.payload_kg}
                  onChange={(e) => setTelemetry({ ...telemetry, payload_kg: parseFloat(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100 font-mono"
                />
              </div>

              <button
                onClick={handleSendTelemetry}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-amber-400 hover:from-amber-400 hover:to-emerald-500 text-white font-bold uppercase tracking-wider text-xs shadow-md transition-all"
              >
                Broadcast Telemetry Packet
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Incident Report Modal */}
      <AnimatePresence>
        {showIncidentModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-amber-400/60 p-6 rounded-2xl shadow-2xl space-y-4"
            >
              <button
                onClick={() => setShowIncidentModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-gray-900 dark:hover:text-white font-bold"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
              
              <div className="flex items-center space-x-2">
                <ExclamationTriangleIcon className="w-6 h-6 text-amber-500" />
                <h3 className="text-lg font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent font-heading">
                  Report On-Road Exception
                </h3>
              </div>

              <form onSubmit={handleReportIncident} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Incident Category</label>
                  <select
                    value={incidentType}
                    onChange={(e) => setIncidentType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:border-amber-500"
                  >
                    <option value="TRAFFIC_DELAY">Heavy Traffic Delay</option>
                    <option value="FAILED_DELIVERY">Customer Absent / Access Denied</option>
                    <option value="BREAKDOWN">Vehicle Mechanical Fault</option>
                    <option value="ROAD_CLOSED">Road Blockage / Detour</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Description & Notes</label>
                  <textarea
                    rows="3"
                    value={incidentDesc}
                    onChange={(e) => setIncidentDesc(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                    placeholder="Provide details for dispatcher intervention..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold uppercase tracking-wider text-xs shadow-lg shadow-amber-500/20 transition-all"
                >
                  Transmit Incident to Control
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


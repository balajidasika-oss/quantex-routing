import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExclamationTriangleIcon,
  BoltIcon,
  TruckIcon,
  ArrowPathIcon,
  AdjustmentsHorizontalIcon,
  CheckCircleIcon,
  ClockIcon,
  CpuChipIcon,
  SignalIcon,
  MapPinIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import FleetMap from "./FleetMap";

export default function DispatcherDashboard({ apiUrl = (process.env.REACT_APP_API_URL || "http://localhost:8000/api"), onNavigate = () => {} }) {
  const [activeTab, setActiveTab] = useState("routing"); // "overview", "routing", "incidents", "quantum"
  const [fleetData, setFleetData] = useState({ vehicles: [], summary: {} });
  const [alertsData, setAlertsData] = useState({ unacknowledged_alerts: 0, alerts: [] });
  const [operationalSummary, setOperationalSummary] = useState(null);
  const [trafficZones, setTrafficZones] = useState([]);
  const [trafficHistory, setTrafficHistory] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [ghostPolyline, setGhostPolyline] = useState([]);
  const [rerouteAlert, setRerouteAlert] = useState(null);
  const [driverAckStatus, setDriverAckStatus] = useState(null);
  const [dispatchStatus, setDispatchStatus] = useState("");
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [replayIdx, setReplayIdx] = useState(0);

  // Dynamic Routing Sensitivity State
  const [threshold, setThreshold] = useState(1.4);
  const [autoReroute, setAutoReroute] = useState(true);
  const [showInjectModal, setShowInjectModal] = useState(false);

  // Incident Injection Form State
  const [incidentForm, setIncidentForm] = useState({
    name: "Financial District Gridlock",
    incident_type: "ACCIDENT",
    severity: "MAJOR",
    lat: 37.789,
    lng: -122.401,
    radius_meters: 750,
    description: "Multi-vehicle collision blocking intersection",
  });

  const fetchData = async () => {
    try {
      const fRes = await fetch(`${apiUrl}/dispatcher/fleet-overview`);
      if (fRes.ok) setFleetData(await fRes.json());

      const aRes = await fetch(`${apiUrl}/dispatcher/alerts`);
      if (aRes.ok) setAlertsData(await aRes.json());

      const oRes = await fetch(`${apiUrl}/dispatcher/operational-summary`);
      if (oRes.ok) setOperationalSummary(await oRes.json());

      const tRes = await fetch(`${apiUrl}/traffic/live-zones`);
      if (tRes.ok) {
        const tData = await tRes.json();
        setTrafficZones(tData.zones || []);
        if (tData.threshold) setThreshold(tData.threshold);
        if (tData.auto_reroute_enabled !== undefined) setAutoReroute(tData.auto_reroute_enabled);
      }

      const hRes = await fetch(`${apiUrl}/traffic/history?limit=15`);
      if (hRes.ok) {
        const hData = await hRes.json();
        setTrafficHistory(hData.history || []);
      }

      // Fetch active route plan for preview
      const pRes = await fetch(`${apiUrl}/optimize/plans?limit=1`);
      if (pRes.ok) {
        const plans = await pRes.json();
        if (plans.length > 0) {
          const planDetailRes = await fetch(`${apiUrl}/optimize/plans/${plans[0].id}`);
          if (planDetailRes.ok) {
            const planData = await planDetailRes.json();
            setActivePlan(planData);
          }
        }
      }
    } catch (e) {
      console.warn("Dispatcher fetch error:", e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WebSocket Live Stream Listener for Reroute & Driver Ack
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
              message: `Quantum detour computed for ${msg.data.plan_code}.`,
              time_saved_minutes: msg.data.time_saved_minutes,
            });
            if (msg.data.polyline) {
              setGhostPolyline(msg.data.polyline);
            }
            fetchData();
          } else if (msg.type === "REROUTE_ACKNOWLEDGED") {
            setDriverAckStatus({
              driver_name: msg.data.driver_name,
              time: new Date().toLocaleTimeString(),
              status: "CONFIRMED_IN_CAB",
            });
            setTimeout(() => setDriverAckStatus(null), 8000);
          }
        } catch (err) {}
      };
    } catch (e) {}

    return () => {
      if (ws) ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  const handleUpdateThreshold = async (val, autoFlag) => {
    setThreshold(parseFloat(val));
    const newAuto = autoFlag !== undefined ? autoFlag : autoReroute;
    if (autoFlag !== undefined) setAutoReroute(autoFlag);
    try {
      await fetch(`${apiUrl}/traffic/threshold-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          congestion_threshold_multiplier: parseFloat(val),
          auto_reroute_enabled: newAuto,
        }),
      });
    } catch (err) {}
  };

  const handleInjectIncident = async (e) => {
    if (e) e.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/traffic/simulate-incident`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(incidentForm),
      });
      if (res.ok) {
        setDispatchStatus(`Traffic Incident [${incidentForm.severity}] injected on sector.`);
        setShowInjectModal(false);
        fetchData();
        setTimeout(() => setDispatchStatus(""), 4000);
      }
    } catch (err) {
      alert("Error injecting incident: " + err.message);
    }
  };

  const handleTriggerQuantumReroute = async () => {
    try {
      const res = await fetch(`${apiUrl}/traffic/trigger-reoptimization`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: activePlan ? activePlan.id : 1,
          vehicle_type: "ELECTRIC",
          solver_type: "quantum",
          p_depth: 2,
          force_override: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGhostPolyline(data.polyline || []);
        setRerouteAlert({
          message: `Quantum QAOA Detour active. Saved ${data.time_saved_minutes} min.`,
          time_saved_minutes: data.time_saved_minutes,
        });
        setDispatchStatus(`Dynamic Quantum Detour calculated & pushed to Fleet.`);
        fetchData();
        setTimeout(() => setDispatchStatus(""), 5000);
      }
    } catch (err) {
      alert("Reroute trigger error: " + err.message);
    }
  };

  const handleManualOverride = async () => {
    try {
      const res = await fetch(`${apiUrl}/traffic/manual-reroute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: activePlan ? activePlan.id : 1,
          override_reason: "Central Dispatcher Severe Congestion Bypass Directive",
          vehicle_type: "ELECTRIC",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGhostPolyline(data.polyline || []);
        setDispatchStatus("Dispatcher Manual Reroute Override executed.");
        fetchData();
        setTimeout(() => setDispatchStatus(""), 4000);
      }
    } catch (err) {
      alert("Manual override error: " + err.message);
    }
  };

  const handleClearIncident = async (id) => {
    try {
      const res = await fetch(`${apiUrl}/traffic/incidents/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {}
  };

  const handleReplayStep = (step) => {
    if (trafficHistory.length === 0) return;
    const nextIdx = Math.max(0, Math.min(trafficHistory.length - 1, replayIdx + step));
    setReplayIdx(nextIdx);
  };

  const handleQuickDispatch = async (vehicleId) => {
    try {
      const res = await fetch(`${apiUrl}/dispatcher/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: 1, vehicle_id: vehicleId, driver_id: 3 }),
      });
      if (res.ok) {
        setDispatchStatus(`Successfully dispatched Route Plan to Vehicle #${vehicleId}`);
        fetchData();
        setTimeout(() => setDispatchStatus(""), 4000);
      }
    } catch (e) {
      alert("Dispatch error: " + e.message);
    }
  };

  const navLinks = [
    { id: "routing", label: "Dynamic Routing", icon: AdjustmentsHorizontalIcon },
    { id: "overview", label: `Fleet Overview (${fleetData.vehicles.length})`, icon: TruckIcon },
    { id: "incidents", label: `Incident Log (${trafficZones.length})`, icon: BoltIcon },
    { id: "quantum", label: "Quantum Studio", icon: CpuChipIcon },
  ];

  return (
    <div className="rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl bg-gradient-to-br from-gray-100 via-pink-50 to-gray-200 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700 flex flex-col md:flex-row min-h-[680px] transition-colors duration-200">
      
      {/* Sidebar with Frosted Glass Styling */}
      <aside className="w-full md:w-64 bg-white/20 dark:bg-slate-800/30 backdrop-blur-lg border-b md:border-b-0 md:border-r border-white/60 dark:border-slate-700/40 p-6 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-pink-500/25">
              <TruckIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent font-heading">
                Dispatcher Console
              </h2>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block">
                Central Operations
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-2">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === "quantum") {
                      onNavigate("optimize");
                    } else {
                      setActiveTab(item.id);
                    }
                  }}
                  className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                    isActive
                      ? "bg-gradient-to-r from-violet-600 to-pink-500 text-white shadow-lg shadow-pink-500/25"
                      : "text-gray-900 dark:text-gray-50 hover:text-pink-600 dark:hover:text-pink-400 hover:bg-white/40 dark:hover:bg-slate-700/40"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-violet-500 dark:text-pink-400"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Quick Simulator CTA in Sidebar */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-700/50 mt-6 space-y-2">
          <button
            onClick={() => setShowInjectModal(true)}
            className="w-full flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 hover:from-pink-600 hover:to-violet-700 text-white text-xs font-bold shadow-md shadow-pink-500/20 transition-all"
          >
            <ExclamationTriangleIcon className="w-4 h-4" />
            <span>Inject Traffic Surge</span>
          </button>

          <button
            onClick={() => setIsReplayMode(!isReplayMode)}
            className={`w-full flex items-center justify-center space-x-2 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all ${
              isReplayMode
                ? "bg-purple-600 text-white border-purple-400 shadow-md"
                : "bg-white/40 dark:bg-slate-900/40 hover:bg-white/70 dark:hover:bg-slate-900/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            }`}
          >
            <ClockIcon className="w-3.5 h-3.5" />
            <span>{isReplayMode ? "Exit Replay" : "Incident Replay"}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 space-y-6 md:space-y-8 overflow-y-auto">
        
        {/* Header Frosted Glass Panel */}
        <div className="bg-white/30 dark:bg-slate-800/40 backdrop-blur-md rounded-xl shadow-lg p-6 flex flex-wrap justify-between items-center gap-4 border border-white/40 dark:border-slate-700/40">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent font-heading">
              Live Dynamic Routing Control
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Real-time quantum fleet routing, automated congestion triggers, and in-cab telemetry.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <span className="px-4 py-2 rounded-full bg-pink-500 text-white text-sm font-semibold flex items-center space-x-1.5 shadow-md shadow-pink-500/25">
              <SignalIcon className="w-4 h-4 animate-pulse" />
              <span>🚦 Traffic Monitoring Active</span>
            </span>
          </div>
        </div>

        {/* Status Toast */}
        <AnimatePresence>
          {dispatchStatus && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3.5 bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-xl flex items-center space-x-2 shadow-sm"
            >
              <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
              <span>{dispatchStatus}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Driver Acknowledgement Toast */}
        {driverAckStatus && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-white/40 dark:bg-slate-800/60 backdrop-blur-md border border-pink-500/40 rounded-2xl text-xs text-slate-800 dark:text-slate-100 flex items-center justify-between shadow-xl"
          >
            <div className="flex items-center space-x-3">
              <span className="w-3 h-3 rounded-full bg-pink-500 animate-ping" />
              <div>
                <strong className="text-pink-600 dark:text-pink-400 font-bold block">Driver Confirmation Transmitted</strong>
                <span className="text-slate-600 dark:text-slate-300">
                  Driver <b>{driverAckStatus.driver_name}</b> confirmed & synced detour in-cab at {driverAckStatus.time}
                </span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-lg bg-pink-500/20 text-pink-600 dark:text-pink-300 border border-pink-500/40 font-mono text-[10px] font-bold">
              CONFIRMED
            </span>
          </motion.div>
        )}

        {/* Operational KPI Row */}
        {operationalSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="bg-white/30 dark:bg-slate-800/40 backdrop-blur-md rounded-xl shadow-lg p-4 border border-white/40 dark:border-slate-700/40 space-y-1">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">Fleet Efficiency</span>
              <span className="text-2xl font-black text-violet-600 dark:text-pink-400 block font-heading">{operationalSummary.fleet_efficiency_score}</span>
            </div>
            <div className="bg-white/30 dark:bg-slate-800/40 backdrop-blur-md rounded-xl shadow-lg p-4 border border-white/40 dark:border-slate-700/40 space-y-1">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">Active Incidents</span>
              <span className="text-2xl font-black text-rose-500 dark:text-rose-400 block font-heading">{trafficZones.length} Zones</span>
            </div>
            <div className="bg-white/30 dark:bg-slate-800/40 backdrop-blur-md rounded-xl shadow-lg p-4 border border-white/40 dark:border-slate-700/40 space-y-1">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">Avg Quantum Time</span>
              <span className="text-2xl font-black text-pink-600 dark:text-pink-300 font-mono block font-heading">{operationalSummary.avg_qaoa_computation_ms} ms</span>
            </div>
            <div className="bg-white/30 dark:bg-slate-800/40 backdrop-blur-md rounded-xl shadow-lg p-4 border border-white/40 dark:border-slate-700/40 space-y-1">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">Active En Route</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 block font-heading font-mono">{fleetData.summary.en_route || 0} / {fleetData.summary.total_fleet || 0}</span>
            </div>
          </div>
        )}

        {/* 1. Dynamic Routing & Interactive Map Tab */}
        {(activeTab === "routing" || activeTab === "overview") && (
          <div className="space-y-6">
            
            {/* Top Interactive Controls: Congestion Threshold & Auto Reroute */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Congestion Threshold Control Slider */}
              <div className="bg-white/30 dark:bg-slate-800/40 backdrop-blur-md rounded-xl shadow-lg p-6 border border-white/40 dark:border-slate-700/40 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                    <AdjustmentsHorizontalIcon className="w-5 h-5 text-pink-500" />
                    <span>Congestion Threshold</span>
                  </h2>
                  <span className="text-xs font-mono font-bold bg-pink-500/20 text-pink-700 dark:text-pink-300 px-2.5 py-1 rounded-full border border-pink-500/30">
                    {threshold}×
                  </span>
                </div>
                <input
                  type="range"
                  min="1.2"
                  max="2.0"
                  step="0.1"
                  value={threshold}
                  onChange={(e) => handleUpdateThreshold(e.target.value)}
                  className="w-full accent-pink-500 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />
                <div className="flex justify-between text-xs text-gray-900 dark:text-gray-50">
                  <span>Current Multiplier: <span className="font-bold">{threshold}×</span></span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">Range: 1.2× – 2.0×</span>
                </div>
              </div>

              {/* Auto-Reroute Toggle Card */}
              <div className="bg-white/30 dark:bg-slate-800/40 backdrop-blur-md rounded-xl shadow-lg p-6 border border-white/40 dark:border-slate-700/40 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                    <BoltIcon className="w-5 h-5 text-violet-500" />
                    <span>Automated Quantum Rerouting</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                    {autoReroute
                      ? "Auto-reroute active: QAOA recomputes upon threshold breach."
                      : "Manual mode: Requires dispatcher authorization before dispatch."}
                  </p>
                </div>

                <label className="flex items-center cursor-pointer ml-4 shrink-0">
                  <input
                    type="checkbox"
                    checked={autoReroute}
                    onChange={() => handleUpdateThreshold(threshold, !autoReroute)}
                    className="hidden"
                  />
                  <span
                    className={`w-14 h-7 flex items-center rounded-full p-1 transition-colors duration-300 ${
                      autoReroute ? "bg-gradient-to-r from-violet-600 to-pink-500" : "bg-slate-300 dark:bg-slate-700"
                    }`}
                  >
                    <span
                      className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${
                        autoReroute ? "translate-x-7" : "translate-x-0"
                      }`}
                    />
                  </span>
                </label>
              </div>
            </div>

            {/* Real Interactive Leaflet Street Map */}
            <FleetMap
              stops={activePlan ? activePlan.stops : []}
              polyline={activePlan ? activePlan.polyline : []}
              ghostPolyline={ghostPolyline}
              vehicles={fleetData.vehicles}
              alerts={alertsData.alerts}
              incidentZones={isReplayMode && trafficHistory[replayIdx] ? [trafficHistory[replayIdx]] : trafficZones}
              rerouteAlert={rerouteAlert}
            />

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => setShowInjectModal(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-pink-500 hover:from-pink-600 hover:to-violet-700 px-6 py-3 rounded-lg font-semibold shadow-lg text-white transition-all"
              >
                <ExclamationTriangleIcon className="w-5 h-5" />
                <span>Inject Traffic Surge</span>
              </button>

              <button
                onClick={handleTriggerQuantumReroute}
                className="flex items-center gap-2 bg-white/50 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 text-violet-700 dark:text-pink-300 border border-violet-300 dark:border-pink-500/30 px-6 py-3 rounded-lg font-semibold shadow-md transition-all"
              >
                <BoltIcon className="w-5 h-5 text-pink-500" />
                <span>Trigger Quantum QAOA Detour</span>
              </button>

              <button
                onClick={handleManualOverride}
                className="flex items-center gap-2 bg-white/50 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 px-6 py-3 rounded-lg font-semibold shadow-md transition-all"
              >
                <ArrowPathIcon className="w-5 h-5 text-amber-500" />
                <span>Manual Dispatcher Bypass</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. Incident Log Tab or Sub-Panel */}
        {(activeTab === "incidents" || activeTab === "routing") && (
          <div className="bg-white/30 dark:bg-slate-800/40 backdrop-blur-md rounded-xl shadow-lg p-6 border border-white/40 dark:border-slate-700/40 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-3">
              <h2 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent font-heading">
                Live Incident Log
              </h2>
              <span className="text-xs font-mono text-pink-600 dark:text-pink-400 font-bold">
                {trafficZones.length} Active Incidents
              </span>
            </div>

            <ul className="space-y-3 text-sm">
              {trafficZones.length === 0 ? (
                <>
                  <li className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60">
                    <div className="flex items-center gap-2.5">
                      <BoltIcon className="w-4 h-4 text-pink-500" />
                      <span className="text-gray-900 dark:text-gray-100 font-medium">
                        Quantum reroute active for Mission District Corridor
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">AUTOMATED</span>
                  </li>
                  <li className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60">
                    <div className="flex items-center gap-2.5">
                      <BoltIcon className="w-4 h-4 text-violet-500" />
                      <span className="text-gray-900 dark:text-gray-100 font-medium">
                        Road closure detected near Financial Center (1.85× delay)
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">STANDBY</span>
                  </li>
                </>
              ) : (
                trafficZones.map((z) => (
                  <li
                    key={z.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60"
                  >
                    <div className="flex items-center gap-2.5">
                      <BoltIcon className="w-4 h-4 text-pink-500 shrink-0" />
                      <div>
                        <strong className="text-gray-900 dark:text-gray-100 block">{z.name}</strong>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {z.severity} · Delay {z.delay_multiplier}× · -{z.speed_reduction_pct}% speed
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleClearIncident(z.id)}
                      className="px-3 py-1 rounded-lg bg-pink-500/15 hover:bg-pink-500/25 text-pink-700 dark:text-pink-300 text-xs font-bold transition-all"
                    >
                      Clear
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        {/* 3. Fleet Directory Tab or Overview Sub-Panel */}
        {(activeTab === "overview") && (
          <div className="bg-white/30 dark:bg-slate-800/40 backdrop-blur-md rounded-xl shadow-lg p-6 border border-white/40 dark:border-slate-700/40 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-3">
              <h3 className="text-lg font-bold bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent font-heading">
                Fleet Status & Vehicle Telemetry ({fleetData.vehicles.length})
              </h3>
              <span className="text-pink-600 dark:text-pink-400 font-mono text-xs font-bold">Live GPS Telemetry</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {fleetData.vehicles.map((v) => {
                const isEv = v.vehicle_type === "ELECTRIC";
                return (
                  <div
                    key={v.id}
                    className="p-4 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 space-y-3 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <strong className="text-gray-900 dark:text-gray-100 text-sm font-bold">{v.code}</strong>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">{v.name}</span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        v.status === "EN_ROUTE"
                          ? "bg-pink-500/20 text-pink-700 dark:text-pink-300 border border-pink-500/30"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}>
                        {v.status}
                      </span>
                    </div>

                    {isEv && (
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Battery SoC:</span>
                          <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{v.current_soc}%</strong>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${v.current_soc}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">Speed: <b>{v.speed_kmh} km/h</b></span>
                      <button
                        onClick={() => handleQuickDispatch(v.id)}
                        className="px-3 py-1 rounded-lg bg-gradient-to-r from-violet-600 to-pink-500 hover:from-pink-600 hover:to-violet-700 text-white text-[11px] font-bold shadow transition-all"
                      >
                        Assign Plan
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Replay Mode Inspector */}
        {isReplayMode && trafficHistory.length > 0 && (
          <div className="bg-white/30 dark:bg-slate-800/40 backdrop-blur-md rounded-xl shadow-lg p-6 border border-pink-500/40 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-pink-500 text-base">⏪</span>
                <strong className="text-pink-600 dark:text-pink-300 font-bold uppercase tracking-wider">Training Incident Replay Timeline</strong>
                <span className="text-slate-500 font-mono">
                  (Event {replayIdx + 1} of {trafficHistory.length})
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleReplayStep(-1)}
                  disabled={replayIdx === 0}
                  className="px-3 py-1.5 rounded-lg bg-white/60 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 disabled:opacity-40 font-bold"
                >
                  ◀ Step Back
                </button>
                <button
                  onClick={() => handleReplayStep(1)}
                  disabled={replayIdx === trafficHistory.length - 1}
                  className="px-3 py-1.5 rounded-lg bg-white/60 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 disabled:opacity-40 font-bold"
                >
                  Step Forward ▶
                </button>
              </div>
            </div>
            <div className="p-3.5 bg-white/60 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 flex justify-between items-center">
              <div>
                <span className="font-bold text-sm block">{trafficHistory[replayIdx].name}</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{trafficHistory[replayIdx].description}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30 font-bold font-mono">
                  {trafficHistory[replayIdx].severity}
                </span>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">{trafficHistory[replayIdx].created_at}</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Incident Inject Modal with Frosted Glass Overlay */}
      <AnimatePresence>
        {showInjectModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-pink-500/40 p-6 rounded-2xl shadow-2xl space-y-4"
            >
              <button
                onClick={() => setShowInjectModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-gray-900 dark:hover:text-white font-bold"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-2">
                <ExclamationTriangleIcon className="w-6 h-6 text-pink-500" />
                <h3 className="text-lg font-bold bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent font-heading">
                  Inject Traffic Surge & Live Incident
                </h3>
              </div>

              <form onSubmit={handleInjectIncident} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Incident Name</label>
                    <input
                      type="text"
                      value={incidentForm.name}
                      onChange={(e) => setIncidentForm({ ...incidentForm, name: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-pink-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Category</label>
                    <select
                      value={incidentForm.incident_type}
                      onChange={(e) => setIncidentForm({ ...incidentForm, incident_type: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:border-pink-500"
                    >
                      <option value="ACCIDENT">🚗 Accident Collision</option>
                      <option value="CONSTRUCTION">🚧 Road Construction</option>
                      <option value="ROAD_CLOSURE">⛔ Full Road Closure</option>
                      <option value="CONGESTION">🚦 Heavy Congestion</option>
                      <option value="WEATHER_HAZARD">🌧️ Weather Hazard</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Severity</label>
                    <select
                      value={incidentForm.severity}
                      onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:border-pink-500"
                    >
                      <option value="MINOR">MINOR (1.3×)</option>
                      <option value="MAJOR">MAJOR (1.85×)</option>
                      <option value="CRITICAL">CRITICAL (3.5×)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Latitude</label>
                    <input
                      type="number"
                      step="0.001"
                      value={incidentForm.lat}
                      onChange={(e) => setIncidentForm({ ...incidentForm, lat: parseFloat(e.target.value) })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:border-pink-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Longitude</label>
                    <input
                      type="number"
                      step="0.001"
                      value={incidentForm.lng}
                      onChange={(e) => setIncidentForm({ ...incidentForm, lng: parseFloat(e.target.value) })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Description</label>
                  <input
                    type="text"
                    value={incidentForm.description}
                    onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-pink-500"
                  />
                </div>

                {/* Quick Presets */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1.5 font-bold uppercase">Quick SF Hotspots:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { name: "Financial District", lat: 37.789, lng: -122.401, type: "ACCIDENT", sev: "CRITICAL" },
                      { name: "SoMa Hub", lat: 37.778, lng: -122.398, type: "CONSTRUCTION", sev: "MAJOR" },
                      { name: "Mission Blvd", lat: 37.760, lng: -122.415, type: "CONGESTION", sev: "MINOR" },
                    ].map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => setIncidentForm({
                          ...incidentForm,
                          name: `${p.name} Incident`,
                          lat: p.lat,
                          lng: p.lng,
                          incident_type: p.type,
                          severity: p.sev,
                        })}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[10px] flex items-center space-x-1"
                      >
                        <MapPinIcon className="w-3 h-3 text-pink-500" />
                        <span>{p.name} ({p.sev})</span>
                      </button>
                    ))}
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 hover:from-pink-600 hover:to-violet-700 text-white font-black uppercase tracking-wider text-xs shadow-xl shadow-pink-500/25 transition-all"
                >
                  Inject Incident & Stream to Redis
                </motion.button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

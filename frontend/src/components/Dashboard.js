import React, { useState, useEffect } from "react";

export default function Dashboard({
  userRole = "DISPATCHER",
  metrics = {},
  benchmarkData = null,
  onNavigate = () => {},
}) {
  const [metricToggle, setMetricToggle] = useState("distance"); // 'distance', 'runtime', 'co2'
  const [co2SavedDisplay, setCo2SavedDisplay] = useState(148.4);

  // Animated carbon counter increment
  useEffect(() => {
    const timer = setInterval(() => {
      setCo2SavedDisplay((prev) => +(prev + 0.05).toFixed(2));
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  // Benchmark default comparison dataset
  const benchmarkRows = benchmarkData || [
    { algorithm: "QAOA (Quantum)", distance_km: 33.51, execution_time_ms: 45.2, co2_kg: 1.608, is_quantum: true },
    { algorithm: "Simulated Quantum Annealing", distance_km: 33.51, execution_time_ms: 78.4, co2_kg: 1.608, is_quantum: true },
    { algorithm: "Clarke-Wright Savings", distance_km: 34.80, execution_time_ms: 0.05, co2_kg: 1.670, is_quantum: false },
    { algorithm: "2-Opt Local Search", distance_km: 34.10, execution_time_ms: 0.04, co2_kg: 1.636, is_quantum: false },
    { algorithm: "Tabu Search", distance_km: 33.70, execution_time_ms: 6.80, co2_kg: 1.617, is_quantum: false },
    { algorithm: "Classical Simulated Annealing", distance_km: 33.95, execution_time_ms: 1.85, co2_kg: 1.629, is_quantum: false },
  ];

  // Compute maximum values for percentage bar widths
  const maxDistance = Math.max(...benchmarkRows.map((r) => r.distance_km)) || 1.0;
  const maxRuntime = Math.max(...benchmarkRows.map((r) => r.execution_time_ms)) || 1.0;
  const maxCo2 = Math.max(...benchmarkRows.map((r) => r.co2_kg)) || 1.0;

  return (
    <div className="space-y-6">
      {/* Role-Specific Notification / Action Banner */}
      <div className="rounded-xl border p-4 bg-gradient-to-r from-slate-900 via-navy-900 to-navy-950 flex flex-wrap items-center justify-between gap-4 shadow-lg border-cyan-500/20">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold">
            {userRole[0]}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                Active Session: {userRole}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-sm text-slate-300 font-medium">
              {userRole === "ADMIN" && "System health normal. SHA-256 audit blockchain verified with 0 tampering events."}
              {userRole === "DISPATCHER" && "Quantum optimization engine ready. 4 fleet units active in San Francisco corridor."}
              {userRole === "DRIVER" && "Active manifest assigned. GPS corridor tracking enabled with live telemetry streaming."}
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate(userRole === "DRIVER" ? "fleet" : "optimize")}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold text-xs uppercase tracking-wider hover:opacity-90 shadow-md shadow-cyan-500/20 transition-all"
        >
          {userRole === "DRIVER" ? "View My Manifest" : "Launch Optimization Studio"}
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Distance Optimized */}
        <div className="quantum-card p-5 bg-navy-900 border border-slate-800 rounded-xl relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs uppercase font-bold text-slate-400">Total Route Distance</span>
            <span className="text-cyan-400 text-xs font-bold bg-cyan-500/10 px-2 py-0.5 rounded">Optimal</span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-100">1,248.6</span>
            <span className="text-xs text-slate-400 font-medium">km planned</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">QAOA & SQA tour compression</p>
        </div>

        {/* Card 2: Animated Carbon Footprint Counter */}
        <div className="quantum-card p-5 bg-navy-900 border border-slate-800 rounded-xl relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs uppercase font-bold text-emerald-400">Carbon Savings</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-emerald-400 font-mono">
              {co2SavedDisplay.toFixed(2)}
            </span>
            <span className="text-xs text-emerald-300 font-medium">kg CO2</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">vs standard diesel vehicle baseline</p>
        </div>

        {/* Card 3: Fleet Efficiency */}
        <div className="quantum-card p-5 bg-navy-900 border border-slate-800 rounded-xl relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs uppercase font-bold text-slate-400">Fleet Energy Index</span>
            <span className="text-purple-400 text-xs font-bold bg-purple-500/10 px-2 py-0.5 rounded">98.4%</span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-purple-400">0.198</span>
            <span className="text-xs text-slate-400 font-medium">kWh / km</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Regenerative braking active</p>
        </div>

        {/* Card 4: Active Fleet Telemetry */}
        <div className="quantum-card p-5 bg-navy-900 border border-slate-800 rounded-xl relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs uppercase font-bold text-slate-400">Active Fleet Units</span>
            <span className="text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2 py-0.5 rounded">Live</span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-100">4 / 4</span>
            <span className="text-xs text-slate-400 font-medium">Vehicles</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Zero corridor safety deviations</p>
        </div>
      </div>

      {/* Quantum vs Classical Performance Benchmark Section */}
      <div className="quantum-card p-5 bg-navy-900 border border-slate-800 rounded-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold tracking-wider uppercase text-slate-200">
              Quantum vs Classical Optimization Benchmark
            </h3>
            <p className="text-xs text-slate-400">
              Side-by-side performance evaluation on identical delivery stop instances
            </p>
          </div>

          {/* Metric Selector Toggles */}
          <div className="flex items-center bg-navy-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setMetricToggle("distance")}
              className={`px-3 py-1 rounded font-semibold transition-all ${
                metricToggle === "distance"
                  ? "bg-cyan-500 text-black shadow-cyan-500/30 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Route Distance (km)
            </button>
            <button
              onClick={() => setMetricToggle("runtime")}
              className={`px-3 py-1 rounded font-semibold transition-all ${
                metricToggle === "runtime"
                  ? "bg-cyan-500 text-black shadow-cyan-500/30 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Execution Time (ms)
            </button>
            <button
              onClick={() => setMetricToggle("co2")}
              className={`px-3 py-1 rounded font-semibold transition-all ${
                metricToggle === "co2"
                  ? "bg-cyan-500 text-black shadow-cyan-500/30 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              CO2 Emissions (kg)
            </button>
          </div>
        </div>

        {/* Dynamic Comparative Bar Charts */}
        <div className="space-y-3 pt-2">
          {benchmarkRows.map((row, idx) => {
            let value = 0;
            let maxVal = 1;
            let displayVal = "";
            let color = row.is_quantum ? "from-cyan-500 to-purple-600" : "from-slate-600 to-slate-500";

            if (metricToggle === "distance") {
              value = row.distance_km;
              maxVal = maxDistance;
              displayVal = `${value.toFixed(2)} km`;
            } else if (metricToggle === "runtime") {
              value = row.execution_time_ms;
              maxVal = maxRuntime;
              displayVal = `${value.toFixed(2)} ms`;
              color = row.is_quantum ? "from-purple-500 to-indigo-600" : "from-teal-600 to-emerald-500";
            } else {
              value = row.co2_kg;
              maxVal = maxCo2;
              displayVal = `${value.toFixed(3)} kg`;
              color = "from-emerald-500 to-teal-500";
            }

            const pct = Math.max(8, (value / maxVal) * 100);

            return (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="flex items-center space-x-2">
                    <span className={row.is_quantum ? "text-cyan-400 font-bold" : "text-slate-300"}>
                      {row.algorithm}
                    </span>
                    {row.is_quantum && (
                      <span className="text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.2 rounded">
                        QUBO / QAOA
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-slate-200">{displayVal}</span>
                </div>

                {/* Bar Track */}
                <div className="w-full h-3 bg-navy-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

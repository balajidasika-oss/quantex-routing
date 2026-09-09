import React, { useState, useEffect, useCallback } from "react";
import FleetMap from "../components/FleetMap";
import QuantumCircuitViewer from "../components/QuantumCircuitViewer";

export default function Optimize({ apiUrl = "http://localhost:8000/api", onRouteDispatched = () => {} }) {
  // Default delivery stop locations around San Francisco
  const [locations, setLocations] = useState([
    { name: "Central Metro Depot", lat: 37.7749, lng: -122.4194, demand_kg: 0.0 },
    { name: "Mission Delivery #1", lat: 37.7599, lng: -122.4148, demand_kg: 18.5 },
    { name: "Financial Center Drop #2", lat: 37.7946, lng: -122.4005, demand_kg: 32.0 },
    { name: "SoMa Tech Park #3", lat: 37.7801, lng: -122.4011, demand_kg: 24.0 },
    { name: "Sunset Residential #4", lat: 37.7540, lng: -122.4800, demand_kg: 15.0 },
  ]);

  const [solverType, setSolverType] = useState("quantum"); // "quantum", "classical", "hybrid"
  const [algorithm, setAlgorithm] = useState("QAOA");
  const [vehicleType, setVehicleType] = useState("ELECTRIC");
  const [pDepth, setPDepth] = useState(2);
  const [shots, setShots] = useState(1024);
  const [applyTraffic, setApplyTraffic] = useState(true);

  // Results state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [dispatchStatus, setDispatchStatus] = useState("");

  const handleOptimize = useCallback(async (customLocations = null) => {
    const stopsToOptimize = (Array.isArray(customLocations) && customLocations.length) ? customLocations : locations;
    setLoading(true);
    setDispatchStatus("");
    try {
      const res = await fetch(`${apiUrl}/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locations: stopsToOptimize,
          solver_type: solverType,
          algorithm,
          vehicle_type: vehicleType,
          p_depth: pDepth,
          shots,
          apply_traffic: applyTraffic,
        }),
      });
      if (!res.ok) {
        throw new Error("Optimization request failed");
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error("Error optimizing route:", err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, locations, solverType, algorithm, vehicleType, pDepth, shots, applyTraffic]);

  // Automatically calculate initial route on component mount
  useEffect(() => {
    handleOptimize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run on initial load

  const handleBenchmark = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/optimize/benchmark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locations,
          solver_type: solverType,
          vehicle_type: vehicleType,
          p_depth: pDepth,
          apply_traffic: applyTraffic,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBenchmarkResult(data);
      }
    } catch (err) {
      alert("Error running benchmark: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDispatch = async () => {
    if (!result || !result.id) return;
    try {
      const res = await fetch(`${apiUrl}/optimize/dispatch/${result.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle_id: 1 }),
      });
      if (res.ok) {
        setDispatchStatus("SUCCESSFULLY DISPATCHED TO FLEET (EV-VAN-01)");
        onRouteDispatched(result);
      }
    } catch (err) {
      alert("Dispatch error: " + err.message);
    }
  };

  const generateRandomStops = () => {
    const baseLat = 37.7749;
    const baseLng = -122.4194;
    const names = ["Embarcadero Pier", "Presidio Hub", "Nob Hill Drop", "Twin Peaks Courier", "Civic Center Express"];
    const newStops = [
      { name: "Central Metro Depot", lat: baseLat, lng: baseLng, demand_kg: 0.0 },
    ];
    for (let i = 0; i < 4; i++) {
      newStops.push({
        name: names[i] || `Drop Zone #${i + 1}`,
        lat: +(baseLat + (Math.random() - 0.5) * 0.06).toFixed(4),
        lng: +(baseLng + (Math.random() - 0.5) * 0.08).toFixed(4),
        demand_kg: +(Math.random() * 30 + 10).toFixed(1),
      });
    }
    setLocations(newStops);
    handleOptimize(newStops);
  };

  const handleMapClick = (latlng) => {
    const newStop = {
      name: `Manual Drop #${locations.length}`,
      lat: latlng.lat,
      lng: latlng.lng,
      demand_kg: +(Math.random() * 20 + 5).toFixed(1)
    };
    const updated = [...locations, newStop];
    setLocations(updated);
    handleOptimize(updated);
  };

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-black tracking-wide uppercase text-white">
            Route Optimization Studio
          </h2>
          <p className="text-xs text-slate-400">
            Qiskit QAOA Statevector Optimization, Hybrid Solvers & Classical Baselines
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={generateRandomStops}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
          >
            Generate Random Batch
          </button>
          <button
            onClick={() => handleBenchmark()}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/20"
          >
            Cross-Solver Benchmark
          </button>
          <button
            onClick={() => handleOptimize()}
            disabled={loading}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-cyan-500/25"
          >
            {loading ? "Computing Solution..." : "Optimize Route"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Controls Column (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Solver Settings */}
          <div className="quantum-card p-4 bg-navy-900 border border-slate-800 rounded-xl space-y-4 text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 border-b border-slate-800 pb-2">
              Optimization Engine Settings
            </h3>

            {/* Solver Type Selector */}
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Solver Category</label>
              <select
                value={solverType}
                onChange={(e) => setSolverType(e.target.value)}
                className="w-full bg-navy-950 border border-cyan-500/40 rounded px-2.5 py-1.5 text-cyan-300 font-bold focus:outline-none focus:border-cyan-400"
              >
                <option value="quantum">Quantum (Qiskit QAOA / Statevector)</option>
                <option value="hybrid">Hybrid (Quantum QAOA + Classical Refinement)</option>
                <option value="classical">Classical Heuristic (Clarke-Wright / 2-Opt)</option>
              </select>
            </div>

            {solverType === "classical" && (
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Classical Algorithm</label>
                <select
                  value={algorithm}
                  onChange={(e) => setAlgorithm(e.target.value)}
                  className="w-full bg-navy-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-medium"
                >
                  <option value="TWO_OPT">2-Opt Local Search</option>
                  <option value="CLARKE_WRIGHT">Clarke-Wright Savings</option>
                  <option value="TABU_SEARCH">Tabu Search (Tenure Memory)</option>
                  <option value="CLASSICAL_SA">Simulated Annealing (Metropolis)</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Vehicle Powertrain</label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full bg-navy-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-medium"
              >
                <option value="ELECTRIC">Electric Commercial Van (0.048 kg CO2/km)</option>
                <option value="HYBRID">Hybrid Delivery Van (0.145 kg CO2/km)</option>
                <option value="DIESEL">Diesel Light Commercial (0.268 kg CO2/km)</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-400 font-semibold">Real-Time Traffic Congestion</span>
              <input
                type="checkbox"
                checked={applyTraffic}
                onChange={(e) => setApplyTraffic(e.target.checked)}
                className="rounded bg-navy-950 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
              />
            </div>
          </div>

          {/* Delivery Stops Manifest Editor */}
          <div className="quantum-card p-4 bg-navy-900 border border-slate-800 rounded-xl space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Waypoints ({locations.length})
              </h3>
              <span className="text-[11px] text-slate-400">Click map to add</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {locations.map((loc, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-navy-950/80 border border-slate-800/80 flex items-center justify-between"
                >
                  <div className="overflow-hidden">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[9px] font-bold text-cyan-400">
                        {idx === 0 ? "D" : idx}
                      </span>
                      <strong className="text-slate-200 truncate">{loc.name}</strong>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)} | {loc.demand_kg} kg
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Visualization Column (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Interactive Map */}
          <FleetMap
            stops={result ? result.ordered_stops : locations}
            polyline={result ? result.polyline : []}
            onMapClick={handleMapClick}
          />

          {/* QAOA Circuit Viewer (shown in Quantum or Hybrid mode) */}
          {solverType !== "classical" && (
            <QuantumCircuitViewer
              circuit={result ? result.circuit_diagram : null}
              initialDepth={pDepth}
              onParametersChange={(p) => {
                setPDepth(p.depth);
                setShots(p.shots);
              }}
            />
          )}

          {/* Qiskit Circuit Metrics Card */}
          {result && result.qiskit_metrics && Object.keys(result.qiskit_metrics).length > 0 && (
            <div className="quantum-card p-4 bg-navy-900 border border-purple-500/40 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-purple-300 uppercase tracking-wider">
                  Qiskit Quantum Circuit Execution Metrics
                </span>
                <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                  Backend: {result.qiskit_metrics.backend || "statevector_simulator"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="bg-navy-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Ground Energy (Eigenvalue)</span>
                  <span className="text-sm font-black text-purple-400 font-mono">
                    {result.qiskit_metrics.energy?.toFixed(4)}
                  </span>
                </div>
                <div className="bg-navy-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Circuit Depth</span>
                  <span className="text-sm font-black text-cyan-400 font-mono">
                    {result.qiskit_metrics.circuit_depth} Gates
                  </span>
                </div>
                <div className="bg-navy-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Convergence Evals</span>
                  <span className="text-sm font-black text-emerald-400 font-mono">
                    {result.qiskit_metrics.convergence_evals || "Converged"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Comparative Metrics (Quantum vs Classical) */}
          {result && result.comparative_metrics && (
            <div className="quantum-card p-4 bg-navy-900 border border-teal-500/40 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-teal-300 uppercase tracking-wider">
                  Comparative Analysis: Quantum vs Classical Baseline
                </span>
                <span className="text-[11px] text-emerald-400 font-bold">
                  {result.comparative_metrics.co2_delta_kg >= 0 ? "✓ Efficiency Confirmed" : "Near-Optimal"}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="bg-navy-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Quantum Distance</span>
                  <span className="text-sm font-black text-cyan-400 font-mono">
                    {result.comparative_metrics.quantum_distance_km} km
                  </span>
                </div>
                <div className="bg-navy-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Classical Distance</span>
                  <span className="text-sm font-black text-slate-300 font-mono">
                    {result.comparative_metrics.classical_distance_km} km
                  </span>
                </div>
                <div className="bg-navy-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Quantum CO2</span>
                  <span className="text-sm font-black text-emerald-400 font-mono">
                    {result.comparative_metrics.quantum_co2_kg} kg
                  </span>
                </div>
                <div className="bg-navy-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Classical CO2</span>
                  <span className="text-sm font-black text-slate-300 font-mono">
                    {result.comparative_metrics.classical_co2_kg} kg
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Results KPI & Dispatch Action */}
          {result && (
            <div className="quantum-card p-5 bg-navy-900 border border-cyan-500/40 rounded-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="quantum-badge bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-mono font-bold">
                    {result.plan_code}
                  </span>
                  <span className="text-xs text-slate-300 font-semibold">
                    Optimal Tour: {result.tour?.join(" → ")}
                  </span>
                </div>

                <button
                  onClick={handleDispatch}
                  className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20"
                >
                  Dispatch to Fleet
                </button>
              </div>

              {dispatchStatus && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-lg flex items-center space-x-2">
                  <span>✓</span>
                  <span>{dispatchStatus}</span>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-navy-950 p-2.5 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Distance</span>
                  <span className="text-base font-black text-cyan-400">{result.total_distance_km} km</span>
                </div>
                <div className="bg-navy-950 p-2.5 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Runtime</span>
                  <span className="text-base font-black text-purple-400">{result.execution_time_ms} ms</span>
                </div>
                <div className="bg-navy-950 p-2.5 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">CO2 Emissions</span>
                  <span className="text-base font-black text-emerald-400">
                    {result.emissions?.total_co2_kg} kg
                  </span>
                </div>
                <div className="bg-navy-950 p-2.5 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Audit Hash</span>
                  <span className="text-xs font-mono text-slate-300 truncate block mt-0.5">
                    {result.audit_block_hash ? result.audit_block_hash.slice(0, 10) + "..." : "Recorded"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Benchmark Results Table */}
          {benchmarkResult && benchmarkResult.results && (
            <div className="quantum-card p-5 bg-navy-900 border border-purple-500/40 rounded-xl space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Cross-Solver Benchmark Comparison Table
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-navy-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Algorithm</th>
                      <th className="p-2.5">Distance (km)</th>
                      <th className="p-2.5">Runtime (ms)</th>
                      <th className="p-2.5">CO2 (kg)</th>
                      <th className="p-2.5">Quality Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {benchmarkResult.results.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="p-2.5 font-sans font-bold text-slate-200">{r.algorithm}</td>
                        <td className="p-2.5 text-cyan-400 font-bold">{r.distance_km}</td>
                        <td className="p-2.5 text-purple-300">{r.execution_time_ms}</td>
                        <td className="p-2.5 text-emerald-400">{r.co2_emissions_kg}</td>
                        <td className="p-2.5 text-slate-300">{r.solution_quality_score}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

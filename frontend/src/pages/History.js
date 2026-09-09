import React, { useState, useEffect } from "react";
import Reports from "../components/Reports";

export default function History({ apiUrl = "http://localhost:8000/api" }) {
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [selectedPlanCode, setSelectedPlanCode] = useState("");

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${apiUrl}/optimize/plans`);
      if (res.ok) {
        const data = await res.json();
        setPlans(data);
        if (data.length > 0 && !selectedPlanId) {
          setSelectedPlanId(data[0].id);
          setSelectedPlanCode(data[0].plan_code);
        }
      }
    } catch (e) {
      console.warn("Could not fetch plans:", e);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-3">
        <h2 className="text-lg font-black tracking-wide uppercase text-white">
          Historical Optimizations & Cryptographic Ledger
        </h2>
        <p className="text-xs text-slate-400">
          Review saved route plans, verify SHA-256 chain certification, and download reports.
        </p>
      </div>

      {/* Historical Plans Table */}
      <div className="quantum-card p-5 bg-navy-900 border border-slate-800 rounded-xl space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
          Saved Route Optimizations ({plans.length})
        </h3>

        {plans.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            No route plans found in database. Optimize a route in the studio to record entries.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-navy-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                <tr>
                  <th className="p-2.5">Plan Code</th>
                  <th className="p-2.5">Solver</th>
                  <th className="p-2.5">Distance</th>
                  <th className="p-2.5">CO2 (kg)</th>
                  <th className="p-2.5">Runtime</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {plans.map((p) => {
                  const isSelected = selectedPlanId === p.id;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => {
                        setSelectedPlanId(p.id);
                        setSelectedPlanCode(p.plan_code);
                      }}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? "bg-cyan-500/10 text-cyan-300" : "hover:bg-slate-800/30"
                      }`}
                    >
                      <td className="p-2.5 font-bold font-sans text-slate-200">{p.plan_code}</td>
                      <td className="p-2.5 text-purple-400 font-sans">{p.solver_type}</td>
                      <td className="p-2.5 text-cyan-400">{p.total_distance_km} km</td>
                      <td className="p-2.5 text-emerald-400">{p.total_co2_kg}</td>
                      <td className="p-2.5 text-slate-400">{p.execution_time_ms} ms</td>
                      <td className="p-2.5 font-sans">
                        <span className="quantum-badge bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                          {p.status}
                        </span>
                      </td>
                      <td className="p-2.5 font-sans">
                        <button
                          onClick={() => {
                            setSelectedPlanId(p.id);
                            setSelectedPlanCode(p.plan_code);
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                            isSelected ? "bg-cyan-500 text-black" : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reports & Blockchain Explorer */}
      <Reports
        selectedPlanId={selectedPlanId}
        planCode={selectedPlanCode}
        apiUrl={apiUrl}
      />
    </div>
  );
}

import React from "react";

export default function Home({ onNavigate = () => {} }) {
  return (
    <div className="space-y-10 py-4">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-navy-900 via-navy-950 to-navy-950 p-8 sm:p-12 text-center shadow-2xl">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-6">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>Next-Generation Hybrid Optimization System</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white max-w-3xl mx-auto leading-tight">
          Quantum-AI Last-Mile Delivery &{" "}
          <span className="quantum-gradient-text">Vehicle Routing System</span>
        </h1>

        <p className="mt-4 text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Formulate VRP as Quadratic Unconstrained Binary Optimization (QUBO) matrices, execute QAOA
          circuits with variational parameter grid search, model EV battery degradation physics, and maintain
          tamper-proof cryptographic SHA-256 audit logs.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => onNavigate("optimize")}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-blue-600 text-black font-black text-xs sm:text-sm uppercase tracking-wider hover:opacity-95 transition-all shadow-lg shadow-cyan-500/25"
          >
            Launch Optimization Studio
          </button>
          <button
            onClick={() => onNavigate("fleet")}
            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs sm:text-sm uppercase tracking-wider transition-all"
          >
            Monitor Live Fleet Telemetry
          </button>
        </div>
      </div>

      {/* Feature Pillar Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pillar 1: Quantum Optimization */}
        <div className="quantum-card p-6 bg-navy-900 border border-slate-800 rounded-xl space-y-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 text-lg font-bold">
            Ψ
          </div>
          <h3 className="text-base font-bold text-white">Quantum & Classical Engine</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Exact statevector QAOA quantum circuit emulation with automated (γ, β) grid search,
            Simulated Quantum Annealing, Clarke-Wright savings, 2-Opt local search, and Tabu Search.
          </p>
          <div className="pt-2 text-xs font-mono text-purple-300">
            H_C = x^T Q x | p-layer QAOA
          </div>
        </div>

        {/* Pillar 2: Fleet Intelligence */}
        <div className="quantum-card p-6 bg-navy-900 border border-slate-800 rounded-xl space-y-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-lg font-bold">
            ⚡
          </div>
          <h3 className="text-base font-bold text-white">Fleet & EV Intelligence</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Dynamic corridor geofencing with real-time point-to-polyline deviation alerts, EV battery
            state-of-charge discharge modeling, and cumulative electrochemical degradation tracking.
          </p>
          <div className="pt-2 text-xs font-mono text-emerald-300">
            P_tractive = F_roll + F_aero + F_grade
          </div>
        </div>

        {/* Pillar 3: Cryptographic Compliance */}
        <div className="quantum-card p-6 bg-navy-900 border border-slate-800 rounded-xl space-y-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-lg font-bold">
            ⛓️
          </div>
          <h3 className="text-base font-bold text-white">Chained SHA-256 Audit Logs</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every optimization run and vehicle dispatch is cryptographically signed and chained to previous
            hashes, enabling end-to-end mathematical verification of route integrity and zero tampering.
          </p>
          <div className="pt-2 text-xs font-mono text-cyan-300">
            Hash = SHA256(idx + prev + payload)
          </div>
        </div>
      </div>
    </div>
  );
}

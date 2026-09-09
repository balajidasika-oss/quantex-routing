import React, { useState } from "react";

export default function QuantumCircuitViewer({
  circuit = null,
  initialGamma = 1.45,
  initialBeta = 0.78,
  initialDepth = 2,
  onParametersChange = () => {},
}) {
  const [gamma, setGamma] = useState(initialGamma);
  const [beta, setBeta] = useState(initialBeta);
  const [depth, setDepth] = useState(initialDepth);
  const [shots, setShots] = useState(1024);

  const handleGammaChange = (val) => {
    const g = parseFloat(val);
    setGamma(g);
    onParametersChange({ gamma: g, beta, depth, shots });
  };

  const handleBetaChange = (val) => {
    const b = parseFloat(val);
    setBeta(b);
    onParametersChange({ gamma, beta: b, depth, shots });
  };

  const handleDepthChange = (d) => {
    setDepth(d);
    onParametersChange({ gamma, beta, depth: d, shots });
  };

  // Default qubits for visual rendering
  const qubits = circuit?.qubits || ["q[0]", "q[1]", "q[2]", "q[3]"];

  return (
    <div className="quantum-card p-5 bg-navy-900 border border-slate-800 rounded-xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-purple-400 animate-pulse" />
          <h3 className="text-sm font-bold tracking-wider uppercase text-slate-200">
            QAOA Variational Quantum Circuit Visualizer
          </h3>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <span className="quantum-badge bg-purple-500/10 text-purple-300 border-purple-500/30">
            Depth p = {depth}
          </span>
          <span className="quantum-badge bg-cyan-500/10 text-cyan-300 border-cyan-500/30">
            {qubits.length} Qubits Active
          </span>
        </div>
      </div>

      {/* Graphical Circuit Diagram SVG */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[650px] bg-navy-950 p-4 rounded-lg border border-slate-800/80">
          <svg viewBox="0 0 760 220" className="w-full select-none font-mono text-xs">
            <defs>
              <linearGradient id="gateHadamard" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>
              <linearGradient id="gatePhase" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#6d28d9" />
              </linearGradient>
              <linearGradient id="gateMixer" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0d9488" />
                <stop offset="100%" stopColor="#0f766e" />
              </linearGradient>
            </defs>

            {/* Qubit Wire Tracks */}
            {qubits.map((q, idx) => {
              const y = 35 + idx * 45;
              return (
                <g key={`wire-${idx}`}>
                  {/* Qubit Label */}
                  <text x="15" y={y + 4} fill="#94a3b8" fontSize="12" fontWeight="bold">
                    {q}
                  </text>
                  {/* Wire Line */}
                  <line x1="60" y1={y} x2="720" y2={y} stroke="#334155" strokeWidth="1.5" />
                </g>
              );
            })}

            {/* Layer 0: Hadamard Gates */}
            {qubits.map((_, idx) => {
              const y = 35 + idx * 45;
              return (
                <g key={`h-${idx}`}>
                  <rect x="80" y={y - 14} width="28" height="28" rx="4" fill="url(#gateHadamard)" stroke="#38bdf8" strokeWidth="1.5" />
                  <text x="94" y={y + 4} fill="#fff" fontWeight="bold" textAnchor="middle">
                    H
                  </text>
                </g>
              );
            })}

            {/* Stage Label 1 */}
            <text x="94" y="210" fill="#64748b" fontSize="10" textAnchor="middle">
              Superposition |+⟩
            </text>

            {/* QAOA Layer 1: Problem Unitary U(C, gamma) */}
            <rect x="135" y="10" width="220" height="185" rx="6" fill="rgba(124, 58, 237, 0.06)" stroke="#7c3aed" strokeDasharray="4,4" strokeWidth="1" />
            <text x="245" y="210" fill="#a78bfa" fontSize="10" textAnchor="middle">
              U(C, γ={gamma.toFixed(2)})
            </text>

            {/* Entangling RZZ gates across adjacent qubits */}
            {qubits.slice(0, -1).map((_, idx) => {
              const y1 = 35 + idx * 45;
              const y2 = 35 + (idx + 1) * 45;
              const xPos = 160 + idx * 40;
              return (
                <g key={`rzz-${idx}`}>
                  <line x1={xPos} y1={y1} x2={xPos} y2={y2} stroke="#a78bfa" strokeWidth="2" />
                  <circle cx={xPos} cy={y1} r="4" fill="#a78bfa" />
                  <circle cx={xPos} cy={y2} r="4" fill="#a78bfa" />
                  <rect x={xPos - 22} y={(y1 + y2) / 2 - 11} width="44" height="22" rx="3" fill="url(#gatePhase)" stroke="#c4b5fd" strokeWidth="1" />
                  <text x={xPos} y={(y1 + y2) / 2 + 4} fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">
                    Rzz
                  </text>
                </g>
              );
            })}

            {/* QAOA Layer 1: Mixer Unitary U(B, beta) */}
            <rect x="380" y="10" width="130" height="185" rx="6" fill="rgba(13, 148, 136, 0.06)" stroke="#0d9488" strokeDasharray="4,4" strokeWidth="1" />
            <text x="445" y="210" fill="#2dd4bf" fontSize="10" textAnchor="middle">
              U(B, β={beta.toFixed(2)})
            </text>

            {qubits.map((_, idx) => {
              const y = 35 + idx * 45;
              return (
                <g key={`rx-${idx}`}>
                  <rect x="420" y={y - 14} width="36" height="28" rx="4" fill="url(#gateMixer)" stroke="#5eead4" strokeWidth="1.5" />
                  <text x="438" y={y + 4} fill="#fff" fontSize="10" fontWeight="bold" textAnchor="middle">
                    Rx
                  </text>
                </g>
              );
            })}

            {/* Measurement Gauge Meters */}
            {qubits.map((_, idx) => {
              const y = 35 + idx * 45;
              return (
                <g key={`m-${idx}`}>
                  <rect x="670" y={y - 14} width="28" height="28" rx="4" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
                  {/* Gauge Arc */}
                  <path d={`M 676 ${y + 5} A 8 8 0 0 1 692 ${y + 5}`} fill="none" stroke="#e2e8f0" strokeWidth="1" />
                  <line x1="684" y1={y + 5} x2="690" y2={y - 5} stroke="#00f0ff" strokeWidth="1.5" />
                </g>
              );
            })}
            <text x="684" y="210" fill="#94a3b8" fontSize="10" textAnchor="middle">
              Measure
            </text>
          </svg>
        </div>
      </div>

      {/* Interactive Variational Parameter Tuning Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-navy-950/60 p-4 rounded-lg border border-slate-800">
        {/* Gamma Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 font-semibold">Phase Angle (γ)</span>
            <span className="text-purple-400 font-mono font-bold">{gamma.toFixed(3)} rad</span>
          </div>
          <input
            type="range"
            min="0.05"
            max="6.28"
            step="0.05"
            value={gamma}
            onChange={(e) => handleGammaChange(e.target.value)}
            className="w-full accent-purple-500 bg-slate-800 h-1.5 rounded cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>0</span>
            <span>π</span>
            <span>2π</span>
          </div>
        </div>

        {/* Beta Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 font-semibold">Mixer Angle (β)</span>
            <span className="text-teal-400 font-mono font-bold">{beta.toFixed(3)} rad</span>
          </div>
          <input
            type="range"
            min="0.05"
            max="3.14"
            step="0.05"
            value={beta}
            onChange={(e) => handleBetaChange(e.target.value)}
            className="w-full accent-teal-500 bg-slate-800 h-1.5 rounded cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>0</span>
            <span>π/2</span>
            <span>π</span>
          </div>
        </div>

        {/* Circuit Depth p */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 font-semibold">Circuit Depth (p)</span>
            <span className="text-cyan-400 font-bold">{depth} Layers</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[1, 2, 3, 4].map((d) => (
              <button
                key={d}
                onClick={() => handleDepthChange(d)}
                className={`py-1 text-xs rounded font-bold transition-all ${
                  depth === d
                    ? "bg-cyan-500 text-black shadow-cyan-500/20 shadow-md"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                p={d}
              </button>
            ))}
          </div>
        </div>

        {/* Shot Count */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 font-semibold">Sampling Shots</span>
            <span className="text-amber-400 font-mono font-bold">{shots}</span>
          </div>
          <select
            value={shots}
            onChange={(e) => {
              const s = parseInt(e.target.value);
              setShots(s);
              onParametersChange({ gamma, beta, depth, shots: s });
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="256">256 Shots (Fast)</option>
            <option value="1024">1,024 Shots (Optimal)</option>
            <option value="4096">4,096 Shots (High Precision)</option>
          </select>
        </div>
      </div>
    </div>
  );
}

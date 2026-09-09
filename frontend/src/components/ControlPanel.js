import React from 'react';
import { Package, Zap, BarChart3, Leaf, Fuel, Timer, ServerCrash, Server, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

const MetricCard = ({ icon: Icon, title, value, unit, highlight }) => (
  <motion.div 
    whileHover={{ scale: 1.02 }}
    className={`p-4 rounded-xl border backdrop-blur-md ${highlight ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}
  >
    <div className="flex items-center gap-2 mb-2">
      <Icon size={16} className={highlight ? 'text-emerald-400' : 'text-slate-400'} />
      <span className="text-xs font-semibold tracking-wider text-slate-300 uppercase">{title}</span>
    </div>
    <div className="flex items-baseline gap-1">
      <span className={`text-2xl font-bold ${highlight ? 'text-emerald-400' : 'text-white'}`}>{value}</span>
      <span className="text-sm text-slate-400">{unit}</span>
    </div>
  </motion.div>
);

const ControlPanel = ({ onLoadData, onOptimize, onClear, loading, metrics, numVehicles, setNumVehicles, hasNodes, backendStatus, nodeCount }) => {
  return (
    <div className="flex flex-col h-full bg-[#111827]/80 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/10 p-6 relative overflow-hidden">
      {/* Decorative gradient orb */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/30 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Package size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Q-Dispatch</h1>
            <p className="text-sm text-indigo-200/60 font-medium">Quantum Routing Engine</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          {backendStatus === 'error' ? <ServerCrash size={18} className="text-rose-500 animate-pulse"/> : <Server size={18} className="text-emerald-500"/>}
        </div>
      </div>

      <div className="space-y-4 mb-8 relative z-10">
        <div className="flex gap-2">
          <button 
            onClick={onLoadData}
            className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Package size={18} />
            Load Base Data
          </button>
          <button 
            onClick={onClear}
            disabled={!hasNodes}
            className={`py-3 px-4 border rounded-xl transition-all duration-200 flex items-center justify-center ${!hasNodes ? 'bg-white/5 border-white/5 text-slate-600' : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400'}`}
          >
            <Trash2 size={18} />
          </button>
        </div>
        
        <div className="flex flex-col gap-2 p-4 bg-white/5 border border-white/10 rounded-xl">
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-semibold text-slate-300">Fleet Size (Clusters)</label>
            <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-md">{nodeCount} Nodes Active</span>
          </div>
          <input 
            type="range" 
            value={numVehicles} 
            onChange={(e) => setNumVehicles(parseInt(e.target.value) || 1)}
            min="1" max="10"
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="text-center text-xl font-bold text-white mt-2">{numVehicles} Vehicles</div>
        </div>

        <button 
          onClick={onOptimize}
          disabled={!hasNodes || loading}
          className={`w-full py-4 px-4 font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg
            ${!hasNodes ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed' : 
              loading ? 'bg-indigo-600/50 text-indigo-200 border border-indigo-500/50 cursor-wait' : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border border-indigo-400/30 hover:shadow-indigo-500/25'}`}
        >
          <Zap size={20} className={loading ? 'animate-pulse' : ''} />
          {loading ? 'Solving QUBO Matrix...' : 'Execute Quantum Routing'}
        </button>
      </div>

      <div className="flex-1 flex flex-col relative z-10">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
          <BarChart3 size={18} className="text-indigo-400" />
          <h2 className="text-sm font-bold tracking-widest text-slate-300 uppercase">Telemetry Dashboard</h2>
        </div>

        {metrics ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-3"
          >
            <MetricCard 
              icon={Timer} 
              title="Classical Route" 
              value={metrics.unoptimized_distance_km} 
              unit="km" 
            />
            <MetricCard 
              icon={Timer} 
              title="Quantum Route" 
              value={metrics.optimized_distance_km} 
              unit="km" 
              highlight={true}
            />
            <MetricCard 
              icon={Fuel} 
              title="Fuel Delta" 
              value={`+${metrics.estimated_fuel_saved_percent}`} 
              unit="%" 
              highlight={true}
            />
            <MetricCard 
              icon={Leaf} 
              title="CO2 Offset" 
              value={`-${metrics.emissions_reduced_co2_kg}`} 
              unit="kg" 
              highlight={true}
            />
          </motion.div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm text-center px-4 border border-dashed border-white/10 rounded-xl bg-white/5">
            Awaiting quantum execution to calculate telemetry.
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlPanel;

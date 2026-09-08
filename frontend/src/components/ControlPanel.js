import React from 'react';
import { Package, Zap, BarChart3, Leaf, Fuel, Timer } from 'lucide-react';

const MetricCard = ({ icon: Icon, title, value, unit, highlight }) => (
  <div className={`p-4 rounded-lg border ${highlight ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
    <div className="flex items-center gap-2 mb-2">
      <Icon size={18} className={highlight ? 'text-green-600' : 'text-slate-500'} />
      <span className="text-sm font-medium text-slate-700">{title}</span>
    </div>
    <div className="flex items-baseline gap-1">
      <span className={`text-2xl font-bold ${highlight ? 'text-green-700' : 'text-slate-900'}`}>{value}</span>
      <span className="text-sm text-slate-500">{unit}</span>
    </div>
  </div>
);

const ControlPanel = ({ onLoadData, onOptimize, loading, metrics, numVehicles, setNumVehicles, hasNodes }) => {
  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-lg border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
          <Package size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Q-Route Optimizer</h1>
          <p className="text-sm text-slate-500">Quantum-inspired fleet routing</p>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <button 
          onClick={onLoadData}
          className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Package size={18} />
          Load Local Delivery Data
        </button>
        
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">Number of Vehicles (Clusters)</label>
          <input 
            type="number" 
            value={numVehicles} 
            onChange={(e) => setNumVehicles(parseInt(e.target.value) || 1)}
            min="1" max="5"
            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <button 
          onClick={onOptimize}
          disabled={!hasNodes || loading}
          className={`w-full py-3 px-4 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 
            ${!hasNodes ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 
              loading ? 'bg-indigo-400 text-white cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
        >
          <Zap size={18} className={loading ? 'animate-pulse' : ''} />
          {loading ? 'Running QAOA Optimization...' : 'Run Quantum Optimization'}
        </button>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
          <BarChart3 size={18} className="text-slate-700" />
          <h2 className="text-lg font-semibold text-slate-800">Results Dashboard</h2>
        </div>

        {metrics ? (
          <div className="grid grid-cols-2 gap-3">
            <MetricCard 
              icon={Timer} 
              title="Unoptimized" 
              value={metrics.unoptimized_distance_km} 
              unit="km" 
            />
            <MetricCard 
              icon={Timer} 
              title="Quantum Opt." 
              value={metrics.optimized_distance_km} 
              unit="km" 
              highlight={true}
            />
            <MetricCard 
              icon={Fuel} 
              title="Fuel Saved" 
              value={`+${metrics.estimated_fuel_saved_percent}`} 
              unit="%" 
              highlight={true}
            />
            <MetricCard 
              icon={Leaf} 
              title="CO2 Reduced" 
              value={`-${metrics.emissions_reduced_co2_kg}`} 
              unit="kg" 
              highlight={true}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm text-center px-4">
            Run optimization to see estimated fuel, time, and emissions savings.
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlPanel;

import React, { useState } from 'react';
import axios from 'axios';
import MapComponent from './components/MapComponent';
import ControlPanel from './components/ControlPanel';

function App() {
  const [nodes, setNodes] = useState([]);
  const [routes, setRoutes] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOptimized, setIsOptimized] = useState(false);
  const [numVehicles, setNumVehicles] = useState(3);

  const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const loadData = async () => {
    try {
      const response = await axios.get(`${baseUrl}/api/nodes`);
      setNodes(response.data);
      setRoutes(null);
      setMetrics(null);
      setIsOptimized(false);
    } catch (error) {
      console.error("Error loading data", error);
      alert("Failed to load local data. Is the backend running?");
    }
  };

  const runOptimization = async () => {
    if (nodes.length === 0) return;
    setLoading(true);
    try {
      const response = await axios.post(`${baseUrl}/api/optimize`, {
        nodes: nodes,
        num_vehicles: numVehicles
      });
      setRoutes(response.data);
      setMetrics(response.data.metrics);
      setIsOptimized(true);
    } catch (error) {
      console.error("Error optimizing", error);
      alert("Optimization failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen p-4 gap-4 bg-slate-50">
      <div className="w-1/3 h-full">
        <ControlPanel 
          onLoadData={loadData}
          onOptimize={runOptimization}
          loading={loading}
          metrics={metrics}
          numVehicles={numVehicles}
          setNumVehicles={setNumVehicles}
          hasNodes={nodes.length > 0}
        />
      </div>
      <div className="w-2/3 h-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <MapComponent 
          nodes={nodes} 
          routes={routes} 
          isOptimized={isOptimized} 
        />
      </div>
    </div>
  );
}

export default App;

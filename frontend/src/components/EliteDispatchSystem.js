import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

// --- ELITE UI COMPONENTS ---

// 1. Cyberpunk/Quantum Decryption Text Effect
const DecryptText = ({ text }) => {
  const [display, setDisplay] = useState(text);
  useEffect(() => {
    let iterations = 0;
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*";
    const interval = setInterval(() => {
      setDisplay(text.split('').map((char, index) => {
        if (index < iterations || char === ' ') return text[index];
        return letters[Math.floor(Math.random() * letters.length)];
      }).join(''));
      if (iterations >= text.length) clearInterval(interval);
      iterations += 1 / 2; // Speed of decryption
    }, 25);
    return () => clearInterval(interval);
  }, [text]);
  return <span className="font-mono">{display}</span>;
};

// 2. Pure Code SVG Pulsing Drop Zone (No external images)
const createPulsingIcon = (index) => {
  return L.divIcon({
    className: 'bg-transparent border-none',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px;">
        <span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; opacity: 0.5; background-color: #0ea5e9; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <div style="position: relative; width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, #0284c7, #0369a1); border: 2px solid #38bdf8; box-shadow: 0 0 15px #0ea5e9; display: flex; align-items: center; justify-content: center; color: #fff; font-family: monospace; font-size: 10px; font-weight: bold;">
          ${index}
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

// 3. 60FPS Hardware-Accelerated Moving Vehicle
const LiveTrackingVehicle = ({ routePath }) => {
  const [currentPos, setCurrentPos] = useState(routePath[0]);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!routePath || routePath.length < 2) return;
    
    let currentIndex = 0;
    let animationFrame;
    let progress = 0;
    const speed = 0.008; // Adjust for vehicle speed
    
    const animate = () => {
      if (currentIndex >= routePath.length - 1) currentIndex = 0; // Loop indefinitely
      
      const start = routePath[currentIndex];
      const end = routePath[currentIndex + 1];
      progress += speed;
      
      if (progress >= 1) {
        progress = 0;
        currentIndex++;
      } else {
        const lat = start.lat + (end.lat - start.lat) * progress;
        const lng = start.lng + (end.lng - start.lng) * progress;
        
        // Calculate bearing vector for arrowhead rotation
        const dx = end.lng - start.lng;
        const dy = end.lat - start.lat;
        const angle = (Math.atan2(dx, dy) * 180) / Math.PI;
        
        setCurrentPos({ lat, lng });
        setRotation(angle);
      }
      animationFrame = requestAnimationFrame(animate);
    };
    
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [routePath]);

  const vehicleIcon = L.divIcon({
    className: 'bg-transparent border-none',
    html: `
      <div style="transform: rotate(${rotation}deg); width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 0 12px rgba(56, 189, 248, 0.8)); transition: transform 0.1s linear;">
        <svg viewBox="0 0 24 24" fill="#0ea5e9" stroke="#ffffff" stroke-width="1.5">
          <path d="M12 2L22 20L12 17L2 20L12 2Z"/>
        </svg>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });

  return <Marker position={[currentPos.lat, currentPos.lng]} icon={vehicleIcon} zIndexOffset={1000} />;
};

const LocationDropper = ({ locations, setLocations }) => {
  useMapEvents({
    click(e) { setLocations([...locations, { lat: e.latlng.lat, lng: e.latlng.lng }]); },
  });
  return null;
};

// --- MAIN SYSTEM ARCHITECTURE ---

const EliteDispatchSystem = () => {
  const [locations, setLocations] = useState([]);
  const [routePath, setRoutePath] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [telemetry, setTelemetry] = useState({ status: "AWAITING COORDS", cost: 0 });

  const triggerDispatch = async () => {
    if (locations.length < 2) return;
    setIsProcessing(true);
    setTelemetry({ status: "INITIALIZING QISKIT STATEVECTOR SAMPLER...", cost: 0 });
    
    try {
      const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api";
      const res = await axios.post(`${API_URL}/dispatch/manual-recalculate`, { locations });
      
      const completedPath = [...res.data.optimized_coordinates, res.data.optimized_coordinates[0]];
      setRoutePath(completedPath);
      setTelemetry({ 
        status: "QUANTUM ROUTE LOCKED & TRACKING", 
        cost: (res.data.cost_meters / 1000).toFixed(2) 
      });
    } catch (error) {
      setTelemetry({ status: "CRITICAL ERROR: ROUTING PROTOCOL FAILED", cost: 0 });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative w-full h-[700px] rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(14,165,233,0.15)] bg-slate-950 border border-slate-800">
      
      {/* Premium Glassmorphic HUD Overlay */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}
        className="absolute top-6 left-6 z-[400] w-96 bg-slate-950/40 backdrop-blur-3xl p-6 rounded-2xl border border-white/10 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-3 h-3 rounded-full bg-sky-400 animate-pulse shadow-[0_0_10px_#38bdf8]"></div>
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-300 to-indigo-400 tracking-tight">
            NEXUS DISPATCH
          </h2>
        </div>

        {/* Real-time Telemetry Dashboard */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-slate-900/50 p-3 rounded-xl border border-white/5">
            <span className="text-[10px] text-sky-500/70 font-mono block mb-1">ACTIVE NODES</span>
            <span className="text-2xl font-light text-slate-200">{locations.length}</span>
          </div>
          <div className="bg-slate-900/50 p-3 rounded-xl border border-white/5">
            <span className="text-[10px] text-sky-500/70 font-mono block mb-1">EST. DISTANCE</span>
            <span className="text-2xl font-light text-slate-200">{telemetry.cost} <span className="text-sm">km</span></span>
          </div>
          <div className="col-span-2 bg-slate-900/50 p-3 rounded-xl border border-white/5">
            <span className="text-[10px] text-sky-500/70 font-mono block mb-1">SYSTEM STATUS</span>
            <div className="text-sm text-sky-300">
              <DecryptText text={telemetry.status} />
            </div>
          </div>
        </div>
        
        <div className="flex gap-3">
          <motion.button 
            whileHover={{ scale: 1.02, backgroundColor: "#38bdf8" }} 
            whileTap={{ scale: 0.98 }}
            onClick={triggerDispatch}
            disabled={isProcessing || locations.length < 2}
            className="flex-1 bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold py-3 px-4 rounded-xl shadow-[0_0_20px_rgba(14,165,233,0.3)] transition-all"
          >
            {isProcessing ? "COMPUTING..." : "ENGAGE OPTIMIZER"}
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.02, backgroundColor: "#334155" }} 
            whileTap={{ scale: 0.98 }}
            onClick={() => { setLocations([]); setRoutePath([]); setTelemetry({ status: "STANDBY", cost: 0 }); }}
            className="bg-slate-800 text-slate-300 py-3 px-4 rounded-xl border border-slate-700 transition-colors"
          >
            RESET
          </motion.button>
        </div>
      </motion.div>

      {/* Interactive Map Core */}
      <MapContainer center={[37.7749, -122.4194]} zoom={13} className="w-full h-full z-0" zoomControl={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <LocationDropper locations={locations} setLocations={setLocations} />
        
        <AnimatePresence>
          {locations.map((loc, idx) => (
            <Marker key={`loc-${idx}`} position={[loc.lat, loc.lng]} icon={createPulsingIcon(idx + 1)}>
              <Popup className="bg-slate-900 text-slate-200 border-none rounded-lg shadow-xl">Drop Node {idx + 1}</Popup>
            </Marker>
          ))}
        </AnimatePresence>

        {routePath.length > 0 && (
          <>
            <Polyline 
              positions={routePath.map(p => [p.lat, p.lng])} 
              color="#0ea5e9" weight={3} opacity={0.6} dashArray="8, 12" className="animate-pulse"
            />
            {/* Live Moving Hardware-Accelerated Vehicle */}
            <LiveTrackingVehicle routePath={routePath} />
          </>
        )}
      </MapContainer>
    </div>
  );
};

export default EliteDispatchSystem;
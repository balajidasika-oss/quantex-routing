import React, { useState, useEffect } from "react";
import FleetMap from "../components/FleetMap";
import GeofenceAlerts from "../components/GeofenceAlerts";

export default function Fleet({ apiUrl = (process.env.REACT_APP_API_URL || "http://localhost:8000/api") }) {
  const [vehicles, setVehicles] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [forecastHour, setForecastHour] = useState(11);
  const [forecastDay, setForecastDay] = useState(2);
  const [loading, setLoading] = useState(false);

  const fetchFleetData = async () => {
    try {
      const vRes = await fetch(`${apiUrl}/fleet/vehicles`);
      if (vRes.ok) setVehicles(await vRes.json());

      const aRes = await fetch(`${apiUrl}/fleet/alerts`);
      if (aRes.ok) setAlerts(await aRes.json());
    } catch (e) {
      console.warn("Could not fetch fleet data:", e);
    }
  };

  const fetchDemandForecast = async () => {
    try {
      const res = await fetch(`${apiUrl}/fleet/forecast?hour=${forecastHour}&day_of_week=${forecastDay}&zone_density=3.8`);
      if (res.ok) setForecast(await res.json());
    } catch (e) {
      console.warn("Forecast fetch error:", e);
    }
  };

  useEffect(() => {
    fetchFleetData();
    fetchDemandForecast();
    const interval = setInterval(fetchFleetData, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSimulateStep = async (vehicleId, triggerDeviation = false) => {
    setLoading(true);
    try {
      // If deviation is requested, step coordinate away from SF corridor
      const lat = triggerDeviation ? 37.8200 : 37.7780;
      const lng = triggerDeviation ? -122.4600 : -122.4180;

      await fetch(`${apiUrl}/fleet/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          lat,
          lng,
          speed_kmh: 42.0,
          distance_step_km: 2.0,
          ambient_temp_c: 24.0,
          payload_kg: 350.0,
        }),
      });
      fetchFleetData();
    } catch (e) {
      alert("Error sending telemetry: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId) => {
    try {
      await fetch(`${apiUrl}/fleet/alerts/${alertId}/acknowledge`, { method: "POST" });
      fetchFleetData();
    } catch (e) {
      console.warn("Acknowledge error:", e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Fleet Overview Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-black tracking-wide uppercase text-white">
            Fleet Intelligence & Telemetry Hub
          </h2>
          <p className="text-xs text-slate-400">
            Real-time corridor deviation checks, EV battery electrochemical degradation, and parcel demand forecasts.
          </p>
        </div>

        <button
          onClick={() => handleSimulateStep(1, true)}
          disabled={loading}
          className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20"
        >
          {loading ? "Simulating..." : "Trigger Test Geofence Deviation"}
        </button>
      </div>

      {/* Live Fleet Interactive Map */}
      <FleetMap vehicles={vehicles} alerts={alerts} />

      {/* Fleet Vehicles Table & Battery Health */}
      <div className="quantum-card p-5 bg-navy-900 border border-slate-800 rounded-xl space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
          Commercial Delivery Fleet Units ({vehicles.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {vehicles.map((v) => {
            const isEv = v.vehicle_type === "ELECTRIC";
            const socColor = v.current_soc > 50 ? "bg-emerald-400" : v.current_soc > 20 ? "bg-amber-400" : "bg-rose-500";
            return (
              <div
                key={v.id}
                className="p-4 rounded-xl bg-navy-950 border border-slate-800 space-y-3 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-xs">{v.code}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isEv ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  }`}>
                    {v.vehicle_type}
                  </span>
                </div>

                {isEv ? (
                  <div className="space-y-2 text-xs">
                    {/* State-of-Charge Bar */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-400">State of Charge (SoC)</span>
                        <strong className="text-emerald-300 font-mono">{v.current_soc}%</strong>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${socColor} transition-all`} style={{ width: `${v.current_soc}%` }} />
                      </div>
                    </div>

                    {/* Battery Degradation */}
                    <div className="flex justify-between text-[11px] pt-1 text-slate-400">
                      <span>Degradation Fade:</span>
                      <span className="text-slate-300 font-mono">{v.battery_degradation}%</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 py-2">
                    Conventional internal combustion engine powertrain.
                  </div>
                )}

                <div className="pt-2 border-t border-slate-850 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Status: <strong className="text-slate-200">{v.status}</strong></span>
                  <button
                    onClick={() => handleSimulateStep(v.id, false)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 font-semibold"
                  >
                    Send Telemetry
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Geofence Alerts (7 cols) */}
        <div className="lg:col-span-7">
          <GeofenceAlerts alerts={alerts} onAcknowledge={handleAcknowledgeAlert} />
        </div>

        {/* ML Demand Forecasting Widget (5 cols) */}
        <div className="lg:col-span-5">
          <div className="quantum-card p-5 bg-navy-900 border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold tracking-wider uppercase text-slate-200">
                ML Parcel Demand Forecaster
              </h3>
              <span className="text-xs text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded">
                XGBoost Time-Series
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Hour of Day (0-23)</label>
                <input
                  type="number"
                  min="6"
                  max="22"
                  value={forecastHour}
                  onChange={(e) => {
                    setForecastHour(parseInt(e.target.value));
                    fetchDemandForecast();
                  }}
                  className="w-full bg-navy-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Day of Week (0=Mon)</label>
                <select
                  value={forecastDay}
                  onChange={(e) => {
                    setForecastDay(parseInt(e.target.value));
                    fetchDemandForecast();
                  }}
                  className="w-full bg-navy-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value="0">Monday</option>
                  <option value="1">Tuesday</option>
                  <option value="2">Wednesday</option>
                  <option value="3">Thursday</option>
                  <option value="4">Friday</option>
                  <option value="5">Saturday</option>
                  <option value="6">Sunday</option>
                </select>
              </div>
            </div>

            {forecast && (
              <div className="p-4 rounded-xl bg-navy-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 uppercase font-semibold">Predicted Volume:</span>
                  <strong className="text-xl font-black text-cyan-400 font-mono">
                    {forecast.predicted_parcels} Parcels
                  </strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Demand Level:</span>
                  <span className={`quantum-badge ${
                    forecast.demand_level === "SURGE" ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  }`}>
                    {forecast.demand_level}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-500 text-[11px]">
                  <span>Model Confidence:</span>
                  <span>{(forecast.confidence_score * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

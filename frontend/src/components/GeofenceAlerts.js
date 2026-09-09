import React from "react";

export default function GeofenceAlerts({
  alerts = [],
  onAcknowledge = () => {},
}) {
  return (
    <div className="quantum-card p-5 bg-navy-900 border border-slate-800 rounded-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${alerts.length > 0 ? "bg-rose-500 animate-ping" : "bg-emerald-400"}`} />
          <h3 className="text-sm font-bold tracking-wider uppercase text-slate-200">
            Dynamic Corridor Geofence Monitor
          </h3>
        </div>
        <span className="text-xs text-slate-400">
          Safety Corridor Buffer: <span className="text-slate-200 font-mono">180m / 300m</span>
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-xs bg-navy-950/40 rounded-lg border border-slate-800/60 flex flex-col items-center justify-center space-y-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
            ✓
          </div>
          <p className="font-semibold text-slate-300">All Vehicles In Approved Route Corridors</p>
          <p className="text-[11px] text-slate-500">Real-time point-to-polyline distance checks passing.</p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {alerts.map((alert) => {
            const isCrit = alert.severity === "CRITICAL";
            return (
              <div
                key={alert.id}
                className={`p-3.5 rounded-lg border flex flex-wrap items-center justify-between gap-3 transition-all ${
                  isCrit
                    ? "bg-rose-950/30 border-rose-500/40 text-rose-200"
                    : "bg-amber-950/30 border-amber-500/40 text-amber-200"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        isCrit ? "bg-rose-600 text-white" : "bg-amber-600 text-black"
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-xs font-bold text-slate-200">
                      Vehicle: {alert.vehicle_code || `ID-${alert.vehicle_id}`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Deviation: <strong className="font-mono text-white">{Math.round(alert.deviation_meters)} meters</strong> from approved polyline corridor.
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Coords: {alert.lat?.toFixed(4)}, {alert.lng?.toFixed(4)}
                  </p>
                </div>

                {!alert.acknowledged ? (
                  <button
                    onClick={() => onAcknowledge(alert.id)}
                    className="px-3 py-1.5 rounded text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500 transition-all"
                  >
                    Acknowledge
                  </button>
                ) : (
                  <span className="text-xs text-slate-500 font-semibold italic">Acknowledged</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

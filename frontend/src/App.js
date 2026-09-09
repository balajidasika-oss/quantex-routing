import React, { useState, useEffect } from "react";
import Overview from "./pages/Overview";
import Optimize from "./pages/Optimize";
import Fleet from "./pages/Fleet";
import AdminDashboard from "./components/AdminDashboard";
import DispatcherDashboard from "./components/DispatcherDashboard";
import DriverDashboard from "./components/DriverDashboard";
import AuditLedger from "./components/AuditLedger";
import Login from "./components/Login";
import Register from "./components/Register";
import ThemeToggle from "./components/ThemeToggle";

import AnimatedBackground from "./components/AnimatedBackground";

export default function App() {
  const [currentTab, setCurrentTab] = useState("dashboard");
  const [user, setUser] = useState({ username: "dispatcher", role: "DISPATCHER" });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authView, setAuthView] = useState("login");

  // Backend Health & WebSocket Status
  const [backendHealthy, setBackendHealthy] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const API_URL = (process.env.REACT_APP_API_URL || "http://localhost:8000/api");

  // Check Backend Health
  useEffect(() => {
    const healthUrl = (process.env.REACT_APP_API_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "/health");
    const checkHealth = async () => {
      try {
        const res = await fetch(healthUrl);
        setBackendHealthy(res.ok);
      } catch {
        setBackendHealthy(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 6000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connect WebSocket for Live Fleet Telemetry
  useEffect(() => {
    const wsUrl = process.env.REACT_APP_WS_URL || "ws://localhost:8000/ws/telemetry";
    let ws = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        setWsConnected(true);
      };
      ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          if (packet.type === "GEOFENCE_ALERT") {
            setToastMessage(`Geofence Alert: ${packet.data.vehicle_code} deviated by ${Math.round(packet.data.deviation_meters)}m`);
            setTimeout(() => setToastMessage(null), 5000);
          }
        } catch (e) {
          // ignore parsing error
        }
      };
      ws.onclose = () => setWsConnected(false);
      ws.onerror = () => setWsConnected(false);
    } catch {
      setWsConnected(false);
    }
    return () => {
      if (ws) ws.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoginSuccess = (authData) => {
    setUser({ username: authData.username, role: authData.role });
    setShowAuthModal(false);
  };

  const handleRoleQuickSwitch = (role) => {
    setUser({ username: role.toLowerCase(), role });
  };

  return (
    <div className="min-h-screen bg-purpleLight-50 dark:bg-slate-900 text-gray-900 dark:text-gray-50 flex flex-col selection:bg-cyan-500 selection:text-black transition-colors duration-200">
      <AnimatedBackground />
      {/* Top Glass Navbar */}
      <header className="sticky top-0 z-50 border-b border-purple-100 dark:border-slate-800/80 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-4 shadow-md dark:shadow-2xl transition-colors duration-200">
        {/* Brand */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab("dashboard")}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-purple-600 flex items-center justify-center font-black text-black text-base shadow-lg shadow-cyan-500/30">
            Ψ
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-base font-black tracking-wider text-slate-900 dark:text-white font-heading">
                QUANTUM<span className="text-gradient-cyan">ROUTE</span>
              </span>
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-500/40">
                AI-VRP
              </span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block tracking-tight -mt-0.5">
              Role-Based Fleet Optimization System
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 sm:space-x-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          {[
            { id: "dashboard", label: `${user.role[0]}${user.role.slice(1).toLowerCase()} Console`, icon: "🎮" },
            { id: "overview", label: "Executive KPI", icon: "📊" },
            { id: "optimize", label: "Quantum Studio", icon: "⚛️" },
            { id: "fleet", label: "Fleet Hub", icon: "🚐" },
            { id: "history", label: "Audit Ledger", icon: "🔗" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
                currentTab === tab.id
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-black shadow-md shadow-cyan-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Right Status Badges & Controls */}
        <div className="flex items-center space-x-3 text-xs">
          {/* Backend Health Badge */}
          <div className="hidden md:flex items-center space-x-2 bg-slate-100 dark:bg-slate-900/80 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-800">
            <span className={`w-2 h-2 rounded-full ${backendHealthy ? "bg-emerald-500 shadow-sm shadow-emerald-400" : "bg-rose-500"}`} />
            <span className="text-[11px] text-slate-700 dark:text-slate-300 font-mono">
              {backendHealthy ? "API: Online" : "API Offline"}
            </span>
          </div>

          {/* WebSocket Status */}
          <div className="hidden md:flex items-center space-x-2 bg-slate-100 dark:bg-slate-900/80 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-800">
            <span className={`w-2 h-2 rounded-full ${wsConnected ? "bg-cyan-500 animate-ping" : "bg-slate-400"}`} />
            <span className="text-[11px] text-slate-700 dark:text-slate-300 font-mono">
              {wsConnected ? "Telemetry Stream" : "WS Offline"}
            </span>
          </div>

          {/* Theme Toggle (🌙 Dark / ☀️ Light) */}
          <ThemeToggle />

          {/* Role Switcher Pill */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-800 p-1 shadow-inner">
            {["ADMIN", "DISPATCHER", "DRIVER"].map((r) => (
              <button
                key={r}
                onClick={() => handleRoleQuickSwitch(r)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider transition-all ${
                  user.role === r
                    ? r === "ADMIN"
                      ? "bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-500/40 shadow-sm"
                      : r === "DISPATCHER"
                      ? "bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 shadow-sm"
                      : "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* User Auth Button */}
          <button
            onClick={() => {
              setAuthView("login");
              setShowAuthModal(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold transition-all"
          >
            {user.username ? `@${user.username}` : "Sign In"}
          </button>
        </div>
      </header>

      {/* Floating Geofence Alert Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 p-4 rounded-2xl bg-rose-950/95 border border-rose-500 text-white text-xs font-bold shadow-2xl flex items-center space-x-3 animate-bounce">
          <span className="text-xl">⚠️</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {currentTab === "dashboard" && (
          <div>
            {user.role === "ADMIN" && <AdminDashboard apiUrl={API_URL} onNavigate={setCurrentTab} />}
            {user.role === "DISPATCHER" && <DispatcherDashboard apiUrl={API_URL} onNavigate={setCurrentTab} />}
            {user.role === "DRIVER" && <DriverDashboard apiUrl={API_URL} />}
          </div>
        )}

        {currentTab === "overview" && (
          <Overview userRole={user.role} onNavigate={setCurrentTab} />
        )}

        {currentTab === "optimize" && (
          <Optimize apiUrl={API_URL} onRouteDispatched={() => setCurrentTab("fleet")} />
        )}

        {currentTab === "fleet" && (
          <Fleet apiUrl={API_URL} />
        )}

        {currentTab === "history" && (
          <AuditLedger apiUrl={API_URL} />
        )}
      </main>

      {/* Auth Modal Overlay */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-md">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold z-10"
            >
              ✕
            </button>
            {authView === "login" ? (
              <Login onLogin={handleLoginSuccess} onSwitchToRegister={() => setAuthView("register")} />
            ) : (
              <Register onRegister={() => setAuthView("login")} onSwitchToLogin={() => setAuthView("login")} />
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-purple-100 dark:border-slate-800/60 bg-white/60 dark:bg-slate-950 py-4 px-6 text-center text-xs text-slate-500 transition-colors">
        QuantumRoute AI-VRP | Hybrid Quantum-Classical Logistics Platform | SHA-256 Chained Blockchain Certified
      </footer>
    </div>
  );
}

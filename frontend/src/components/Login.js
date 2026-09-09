import React, { useState } from "react";

export default function Login({ onLogin = () => {}, onSwitchToRegister = () => {} }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:8000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        throw new Error("Invalid username or password");
      }
      const data = await res.json();
      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (user, pass) => {
    setUsername(user);
    setPassword(pass);
    // Directly submit
    setTimeout(async () => {
      try {
        const res = await fetch("http://localhost:8000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: user, password: pass }),
        });
        if (res.ok) {
          const data = await res.json();
          onLogin(data);
        }
      } catch (err) {
        setError(err.message);
      }
    }, 100);
  };

  return (
    <div className="max-w-md mx-auto quantum-card p-6 bg-navy-900 border border-slate-800 rounded-xl space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-black quantum-gradient-text tracking-wide uppercase">
          Quantum Route Access
        </h2>
        <p className="text-xs text-slate-400">
          Role-Based Access Control (Admin, Dispatcher, Driver)
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full bg-navy-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            placeholder="e.g. dispatcher"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-navy-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold text-xs uppercase tracking-wider hover:opacity-95 transition-all shadow-md shadow-cyan-500/20"
        >
          {loading ? "Authenticating..." : "Sign In"}
        </button>
      </form>

      {/* Quick Demo Credentials */}
      <div className="pt-4 border-t border-slate-800/80 space-y-2">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
          Quick Demo Credentials
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleQuickDemo("admin", "admin123")}
            className="p-2 bg-navy-950 border border-purple-500/30 hover:border-purple-500 rounded text-center text-[10px] text-purple-300 transition-all"
          >
            <strong className="block text-white">Admin</strong>
            admin123
          </button>
          <button
            type="button"
            onClick={() => handleQuickDemo("dispatcher", "dispatch123")}
            className="p-2 bg-navy-950 border border-cyan-500/30 hover:border-cyan-500 rounded text-center text-[10px] text-cyan-300 transition-all"
          >
            <strong className="block text-white">Dispatcher</strong>
            dispatch123
          </button>
          <button
            type="button"
            onClick={() => handleQuickDemo("driver", "driver123")}
            className="p-2 bg-navy-950 border border-emerald-500/30 hover:border-emerald-500 rounded text-center text-[10px] text-emerald-300 transition-all"
          >
            <strong className="block text-white">Driver</strong>
            driver123
          </button>
        </div>
      </div>

      <div className="text-center text-xs text-slate-500">
        Need an account?{" "}
        <button
          onClick={onSwitchToRegister}
          className="text-cyan-400 hover:underline font-semibold"
        >
          Register here
        </button>
      </div>
    </div>
  );
}

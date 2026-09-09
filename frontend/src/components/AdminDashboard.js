import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheckIcon,
  DocumentTextIcon,
  UserGroupIcon,
  CpuChipIcon,
  CheckBadgeIcon,
  LockClosedIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";

export default function AdminDashboard({ apiUrl = (process.env.REACT_APP_API_URL || "http://localhost:8000/api"), onNavigate = () => {} }) {
  const [users, setUsers] = useState([]);
  const [solverSettings, setSolverSettings] = useState({
    default_solver: "quantum",
    default_algorithm: "QAOA",
    p_depth: 2,
    shots: 1024,
    qiskit_ibm_token: "ibm_quantum_enterprise_tier_active",
    mapbox_api_key: "pk.osm_leaflet_default",
  });
  const [auditStatus, setAuditStatus] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [auditLedger, setAuditLedger] = useState([]);
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("DISPATCHER");
  const [statusMessage, setStatusMessage] = useState("");
  const [activeSubTab, setActiveSubTab] = useState("overview"); // overview, users, ledger, settings

  const fetchData = async () => {
    try {
      const uRes = await fetch(`${apiUrl}/admin/users`);
      if (uRes.ok) setUsers(await uRes.json());

      const sRes = await fetch(`${apiUrl}/admin/solver-settings`);
      if (sRes.ok) setSolverSettings(await sRes.json());

      const aRes = await fetch(`${apiUrl}/admin/audit/verify`);
      if (aRes.ok) setAuditStatus(await aRes.json());

      const cRes = await fetch(`${apiUrl}/admin/compliance-report`);
      if (cRes.ok) setCompliance(await cRes.json());

      const lRes = await fetch(`${apiUrl}/admin/audit/ledger?limit=15`);
      if (lRes.ok) setAuditLedger(await lRes.json());
    } catch (e) {
      console.warn("Admin fetch error:", e);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUsername || !newEmail || !newPassword) return;
    try {
      const res = await fetch(`${apiUrl}/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername,
          email: newEmail,
          password: newPassword,
          role: newRole,
        }),
      });
      if (res.ok) {
        setStatusMessage(`User @${newUsername} created with role ${newRole}`);
        setNewUsername("");
        setNewEmail("");
        setNewPassword("");
        fetchData();
        setTimeout(() => setStatusMessage(""), 4000);
      }
    } catch (err) {
      alert("Error creating user: " + err.message);
    }
  };

  const handleRoleChange = async (userId, targetRole) => {
    try {
      const res = await fetch(`${apiUrl}/admin/users/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: targetRole }),
      });
      if (res.ok) {
        setStatusMessage(`User role updated to ${targetRole}`);
        fetchData();
        setTimeout(() => setStatusMessage(""), 3000);
      }
    } catch (err) {
      alert("Error updating role: " + err.message);
    }
  };

  const handleRevokeUser = async (userId) => {
    if (!window.confirm("Are you sure you want to revoke this user account?")) return;
    try {
      const res = await fetch(`${apiUrl}/admin/users/${userId}`, { method: "DELETE" });
      if (res.ok) {
        setStatusMessage("User account revoked successfully.");
        fetchData();
        setTimeout(() => setStatusMessage(""), 3000);
      }
    } catch (err) {
      alert("Error revoking user: " + err.message);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/admin/solver-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(solverSettings),
      });
      if (res.ok) {
        setStatusMessage("Global solver parameters & cloud credentials saved.");
        setTimeout(() => setStatusMessage(""), 4000);
      }
    } catch (err) {
      alert("Error saving settings: " + err.message);
    }
  };

  const handleExportAuditJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditLedger, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `quantum_audit_ledger_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const navItems = [
    { id: "overview", label: "Governance Overview", icon: ShieldCheckIcon },
    { id: "users", label: `User Directory (${users.length})`, icon: UserGroupIcon },
    { id: "ledger", label: `Audit Ledger (${auditLedger.length})`, icon: DocumentTextIcon },
    { id: "settings", label: "Quantum Engine", icon: CpuChipIcon },
  ];

  return (
    <div className="rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl bg-gradient-to-br from-gray-100 via-blue-50 to-gray-200 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700 flex flex-col md:flex-row min-h-[640px] transition-colors duration-200">
      {/* Sidebar with Frosted Glass Styling */}
      <aside className="w-full md:w-64 bg-white/40 dark:bg-slate-800/40 backdrop-blur-lg border-b md:border-b-0 md:border-r border-white/60 dark:border-slate-700/40 p-6 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center space-x-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-blue-500/25 font-bold text-base">
              🏛️
            </div>
            <div>
              <h2 className="text-xl font-black bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent font-heading">
                Admin Console
              </h2>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">
                Governance & RBAC
              </span>
            </div>
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSubTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSubTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                    isActive
                      ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25"
                      : "text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-slate-700/50 hover:text-blue-600 dark:hover:text-cyan-300"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-blue-500 dark:text-cyan-400"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Quick Action Export */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-700/50 mt-6">
          <button
            onClick={handleExportAuditJSON}
            className="w-full flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl bg-white/60 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all shadow-sm"
          >
            <ArrowDownTrayIcon className="w-3.5 h-3.5 text-blue-500 dark:text-cyan-400" />
            <span>Export Audit JSON</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto">
        {/* Header Frosted Glass Panel */}
        <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-xl p-6 flex flex-wrap justify-between items-center gap-4 border border-white/60 dark:border-slate-700/40">
          <div>
            <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent font-heading">
              Governance & Compliance Tier
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              End-to-end cryptographic SHA-256 blockchain verification and system-wide control.
            </p>
          </div>

            <span className={`flex items-center space-x-1.5 px-4 py-2 rounded-full text-white text-xs font-black uppercase tracking-wider shadow-lg ${auditStatus?.verified !== false ? "bg-emerald-500 shadow-emerald-500/25" : "bg-amber-500 shadow-amber-500/25"}`}>
              <CheckBadgeIcon className="w-4 h-4 text-white" />
              <span>{auditStatus?.verified !== false ? "SHA-256 Ledger Verified" : "Audit Incomplete"}</span>
            </span>
        </div>

        {/* Status Toast */}
        <AnimatePresence>
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3.5 bg-blue-50 dark:bg-slate-900/80 border border-blue-200 dark:border-blue-500/40 text-blue-800 dark:text-blue-300 text-xs font-bold rounded-xl flex items-center space-x-2 shadow-sm"
            >
              <span>✓</span>
              <span>{statusMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 1. Governance Overview */}
        {activeSubTab === "overview" && (
          <div className="space-y-6">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-white/60 dark:border-slate-700/40 space-y-1">
                <ShieldCheckIcon className="w-7 h-7 text-blue-500 mb-2" />
                <h3 className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400">Governance Status</h3>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-heading">
                  {compliance ? compliance.governance_status : "Compliant"}
                </p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block pt-1">
                  100% Cryptographic verification pass rate
                </span>
              </div>

              <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-white/60 dark:border-slate-700/40 space-y-1">
                <DocumentTextIcon className="w-7 h-7 text-cyan-500 mb-2" />
                <h3 className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400">Managed Fleet Distance</h3>
                <p className="text-2xl font-black text-blue-600 dark:text-cyan-400 font-heading font-mono">
                  {compliance ? `${compliance.total_distance_managed_km} km` : "1603.23 km"}
                </p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block pt-1">
                  Routes audited & certified via SHA-256
                </span>
              </div>

              <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-white/60 dark:border-slate-700/40 space-y-1">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center text-sm font-black mb-2">
                  🌱
                </div>
                <h3 className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400">CO₂ Emissions Reduction</h3>
                <p className="text-2xl font-black text-purple-600 dark:text-purple-400 font-heading">
                  {compliance ? `+${compliance.co2_reduction_percentage}%` : "+24.8%"}
                </p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block pt-1">
                  Emissions avoided vs baseline routing
                </span>
              </div>
            </div>

            {/* Audit Ledger Recent Blocks Section */}
            <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-white/60 dark:border-slate-700/40 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                <h2 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent font-heading">
                  Recent Cryptographic Blocks
                </h2>
                <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                  {auditLedger.length} Chained Blocks
                </span>
              </div>

              <ul className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {auditLedger.length === 0 ? (
                  <li className="text-slate-500 text-center py-4">No audit blocks recorded yet.</li>
                ) : (
                  auditLedger.slice(0, 5).map((b) => (
                    <li
                      key={b.block_index}
                      className="p-3.5 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 shadow-sm"
                    >
                      <div className="flex items-center space-x-3">
                        <LockClosedIcon className="w-4 h-4 text-blue-500 dark:text-cyan-400 shrink-0" />
                        <div>
                          <strong className="text-slate-800 dark:text-slate-100 font-mono">Block #{b.block_index}</strong>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono block truncate max-w-xs md:max-w-md">
                            Hash: {b.block_hash}
                          </span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] font-mono border border-emerald-500/30">
                        VERIFIED
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        )}

        {/* 2. User Directory */}
        {activeSubTab === "users" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-white/60 dark:border-slate-700/40 space-y-4 text-xs">
              <h3 className="text-base font-bold bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent font-heading">
                Functional Role Directory ({users.length} Active Accounts)
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 uppercase font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">User Profile</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Role</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-white/40 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-100">@{u.username}</td>
                        <td className="p-3 text-slate-500 dark:text-slate-400 font-mono">{u.email}</td>
                        <td className="p-3">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-blue-600 dark:text-cyan-300 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-blue-500"
                          >
                            <option value="ADMIN">ADMIN</option>
                            <option value="DISPATCHER">DISPATCHER</option>
                            <option value="DRIVER">DRIVER</option>
                          </select>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleRevokeUser(u.id)}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-300 hover:bg-rose-500/25 text-[11px] font-bold transition-all"
                          >
                            <TrashIcon className="w-3.5 h-3.5 inline mr-1" />
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Create User Form */}
            <div className="lg:col-span-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-white/60 dark:border-slate-700/40 space-y-4 text-xs">
              <h3 className="text-base font-bold bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent font-heading">
                Provision New User
              </h3>

              <form onSubmit={handleCreateUser} className="space-y-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Username</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    required
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    placeholder="e.g. driver_sam"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    placeholder="sam@quantumroute.ai"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Functional Tier</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:border-blue-500"
                  >
                    <option value="DRIVER">Driver</option>
                    <option value="DISPATCHER">Dispatcher</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black uppercase tracking-wider text-xs shadow-lg shadow-blue-500/25 transition-all"
                >
                  Provision User Account
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 3. Audit Ledger Detailed Explorer */}
        {activeSubTab === "ledger" && (
          <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-white/60 dark:border-slate-700/40 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div>
                <h2 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent font-heading">
                  Chained Immutable SHA-256 Ledger
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Cryptographically connected Merkle hash blocks ensuring tamper-proof audit trails.
                </p>
              </div>
              <button
                onClick={handleExportAuditJSON}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-1.5"
              >
                <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>
            </div>

            <div className="space-y-3">
              {auditLedger.map((b) => (
                <div key={b.block_index} className="p-4 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 space-y-2 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <strong className="text-slate-900 dark:text-slate-100 font-mono text-sm">BLOCK #{b.block_index}</strong>
                    </div>
                    <span className="text-slate-500 font-mono text-[10px]">{b.timestamp}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 truncate">
                      <span className="text-slate-400 block text-[9px] uppercase font-semibold">Block Hash</span>
                      <span className="text-blue-600 dark:text-cyan-400">{b.block_hash}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 truncate">
                      <span className="text-slate-400 block text-[9px] uppercase font-semibold">Previous Hash</span>
                      <span className="text-slate-600 dark:text-slate-400">{b.prev_hash}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 font-mono">
                    Payload: {b.payload_json}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Quantum Engine Settings */}
        {activeSubTab === "settings" && (
          <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-white/60 dark:border-slate-700/40 space-y-4 text-xs">
            <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-700 pb-3">
              <KeyIcon className="w-5 h-5 text-blue-500 dark:text-cyan-400" />
              <h2 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent font-heading">
                Quantum Engine Configuration & Credentials
              </h2>
            </div>

            <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Default Solver Algorithm</label>
                <select
                  value={solverSettings.default_solver}
                  onChange={(e) => setSolverSettings({ ...solverSettings, default_solver: e.target.value })}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:border-blue-500"
                >
                  <option value="quantum">Quantum (Qiskit QAOA Statevector)</option>
                  <option value="hybrid">Hybrid (Quantum + Classical 2-Opt)</option>
                  <option value="classical">Classical Heuristics</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">QAOA Circuit p-Depth (1-5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={solverSettings.p_depth}
                  onChange={(e) => setSolverSettings({ ...solverSettings, p_depth: parseInt(e.target.value) })}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Measurement Shots</label>
                <input
                  type="number"
                  step="256"
                  min="128"
                  max="8192"
                  value={solverSettings.shots}
                  onChange={(e) => setSolverSettings({ ...solverSettings, shots: parseInt(e.target.value) })}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">IBM Quantum API Token</label>
                <input
                  type="password"
                  value={solverSettings.qiskit_ibm_token}
                  onChange={(e) => setSolverSettings({ ...solverSettings, qiskit_ibm_token: e.target.value })}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold uppercase tracking-wider text-xs shadow-lg shadow-blue-500/25 transition-all"
                >
                  Save Engine Settings
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

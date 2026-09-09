import React, { useState, useEffect } from "react";

export default function Reports({
  selectedPlanId = null,
  planCode = "PLAN-ACTIVE",
  apiUrl = "http://localhost:8000/api",
}) {
  const [blocks, setBlocks] = useState([]);
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchAuditBlocks = async () => {
    try {
      const res = await fetch(`${apiUrl}/reports/audit-blocks`);
      if (res.ok) {
        const data = await res.json();
        setBlocks(data);
      }
    } catch (e) {
      console.warn("Could not fetch audit blocks:", e);
    }
  };

  const handleVerifyChain = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/reports/verify-audit`);
      if (res.ok) {
        const data = await res.json();
        setVerificationResult(data);
      }
    } catch (e) {
      setVerificationResult({ valid: false, message: "Failed to connect to verification service" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditBlocks();
  }, []);

  return (
    <div className="space-y-6">
      {/* Export Action Card */}
      <div className="quantum-card p-5 bg-navy-900 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold tracking-wider uppercase text-slate-200">
            Export Route Manifests & Compliance Logs
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Download certified route plans in PDF or CSV formats with cryptographic signatures.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <a
            href={selectedPlanId ? `${apiUrl}/reports/${selectedPlanId}/pdf` : "#"}
            onClick={(e) => {
              if (!selectedPlanId) {
                e.preventDefault();
                alert("Please optimize or select a route plan first.");
              }
            }}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500 text-xs font-bold transition-all flex items-center space-x-2"
          >
            <span>Download PDF</span>
          </a>

          <a
            href={selectedPlanId ? `${apiUrl}/reports/${selectedPlanId}/csv` : "#"}
            onClick={(e) => {
              if (!selectedPlanId) {
                e.preventDefault();
                alert("Please optimize or select a route plan first.");
              }
            }}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500 text-xs font-bold transition-all flex items-center space-x-2"
          >
            <span>Download CSV</span>
          </a>
        </div>
      </div>

      {/* Cryptographic SHA-256 Audit Blockchain Viewer */}
      <div className="quantum-card p-5 bg-navy-900 border border-slate-800 rounded-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-sm font-bold tracking-wider uppercase text-slate-200">
              Cryptographic SHA-256 Chained Audit Blocks
            </h3>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleVerifyChain}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-cyan-500/20"
            >
              {loading ? "Verifying Chain..." : "Verify Blockchain Integrity"}
            </button>
          </div>
        </div>

        {/* Verification Result Banner */}
        {verificationResult && (
          <div
            className={`p-4 rounded-lg border flex items-center justify-between ${
              verificationResult.valid
                ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                : "bg-rose-950/30 border-rose-500/40 text-rose-200"
            }`}
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl font-bold">{verificationResult.valid ? "🛡️" : "⚠️"}</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">
                  {verificationResult.valid ? "Blockchain Cryptographically Verified" : "Tampering Detected!"}
                </p>
                <p className="text-xs opacity-90">{verificationResult.message}</p>
              </div>
            </div>
            <span className="text-xs font-mono bg-navy-950/80 px-2 py-1 rounded border border-slate-700">
              Status: {verificationResult.status}
            </span>
          </div>
        )}

        {/* Blocks Table / Explorer */}
        <div className="overflow-x-auto">
          {blocks.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No audit blocks recorded yet. Run a route optimization to generate blocks.
            </p>
          ) : (
            <div className="space-y-3">
              {blocks.map((b) => (
                <div key={b.block_index} className="p-3 bg-navy-950 rounded-lg border border-slate-800 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-850 pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-mono font-bold">
                        Block #{b.block_index}
                      </span>
                      <span className="text-slate-400">{b.timestamp}</span>
                    </div>
                    <span className="quantum-badge bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                      SHA-256 Chained
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-[11px]">
                    <div className="overflow-hidden text-ellipsis">
                      <span className="text-slate-500">Prev Hash: </span>
                      <span className="text-slate-400">{b.prev_hash}</span>
                    </div>
                    <div className="overflow-hidden text-ellipsis">
                      <span className="text-cyan-400">Block Hash: </span>
                      <span className="text-cyan-300 font-bold">{b.block_hash}</span>
                    </div>
                  </div>

                  <div className="bg-navy-900/60 p-2 rounded text-[11px] text-slate-300 font-mono overflow-x-auto">
                    <span className="text-slate-500">Payload: </span>
                    {JSON.stringify(b.payload)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

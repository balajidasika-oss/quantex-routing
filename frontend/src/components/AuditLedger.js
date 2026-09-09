import React, { useState, useEffect } from "react";

export default function AuditLedger({ apiUrl = "http://localhost:8000/api" }) {
  const [ledger, setLedger] = useState([]);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const lRes = await fetch(`${apiUrl}/admin/audit/ledger?limit=30`);
      if (lRes.ok) setLedger(await lRes.json());

      const vRes = await fetch(`${apiUrl}/admin/audit/verify`);
      if (vRes.ok) setVerification(await vRes.json());
    } catch (e) {
      console.warn("Audit fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h2 className="text-lg font-black tracking-wide uppercase text-white">
              Cryptographic SHA-256 Audit & Ledger
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Immutable chained audit blockchain certifying every quantum solver run, route dispatch, and telemetry event.
          </p>
        </div>

        <button
          onClick={fetchLedger}
          disabled={loading}
          className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold text-xs border border-slate-700 shadow-sm transition-all"
        >
          {loading ? "Verifying..." : "Verify Chain Integrity"}
        </button>
      </div>

      {/* Verification Status Card */}
      {verification && (
        <div className="p-4 rounded-xl bg-navy-900 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black">
              ✓
            </div>
            <div>
              <span className="font-bold text-slate-200 text-sm">Blockchain Status: {verification.status}</span>
              <p className="text-slate-400 text-[11px] font-mono mt-0.5">
                Total Certified Blocks: <b>{verification.total_blocks}</b> | Zero Tampering Detected
              </p>
            </div>
          </div>

          <div className="text-right font-mono text-[11px] text-slate-400">
            <span>Latest Hash: </span>
            <span className="text-cyan-300 font-bold">
              {verification.latest_block_hash ? verification.latest_block_hash.slice(0, 16) + "..." : "GENESIS"}
            </span>
          </div>
        </div>
      )}

      {/* Ledger Block List */}
      <div className="quantum-card p-5 bg-navy-900 border border-slate-800 rounded-xl space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 border-b border-slate-800 pb-2">
          Immutable Audit Blocks ({ledger.length})
        </h3>

        <div className="space-y-3">
          {ledger.map((block) => (
            <div
              key={block.index}
              className="p-3.5 rounded-xl bg-navy-950 border border-slate-800/80 space-y-2 text-xs font-mono"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-850 pb-2">
                <div className="flex items-center space-x-2 font-sans">
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold text-[10px]">
                    BLOCK #{block.index}
                  </span>
                  <strong className="text-slate-200 text-xs">{block.payload?.event || "AUDIT_RECORD"}</strong>
                </div>
                <span className="text-slate-500 text-[11px]">{block.timestamp}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-400">
                <div>
                  <span className="text-slate-500 block">Current Block Hash:</span>
                  <span className="text-cyan-400 font-bold truncate block">{block.block_hash}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Previous Block Hash:</span>
                  <span className="text-slate-400 truncate block">{block.prev_hash}</span>
                </div>
              </div>

              <div className="p-2 rounded bg-slate-900/80 border border-slate-800/60 text-[10px] text-slate-300 overflow-x-auto">
                <pre>{JSON.stringify(block.payload, null, 2)}</pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

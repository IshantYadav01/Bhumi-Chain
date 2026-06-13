"use client";

export default function BlockchainMonitor({ activeTx, simulationLogs, isSimulating, attackStatus, onRunSimulation }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      {/* Verification Pipeline Display */}
      <div className="lg:col-span-2 bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] p-5 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-semibold mb-3 text-[#ccc] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
            Fabric Consensus & Verification Pipeline
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-[#0f0f1a] p-3 rounded-lg border border-gray-800/60">
              <div className="font-bold text-purple-400 mb-1">1. Endorsement Layer</div>
              <p className="text-gray-400 text-[11px] leading-relaxed">Simulates payload execution across distributed department organizations to generate valid cryptosignatures.</p>
            </div>
            <div className="bg-[#0f0f1a] p-3 rounded-lg border border-gray-800/60">
              <div className="font-bold text-amber-400 mb-1">2. Ordering Service</div>
              <p className="text-gray-400 text-[11px] leading-relaxed">Arranges incoming, signed state updates sequentially inside chronological data blocks to suppress race conditions.</p>
            </div>
            <div className="bg-[#0f0f1a] p-3 rounded-lg border border-gray-800/60">
              <div className="font-bold text-green-400 mb-1">3. Validation & Commit</div>
              <p className="text-gray-400 text-[11px] leading-relaxed">Checks current Read-Write sets. If local hashes remain unaltered, records securely lock into the state database.</p>
            </div>
          </div>
        </div>
        {activeTx && (
          <div className="mt-4 p-2.5 bg-purple-950/20 border border-purple-500/30 rounded-lg text-[11px] font-mono text-purple-300">
            <span className="font-bold text-purple-400">⚡ Last Transaction Verified:</span> {activeTx.id} <br />
            <span className="text-gray-400">Path: {activeTx.lifecycle}</span>
          </div>
        )}
      </div>

      {/* Security Sandbox (Anti-Tamper Monitor) */}
      <div className="bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] p-5 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-[#ccc]">Anti-Tamper Diagnostic Sandbox</h3>
            {attackStatus === "intercepted" && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/30 rounded">
                Attack Isolated
              </span>
            )}
            {attackStatus === "processing" && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 rounded animate-pulse">
                Mismatches Found
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mb-3">
            Test how the architecture detects and neutralizes direct unauthorized modifications targeting single peer node records.
          </p>
          <div className="bg-[#0f0f1a] p-2.5 rounded-lg border border-gray-800 h-28 overflow-y-auto font-mono text-[10px] space-y-1 text-gray-300">
            {simulationLogs.length === 0 ? (
              <span className="text-gray-600 italic">Awaiting simulation sequence execution...</span>
            ) : (
              simulationLogs.map((log, idx) => (
                <div key={idx} className={log.startsWith("❌") || log.startsWith("⚠️") ? "text-red-400" : log.startsWith("✅") ? "text-green-400" : "text-gray-300"}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
        <button
          onClick={onRunSimulation}
          disabled={isSimulating}
          className={`w-full mt-3 px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            isSimulating
              ? "bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed"
              : "bg-transparent text-red-400 border-red-500/40 hover:bg-red-500/10"
          }`}
        >
          {isSimulating ? "Performing Cryptographic Integrity Audit..." : "Simulate Database Tamper Attack"}
        </button>
      </div>
    </div>
  );
}
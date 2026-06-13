"use client";

import { useState } from "react";

export default function BlockchainVisualizer({ blocks, onTamperBlock, onRestoreLedger }) {
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [tamperValue, setTamperValue] = useState("");

  return (
    <div className="bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] p-5 mb-6">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#ccc] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            Immutable Ledger Chain View & Fraud Simulator
          </h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Real-time blocks committed via Fabric Orderer. Click <strong>"Tamper Data"</strong> to inject an unauthorized change and watch the block hash coupling break.
          </p>
        </div>
        {blocks.some(b => b.isTampered) && (
          <button
            onClick={onRestoreLedger}
            className="px-3 py-1 bg-green-600/20 border border-green-500/50 text-green-400 text-xs rounded-md font-semibold hover:bg-green-600/30 transition-all"
          >
            🔄 Run Self-Healing Sync (Restore Ledger Integrity)
          </button>
        )}
      </div>

      {/* Horizontal Chain Scroller */}
      <div className="flex gap-6 overflow-x-auto pb-4 pt-2 px-1 scrollbar-thin scrollbar-thumb-gray-800">
        {blocks.map((block, idx) => {
          const isChainBroken = idx > 0 && blocks[idx - 1].hash !== block.prevHash;
          const displayTampered = block.isTampered || isChainBroken;

          return (
            <div key={block.id} className="flex items-center flex-shrink-0">
              {/* Cryptographic Link Indicator */}
              {idx > 0 && (
                <div className="flex flex-col items-center mx-1">
                  <div className={`h-[2px] w-8 transition-colors ${isChainBroken ? "bg-red-500 animate-pulse" : "bg-indigo-500/60"}`} />
                  <span className={`text-[9px] font-mono mt-1 ${isChainBroken ? "text-red-400 font-bold" : "text-indigo-400"}`}>
                    {isChainBroken ? "⛓️ BREAK" : "🔗 link"}
                  </span>
                </div>
              )}

              {/* Block Card Layout */}
              <div 
                className={`w-64 rounded-xl border p-4 transition-all duration-300 ${
                  displayTampered 
                    ? "bg-red-950/20 border-red-500/50 shadow-lg shadow-red-950/40" 
                    : "bg-[#0f0f1a] border-[#2a2a3e] shadow-md"
                }`}
              >
                {/* Block Header */}
                <div className="flex justify-between items-center mb-2.5 border-b border-gray-800/60 pb-1.5">
                  <span className="text-xs font-bold font-mono text-gray-400">BLOCK #{block.id}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${displayTampered ? "bg-red-500/10 text-red-400" : "bg-indigo-500/10 text-indigo-400"}`}>
                    TS: {block.timestamp}
                  </span>
                </div>

                {/* Block Meta Fields */}
                <div className="space-y-1.5 text-[11px] font-mono">
                  <div>
                    <span className="text-gray-500 block text-[10px]">TRANSACTION DATA</span>
                    {editingBlockId === block.id ? (
                      <div className="flex gap-1 mt-1">
                        <input
                          type="text"
                          className="bg-[#1a1a2e] border border-red-500/40 text-xs px-1.5 py-0.5 rounded text-white w-full focus:outline-none"
                          value={tamperValue}
                          onChange={(e) => setTamperValue(e.target.value)}
                        />
                        <button
                          onClick={() => {
                            onTamperBlock(block.id, tamperValue);
                            setEditingBlockId(null);
                          }}
                          className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] rounded hover:bg-red-700"
                        >
                          Inject
                        </button>
                      </div>
                    ) : (
                      <div className={`p-1.5 rounded text-[11px] font-semibold break-all leading-relaxed ${displayTampered ? "bg-red-950/40 text-red-300" : "bg-[#161625] text-emerald-400"}`}>
                        ⚙️ Action: <span className="text-white">{block.txAction}</span> <br/>
                        🆔 ID: <span className="text-gray-300">{block.plotId}</span> <br/>
                        👤 Payload: <span className="text-gray-300">"{block.payloadDetails}"</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-1">
                    <span className="text-gray-500 text-[10px] block">PREVIOUS BLOCK HASH</span>
                    <span className="text-gray-400 text-[10px] truncate block bg-black/20 p-1 rounded border border-gray-900" title={block.prevHash}>
                      {block.prevHash}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500 text-[10px] block">CURRENT MERKLE STATE HASH</span>
                    <span className={`text-[10px] truncate block p-1 rounded border ${displayTampered ? "bg-red-950/60 text-red-400 border-red-900" : "bg-black/20 text-indigo-300 border-gray-900"}`} title={block.hash}>
                      {block.hash}
                    </span>
                  </div>
                </div>

                {/* Invalidation Context Footer */}
                <div className="mt-3 pt-2 border-t border-gray-800/40 flex justify-between items-center text-[10px]">
                  {displayTampered ? (
                    <span className="text-red-400 font-semibold flex items-center gap-1">
                      ❌ Invalid State: Hash Mismatch
                    </span>
                  ) : (
                    <span className="text-emerald-500 font-semibold flex items-center gap-1">
                      🛡️ Consensus Verified
                    </span>
                  )}
                  
                  {!block.isTampered && !isChainBroken && (
                    <button
                      onClick={() => {
                        setEditingBlockId(block.id);
                        setTamperValue(block.payloadDetails);
                      }}
                      className="text-[10px] text-red-400 hover:underline bg-transparent border-none cursor-pointer"
                    >
                      Tamper Data
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
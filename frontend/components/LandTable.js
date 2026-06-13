"use client";

import StatusBadge from "./StatusBadge";

export default function LandTable({ loading, filtered, selected, onSelectLand, onDoAction }) {
  const btnClass = "px-[18px] py-2 rounded-lg text-xs font-semibold cursor-pointer border transition-opacity hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed";
  const btnSmallClass = "px-2.5 py-1 text-xs rounded-md";

  return (
    <div className="bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] overflow-hidden mb-5">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e] text-[#888] font-semibold text-[11px] uppercase tracking-wider">Plot ID</th>
            <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e] text-[#888] font-semibold text-[11px] uppercase tracking-wider">Survey #</th>
            <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e] text-[#888] font-semibold text-[11px] uppercase tracking-wider">Owner</th>
            <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e] text-[#888] font-semibold text-[11px] uppercase tracking-wider">Location</th>
            <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e] text-[#888] font-semibold text-[11px] uppercase tracking-wider">Area (m²)</th>
            <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e] text-[#888] font-semibold text-[11px] uppercase tracking-wider">Type</th>
            <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e] text-[#888] font-semibold text-[11px] uppercase tracking-wider">Status</th>
            <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e] text-[#888] font-semibold text-[11px] uppercase tracking-wider">Mortgage / Dispute</th>
            <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e] text-[#888] font-semibold text-[11px] uppercase tracking-wider"></th>
          </tr>
        </thead>
        <tbody>
          {loading && filtered.length === 0 ? (
            <tr>
              <td colSpan={9} className="text-center py-10 text-[#666]">Loading...</td>
            </tr>
          ) : filtered.length === 0 ? (
            <tr>
              <td colSpan={9} className="text-center py-10 text-[#666]">No land records. Register one below.</td>
            </tr>
          ) : (
            filtered.map((l) => (
              <tr
                key={l.plotId}
                className={`cursor-pointer transition-colors border-b border-[#1f1f35] hover:bg-[#1f1f35] ${
                  selected?.plotId === l.plotId ? "bg-[#252540]" : "bg-transparent"
                }`}
                onClick={() => onSelectLand(l)}
              >
                <td className="px-3.5 py-2.5">
                  <code className="text-[#a78bfa]">{l.plotId}</code>
                </td>
                <td className="px-3.5 py-2.5">{l.surveyNumber}</td>
                <td className="px-3.5 py-2.5">{l.owner}</td>
                <td className="px-3.5 py-2.5">{l.location}</td>
                <td className="px-3.5 py-2.5">{l.area}</td>
                <td className="px-3.5 py-2.5">{l.landType}</td>
                <td className="px-3.5 py-2.5"><StatusBadge status={l.status} /></td>
                <td className="px-3.5 py-2.5 space-x-1">
                  {l.mortgage && (
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold text-amber-500 bg-amber-500/10">
                      🏦 {l.mortgage.bank} (Rs.{l.mortgage.amount})
                    </span>
                  )}
                  {l.dispute && (
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold text-red-500 bg-red-500/10">
                      ⚖️ {l.dispute.caseNumber} — {l.dispute.court}
                    </span>
                  )}
                </td>
                <td className="px-3.5 py-2.5">
                  {l.status === "active" && (
                    <button
                      className={`${btnClass} ${btnSmallClass} bg-transparent text-red-500 border-red-500`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDoAction("dispute", {
                          plotId: l.plotId,
                          caseNumber: prompt("Case number?"),
                          court: prompt("Court?"),
                          description: prompt("Description?"),
                        });
                      }}
                    >
                      Dispute
                    </button>
                  )}
                  {l.status === "disputed" && (
                    <button
                      className={`${btnClass} ${btnSmallClass} bg-transparent text-[#7c3aed] border-[#7c3aed]`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDoAction("resolve-dispute", { plotId: l.plotId });
                      }}
                    >
                      Resolve
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
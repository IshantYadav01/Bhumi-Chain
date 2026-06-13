"use client";

import StatusBadge from "./StatusBadge";

export default function SelectedLandDetails({ selected }) {
  const formCardClass = "bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] p-5 mb-4";

  return (
    <div className={`${formCardClass} mt-4`}>
      <div className="text-sm font-semibold mb-3 text-[#ccc]">
        Details: {selected.plotId} <StatusBadge status={selected.status} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div><span className="text-[#888]">Survey #:</span> {selected.surveyNumber}</div>
        <div><span className="text-[#888]">Owner:</span> {selected.owner}</div>
        <div><span className="text-[#888]">Previous:</span> {selected.previousOwner || "—"}</div>
        <div><span className="text-[#888]">Location:</span> {selected.location}</div>
        <div><span className="text-[#888]">Area:</span> {selected.area} m²</div>
        <div><span className="text-[#888]">Type:</span> {selected.landType}</div>
        <div><span className="text-[#888]">Transfers:</span> {selected.transferCount}</div>
        <div><span className="text-[#888]">Registered:</span> {selected.registeredDate?.slice(0, 10)}</div>
        {selected.lastTransfer && (
          <div>
            <span className="text-[#888]">Last Sale:</span> {selected.lastTransfer.from} → {selected.lastTransfer.to} (Rs. {selected.lastTransfer.price})
          </div>
        )}
      </div>
      {selected.mortgage && (
        <div className="mt-2.5 px-3 py-2 bg-[#2a2a0a] rounded-lg text-xs">
          🏦 <strong>Mortgage:</strong> {selected.mortgage.bank} — Rs. {selected.mortgage.amount} ({selected.mortgage.startDate} to {selected.mortgage.endDate})
        </div>
      )}
      {selected.dispute && (
        <div className="mt-2.5 px-3 py-2 bg-[#2a0a0a] rounded-lg text-xs">
          ⚖️ <strong>Dispute:</strong> Case #{selected.dispute.caseNumber} — {selected.dispute.court} ({selected.dispute.status})<br />
          <span className="text-[#888]">{selected.dispute.description}</span>
        </div>
      )}
    </div>
  );
}
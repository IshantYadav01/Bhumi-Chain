"use client";

import { useState, useEffect, useCallback } from "react";

function statusBadge(status) {
  const map = {
    active: "text-green-500 bg-green-500/10",
    mortgaged: "text-amber-500 bg-amber-500/10",
    disputed: "text-red-500 bg-red-500/10",
  };
  const classes = map[status] || "text-gray-400 bg-gray-400/10";
  
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${classes}`}>
      {status}
    </span>
  );
}

// ── Main Page ───────────────────────────────────────────────────────
export default function Home() {
  const [lands, setLands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [selected, setSelected] = useState(null);
  const [networkStatus, setNetworkStatus] = useState("checking");
  const [tab, setTab] = useState("all"); // all | active | mortgaged | disputed
  const [filterOwner, setFilterOwner] = useState("");

  const [form, setForm] = useState({
    action: "register",
    plotId: "",
    surveyNumber: "",
    owner: "",
    location: "",
    area: "",
    landType: "residential",
    buyer: "",
    price: "",
    bank: "",
    amount: "",
    startDate: "",
    endDate: "",
    caseNumber: "",
    court: "",
    description: "",
  });

  const clearForm = () =>
    setForm({
      action: "register",
      plotId: "",
      surveyNumber: "",
      owner: "",
      location: "",
      area: "",
      landType: "residential",
      buyer: "",
      price: "",
      bank: "",
      amount: "",
      startDate: "",
      endDate: "",
      caseNumber: "",
      court: "",
      description: "",
    });

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchLands = useCallback(async () => {
    try {
      setLoading(true);
      let url = "/api/land";
      if (tab !== "all") url += `?status=${tab}`;
      else if (filterOwner) url += `?owner=${encodeURIComponent(filterOwner)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLands(Array.isArray(data) ? data : []);
      setError(null);
      setNetworkStatus("connected");
    } catch (err) {
      setError(err.message);
      setNetworkStatus("disconnected");
    } finally {
      setLoading(false);
    }
  }, [tab, filterOwner]);

  useEffect(() => {
    fetchLands();
    const i = setInterval(fetchLands, 8000);
    return () => clearInterval(i);
  }, [fetchLands]);

  const doAction = async (action, body = {}) => {
    try {
      const res = await fetch("/api/land", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, false);
        return false;
      }
      showToast(`${action} successful!`);
      setTimeout(fetchLands, 1500);
      return true;
    } catch (err) {
      showToast(err.message, false);
      return false;
    }
  };

  const selectLand = (land) => {
    setSelected(land);
    setForm({
      ...form,
      plotId: land.plotId,
      surveyNumber: land.surveyNumber,
      owner: land.owner,
      location: land.location,
      area: String(land.area),
      landType: land.landType,
    });
  };

  const filtered = lands;

  // Reusable utility styles translated to Tailwind CSS strings
  const inputClass = "bg-[#0f0f1a] border border-[#333] rounded px-[11px] py-[7px] text-[#e0e0e0] text-ed-13 w-full box-border focus:outline-none focus:border-[#7c3aed]";
  const btnClass = "px-[18px] py-2 rounded-lg text-xs font-semibold cursor-pointer border transition-opacity hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed";
  const btnSmallClass = "px-2.5 py-1 text-xs rounded-md";
  const formCardClass = "bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] p-5 mb-4";
  const inputGridClass = "grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 mb-2.5";

  return (
    <div className="max-w-[1200px] my-0 mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-[26px] font-bold text-[#7c3aed] m-0">Land Registry Explorer</h1>
          <p className="text-xs text-[#888] mt-1">
            Private Blockchain — 5 Department Full Nodes | Buyers, Sellers, Officials as Lite Nodes
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-[#1a1a2e] px-3.5 py-1.5 rounded-[20px] border border-[#333]">
          <span className={`w-2 h-2 rounded-full inline-block ${networkStatus === "connected" ? "bg-[#22c55e]" : "bg-[#ef4444]"}`} />
          {networkStatus === "connected" ? "Connected" : "Disconnected"}
          <span className="text-[#555] ml-2">{lands.length} plots</span>
        </div>
      </div>

      {error && (
        <div className="bg-[#3b1111] border border-[#ef4444] rounded-lg px-4 py-2.5 mb-4 text-xs text-[#fca5a5]">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="flex gap-1 mb-4">
          {["all", "active", "mortgaged", "disputed"].map((t) => (
            <button
              key={t}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none transition-all duration-150 hover:opacity-85 ${
                tab === t ? "bg-[#7c3aed] text-white" : "bg-transparent text-[#888]"
              }`}
              onClick={() => {
                setTab(t);
                setFilterOwner("");
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <input
          className={`${inputClass} w-[200px]`}
          placeholder="Filter by owner..."
          value={filterOwner}
          onChange={(e) => {
            setFilterOwner(e.target.value);
            setTab("all");
          }}
        />
      </div>

      {/* Land Table */}
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
                <td colSpan={9} className="text-center py-10 text-[#666]">
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-[#666]">
                  No land records. Register one below.
                </td>
              </tr>
            ) : (
              filtered.map((l) => (
                <tr
                  key={l.plotId}
                  className={`cursor-pointer transition-colors border-b border-[#1f1f35] hover:bg-[#1f1f35] ${
                    selected?.plotId === l.plotId ? "bg-[#252540]" : "bg-transparent"
                  }`}
                  onClick={() => selectLand(l)}
                >
                  <td className="px-3.5 py-2.5">
                    <code className="text-[#a78bfa]">{l.plotId}</code>
                  </td>
                  <td className="px-3.5 py-2.5">{l.surveyNumber}</td>
                  <td className="px-3.5 py-2.5">{l.owner}</td>
                  <td className="px-3.5 py-2.5">{l.location}</td>
                  <td className="px-3.5 py-2.5">{l.area}</td>
                  <td className="px-3.5 py-2.5">{l.landType}</td>
                  <td className="px-3.5 py-2.5">{statusBadge(l.status)}</td>
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
                          doAction("dispute", {
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
                          doAction("resolve-dispute", { plotId: l.plotId });
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

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Register Land */}
        <div className={formCardClass}>
          <div className="text-sm font-semibold mb-3 text-[#ccc]">Register New Land</div>
          <div className={inputGridClass}>
            <input
              className={inputClass}
              placeholder="Plot ID *"
              value={form.plotId}
              onChange={(e) => setForm({ ...form, plotId: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Survey Number"
              value={form.surveyNumber}
              onChange={(e) => setForm({ ...form, surveyNumber: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Owner *"
              value={form.owner}
              onChange={(e) => setForm({ ...form, owner: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Area (m²)"
              type="number"
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
            />
            <select
              className={inputClass}
              value={form.landType}
              onChange={(e) => setForm({ ...form, landType: e.target.value })}
            >
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="agricultural">Agricultural</option>
              <option value="industrial">Industrial</option>
            </select>
          </div>
          <button
            className={`${btnClass} bg-[#7c3aed] text-white border-transparent`}
            disabled={!form.plotId || !form.owner}
            onClick={() =>
              doAction("register", {
                plotId: form.plotId,
                surveyNumber: form.surveyNumber,
                owner: form.owner,
                location: form.location,
                area: parseFloat(form.area) || 0,
                landType: form.landType,
              }).then((ok) => ok && clearForm())
            }
          >
            Register Land
          </button>
        </div>

        {/* Transfer Land */}
        <div className={formCardClass}>
          <div className="text-sm font-semibold mb-3 text-[#ccc]">Transfer Land (Sale)</div>
          <p className="text-xs text-[#777] mb-2.5">
            Endorsed by Municipality · Malpot · Survey
          </p>
          <div className={inputGridClass}>
            <input
              className={inputClass}
              placeholder="Plot ID *"
              value={form.plotId}
              onChange={(e) => setForm({ ...form, plotId: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Buyer *"
              value={form.buyer}
              onChange={(e) => setForm({ ...form, buyer: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Price (Rs.)"
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <button
            className={`${btnClass} bg-transparent text-[#7c3aed] border-[#7c3aed]`}
            disabled={!form.plotId || !form.buyer}
            onClick={() =>
              doAction("transfer", {
                plotId: form.plotId,
                buyer: form.buyer,
                price: parseFloat(form.price) || 0,
              }).then((ok) => ok && clearForm())
            }
          >
            Transfer Land
          </button>
        </div>

        {/* Mortgage */}
        <div className={formCardClass}>
          <div className="text-sm font-semibold mb-3 text-[#ccc]">Set Mortgage</div>
          <div className={inputGridClass}>
            <input
              className={inputClass}
              placeholder="Plot ID *"
              value={form.plotId}
              onChange={(e) => setForm({ ...form, plotId: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Bank *"
              value={form.bank}
              onChange={(e) => setForm({ ...form, bank: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Amount (Rs.)"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Start Date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="End Date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button
              className={`${btnClass} bg-transparent text-amber-500 border-amber-500`}
              disabled={!form.plotId || !form.bank}
              onClick={() =>
                doAction("mortgage", {
                  plotId: form.plotId,
                  bank: form.bank,
                  amount: parseFloat(form.amount) || 0,
                  startDate: form.startDate,
                  endDate: form.endDate,
                }).then((ok) => ok && clearForm())
              }
            >
              Set Mortgage
            </button>
            <button
              className={`${btnClass} ${btnSmallClass} bg-transparent text-[#7c3aed] border-[#7c3aed]`}
              disabled={!form.plotId}
              onClick={() =>
                doAction("clear-mortgage", { plotId: form.plotId }).then(
                  (ok) => ok && clearForm(),
                )
              }
            >
              Clear Mortgage
            </button>
          </div>
        </div>

        {/* Dispute */}
        <div className={formCardClass}>
          <div className="text-sm font-semibold mb-3 text-[#ccc]">File Legal Dispute</div>
          <div className={inputGridClass}>
            <input
              className={inputClass}
              placeholder="Plot ID *"
              value={form.plotId}
              onChange={(e) => setForm({ ...form, plotId: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Case Number *"
              value={form.caseNumber}
              onChange={(e) => setForm({ ...form, caseNumber: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Court"
              value={form.court}
              onChange={(e) => setForm({ ...form, court: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button
              className={`${btnClass} bg-transparent text-red-500 border-red-500`}
              disabled={!form.plotId || !form.caseNumber}
              onClick={() =>
                doAction("dispute", {
                  plotId: form.plotId,
                  caseNumber: form.caseNumber,
                  court: form.court,
                  description: form.description,
                }).then((ok) => ok && clearForm())
              }
            >
              File Dispute
            </button>
            <button
              className={`${btnClass} ${btnSmallClass} bg-transparent text-[#7c3aed] border-[#7c3aed]`}
              disabled={!form.plotId}
              onClick={() =>
                doAction("resolve-dispute", { plotId: form.plotId }).then(
                  (ok) => ok && clearForm(),
                )
              }
            >
              Resolve Dispute
            </button>
          </div>
        </div>
      </div>

      {/* Selected Land Detail */}
      {selected && (
        <div className={`${formCardClass} mt-4`}>
          <div className="text-sm font-semibold mb-3 text-[#ccc]">
            Details: {selected.plotId} {statusBadge(selected.status)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-[#888]">Survey #:</span> {selected.surveyNumber}
            </div>
            <div>
              <span className="text-[#888]">Owner:</span> {selected.owner}
            </div>
            <div>
              <span className="text-[#888]">Previous:</span> {selected.previousOwner || "—"}
            </div>
            <div>
              <span className="text-[#888]">Location:</span> {selected.location}
            </div>
            <div>
              <span className="text-[#888]">Area:</span> {selected.area} m²
            </div>
            <div>
              <span className="text-[#888]">Type:</span> {selected.landType}
            </div>
            <div>
              <span className="text-[#888]">Transfers:</span> {selected.transferCount}
            </div>
            <div>
              <span className="text-[#888]">Registered:</span> {selected.registeredDate?.slice(0, 10)}
            </div>
            {selected.lastTransfer && (
              <div>
                <span className="text-[#888]">Last Sale:</span> {selected.lastTransfer.from} → {selected.lastTransfer.to} (Rs.
                {selected.lastTransfer.price})
              </div>
            )}
          </div>
          {selected.mortgage && (
            <div className="mt-2.5 px-3 py-2 bg-[#2a2a0a] rounded-lg text-xs">
              🏦 <strong>Mortgage:</strong> {selected.mortgage.bank} — Rs.
              {selected.mortgage.amount} ({selected.mortgage.startDate} to {selected.mortgage.endDate})
            </div>
          )}
          {selected.dispute && (
            <div className="mt-2.5 px-3 py-2 bg-[#2a0a0a] rounded-lg text-xs">
              ⚖️ <strong>Dispute:</strong> Case #{selected.dispute.caseNumber} — {selected.dispute.court} ({selected.dispute.status})<br />
              <span className="text-[#888]">{selected.dispute.description}</span>
            </div>
          )}
        </div>
      )}

      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-5 py-3 rounded-text-sm font-semibold z-[999] animate-[slideUp_0.15s_ease-out] border ${
            toast.ok 
              ? "bg-[#1a3a1a] border-[#22c55e] text-[#86efac]" 
              : "bg-[#3a1a1a] border-[#ef4444] text-[#fca5a5]"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
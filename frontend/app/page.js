"use client";

import { useState, useEffect, useCallback } from "react";

// ── Styles ──────────────────────────────────────────────────────────
const S = {
  container: { maxWidth: 1200, margin: "0 auto", padding: "24px 16px" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  },
  title: { fontSize: 26, fontWeight: 700, color: "#7c3aed", margin: 0 },
  subtitle: { fontSize: 13, color: "#888", marginTop: 4 },
  status: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    background: "#1a1a2e",
    padding: "6px 14px",
    borderRadius: 20,
    border: "1px solid #333",
  },
  dot: (c) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: c,
    display: "inline-block",
  }),
  btn: {
    padding: "8px 18px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  btnPrimary: { background: "#7c3aed", color: "#fff" },
  btnDanger: {
    background: "transparent",
    color: "#ef4444",
    border: "1px solid #ef4444",
  },
  btnWarning: {
    background: "transparent",
    color: "#f59e0b",
    border: "1px solid #f59e0b",
  },
  btnOutline: {
    background: "transparent",
    color: "#7c3aed",
    border: "1px solid #7c3aed",
  },
  btnSmall: { padding: "4px 10px", fontSize: 12, borderRadius: 6 },
  card: {
    background: "#1a1a2e",
    borderRadius: 12,
    border: "1px solid #2a2a3e",
    overflow: "hidden",
    marginBottom: 20,
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left",
    padding: "10px 14px",
    borderBottom: "1px solid #2a2a3e",
    color: "#888",
    fontWeight: 600,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  td: { padding: "10px 14px", borderBottom: "1px solid #1f1f35" },
  formCard: {
    background: "#1a1a2e",
    borderRadius: 12,
    border: "1px solid #2a2a3e",
    padding: 20,
    marginBottom: 16,
  },
  formTitle: { fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#ccc" },
  input: {
    background: "#0f0f1a",
    border: "1px solid #333",
    borderRadius: 6,
    padding: "7px 11px",
    color: "#e0e0e0",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
  },
  select: {
    background: "#0f0f1a",
    border: "1px solid #333",
    borderRadius: 6,
    padding: "7px 11px",
    color: "#e0e0e0",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
  },
  inputGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: 8,
    marginBottom: 10,
  },
  badge: (c, bg) => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    background: bg,
    color: c,
  }),
  toast: {
    position: "fixed",
    bottom: 24,
    right: 24,
    padding: "12px 20px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    zIndex: 999,
  },
  tabBar: { display: "flex", gap: 4, marginBottom: 16 },
  tab: (active) => ({
    padding: "6px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    background: active ? "#7c3aed" : "transparent",
    color: active ? "#fff" : "#888",
    transition: "all 0.15s",
  }),
};

function statusBadge(status) {
  const map = {
    active: { color: "#22c55e", bg: "#22c55e22" },
    mortgaged: { color: "#f59e0b", bg: "#f59e0b22" },
    disputed: { color: "#ef4444", bg: "#ef444422" },
  };
  const s = map[status] || { color: "#888", bg: "#88822" };
  return <span style={S.badge(s.color, s.bg)}>{status}</span>;
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

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Land Registry Explorer</h1>
          <p style={S.subtitle}>
            Private Blockchain — 5 Department Full Nodes | Buyers, Sellers,
            Officials as Lite Nodes
          </p>
        </div>
        <div style={S.status}>
          <span
            style={S.dot(networkStatus === "connected" ? "#22c55e" : "#ef4444")}
          />
          {networkStatus === "connected" ? "Connected" : "Disconnected"}
          <span style={{ color: "#555", marginLeft: 8 }}>
            {lands.length} plots
          </span>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#3b1111",
            border: "1px solid #ef4444",
            borderRadius: 8,
            padding: "10px 16px",
            marginBottom: 16,
            fontSize: 13,
            color: "#fca5a5",
          }}
        >
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={S.tabBar}>
          {["all", "active", "mortgaged", "disputed"].map((t) => (
            <button
              key={t}
              style={S.tab(tab === t)}
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
          style={{ ...S.input, width: 200 }}
          placeholder="Filter by owner..."
          value={filterOwner}
          onChange={(e) => {
            setFilterOwner(e.target.value);
            setTab("all");
          }}
        />
      </div>

      {/* Land Table */}
      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Plot ID</th>
              <th style={S.th}>Survey #</th>
              <th style={S.th}>Owner</th>
              <th style={S.th}>Location</th>
              <th style={S.th}>Area (m²)</th>
              <th style={S.th}>Type</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Mortgage / Dispute</th>
              <th style={S.th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  style={{ textAlign: "center", padding: 40, color: "#666" }}
                >
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  style={{ textAlign: "center", padding: 40, color: "#666" }}
                >
                  No land records. Register one below.
                </td>
              </tr>
            ) : (
              filtered.map((l) => (
                <tr
                  key={l.plotId}
                  style={{
                    cursor: "pointer",
                    background:
                      selected?.plotId === l.plotId ? "#252540" : "transparent",
                  }}
                  onClick={() => selectLand(l)}
                >
                  <td style={S.td}>
                    <code style={{ color: "#a78bfa" }}>{l.plotId}</code>
                  </td>
                  <td style={S.td}>{l.surveyNumber}</td>
                  <td style={S.td}>{l.owner}</td>
                  <td style={S.td}>{l.location}</td>
                  <td style={S.td}>{l.area}</td>
                  <td style={S.td}>{l.landType}</td>
                  <td style={S.td}>{statusBadge(l.status)}</td>
                  <td style={S.td}>
                    {l.mortgage && (
                      <span style={S.badge("#f59e0b", "#f59e0b22")}>
                        🏦 {l.mortgage.bank} (Rs.{l.mortgage.amount})
                      </span>
                    )}
                    {l.dispute && (
                      <span style={S.badge("#ef4444", "#ef444422")}>
                        ⚖️ {l.dispute.caseNumber} — {l.dispute.court}
                      </span>
                    )}
                  </td>
                  <td style={S.td}>
                    {l.status === "active" && (
                      <button
                        style={{ ...S.btn, ...S.btnDanger, ...S.btnSmall }}
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
                        style={{ ...S.btn, ...S.btnOutline, ...S.btnSmall }}
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Register Land */}
        <div style={S.formCard}>
          <div style={S.formTitle}>Register New Land</div>
          <div style={S.inputGrid}>
            <input
              style={S.input}
              placeholder="Plot ID *"
              value={form.plotId}
              onChange={(e) => setForm({ ...form, plotId: e.target.value })}
            />
            <input
              style={S.input}
              placeholder="Survey Number"
              value={form.surveyNumber}
              onChange={(e) =>
                setForm({ ...form, surveyNumber: e.target.value })
              }
            />
            <input
              style={S.input}
              placeholder="Owner *"
              value={form.owner}
              onChange={(e) => setForm({ ...form, owner: e.target.value })}
            />
            <input
              style={S.input}
              placeholder="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <input
              style={S.input}
              placeholder="Area (m²)"
              type="number"
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
            />
            <select
              style={S.select}
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
            style={{ ...S.btn, ...S.btnPrimary }}
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
        <div style={S.formCard}>
          <div style={S.formTitle}>Transfer Land (Sale)</div>
          <p style={{ fontSize: 12, color: "#777", marginBottom: 10 }}>
            Endorsed by Municipality · Malpot · Survey
          </p>
          <div style={S.inputGrid}>
            <input
              style={S.input}
              placeholder="Plot ID *"
              value={form.plotId}
              onChange={(e) => setForm({ ...form, plotId: e.target.value })}
            />
            <input
              style={S.input}
              placeholder="Buyer *"
              value={form.buyer}
              onChange={(e) => setForm({ ...form, buyer: e.target.value })}
            />
            <input
              style={S.input}
              placeholder="Price (Rs.)"
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <button
            style={{ ...S.btn, ...S.btnOutline }}
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
        <div style={S.formCard}>
          <div style={S.formTitle}>Set Mortgage</div>
          <div style={S.inputGrid}>
            <input
              style={S.input}
              placeholder="Plot ID *"
              value={form.plotId}
              onChange={(e) => setForm({ ...form, plotId: e.target.value })}
            />
            <input
              style={S.input}
              placeholder="Bank *"
              value={form.bank}
              onChange={(e) => setForm({ ...form, bank: e.target.value })}
            />
            <input
              style={S.input}
              placeholder="Amount (Rs.)"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <input
              style={S.input}
              placeholder="Start Date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
            <input
              style={S.input}
              placeholder="End Date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{ ...S.btn, ...S.btnWarning }}
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
              style={{ ...S.btn, ...S.btnOutline, ...S.btnSmall }}
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
        <div style={S.formCard}>
          <div style={S.formTitle}>File Legal Dispute</div>
          <div style={S.inputGrid}>
            <input
              style={S.input}
              placeholder="Plot ID *"
              value={form.plotId}
              onChange={(e) => setForm({ ...form, plotId: e.target.value })}
            />
            <input
              style={S.input}
              placeholder="Case Number *"
              value={form.caseNumber}
              onChange={(e) => setForm({ ...form, caseNumber: e.target.value })}
            />
            <input
              style={S.input}
              placeholder="Court"
              value={form.court}
              onChange={(e) => setForm({ ...form, court: e.target.value })}
            />
            <input
              style={S.input}
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{ ...S.btn, ...S.btnDanger }}
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
              style={{ ...S.btn, ...S.btnOutline, ...S.btnSmall }}
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
        <div style={{ ...S.formCard, marginTop: 16 }}>
          <div style={S.formTitle}>
            Details: {selected.plotId} {statusBadge(selected.status)}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
              fontSize: 13,
            }}
          >
            <div>
              <span style={{ color: "#888" }}>Survey #:</span>{" "}
              {selected.surveyNumber}
            </div>
            <div>
              <span style={{ color: "#888" }}>Owner:</span> {selected.owner}
            </div>
            <div>
              <span style={{ color: "#888" }}>Previous:</span>{" "}
              {selected.previousOwner || "—"}
            </div>
            <div>
              <span style={{ color: "#888" }}>Location:</span>{" "}
              {selected.location}
            </div>
            <div>
              <span style={{ color: "#888" }}>Area:</span> {selected.area} m²
            </div>
            <div>
              <span style={{ color: "#888" }}>Type:</span> {selected.landType}
            </div>
            <div>
              <span style={{ color: "#888" }}>Transfers:</span>{" "}
              {selected.transferCount}
            </div>
            <div>
              <span style={{ color: "#888" }}>Registered:</span>{" "}
              {selected.registeredDate?.slice(0, 10)}
            </div>
            {selected.lastTransfer && (
              <div>
                <span style={{ color: "#888" }}>Last Sale:</span>{" "}
                {selected.lastTransfer.from} → {selected.lastTransfer.to} (Rs.
                {selected.lastTransfer.price})
              </div>
            )}
          </div>
          {selected.mortgage && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 12px",
                background: "#2a2a0a",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              🏦 <strong>Mortgage:</strong> {selected.mortgage.bank} — Rs.
              {selected.mortgage.amount} ({selected.mortgage.startDate} to{" "}
              {selected.mortgage.endDate})
            </div>
          )}
          {selected.dispute && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 12px",
                background: "#2a0a0a",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              ⚖️ <strong>Dispute:</strong> Case #{selected.dispute.caseNumber} —{" "}
              {selected.dispute.court} ({selected.dispute.status})<br />
              <span style={{ color: "#888" }}>
                {selected.dispute.description}
              </span>
            </div>
          )}
        </div>
      )}

      {toast && (
        <div
          style={{
            ...S.toast,
            background: toast.ok ? "#1a3a1a" : "#3a1a1a",
            border: `1px solid ${toast.ok ? "#22c55e" : "#ef4444"}`,
            color: toast.ok ? "#86efac" : "#fca5a5",
          }}
        >
          {toast.msg}
        </div>
      )}

      <style jsx global>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        input:focus,
        select:focus {
          outline: none;
          border-color: #7c3aed !important;
        }
        button:hover {
          opacity: 0.85;
        }
        button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        tr:hover {
          background: #1f1f35 !important;
        }
      `}</style>
    </div>
  );
}

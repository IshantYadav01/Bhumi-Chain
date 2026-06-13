"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getToken,
  clearToken,
  authHeaders,
  getUserInfo,
  hasRole,
  hasAnyRole,
  getRoles,
} from "@/lib/auth.js";

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
  const router = useRouter();
  const [lands, setLands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [selected, setSelected] = useState(null);
  const [networkStatus, setNetworkStatus] = useState("checking");
  const [tab, setTab] = useState("all"); // all | active | mortgaged | disputed
  const [filterOwner, setFilterOwner] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  const [sales, setSales] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);

  // Redirect to login if no token.
  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  useEffect(() => {
    const info = getUserInfo();
    if (info) setUserInfo(info);
  }, []);

  const handleLogout = () => {
    clearToken();
    router.replace("/login");
  };

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
      const res = await fetch(url, { headers: authHeaders() });
      if (res.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
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
  }, [tab, filterOwner, router]);

  useEffect(() => {
    fetchLands();
    const i = setInterval(fetchLands, 8000);
    return () => clearInterval(i);
  }, [fetchLands]);

  useEffect(() => {
    if (tab === "sales") fetchSales();
  }, [tab]);

  const doAction = async (action, body = {}) => {
    try {
      const res = await fetch("/api/land", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action, ...body }),
      });
      if (res.status === 401) {
        clearToken();
        router.replace("/login");
        return false;
      }
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

  const fetchSales = async () => {
    try {
      setSalesLoading(true);
      const [myRes, pendingRes] = await Promise.all([
        fetch("/api/land?mySales=1", { headers: authHeaders() }),
        fetch("/api/land?pendingApprovals=1", { headers: authHeaders() }),
      ]);
      if (myRes.ok) {
        const d = await myRes.json();
        setSales(Array.isArray(d) ? d : []);
      }
      if (pendingRes.ok) {
        const d = await pendingRes.json();
        setPendingApprovals(Array.isArray(d) ? d : []);
      }
    } catch {
    } finally {
      setSalesLoading(false);
    }
  };

  const handleSaleAction = async (action, proposalId, extra = {}) => {
    const ok = await doAction(action, { plotId: proposalId, ...extra });
    if (ok) fetchSales();
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
          <button
            onClick={handleLogout}
            style={{
              marginLeft: 16,
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid #555",
              background: "transparent",
              color: "#aaa",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Logout
          </button>
        </div>
        {userInfo && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginLeft: 16,
            }}
          >
            <span style={{ color: "#aaa", fontSize: 12 }}>
              {userInfo.name || userInfo.username}
            </span>
            {userInfo.roles?.map((r) => (
              <span
                key={r}
                style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 10,
                  background:
                    r === "admin"
                      ? "#7c3aed"
                      : r === "malpot"
                        ? "#0891b2"
                        : r === "official"
                          ? "#2563eb"
                          : r === "seller"
                            ? "#ea580c"
                            : r === "buyer"
                              ? "#16a34a"
                              : r === "bank"
                                ? "#dc2626"
                                : r === "court"
                                  ? "#9333ea"
                                  : "#6b7280",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                {r}
              </span>
            ))}
          </div>
        )}
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
          <button
            style={
              tab === "sales"
                ? { ...S.tab(true), background: "#4caf50", color: "#fff" }
                : S.tab(false)
            }
            onClick={() => setTab("sales")}
          >
            Sales
          </button>
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
        {hasAnyRole("admin", "malpot", "official") && (
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
        )}

        {/* Transfer Land */}
        {hasRole("seller") && (
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
        )}

        {/* Mortgage */}
        {hasAnyRole("admin", "bank") && (
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
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
                }
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
        )}

        {/* Dispute */}
        {hasAnyRole("admin", "court") && (
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
                onChange={(e) =>
                  setForm({ ...form, caseNumber: e.target.value })
                }
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
        )}
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

      {/* Sales Tab */}
      {tab === "sales" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Initiate Sale — seller only */}
          {hasRole("seller") && (
            <div style={S.formCard}>
              <div style={S.formTitle}>Initiate Sale Proposal</div>
              <div style={S.inputGrid}>
                <select
                  style={S.select}
                  value={form.plotId}
                  onChange={(e) => setForm({ ...form, plotId: e.target.value })}
                >
                  <option value="">-- Select your plot --</option>
                  {lands
                    .filter(
                      (l) => l.owner === (userInfo?.username || userInfo?.name),
                    )
                    .map((l) => (
                      <option key={l.plotId} value={l.plotId}>
                        {l.plotId} — {l.location}
                      </option>
                    ))}
                </select>
                <input
                  style={S.input}
                  placeholder="Buyer CN *"
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
                style={{ ...S.btn, ...S.btnPrimary }}
                disabled={!form.plotId || !form.buyer}
                onClick={() =>
                  handleSaleAction("initiate-sale", form.plotId, {
                    buyer: form.buyer,
                    price: parseFloat(form.price) || 0,
                  }).then((ok) => ok && clearForm())
                }
              >
                Initiate Sale
              </button>
            </div>
          )}

          {/* Pending Approvals */}
          {salesLoading ? (
            <div
              style={{
                color: "#666",
                fontSize: 13,
                textAlign: "center",
                padding: 20,
              }}
            >
              Loading sales...
            </div>
          ) : (
            <>
              {pendingApprovals.length > 0 && (
                <div style={S.formCard}>
                  <div style={S.formTitle}>Pending Approvals</div>
                  {pendingApprovals.map((p) => (
                    <div
                      key={p.proposalId || p.plotId}
                      style={{
                        background: "#1a1a1a",
                        border: "1px solid #333",
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 8,
                        fontSize: 13,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <code style={{ color: "#a78bfa" }}>
                            {p.proposalId || p.plotId}
                          </code>{" "}
                          <span style={{ color: "#888" }}>
                            {p.plotId} — Seller: {p.seller} → Buyer: {p.buyer} —
                            Rs.{p.price}
                          </span>
                        </div>
                      </div>
                      <div
                        style={{ marginTop: 8, color: "#777", fontSize: 11 }}
                      >
                        Approvals:{" "}
                        {p.approvals
                          ? Object.entries(p.approvals)
                              .map(([k, v]) => `${k}: ${v ? "✅" : "⏳"}`)
                              .join("  ")
                          : "None yet"}
                      </div>
                      {hasAnyRole("official", "malpot") && (
                        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                          <button
                            style={{ ...S.btn, ...S.btnPrimary, ...S.btnSmall }}
                            onClick={() =>
                              handleSaleAction(
                                "approve-sale",
                                p.proposalId || p.plotId,
                              )
                            }
                          >
                            Approve
                          </button>
                          <button
                            style={{ ...S.btn, ...S.btnDanger, ...S.btnSmall }}
                            onClick={() =>
                              handleSaleAction(
                                "reject-sale",
                                p.proposalId || p.plotId,
                              )
                            }
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* My Sale Proposals */}
              {sales.length > 0 && (
                <div style={S.formCard}>
                  <div style={S.formTitle}>My Sale Proposals</div>
                  {sales.map((p) => (
                    <div
                      key={p.proposalId || p.plotId}
                      style={{
                        background: "#1a1a1a",
                        border: "1px solid #333",
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 8,
                        fontSize: 13,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <code style={{ color: "#a78bfa" }}>
                            {p.proposalId || p.plotId}
                          </code>{" "}
                          <span style={{ color: "#888" }}>
                            {p.plotId} — {p.seller} → {p.buyer} — Rs.{p.price}
                          </span>
                        </div>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background:
                              p.status === "approved"
                                ? "#16a34a33"
                                : p.status === "rejected"
                                  ? "#dc262633"
                                  : "#f59e0b33",
                            color:
                              p.status === "approved"
                                ? "#86efac"
                                : p.status === "rejected"
                                  ? "#fca5a5"
                                  : "#fde68a",
                          }}
                        >
                          {p.status || "pending"}
                        </span>
                      </div>
                      <div
                        style={{ marginTop: 8, color: "#777", fontSize: 11 }}
                      >
                        Approvals:{" "}
                        {p.approvals
                          ? Object.entries(p.approvals)
                              .map(([k, v]) => `${k}: ${v ? "✅" : "⏳"}`)
                              .join("  ")
                          : "None yet"}
                      </div>
                      {p.status === "approved" && (
                        <button
                          style={{
                            ...S.btn,
                            ...S.btnPrimary,
                            ...S.btnSmall,
                            marginTop: 8,
                          }}
                          onClick={() =>
                            handleSaleAction(
                              "execute-sale",
                              p.proposalId || p.plotId,
                            )
                          }
                        >
                          Execute Sale
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {pendingApprovals.length === 0 && sales.length === 0 && (
                <div
                  style={{
                    color: "#666",
                    fontSize: 13,
                    textAlign: "center",
                    padding: 20,
                  }}
                >
                  No sale proposals yet.
                </div>
              )}
            </>
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

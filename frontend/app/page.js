"use client";

import { useState, useEffect, useCallback } from "react";

// ── Styles ──────────────────────────────────────────────────────────
const S = {
  container: {
    maxWidth: 1000,
    margin: "0 auto",
    padding: "24px 16px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    flexWrap: "wrap",
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: "#7c3aed",
    margin: 0,
  },
  subtitle: {
    fontSize: 13,
    color: "#888",
    marginTop: 4,
  },
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
  dot: (color) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: color,
    display: "inline-block",
  }),
  btn: {
    padding: "8px 18px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    transition: "all 0.15s",
  },
  btnPrimary: {
    background: "#7c3aed",
    color: "#fff",
  },
  btnDanger: {
    background: "transparent",
    color: "#ef4444",
    border: "1px solid #ef4444",
  },
  btnOutline: {
    background: "transparent",
    color: "#7c3aed",
    border: "1px solid #7c3aed",
  },
  btnSmall: {
    padding: "4px 10px",
    fontSize: 12,
    borderRadius: 6,
  },
  card: {
    background: "#1a1a2e",
    borderRadius: 12,
    border: "1px solid #2a2a3e",
    overflow: "hidden",
    marginBottom: 20,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },
  th: {
    textAlign: "left",
    padding: "12px 16px",
    borderBottom: "1px solid #2a2a3e",
    color: "#888",
    fontWeight: 600,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  td: {
    padding: "10px 16px",
    borderBottom: "1px solid #1f1f35",
  },
  formCard: {
    background: "#1a1a2e",
    borderRadius: 12,
    border: "1px solid #2a2a3e",
    padding: 20,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 14,
    color: "#ccc",
  },
  input: {
    background: "#0f0f1a",
    border: "1px solid #333",
    borderRadius: 6,
    padding: "8px 12px",
    color: "#e0e0e0",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
  },
  inputGroup: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: 10,
    marginBottom: 12,
  },
  tag: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
  },
  toast: {
    position: "fixed",
    bottom: 24,
    right: 24,
    padding: "12px 20px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    zIndex: 999,
    animation: "slideUp 0.3s ease",
  },
  assetRow: {
    cursor: "pointer",
    transition: "background 0.1s",
  },
  empty: {
    textAlign: "center",
    padding: 40,
    color: "#666",
    fontSize: 14,
  },
};

// ── Color badge helper ──────────────────────────────────────────────
function colorBadge(color) {
  const map = {
    blue: "#3b82f6",
    red: "#ef4444",
    green: "#22c55e",
    yellow: "#eab308",
    orange: "#f97316",
    purple: "#a855f7",
    gold: "#f59e0b",
    silver: "#9ca3af",
    pink: "#ec4899",
  };
  return map[color] || "#666";
}

// ── Main Page ───────────────────────────────────────────────────────
export default function Home() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [selected, setSelected] = useState(null);
  const [networkStatus, setNetworkStatus] = useState("checking");

  // Form states
  const [form, setForm] = useState({
    action: "create",
    id: "",
    owner: "",
    value: "",
    color: "",
    size: "",
    newOwner: "",
  });

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/assets");
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAssets(data);
      setError(null);
      setNetworkStatus("connected");
    } catch (err) {
      setError(err.message);
      setNetworkStatus("disconnected");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
    const interval = setInterval(fetchAssets, 8000);
    return () => clearInterval(interval);
  }, [fetchAssets]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = { action: form.action };

      if (form.action === "create") {
        Object.assign(body, {
          id: form.id,
          owner: form.owner,
          value: parseInt(form.value) || 0,
          color: form.color,
          size: parseInt(form.size) || 0,
        });
      } else if (form.action === "update") {
        Object.assign(body, {
          id: form.id,
          color: form.color,
          value: parseInt(form.value) || 0,
          size: parseInt(form.size) || 0,
        });
      } else if (form.action === "delete") {
        body.id = form.id;
      } else if (form.action === "transfer") {
        body.id = form.id;
        body.newOwner = form.newOwner;
      } else if (form.action === "init") {
        // no extra fields
      }

      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.error) {
        showToast(data.error, false);
      } else if (data.success === false) {
        showToast(data.error || "Transaction failed", false);
      } else {
        showToast(`${form.action} successful!`);
        setForm({ ...form, id: "", owner: "", value: "", color: "", size: "", newOwner: "" });
        setSelected(null);
        setTimeout(fetchAssets, 1500); // wait for commit
      }
    } catch (err) {
      showToast(err.message, false);
    }
  };

  const selectAsset = (asset) => {
    setSelected(asset);
    setForm({
      ...form,
      action: "update",
      id: asset.id,
      owner: asset.owner,
      value: String(asset.value),
      color: asset.color,
      size: String(asset.size),
      newOwner: "",
    });
  };

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>NDHACK Explorer</h1>
          <p style={S.subtitle}>Hyperledger Fabric Asset Manager</p>
        </div>
        <div style={S.status}>
          <span style={S.dot(networkStatus === "connected" ? "#22c55e" : "#ef4444")} />
          {networkStatus === "connected" ? "Connected" : "Disconnected"}
          <span style={{ color: "#555", marginLeft: 8 }}>
            {assets.length} assets
          </span>
        </div>
      </div>

      {/* Error banner */}
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

      {/* Assets Table */}
      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>ID</th>
              <th style={S.th}>Owner</th>
              <th style={S.th}>Value</th>
              <th style={S.th}>Color</th>
              <th style={S.th}>Size</th>
              <th style={S.th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && assets.length === 0 ? (
              <tr>
                <td colSpan={6} style={S.empty}>
                  Loading assets...
                </td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={6} style={S.empty}>
                  No assets on ledger. Initialize or create one below.
                </td>
              </tr>
            ) : (
              assets.map((a) => (
                <tr
                  key={a.id}
                  style={{
                    ...S.assetRow,
                    background: selected?.id === a.id ? "#252540" : "transparent",
                  }}
                  onClick={() => selectAsset(a)}
                >
                  <td style={S.td}>
                    <code style={{ color: "#a78bfa" }}>{a.id}</code>
                  </td>
                  <td style={S.td}>{a.owner}</td>
                  <td style={S.td}>{a.value}</td>
                  <td style={S.td}>
                    <span
                      style={{
                        ...S.tag,
                        background: colorBadge(a.color) + "22",
                        color: colorBadge(a.color),
                      }}
                    >
                      {a.color}
                    </span>
                  </td>
                  <td style={S.td}>{a.size}</td>
                  <td style={S.td}>
                    <button
                      style={{ ...S.btn, ...S.btnDanger, ...S.btnSmall }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setForm({ ...form, action: "delete", id: a.id });
                        document.querySelector("form")?.requestSubmit();
                      }}
                    >
                      Del
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Action Forms */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Init Ledger */}
        <div style={S.formCard}>
          <div style={S.formTitle}>Initialize Ledger</div>
          <p style={{ fontSize: 12, color: "#777", marginBottom: 12 }}>
            Seeds the ledger with 4 sample assets. Only works on an empty
            ledger.
          </p>
          <button
            style={{ ...S.btn, ...S.btnPrimary }}
            onClick={() => {
              setForm({ ...form, action: "init" });
              setTimeout(() => document.querySelector("form")?.requestSubmit(), 50);
            }}
          >
            Init Ledger
          </button>
        </div>

        {/* Quick Transfer */}
        <div style={S.formCard}>
          <div style={S.formTitle}>Quick Transfer</div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setForm({ ...form, action: "transfer" });
              setTimeout(() => e.target.requestSubmit(), 50);
            }}
          >
            <div style={S.inputGroup}>
              <input
                style={S.input}
                placeholder="Asset ID"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
              />
              <input
                style={S.input}
                placeholder="New Owner"
                value={form.newOwner}
                onChange={(e) => setForm({ ...form, newOwner: e.target.value })}
              />
            </div>
            <button style={{ ...S.btn, ...S.btnOutline }}>Transfer</button>
          </form>
        </div>
      </div>

      {/* Create / Update Form */}
      <div style={{ ...S.formCard, marginTop: 16 }}>
        <div style={S.formTitle}>
          {form.action === "update" && selected
            ? `Update: ${selected.id}`
            : "Create New Asset"}
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              style={{
                ...S.btn,
                ...(form.action === "create" ? S.btnPrimary : S.btnOutline),
                ...S.btnSmall,
              }}
              onClick={() => setForm({ ...form, action: "create", id: "", owner: "", value: "", color: "", size: "" })}
            >
              Create
            </button>
            <button
              type="button"
              style={{
                ...S.btn,
                ...(form.action === "update" ? S.btnPrimary : S.btnOutline),
                ...S.btnSmall,
              }}
              onClick={() => {
                if (selected) selectAsset(selected);
                else setForm({ ...form, action: "update" });
              }}
            >
              Update
            </button>
          </div>

          <div style={S.inputGroup}>
            <input
              style={S.input}
              placeholder="Asset ID *"
              value={form.id}
              disabled={form.action === "update" && !!selected}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
            />
            <input
              style={S.input}
              placeholder="Owner *"
              value={form.owner}
              onChange={(e) => setForm({ ...form, owner: e.target.value })}
            />
            <input
              style={S.input}
              placeholder="Value"
              type="number"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
            <input
              style={S.input}
              placeholder="Color"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
            <input
              style={S.input}
              placeholder="Size"
              type="number"
              value={form.size}
              onChange={(e) => setForm({ ...form, size: e.target.value })}
            />
          </div>

          <button
            style={{ ...S.btn, ...S.btnPrimary }}
            disabled={!form.id || (form.action === "create" && !form.owner)}
          >
            {form.action === "create"
              ? "Create Asset"
              : form.action === "update"
              ? "Update Asset"
              : "Submit"}
          </button>
        </form>
      </div>

      {/* Toast */}
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
        input:focus {
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

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getToken, clearToken, authHeaders, getUserInfo } from "@/lib/auth.js";
import { Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600"],
  variable: "--font-poppins",
});
// ── Badge ────────────────────────────────────────────────────────────
function Badge({ status }) {
  const m = {
    active: "bg-[#DAFBE1] text-[#1A7F37] border border-[#4AC26B]",
    listed: "bg-[#FEF5D1] text-[#9A6700] border border-[#D4A72C]",
    sold: "bg-[#F2EAFF] text-[#653CAD] border border-[#A881F4]",
    pending: "bg-[#DDF4FF] text-[#0969DA] border border-[#54AEFF]",
    completed: "bg-[#DAFBE1] text-[#1A7F37] border border-[#4AC26B]",
    cancelled: "bg-[#FFEBEB] text-[#CF222E] border border-[#FFC1C1]",
    pending_buyer_confirm: "bg-[#FEF5D1] text-[#9A6700] border border-[#D4A72C]",
    pending_admin: "bg-[#F2EAFF] text-[#653CAD] border border-[#A881F4]",
    rejected: "bg-[#FFEBEB] text-[#CF222E] border border-[#FFC1C1]",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium tracking-wide capitalize ${m[status] || "bg-[#F6F8FA] text-[#57606A] border border-[#D0D7DE]"}`}
    >
      {status?.replace(/_/g, " ")}
    </span>
  );
}

function cn(name) {
  return name || "—";
}

// ── Design tokens ────────────────────────────────────────────────────
// Colors:
//   Surface:   #0C0E12  (page bg)
//   Panel:     #13161C  (card bg)
//   Raised:    #1A1E26  (input / inner panel bg)
//   Border:    #252B36  (default border)
//   Divider:   #1E2330  (table row divider)
//   Accent:    #3B5BDB  (primary action — civic blue, not purple)
//   AccentHov: #2F4AC4
//   Text/1:    #E6EDF3  (primary text)
//   Text/2:    #8B949E  (secondary / labels)
//   Text/3:    #484F58  (meta / timestamps)
//   Mono:      system monospace (blockchain data only)
const btn = "px-4 py-1.5 rounded text-sm font-medium border-none cursor-pointer transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed";
const btnPri = "bg-[#3B5BDB] text-white hover:bg-[#2F4AC4]";
const btnSuc = "bg-[#DAFBE1] text-[#1A7F37] border border-[#4AC26B] hover:bg-[#CFEAD4]";
const btnDng = "bg-[#FFEBEB] text-[#CF222E] border border-[#FFC1C1] hover:bg-[#FADBD8]";
const btnWrn = "bg-[#FEF5D1] text-[#9A6700] border border-[#D4A72C] hover:bg-[#F3E5AB]";
const btnOut = "bg-transparent text-[#3B5BDB] border border-[#3B5BDB] hover:bg-[#3B5BDB0A]";
const btnSm = "px-2.5 py-1 text-[11px] rounded";

const card = "bg-[#FFFFFF] rounded-lg border border-[#D0D7DE] overflow-hidden mb-5";
const fc = "bg-[#FFFFFF] rounded-lg border border-[#D0D7DE] p-5 mb-4";
const inp = "w-full bg-[#F6F8FA] border border-[#D0D7DE] rounded px-3 py-1.5 text-[13px] text-[#24292F] placeholder-[#8C95A0] focus:outline-none focus:border-[#3B5BDB] focus:bg-[#FFFFFF] transition-colors";
const sel = "w-full bg-[#F6F8FA] border border-[#D0D7DE] rounded px-3 py-1.5 text-[13px] text-[#24292F] focus:outline-none focus:border-[#3B5BDB] focus:bg-[#FFFFFF] transition-colors";

// Table primitives
const th = "text-left px-4 py-2.5 border-b border-[#D0D7DE] text-[11px] font-semibold text-[#57606A] uppercase tracking-wider whitespace-nowrap";
const td = "px-4 py-2.5 border-b border-[#F0F2F5] text-[13px] text-[#24292F]";
const tdMono = "px-4 py-2.5 border-b border-[#F0F2F5] text-[13px] font-mono text-[#24292F]";

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState("lands");
  const [u, setU] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  const [lands, setLands] = useState([]);
  const [listings, setListings] = useState([]);
  const [offers, setOffers] = useState([]);
  const [txs, setTxs] = useState([]);
  const [pendingTxs, setPendingTxs] = useState([]);
  const [offersForLand, setOffersForLand] = useState([]);
  const [sel, setSel] = useState(null);
  const [explorer, setExplorer] = useState(null);
  const [offerPrices, setOfferPrices] = useState({});

  // Form
  const [f, setF] = useState({
    plotId: "",
    owner: "",
    location: "",
    area: "",
    landId: "",
    price: "",
    offeredPrice: "",
    offerId: "",
    txId: "",
  });

  const admin = u?.role === "admin" || u?.role === "superadmin";
  const superAdmin = u?.role === "superadmin";

  const t = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!getToken()) router.replace("/login");
    const info = getUserInfo();
    if (info) setU(info);
  }, [router]);

  const apiGet = useCallback(
    async (url) => {
      try {
        const res = await fetch(url, { headers: authHeaders() });
        if (res.status === 401) {
          clearToken();
          router.replace("/login");
          return null;
        }
        if (!res.ok) {
          const d = await res.json();
          if (
            d.error &&
            (d.error.includes("caller identity") ||
              d.error.includes("identity required"))
          ) {
            clearToken();
            router.replace("/login");
            return null;
          }
          throw new Error(d.error || "API error");
        }
        const data = await res.json();
        setConnected(true);
        return data;
      } catch (e) {
        setConnected(false);
        t(e.message, false);
        return null;
      }
    },
    [router],
  );

  const apiPost = useCallback(
    async (action, body = {}) => {
      try {
        const res = await fetch("/api/land", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ action, ...body }),
        });
        if (res.status === 401) {
          clearToken();
          router.replace("/login");
          return null;
        }
        const data = await res.json();
        if (data.error) {
          if (
            data.error.includes("caller identity") ||
            data.error.includes("identity required")
          ) {
            clearToken();
            router.replace("/login");
            return null;
          }
          t(data.error, false);
          return null;
        }
        t(`${action} successful!`);
        return data;
      } catch (e) {
        t(e.message, false);
        return null;
      }
    },
    [router],
  );

  const fl = useCallback(async () => {
    const url = admin ? "/api/land" : "/api/land?action=my-lands";
    const d = await apiGet(url);
    if (d !== null) setLands(Array.isArray(d) ? d : []);
  }, [apiGet, admin]);
  const fls = useCallback(async () => {
    const d = await apiGet("/api/land?action=listings");
    if (d !== null) setListings(Array.isArray(d) ? d : []);
  }, [apiGet]);
  const fo = useCallback(async () => {
    const d = await apiGet("/api/land?action=my-offers");
    if (d !== null) setOffers(Array.isArray(d) ? d : []);
  }, [apiGet]);
  const ft = useCallback(async () => {
    const d = await apiGet("/api/land?action=my-transactions");
    if (d !== null) setTxs(Array.isArray(d) ? d : []);
  }, [apiGet]);
  const fpt = useCallback(async () => {
    const d = await apiGet("/api/land?action=pending-transactions");
    if (d !== null) setPendingTxs(Array.isArray(d) ? d : []);
  }, [apiGet]);

  const fe = useCallback(async () => {
    const d = await apiGet("/api/land?action=explorer&blocks=20");
    if (d !== null) setExplorer(d);
  }, [apiGet]);

  useEffect(() => {
    setLoading(true);
    const calls = [fl(), fls(), fo(), ft()];
    if (admin) calls.push(fpt());
    Promise.all(calls).finally(() => setLoading(false));
  }, [fl, fls, fo, ft, fpt, admin]);

  useEffect(() => {
    if (view === "lands") fl();
    if (view === "listings") fls();
    if (view === "offers") fo();
    if (view === "transactions") {
      ft();
      if (admin) fpt();
    }
    if (view === "explorer") fe();
  }, [view, fl, fls, fo, ft, fpt, admin, fe]);

  // Poll for data every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fl();
      fls();
      fo();
      ft();
      if (admin) fpt();
    }, 8000);
    return () => clearInterval(interval);
  }, [fl, fls, fo, ft, fpt, admin]);

  const act = async (action, body, ...refresh) => {
    const r = await apiPost(action, body);
    if (r !== null) {
      if (refresh.includes("l")) fl();
      if (refresh.includes("ls")) fls();
      if (refresh.includes("o")) fo();
      if (refresh.includes("t")) {
        ft();
        if (admin) fpt();
      }
    }
    return r;
  };

  return (
    <div className={`${poppins.variable} font-[family-name:var(--font-poppins)] min-h-screen bg-[#E6EDF3]`}>

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="bg-[#FFFFFF] border-b border-[#D0D7DE] sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-6 h-14 flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Registry mark — a simple civic device, no emoji */}
            <img src="/images/logo.png" alt="Land Registry" className="h-8" />
            <div>
              {/* <span className="hidden sm:inline text-[11px] text-[#57606A] ml-2 font-normal">
                Hyperledger Fabric
              </span> */}
            </div>
          </div>

          {/* Status + user + logout */}
          <div className="flex items-center gap-3">
            {/* Network status */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded bg-[#F6F8FA] border border-[#D0D7DE]">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${connected ? "bg-[#1A7F37]" : "bg-[#CF222E]"}`}
              />
              <span className="text-[11px] text-[#57606A]">
                {connected ? "Connected" : "Disconnected"}
              </span>
              <span className="text-[11px] text-[#8C95A0] border-l border-[#D0D7DE] pl-2 ml-1">
                {lands.length} plots
              </span>
            </div>

            {u && (
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[#57606A] hidden md:block">{u.name}</span>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${admin
                    ? "bg-[#DDF4FF] text-[#0969DA] border border-[#54AEFF]"
                    : "bg-[#DAFBE1] text-[#1A7F37] border border-[#4AC26B]"
                    }`}
                >
                  {u.role}
                </span>
              </div>
            )}

            <button
              onClick={() => {
                clearToken();
                router.replace("/login");
              }}
              className="text-[11px] text-[#24292F] border border-[#D0D7DE] hover:border-[#8C95A0] px-3 py-1.5 rounded bg-[#F6F8FA] hover:bg-[#F3F4F6] cursor-pointer transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── Page shell ──────────────────────────────────────────────── */}
      <div className="max-w-[1280px] mx-auto px-6 pt-6 pb-12">

        {/* Page title row */}
        <div className="mb-6">
          <p className="text-[11px] text-[#57606A] uppercase tracking-wider mb-1 font-medium">
            {superAdmin ? "Super Administrator" : admin ? "Administrator" : "Customer"} Dashboard
          </p>
          <h1 className="text-base font-semibold text-[#24292F]">
            {view === "lands" && "Land Records"}
            {view === "listings" && "Market Listings"}
            {view === "offers" && "Offer Management"}
            {view === "transactions" && "Transaction Ledger"}
            {view === "admin" && "Administration"}
            {view === "explorer" && "Block Explorer"}
          </h1>
        </div>

        {/* ── Navigation tabs ─────────────────────────────────────── */}
        <nav className="flex gap-1 mb-6 border-b border-[#D0D7DE] -mx-px">
          {[
            ["lands", "Land Records"],
            ["listings", "For Sale"],
            ["offers", "My Offers"],
            ["transactions", "Transactions"],
            ...(admin
              ? [
                ["admin", "Administration"],
                ["explorer", "Block Explorer"],
              ]
              : []),
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => {
                setView(k);
                setSel(null);
              }}
              className={`px-4 py-2 text-[13px] font-medium border-none cursor-pointer bg-transparent transition-colors relative -mb-px ${view === k
                ? "text-[#3B5BDB]"
                : "text-[#57606A] hover:text-[#24292F]"
                }`}
              style={view === k ? { borderBottom: "2px solid #3B5BDB" } : {}}
            >
              {label}
              {k === "transactions" && admin && pendingTxs.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#3B5BDB] text-white text-[10px] font-semibold">
                  {pendingTxs.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* ── Loading ─────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3">
            <div className="w-4 h-4 border-2 border-[#D0D7DE] border-t-[#3B5BDB] rounded-full animate-spin" />
            <span className="text-[13px] text-[#57606A]">Loading records…</span>
          </div>
        )}

        {!loading && (
          <>
            {/* ── LANDS ─────────────────────────────────────────── */}
            {view === "lands" && (
              <div className={card}>
                <div className="px-4 py-3 border-b border-[#D0D7DE] flex items-center justify-between bg-white">
                  <span className="text-sm font-medium text-[#24292F]">All Land Records</span>
                  <span className="text-[11px] text-[#57606A]">{lands.length} records</span>
                </div>
                <div className="overflow-x-auto bg-white">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={th}>Plot ID</th>
                        <th className={th}>Owner</th>
                        <th className={th}>Location</th>
                        <th className={th}>Area</th>
                        <th className={th}>Status</th>
                        <th className={th}>Listed Price</th>
                        <th className={th}>Transfers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lands.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-14 text-[#57606A] text-[13px]">
                            No land records found.
                          </td>
                        </tr>
                      ) : (
                        lands.map((l) => (
                          <tr
                            key={l.id}
                            onClick={() => setSel(sel?.id === l.id ? null : l)}
                            className={`cursor-pointer transition-colors hover:bg-[#F6F8FA] ${sel?.id === l.id ? "bg-[#F3F4F6]" : ""}`}
                          >
                            <td className={tdMono}>
                              <span className="text-[#0969DA] font-medium">{l.id}</span>
                            </td>
                            <td className={`${td} text-[#57606A]`}>{cn(l.owner)}</td>
                            <td className={`${td} text-[#24292F]`}>{l.location}</td>
                            <td className={`${td} font-mono text-[#57606A]`}>{l.area} m²</td>
                            <td className={td}>
                              <Badge status={l.status} />
                            </td>
                            <td className={`${td} font-mono text-[#24292F]`}>
                              {l.price ? `Rs. ${l.price}` : <span className="text-[#8C95A0]">—</span>}
                            </td>
                            <td className={`${td} text-[#57606A] font-mono`}>{l.transferCount || 0}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Expanded detail panel */}
                {sel && (
                  <div className="border-t border-[#D0D7DE] bg-[#F8FAFC] px-6 py-4 animate-slide-up">
                    <p className="text-[11px] text-[#57606A] uppercase tracking-wider mb-3 font-medium">Record Detail</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3">
                      <div>
                        <p className="text-[11px] text-[#57606A] mb-0.5">Plot ID</p>
                        <p className="font-mono text-[13px] text-[#0969DA] font-medium">{sel.id}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#57606A] mb-0.5">Current Owner</p>
                        <p className="text-[13px] text-[#24292F] font-medium">{sel.owner}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#57606A] mb-0.5">Previous Owner</p>
                        <p className="text-[13px] text-[#57606A]">{sel.previousOwner || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#57606A] mb-0.5">Location</p>
                        <p className="text-[13px] text-[#24292F]">{sel.location}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#57606A] mb-0.5">Area</p>
                        <p className="font-mono text-[13px] text-[#24292F]">{sel.area} m²</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#57606A] mb-0.5">Status</p>
                        <Badge status={sel.status} />
                      </div>
                      <div>
                        <p className="text-[11px] text-[#57606A] mb-0.5">Listed Price</p>
                        <p className="font-mono text-[13px] text-[#24292F]">{sel.price ? `Rs. ${sel.price}` : "—"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#57606A] mb-0.5">Transfer Count</p>
                        <p className="font-mono text-[13px] text-[#24292F]">{sel.transferCount || 0}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#57606A] mb-0.5">Registered</p>
                        <p className="font-mono text-[13px] text-[#57606A]">{sel.registeredAt?.slice(0, 10)}</p>
                      </div>
                      {sel.lastTransfer && (
                        <div className="col-span-2 md:col-span-3">
                          <p className="text-[11px] text-[#57606A] mb-0.5">Last Sale</p>
                          <p className="text-[13px] text-[#24292F]">
                            {cn(sel.lastTransfer.from)}{" "}
                            <span className="text-[#8C95A0]">→</span>{" "}
                            {cn(sel.lastTransfer.to)}{" "}
                            <span className="font-mono text-[#57606A] ml-1 font-medium">Rs. {sel.lastTransfer.price}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── LISTINGS ──────────────────────────────────────── */}
            {view === "listings" && (
              <>
                {/* List for sale form */}
                <div className={fc}>
                  <p className="text-sm font-medium text-[#24292F] mb-4">List Your Land for Sale</p>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-3 mb-4">
                    <div>
                      <label className="text-[11px] text-[#57606A] block mb-1 font-medium">Select a parcel</label>
                      <select
                        className={sel}
                        value={f.landId}
                        onChange={(e) => setF({ ...f, landId: e.target.value })}
                      >
                        <option value="">— Choose land —</option>
                        {lands
                          .filter(
                            (l) => l.owner === u?.nid && l.status === "active",
                          )
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.id} — {l.location}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-[#57606A] block mb-1 font-medium">Asking price (Rs.)</label>
                      <input
                        className={inp}
                        placeholder="0"
                        type="number"
                        value={f.price}
                        onChange={(e) => setF({ ...f, price: e.target.value })}
                      />
                    </div>
                  </div>
                  <button
                    className={`${btn} ${btnPri}`}
                    disabled={!f.landId || !f.price}
                    onClick={() =>
                      act(
                        "list-for-sale",
                        { landId: f.landId, price: parseFloat(f.price) },
                        "l",
                        "ls",
                      ).then(() => setF({ ...f, landId: "", price: "" }))
                    }
                  >
                    List for Sale
                  </button>
                </div>

                {/* Active listings table */}
                <div className={card}>
                  <div className="px-4 py-3 border-b border-[#D0D7DE] flex items-center justify-between">
                    <span className="text-sm font-medium text-[#24292F]">Active Listings</span>
                    <span className="text-[11px] text-[#57606A]">{listings.length} listed</span>
                  </div>
                  {listings.length === 0 ? (
                    <div className="text-center py-14 text-[#57606A] text-[13px]">
                      No active listings at this time.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className={th}>Land ID</th>
                            <th className={th}>Seller</th>
                            <th className={th}>Asking Price</th>
                            <th className={th}>Status</th>
                            <th className={th}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {listings.map((l) => {
                            const isOwner = l.seller === u?.nid;
                            const myOffer = offers.find(
                              (o) =>
                                o.landId === l.landId &&
                                o.buyer === u?.nid &&
                                o.status === "pending",
                            );
                            return (
                              <tr key={l.id} className="hover:bg-[#F6F8FA] transition-colors border-b border-[#F0F2F5] last:border-none">
                                <td className={tdMono}>
                                  <span className="text-[#0969DA] font-medium">{l.landId}</span>
                                </td>
                                <td className={`${td} text-[#57606A]`}>{cn(l.seller)}</td>
                                <td className={`${td} font-mono text-[#24292F]`}>Rs. {l.price}</td>
                                <td className={td}>
                                  <Badge status={l.status} />
                                </td>
                                <td className={td}>
                                  {!isOwner && l.status === "active" && !myOffer && (
                                    <div className="flex gap-2 items-center">
                                      <input
                                        className={`${inp} w-24`}
                                        placeholder="Bid"
                                        type="number"
                                        value={offerPrices[l.landId] || ""}
                                        onChange={(e) =>
                                          setOfferPrices({
                                            ...offerPrices,
                                            [l.landId]: e.target.value,
                                          })
                                        }
                                      />
                                      <button
                                        className={`${btn} ${btnSuc} ${btnSm}`}
                                        onClick={() =>
                                          act(
                                            "make-offer",
                                            {
                                              landId: l.landId,
                                              offeredPrice:
                                                parseFloat(offerPrices[l.landId]) || l.price,
                                            },
                                            "o",
                                          )
                                        }
                                      >
                                        Place Bid
                                      </button>
                                    </div>
                                  )}
                                  {!isOwner && myOffer && (
                                    <div className="flex gap-2 items-center">
                                      <input
                                        className={`${inp} w-24`}
                                        placeholder="New price"
                                        type="number"
                                        value={
                                          offerPrices[l.landId] ?? myOffer.offeredPrice
                                        }
                                        onChange={(e) =>
                                          setOfferPrices({
                                            ...offerPrices,
                                            [l.landId]: e.target.value,
                                          })
                                        }
                                      />
                                      <button
                                        className={`${btn} ${btnWrn} ${btnSm}`}
                                        onClick={() =>
                                          act(
                                            "update-offer",
                                            {
                                              landId: l.landId,
                                              offeredPrice:
                                                parseFloat(offerPrices[l.landId]) ||
                                                myOffer.offeredPrice,
                                            },
                                            "o",
                                          )
                                        }
                                      >
                                        Update Bid
                                      </button>
                                      <span className="text-[11px] text-[#57606A] font-mono">
                                        Current: Rs. {myOffer.offeredPrice}
                                      </span>
                                    </div>
                                  )}
                                  {isOwner && l.status === "active" && (
                                    <button
                                      className={`${btn} ${btnDng} ${btnSm}`}
                                      onClick={() =>
                                        act(
                                          "cancel-listing",
                                          { landId: l.landId },
                                          "l",
                                          "ls",
                                        )
                                      }
                                    >
                                      Cancel Listing
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── OFFERS ────────────────────────────────────────── */}
            {view === "offers" && (
              <>
                {/* Incoming offers — need a landId input */}
                <div className={fc}>
                  <p className="text-sm font-medium text-[#24292F] mb-4">Offers Received on Your Land</p>
                  <div className="flex gap-3 items-end max-w-xs">
                    <div className="flex-1">
                      <label className="text-[11px] text-[#57606A] block mb-1 font-medium">Select parcel</label>
                      <select
                        className={sel}
                        value={f.landViewId}
                        onChange={(e) => {
                          setF({ ...f, landViewId: e.target.value });
                          apiGet(`/api/land?landId=${e.target.value}`).then(
                            (d) => {
                              if (d !== null) setOffersForLand(d);
                            },
                          );
                        }}
                      >
                        <option value="">— Select —</option>
                        {lands
                          .filter(
                            (l) =>
                              l.owner === u?.nid &&
                              (l.status === "listed" || l.status === "active"),
                          )
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.id}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {offersForLand.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {offersForLand.map((o) => (
                        <div
                          key={o.id}
                          className="bg-[#F8FAFC] border border-[#D0D7DE] rounded p-3"
                        >
                          <div className="flex justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="text-[11px] text-[#57606A] mb-0.5">Buyer</p>
                                <p className="text-[13px] text-[#24292F] font-medium">{cn(o.buyer)}</p>
                              </div>
                              <div>
                                <p className="text-[11px] text-[#57606A] mb-0.5">Offer</p>
                                <p className="font-mono text-[13px] text-[#24292F] font-medium">Rs. {o.offeredPrice}</p>
                              </div>
                              <Badge status={o.status} />
                            </div>
                            {o.status === "pending" && (
                              <button
                                className={`${btn} ${btnPri} ${btnSm}`}
                                onClick={() =>
                                  act(
                                    "accept-offer",
                                    { offerId: o.id },
                                    "l",
                                    "ls",
                                    "o",
                                    "t",
                                  )
                                }
                              >
                                Accept Offer
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {offersForLand.length === 0 && (
                    <p className="text-[13px] text-[#57606A] mt-3">
                      No offers received for this parcel.
                    </p>
                  )}
                </div>

                {/* My outgoing offers */}
                <div className={card}>
                  <div className="px-4 py-3 border-b border-[#D0D7DE] flex items-center justify-between">
                    <span className="text-sm font-medium text-[#24292F]">My Submitted Offers</span>
                    <span className="text-[11px] text-[#57606A]">{offers.length} offers</span>
                  </div>
                  {offers.length === 0 ? (
                    <div className="text-center py-14 text-[#57606A] text-[13px]">
                      No offers submitted yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className={th}>Land ID</th>
                            <th className={th}>Offered Price</th>
                            <th className={th}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {offers.map((o) => (
                            <tr key={o.id} className="hover:bg-[#F6F8FA] transition-colors border-b border-[#F0F2F5] last:border-none">
                              <td className={tdMono}>
                                <span className="text-[#0969DA] font-medium">{o.landId}</span>
                              </td>
                              <td className={`${td} font-mono text-[#24292F]`}>Rs. {o.offeredPrice}</td>
                              <td className={td}>
                                <Badge status={o.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── TRANSACTIONS ──────────────────────────────────── */}
            {view === "transactions" && (
              <>
                {/* Pending admin — shown for admin */}
                {admin && pendingTxs.length > 0 && (
                  <div className={fc}>
                    <p className="text-sm font-medium text-[#24292F] mb-4">
                      Pending Admin Approval
                      <span className="ml-2 text-[11px] text-[#57606A] font-normal">
                        {pendingTxs.length} awaiting
                      </span>
                    </p>
                    <div className="space-y-2">
                      {pendingTxs.map((tx) => (
                        <div
                          key={tx.id}
                          className="bg-[#F8FAFC] border border-[#D0D7DE] rounded p-3 flex justify-between items-center gap-4"
                        >
                          <div className="flex items-center gap-6">
                            <div>
                              <p className="text-[11px] text-[#57606A] mb-0.5">Land</p>
                              <p className="font-mono text-[13px] text-[#0969DA] font-medium">{tx.landId}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-[#57606A] mb-0.5">Transfer</p>
                              <p className="text-[13px] text-[#24292F]">
                                {cn(tx.seller)}{" "}
                                <span className="text-[#8C95A0]">→</span>{" "}
                                {cn(tx.buyer)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] text-[#57606A] mb-0.5">Price</p>
                              <p className="font-mono text-[13px] text-[#24292F] font-medium">Rs. {tx.price}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-[#57606A] mb-0.5">Submitted</p>
                              <p className="font-mono text-[11px] text-[#57606A]">{tx.createdAt?.slice(0, 10)}</p>
                            </div>
                          </div>
                          <button
                            className={`${btn} ${btnSuc} ${btnSm} shrink-0`}
                            onClick={() =>
                              act("admin-approve", { txId: tx.id }, "l", "ls", "t")
                            }
                          >
                            Approve Transfer
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* My transactions */}
                <div className={card}>
                  <div className="px-4 py-3 border-b border-[#D0D7DE] flex items-center justify-between">
                    <span className="text-sm font-medium text-[#24292F]">My Transactions</span>
                    <span className="text-[11px] text-[#57606A]">{txs.length} records</span>
                  </div>
                  {txs.length === 0 ? (
                    <div className="text-center py-14 text-[#57606A] text-[13px]">
                      No transactions on record.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className={th}>Land ID</th>
                            <th className={th}>Seller</th>
                            <th className={th}>Buyer</th>
                            <th className={th}>Price</th>
                            <th className={th}>Status</th>
                            <th className={th}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {txs.map((tx) => {
                            const call = u?.nid;
                            const amBuyer = tx.buyer === call;
                            const amSeller = tx.seller === call;
                            return (
                              <tr key={tx.id} className="hover:bg-[#F6F8FA] transition-colors border-b border-[#F0F2F5] last:border-none">
                                <td className={tdMono}>
                                  <span className="text-[#0969DA] font-medium">{tx.landId}</span>
                                </td>
                                <td className={`${td} text-[#57606A]`}>{cn(tx.seller)}</td>
                                <td className={`${td} text-[#57606A]`}>{cn(tx.buyer)}</td>
                                <td className={`${td} font-mono text-[#24292F]`}>Rs. {tx.price}</td>
                                <td className={td}>
                                  <Badge status={tx.status} />
                                </td>
                                <td className={td}>
                                  <div className="flex gap-2">
                                    {amBuyer && tx.status === "pending_buyer_confirm" && (
                                      <button
                                        className={`${btn} ${btnSuc} ${btnSm}`}
                                        onClick={() =>
                                          act(
                                            "confirm-transaction",
                                            { txId: tx.id },
                                            "l",
                                            "ls",
                                            "t",
                                          )
                                        }
                                      >
                                        Confirm
                                      </button>
                                    )}
                                    {(amBuyer || amSeller) &&
                                      tx.status !== "completed" &&
                                      tx.status !== "rejected" && (
                                        <button
                                          className={`${btn} ${btnDng} ${btnSm}`}
                                          onClick={() =>
                                            act(
                                              "reject-transaction",
                                              { txId: tx.id },
                                              "l",
                                              "ls",
                                              "t",
                                            )
                                          }
                                        >
                                          Reject
                                        </button>
                                      )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── ADMIN PANEL ───────────────────────────────────── */}
            {view === "admin" && admin && (
              <>
                {/* Register Land */}
                <div className={fc}>
                  <p className="text-sm font-medium text-[#24292F] mb-1">Register New Land Parcel</p>
                  <p className="text-[11px] text-[#57606A] mb-4">
                    Enter plot details below. Plot ID and owner address are required.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    <div>
                      <label className="text-[11px] text-[#57606A] block mb-1 font-medium">Plot ID *</label>
                      <input
                        className={inp}
                        placeholder="e.g. PLT-0042"
                        value={f.plotId}
                        onChange={(e) => setF({ ...f, plotId: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#57606A] block mb-1 font-medium">Owner Address *</label>
                      <input
                        className={inp}
                        placeholder="User1@org1.example.com"
                        value={f.owner}
                        onChange={(e) => setF({ ...f, owner: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#57606A] block mb-1 font-medium">Location</label>
                      <input
                        className={inp}
                        placeholder="District, Ward"
                        value={f.location}
                        onChange={(e) => setF({ ...f, location: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#57606A] block mb-1 font-medium">Area (m²)</label>
                      <input
                        className={inp}
                        placeholder="0"
                        type="number"
                        value={f.area}
                        onChange={(e) => setF({ ...f, area: e.target.value })}
                      />
                    </div>
                  </div>
                  <button
                    className={`${btn} ${btnPri}`}
                    disabled={!f.plotId || !f.owner}
                    onClick={() =>
                      act(
                        "register",
                        {
                          plotId: f.plotId,
                          owner: f.owner,
                          location: f.location,
                          area: parseFloat(f.area) || 0,
                        },
                        "l",
                      ).then(() =>
                        setF({
                          ...f,
                          plotId: "",
                          owner: "",
                          location: "",
                          area: "",
                        }),
                      )
                    }
                  >
                    Register Land
                  </button>
                </div>

                {/* Pending admin transactions */}
                <div className={card}>
                  <div className="px-4 py-3 border-b border-[#D0D7DE] flex items-center justify-between">
                    <span className="text-sm font-medium text-[#24292F]">Pending Approvals</span>
                    {pendingTxs.length > 0 && (
                      <span className="text-[11px] text-[#9A6700] font-medium">
                        {pendingTxs.length} waiting
                      </span>
                    )}
                  </div>
                  {pendingTxs.length === 0 ? (
                    <div className="text-center py-14 text-[#57606A] text-[13px]">
                      No pending approvals.
                    </div>
                  ) : (
                    pendingTxs.map((tx) => (
                      <div
                        key={tx.id}
                        className="px-4 py-3 border-b border-[#F0F2F5] flex justify-between items-center gap-4 last:border-b-0 hover:bg-[#F6F8FA] transition-colors"
                      >
                        <div className="flex items-center gap-6">
                          <div>
                            <p className="text-[11px] text-[#57606A] mb-0.5">Land</p>
                            <p className="font-mono text-[13px] text-[#0969DA] font-medium">{tx.landId}</p>
                          </div>
                          <div>
                            <p className="text-[11px] text-[#57606A] mb-0.5">Transfer</p>
                            <p className="text-[13px] text-[#24292F]">
                              {cn(tx.seller)}{" "}
                              <span className="text-[#8C95A0]">→</span>{" "}
                              {cn(tx.buyer)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-[#57606A] mb-0.5">Value</p>
                            <p className="font-mono text-[13px] text-[#24292F] font-medium">Rs. {tx.price}</p>
                          </div>
                          <p className="font-mono text-[11px] text-[#57606A] hidden md:block">
                            {tx.createdAt?.slice(0, 10)}
                          </p>
                        </div>
                        <button
                          className={`${btn} ${btnSuc} ${btnSm} shrink-0`}
                          onClick={() =>
                            act("admin-approve", { txId: tx.id }, "l", "ls", "t")
                          }
                        >
                          Approve
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* ── BLOCK EXPLORER ────────────────────────────────── */}
            {view === "explorer" && admin && explorer && (
              <div className={card}>
                <div className="px-4 py-3 border-b border-[#D0D7DE] flex items-center justify-between">
                  <span className="text-sm font-medium text-[#24292F]">Block Explorer</span>
                  <span className="font-mono text-[11px] text-[#57606A]">
                    Height: {explorer.height}
                  </span>
                </div>
                {explorer.blocks?.length > 0 ? (
                  /* Horizontally scrollable container */
                  <div className="flex items-stretch gap-0 p-4 overflow-x-auto scrollbar-thin scrollbar-thumb-[#D0D7DE] scrollbar-track-transparent">
                    {[...explorer.blocks].map((b, index) => (
                      <div key={b.number} className="flex items-center">
                        {/* Main Block Card */}
                        <div className="w-[320px] md:w-[380px] shrink-0 bg-[#FAFAFA] border border-[#D0D7DE] rounded-md p-4 flex flex-col justify-between h-full min-h-[240px]">
                          <div>
                            {/* Block header */}
                            <div className="flex items-center justify-between gap-4 mb-3 pb-2 border-b border-[#F0F2F5]">
                              <span className="font-mono text-[13px] text-[#0969DA] font-semibold">
                                Block #{b.number}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-[#57606A] font-mono">
                                  {b.txCount} tx(s)
                                </span>
                                {b.timestamp && (
                                  <span className="text-[11px] text-[#57606A] font-mono">
                                    {b.timestamp.slice(0, 10)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Hashes */}
                            <div className="flex flex-col gap-1 mb-3 bg-[#F0F2F5] p-2 rounded border border-[#E1E4E8]">
                              <p className="font-mono text-[11px] text-[#57606A] truncate">
                                <span className="text-[#8C95A0]">hash </span>
                                {b.dataHash?.slice(0, 32)}…
                              </p>
                              <p className="font-mono text-[11px] text-[#57606A] truncate">
                                <span className="text-[#8C95A0]">prev </span>
                                {b.prevHash?.slice(0, 32)}…
                              </p>
                            </div>

                            {/* Transactions Wrapper */}
                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                              {b.transactions?.map((tx) => (
                                <div
                                  key={tx.txId}
                                  className="border-l border-[#D0D7DE] pl-2 py-0.5"
                                >
                                  <p className="font-mono text-[11px] text-[#3B5BDB] truncate font-medium">
                                    {tx.txId?.slice(0, 32)}…
                                  </p>
                                  {superAdmin && (
                                    <div className="mt-1 flex flex-col gap-0.5">
                                      {tx.type && (
                                        <p className="text-[10px] text-[#57606A]">
                                          <span className="text-[#8C95A0]">type </span>{tx.type}
                                        </p>
                                      )}
                                      {tx.creator && (
                                        <p className="text-[10px] text-[#57606A] truncate">
                                          <span className="text-[#8C95A0]">by </span>{tx.creator}
                                        </p>
                                      )}
                                      {tx.chaincode && (
                                        <p className="font-mono text-[10px] text-[#57606A]">
                                          <span className="text-[#8C95A0]">cc </span>{tx.chaincode}
                                        </p>
                                      )}
                                      {tx.action && (
                                        <p className="font-mono text-[10px] text-[#8C95A0] truncate">
                                          <span className="text-[#0969DA] font-medium">{tx.action}</span>
                                          {tx.args?.length > 0 && (
                                            <span className="text-[#57606A]">({tx.args.join(", ")})</span>
                                          )}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Precise timestamp at the card footer if available */}
                          {b.timestamp && (
                            <div className="mt-3 pt-2 border-t border-[#F0F2F5] text-[10px] text-[#57606A] font-mono text-right">
                              {b.timestamp.slice(11, 19)}
                            </div>
                          )}
                        </div>

                        {/* Visual horizontal chain link element (Hidden after the last item) */}
                        {index < explorer.blocks.length - 1 && (
                          <div className="flex items-center justify-center px-4 shrink-0">
                            <svg
                              className="text-[#D0D7DE]"
                              width="24"
                              height="16"
                              viewBox="0 0 24 16"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M0 8H20M20 8L14 3M20 8L14 13"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-14 text-[#57606A] text-[13px]">
                    No blocks found.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {/* ── Toast notification ────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg text-[13px] font-medium z-50 animate-slide-up border ${toast.ok
            ? "bg-[#DAFBE1] border-[#4AC26B] text-[#1A7F37]"
            : "bg-[#FFEBEB] border-[#FFC1C1] text-[#CF222E]"
            }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
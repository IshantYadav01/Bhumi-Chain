"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getToken, clearToken, authHeaders, getUserInfo } from "@/lib/auth.js";

function Badge({ status }) {
  const m = {
    active: "bg-green-900/20 text-green-400",
    listed: "bg-yellow-900/20 text-yellow-400",
    sold: "bg-purple-900/20 text-purple-300",
    pending: "bg-blue-900/20 text-blue-400",
    completed: "bg-green-900/20 text-green-400",
    cancelled: "bg-red-900/20 text-red-400",
    pending_buyer_confirm: "bg-yellow-900/20 text-yellow-400",
    pending_admin: "bg-purple-900/20 text-purple-300",
    rejected: "bg-red-900/20 text-red-400",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${m[status] || "bg-gray-800 text-gray-400"}`}
    >
      {status}
    </span>
  );
}

function cn(name) {
  return name || "—";
}

// ── Helpers ─────────────────────────────────────────────────────────
const btn = "px-4 py-2 rounded-lg text-sm font-semibold border-none";
const btnPri = "bg-[#7c3aed] text-white";
const btnSuc = "bg-green-600 text-white";
const btnDng = "bg-transparent text-red-400 border border-red-400";
const btnWrn = "bg-transparent text-yellow-400 border border-yellow-400";
const btnOut = "bg-transparent text-[#7c3aed] border border-[#7c3aed]";
const btnSm = "px-2.5 py-1 text-xs rounded-md";
const card =
  "bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] overflow-hidden mb-5";
const fc = "bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] p-5 mb-4";
const inp =
  "w-full bg-[#0f0f1a] border border-[#333] rounded-md px-3 py-1.5 text-sm text-[#e0e0e0]";
const sel =
  "w-full bg-[#0f0f1a] border border-[#333] rounded-md px-3 py-1.5 text-sm text-[#e0e0e0]";

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

  const admin = u?.role === "admin";

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
    <div className="max-w-[1200px] mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#7c3aed] m-0">
            Land Registry
          </h1>
          <p className="text-xs text-[#888] mt-1">
            {admin ? "Admin" : "Customer"} Dashboard
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs bg-[#1a1a2e] px-3.5 py-1.5 rounded-full border border-[#333]">
            <span
              className={`w-2 h-2 rounded-full inline-block ${connected ? "bg-green-500" : "bg-red-500"}`}
            />
            {connected ? "Connected" : "Disconnected"}
            <span className="text-[#555] ml-2">{lands.length} plots</span>
          </div>
          {u && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#aaa]">{u.name}</span>
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${admin ? "bg-[#7c3aed33] text-[#7c3aed]" : "bg-green-900/20 text-green-400"}`}
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
            className="text-xs bg-transparent border border-[#555] text-[#aaa] px-3.5 py-1.5 rounded-md cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {[
          ["lands", "All Lands"],
          ["listings", "For Sale"],
          ["offers", "My Offers"],
          ["transactions", "Transactions"],
          ...(admin
            ? [
                ["admin", "Admin"],
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
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold border-none cursor-pointer transition-all ${view === k ? "bg-[#7c3aed] text-white" : "bg-transparent text-[#888]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-10 text-[#666]">Loading...</div>
      )}

      {!loading && (
        <>
          {/* ── LANDS ── */}
          {view === "lands" && (
            <div className={card}>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="text-[#888] font-semibold text-[11px] uppercase tracking-wider">
                    <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]">
                      ID
                    </th>
                    <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]">
                      Owner
                    </th>
                    <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]">
                      Location
                    </th>
                    <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]">
                      Area
                    </th>
                    <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]">
                      Status
                    </th>
                    <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]">
                      Price
                    </th>
                    <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]">
                      Transfers
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lands.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-[#666]">
                        No land records.
                      </td>
                    </tr>
                  ) : (
                    lands.map((l) => (
                      <tr
                        key={l.id}
                        onClick={() => setSel(l)}
                        className={`cursor-pointer ${sel?.id === l.id ? "bg-[#252540]" : ""}`}
                      >
                        <td className="px-3.5 py-2.5 border-b border-[#1f1f35]">
                          <code className="text-[#a78bfa]">{l.id}</code>
                        </td>
                        <td className="px-3.5 py-2.5 border-b border-[#1f1f35]">
                          {cn(l.owner)}
                        </td>
                        <td className="px-3.5 py-2.5 border-b border-[#1f1f35]">
                          {l.location}
                        </td>
                        <td className="px-3.5 py-2.5 border-b border-[#1f1f35]">
                          {l.area} m²
                        </td>
                        <td className="px-3.5 py-2.5 border-b border-[#1f1f35]}">
                          <Badge status={l.status} />
                        </td>
                        <td className="px-3.5 py-2.5 border-b border-[#1f1f35]">
                          {l.price ? `Rs.${l.price}` : "—"}
                        </td>
                        <td className="px-3.5 py-2.5 border-b border-[#1f1f35]">
                          {l.transferCount || 0}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {sel && (
                <div className="p-4 border-t border-[#2a2a3e] text-xs animate-slide-up">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[#888]">ID:</span> {sel.id}
                    </div>
                    <div>
                      <span className="text-[#888]">Owner:</span> {sel.owner}
                    </div>
                    <div>
                      <span className="text-[#888]">Previous:</span>{" "}
                      {sel.previousOwner || "—"}
                    </div>
                    <div>
                      <span className="text-[#888]">Location:</span>{" "}
                      {sel.location}
                    </div>
                    <div>
                      <span className="text-[#888]">Area:</span> {sel.area} m²
                    </div>
                    <div>
                      <span className="text-[#888]">Status:</span>{" "}
                      <Badge status={sel.status} />
                    </div>
                    <div>
                      <span className="text-[#888]">Price:</span>{" "}
                      {sel.price ? `Rs.${sel.price}` : "—"}
                    </div>
                    <div>
                      <span className="text-[#888]">Transfers:</span>{" "}
                      {sel.transferCount || 0}
                    </div>
                    <div>
                      <span className="text-[#888]">Registered:</span>{" "}
                      {sel.registeredAt?.slice(0, 10)}
                    </div>
                    {sel.lastTransfer && (
                      <div className="col-span-3">
                        <span className="text-[#888]">Last Sale:</span>{" "}
                        {cn(sel.lastTransfer.from)} → {cn(sel.lastTransfer.to)}{" "}
                        (Rs.{sel.lastTransfer.price})
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── LISTINGS ── */}
          {view === "listings" && (
            <>
              {/* List for sale form */}
              <div className={fc}>
                <div className="text-sm font-semibold text-[#ccc] mb-3">
                  List Your Land for Sale
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 mb-2.5">
                  <select
                    className={sel}
                    value={f.landId}
                    onChange={(e) => setF({ ...f, landId: e.target.value })}
                  >
                    <option value="">-- Select your land --</option>
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
                  <input
                    className={inp}
                    placeholder="Price (Rs.)"
                    type="number"
                    value={f.price}
                    onChange={(e) => setF({ ...f, price: e.target.value })}
                  />
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

              {/* Active listings */}
              <div className={card}>
                <div className="px-4 py-3 border-b border-[#2a2a3e] text-sm font-semibold text-[#ccc]">
                  Active Listings
                </div>
                {listings.length === 0 ? (
                  <div className="text-center py-10 text-[#666] text-xs">
                    No active listings.
                  </div>
                ) : (
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="text-[#888] font-semibold text-[11px] uppercase tracking-wider">
                        <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]">
                          Land
                        </th>
                        <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]">
                          Seller
                        </th>
                        <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]">
                          Price
                        </th>
                        <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]">
                          Status
                        </th>
                        <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]"></th>
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
                          <tr key={l.id}>
                            <td className="px-3.5 py-2.5 border-b border-[#1f1f35]">
                              <code className="text-[#a78bfa]">{l.landId}</code>
                            </td>
                            <td className="px-3.5 py-2.5 border-b border-[#1f1f35]">
                              {cn(l.seller)}
                            </td>
                            <td className="px-3.5 py-2.5 border-b border-[#1f1f35]">
                              Rs.{l.price}
                            </td>
                            <td className="px-3.5 py-2.5 border-b border-[#1f1f35]}">
                              <Badge status={l.status} />
                            </td>
                            <td className="px-3.5 py-2.5 border-b border-[#1f1f35]">
                              {!isOwner &&
                                l.status === "active" &&
                                !myOffer && (
                                  <div className="flex gap-1 items-center">
                                    <input
                                      className={`${inp} w-20`}
                                      placeholder="Price"
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
                                              parseFloat(
                                                offerPrices[l.landId],
                                              ) || l.price,
                                          },
                                          "o",
                                        )
                                      }
                                    >
                                      Bid
                                    </button>
                                  </div>
                                )}
                              {!isOwner && myOffer && (
                                <div className="flex gap-1 items-center">
                                  <input
                                    className={`${inp} w-20`}
                                    placeholder="New price"
                                    type="number"
                                    value={
                                      offerPrices[l.landId] ??
                                      myOffer.offeredPrice
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
                                    Edit Bid
                                  </button>
                                  <span className="text-[10px] text-[#666]">
                                    Current: Rs.{myOffer.offeredPrice}
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
                                  Cancel
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* ── OFFERS ── */}
          {view === "offers" && (
            <>
              {/* Incoming offers — need a landId input */}
              <div className={fc}>
                <div className="text-sm font-semibold text-[#ccc] mb-3">
                  View Offers for Your Land
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-[11px] text-[#888] block mb-1">
                      Land ID
                    </label>
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
                      <option value="">-- Select --</option>
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
                  <div className="mt-3 space-y-2">
                    {offersForLand.map((o) => (
                      <div
                        key={o.id}
                        className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-xs"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-[#888]">Buyer:</span>{" "}
                            {cn(o.buyer)} &nbsp;
                            <span className="text-[#888]">Offer:</span> Rs.
                            {o.offeredPrice} &nbsp;
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
                              Accept
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {offersForLand.length === 0 && (
                  <div className="text-xs text-[#666] mt-2">
                    No offers for this land.
                  </div>
                )}
              </div>

              {/* My outgoing offers */}
              <div className={card}>
                <div className="px-4 py-3 border-b border-[#2a2a3e] text-sm font-semibold text-[#ccc]">
                  My Offers
                </div>
                {offers.length === 0 ? (
                  <div className="text-center py-10 text-[#666] text-xs">
                    No offers made yet.
                  </div>
                ) : (
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="text-[#888] font-semibold text-[11px] uppercase tracking-wider">
                        <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]">
                          Land
                        </th>
                        <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]">
                          Offered
                        </th>
                        <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {offers.map((o) => (
                        <tr key={o.id}>
                          <td className="px-3.5 py-2.5 border-b border-[#1f1f35]">
                            <code className="text-[#a78bfa]">{o.landId}</code>
                          </td>
                          <td className="px-3.5 py-2.5 border-b border-[#1f1f35]">
                            Rs.{o.offeredPrice}
                          </td>
                          <td className="px-3.5 py-2.5 border-b border-[#1f1f35]}">
                            <Badge status={o.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* ── TRANSACTIONS ── */}
          {view === "transactions" && (
            <>
              {/* Pending admin — shown in Admin tab AND here for admin */}
              {admin && pendingTxs.length > 0 && (
                <div className={fc}>
                  <div className="text-sm font-semibold text-[#ccc] mb-3">
                    Pending Admin Approval
                  </div>
                  {pendingTxs.map((tx) => (
                    <div
                      key={tx.id}
                      className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-xs mb-2 flex justify-between items-center"
                    >
                      <div>
                        <code className="text-[#a78bfa]">{tx.landId}</code>
                        <span className="text-[#888] ml-2">
                          {cn(tx.seller)} → {cn(tx.buyer)} — Rs.{tx.price}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Badge status={tx.status} />
                        <button
                          className={`${btn} ${btnSuc} ${btnSm}`}
                          onClick={() =>
                            act(
                              "admin-approve",
                              { txId: tx.id },
                              "l",
                              "ls",
                              "t",
                            )
                          }
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* My transactions */}
              <div className={card}>
                <div className="px-4 py-3 border-b border-[#2a2a3e] text-sm font-semibold text-[#ccc]">
                  My Transactions
                </div>
                {txs.length === 0 ? (
                  <div className="text-center py-10 text-[#666] text-xs">
                    No transactions.
                  </div>
                ) : (
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="text-[#888] font-semibold text-[11px] uppercase tracking-wider">
                        <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]">
                          Land
                        </th>
                        <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]">
                          Seller
                        </th>
                        <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]">
                          Buyer
                        </th>
                        <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]">
                          Price
                        </th>
                        <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]">
                          Status
                        </th>
                        <th className="text-left px-3.5 py-2.5 border-b border-[#2a2a3e]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {txs.map((tx) => {
                        const call = u?.nid;
                        const amBuyer = tx.buyer === call;
                        const amSeller = tx.seller === call;
                        return (
                          <tr key={tx.id}>
                            <td className="px-3.5 py-2.5 border-b border-[#1f1f35]">
                              <code className="text-[#a78bfa]">
                                {tx.landId}
                              </code>
                            </td>
                            <td className="px-3.5 py-2.5 border-b border-[#1f1f35]">
                              {cn(tx.seller)}
                            </td>
                            <td className="px-3.5 py-2.5 border-b border-[#1f1f35]">
                              {cn(tx.buyer)}
                            </td>
                            <td className="px-3.5 py-2.5 border-b border-[#1f1f35]">
                              Rs.{tx.price}
                            </td>
                            <td className="px-3.5 py-2.5 border-b border-[#1f1f35]}">
                              <Badge status={tx.status} />
                            </td>
                            <td className="px-3.5 py-2.5 border-b border-[#1f1f35]">
                              {amBuyer &&
                                tx.status === "pending_buyer_confirm" && (
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
                                    className={`${btn} ${btnDng} ${btnSm} ml-1`}
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
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* ── ADMIN PANEL ── */}
          {view === "admin" && admin && (
            <>
              {/* Register Land */}
              <div className={fc}>
                <div className="text-sm font-semibold text-[#ccc] mb-3">
                  Register New Land
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 mb-2.5">
                  <input
                    className={inp}
                    placeholder="Plot ID *"
                    value={f.plotId}
                    onChange={(e) => setF({ ...f, plotId: e.target.value })}
                  />
                  <input
                    className={inp}
                    placeholder="Owner * (e.g. User1@org1.example.com)"
                    value={f.owner}
                    onChange={(e) => setF({ ...f, owner: e.target.value })}
                  />
                  <input
                    className={inp}
                    placeholder="Location"
                    value={f.location}
                    onChange={(e) => setF({ ...f, location: e.target.value })}
                  />
                  <input
                    className={inp}
                    placeholder="Area (m²)"
                    type="number"
                    value={f.area}
                    onChange={(e) => setF({ ...f, area: e.target.value })}
                  />
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
                <div className="px-4 py-3 border-b border-[#2a2a3e] text-sm font-semibold text-[#ccc]">
                  Pending Approvals{" "}
                  {pendingTxs.length > 0 && (
                    <span className="text-[#888] font-normal">
                      ({pendingTxs.length})
                    </span>
                  )}
                </div>
                {pendingTxs.length === 0 ? (
                  <div className="text-center py-10 text-[#666] text-xs">
                    No pending approvals.
                  </div>
                ) : (
                  pendingTxs.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-4 border-b border-[#1f1f35] flex justify-between items-center text-xs"
                    >
                      <div>
                        <code className="text-[#a78bfa]">{tx.landId}</code>
                        <span className="text-[#888] ml-2">
                          {cn(tx.seller)} → {cn(tx.buyer)} — Rs.{tx.price}
                        </span>
                        <div className="text-[#555] mt-1">
                          Created: {tx.createdAt?.slice(0, 10)}
                        </div>
                      </div>
                      <button
                        className={`${btn} ${btnSuc} ${btnSm}`}
                        onClick={() =>
                          act("admin-approve", { txId: tx.id }, "l", "ls", "t")
                        }
                      >
                        Approve Transfer
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* ── BLOCK EXPLORER ── */}
          {view === "explorer" && admin && explorer && (
            <div className={card}>
              <div className="px-4 py-3 border-b border-[#2a2a3e] text-sm font-semibold text-[#ccc]">
                Block Explorer — Height: {explorer.height} blocks
              </div>
              {explorer.blocks?.length > 0 ? (
                <div className="p-2">
                  {[...explorer.blocks].reverse().map((b) => (
                    <div
                      key={b.number}
                      className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 mb-2 text-xs"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-[#a78bfa]">
                          Block #{b.number}
                        </span>
                        <span className="text-[#888]">{b.txCount} tx(s)</span>
                      </div>
                      <div className="text-[#555] text-[11px] mb-1 truncate">
                        <span className="text-[#777]">Hash:</span>{" "}
                        {b.dataHash?.slice(0, 32)}...
                      </div>
                      <div className="text-[#555] text-[11px] mb-1 truncate">
                        <span className="text-[#777]">Prev:</span>{" "}
                        {b.prevHash?.slice(0, 32)}...
                      </div>
                      {b.transactions?.map((tx) => (
                        <div
                          key={tx.txId}
                          className="ml-2 text-[#555] text-[11px] truncate"
                        >
                          └{" "}
                          <code className="text-[#7c3aed]">
                            {tx.txId?.slice(0, 24)}...
                          </code>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-[#666] text-xs">
                  No blocks found.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-5 py-3 rounded-lg text-sm font-semibold z-50 animate-slide-up ${
            toast.ok
              ? "bg-green-900 border border-green-500 text-green-300"
              : "bg-red-900 border border-red-500 text-red-300"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

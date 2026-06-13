"use client";

import { useState, useEffect, useCallback } from "react";
import BlockchainMonitor from "@/components/BlockchainMonitor";
import BlockchainVisualizer from "@/components/BlockchainVisualizer";
import FilterBar from "@/components/FilterBar";
import LandTable from "@/components/LandTable";
import LandForms from "@/components/LandForms";
import SelectedLandDetails from "@/components/SelectedLandDetails";

// Helper utility to simulate cryptographic ledger hashing
const generateSimulatedHash = (id, prevHash, dataString) => {
  let combined = id + prevHash + dataString;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return "0000fx" + Math.abs(hash).toString(16).padStart(12, "f");
};

const INITIAL_GENESIS_BLOCKS = [
  {
    id: 1,
    timestamp: "11:02:14",
    txAction: "GENESIS",
    plotId: "SYSTEM_INIT",
    payloadDetails: "Root State Channel Deployed",
    prevHash: "0000000000000000000000000000000000000000000000000000000000000000",
    hash: "0000fx3a18ef22fca4",
    isTampered: false,
    backupPayload: "Root State Channel Deployed"
  },
  {
    id: 2,
    timestamp: "11:05:40",
    txAction: "register",
    plotId: "PLOT-102",
    payloadDetails: "Owner: Hari Prasad, Area: 1200",
    prevHash: "0000fx3a18ef22fca4",
    hash: "0000fx994821aaccde",
    isTampered: false,
    backupPayload: "Owner: Hari Prasad, Area: 1200"
  }
];

export default function Home() {
  const [lands, setLands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [selected, setSelected] = useState(null);
  const [networkStatus, setNetworkStatus] = useState("checking");
  const [tab, setTab] = useState("all");
  const [filterOwner, setFilterOwner] = useState("");

  const [activeTx, setActiveTx] = useState(null);
  const [simulationLogs, setSimulationLogs] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [attackStatus, setAttackStatus] = useState("idle");

  // Visual Blocks Array States
  const [blocks, setBlocks] = useState(INITIAL_GENESIS_BLOCKS);

  const [form, setForm] = useState({
    action: "register", plotId: "", surveyNumber: "", owner: "", location: "", area: "",
    landType: "residential", buyer: "", price: "", bank: "", amount: "",
    startDate: "", endDate: "", caseNumber: "", court: "", description: ""
  });

  const clearForm = () => setForm({
    action: "register", plotId: "", surveyNumber: "", owner: "", location: "", area: "",
    landType: "residential", buyer: "", price: "", bank: "", amount: "",
    startDate: "", endDate: "", caseNumber: "", court: "", description: ""
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

  // Intercept data submissions to append live nodes to the visual block stack trace
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
      
      if (data.txId) {
        setActiveTx({ id: data.txId, lifecycle: data.lifecycle, action });
        showToast(`Tx Verified & Committed! ID: ${data.txId.slice(0, 15)}...`);

        // Dynamically compute and push a new block into visual representation tracking
        setBlocks((currentBlocks) => {
          const prevBlock = currentBlocks[currentBlocks.length - 1];
          const newId = prevBlock.id + 1;
          const now = new Date();
          const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
          
          let details = `Owner: ${body.owner || body.buyer || "Internal Update"}`;
          if (action === "mortgage") details = `Bank: ${body.bank}, Amt: ${body.amount}`;
          if (action === "dispute") details = `Case: ${body.caseNumber}`;

          const computedHash = generateSimulatedHash(newId, prevBlock.hash, details);

          return [
            ...currentBlocks,
            {
              id: newId,
              timestamp,
              txAction: action,
              plotId: body.plotId || "UNKNOWN",
              payloadDetails: details,
              prevHash: prevBlock.hash,
              hash: computedHash,
              isTampered: false,
              backupPayload: details
            }
          ];
        });

      } else {
        showToast(`${action} successful!`);
      }
      setTimeout(fetchLands, 1500);
      return true;
    } catch (err) {
      showToast(err.message, false);
      return false;
    }
  };

  // Logic to execute manual block tampering
  const handleTamperBlock = (blockId, alteredValue) => {
    setBlocks((currentBlocks) =>
      currentBlocks.map((b) => {
        if (b.id === blockId) {
          // Re-evaluate current hash with modified payload data. 
          // Bypassing normal sequential integrity structures deliberately simulates a malicious update.
          const corruptedHash = generateSimulatedHash(b.id, b.prevHash, alteredValue + "-MALICIOUS-SIG");
          return {
            ...b,
            payloadDetails: alteredValue,
            hash: corruptedHash,
            isTampered: true,
          };
        }
        return b;
      })
    );
    showToast("⚠️ State database manipulation simulated! Chain broke structural consistency.", false);
  };

  // Automated network audit recovery simulation
  const handleRestoreLedger = () => {
    setBlocks((currentBlocks) =>
      currentBlocks.map((b) => ({
        ...b,
        payloadDetails: b.backupPayload,
        isTampered: false,
        // Regenerate clean hash mapping based on genuine tracking historical states
        hash: generateSimulatedHash(b.id, b.prevHash, b.backupPayload)
      }))
    );
    showToast("✅ Consensus audit complete. Restored nodes from decentralized anchors.");
  };

  const runTamperSimulation = () => {
    setIsSimulating(true);
    setAttackStatus("processing");
    setSimulationLogs([]);
    const steps = [
      { msg: "⚠️ Attacker bypassing API layer to modify local SQL Database copy directly on Malpot Peer...", delay: 500 },
      { msg: "💾 Plot state forced manually: Assigned Row 'Owner' to unauthorized identity.", delay: 1200 },
      { msg: "🔄 Client initialization request detected. Triggering Hyperledger State Consistency Audit...", delay: 2000 },
      { msg: "📡 Step 1: Broadcasting verification request to 5 Department Consensus Nodes...", delay: 2800 },
      { msg: "❌ Step 2: Read-Write Set validation failed on Peer 3. Local Hash mismatch detected against Immutable Ledger State!", delay: 3800 },
      { msg: "🛡️ Step 3: Global Consensus Engine dropped the transaction proposal. Malicious state transformation discarded.", delay: 4500 },
      { msg: "✅ Recovery Action: Auto-rolled back Peer 3 database storage to synchronized block height.", delay: 5200 }
    ];
    steps.forEach((step, index) => {
      setTimeout(() => {
        setSimulationLogs((prev) => [...prev, step.msg]);
        if (index === steps.length - 1) {
          setIsSimulating(false);
          setAttackStatus("intercepted");
          // Automatically apply visible visual breaking to highlight validation dynamics directly in visualization
          if (blocks.length > 1) {
            handleTamperBlock(blocks[blocks.length - 1].id, "Owner: Fraudulent Actor EX");
          }
        }
      }, step.delay);
    });
  };

  const selectLand = (land) => {
    setSelected(land);
    setForm({
      ...form, plotId: land.plotId, surveyNumber: land.surveyNumber,
      owner: land.owner, location: land.location, area: String(land.area), landType: land.landType,
    });
  };

  return (
    <div className="max-w-[1200px] my-0 mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-[26px] font-bold text-[#7c3aed] m-0">Land Registry Explorer</h1>
          <p className="text-xs text-[#888] mt-1">Private Blockchain — 5 Department Full Nodes</p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-[#1a1a2e] px-3.5 py-1.5 rounded-[20px] border border-[#333]">
          <span className={`w-2 h-2 rounded-full inline-block ${networkStatus === "connected" ? "bg-[#22c55e]" : "bg-[#ef4444]"}`} />
          {networkStatus === "connected" ? "Connected" : "Disconnected"}
          <span className="text-[#555] ml-2">{lands.length} plots</span>
        </div>
      </div>

      {error && <div className="bg-[#3b1111] border border-[#ef4444] rounded-lg px-4 py-2.5 mb-4 text-xs text-[#fca5a5]">{error}</div>}

      {/* Interactive Blockchain Visual Scroller */}
      <BlockchainVisualizer 
        blocks={blocks} 
        onTamperBlock={handleTamperBlock} 
        onRestoreLedger={handleRestoreLedger} 
      />

      <BlockchainMonitor activeTx={activeTx} simulationLogs={simulationLogs} isSimulating={isSimulating} attackStatus={attackStatus} onRunSimulation={runTamperSimulation} />
      
      <FilterBar tab={tab} setTab={setTab} filterOwner={filterOwner} setFilterOwner={setFilterOwner} />
      
      <LandTable loading={loading} filtered={lands} selected={selected} onSelectLand={selectLand} onDoAction={doAction} />
      
      <LandForms form={form} setForm={setForm} onDoAction={doAction} onClearForm={clearForm} />
      
      {selected && <SelectedLandDetails selected={selected} />}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-5 py-3 rounded text-sm font-semibold z-[999] border transition-all ${toast.ok ? "bg-[#1a3a1a] border-[#22c55e] text-[#86efac]" : "bg-[#3a1a1a] border-[#ef4444] text-[#fca5a5]"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
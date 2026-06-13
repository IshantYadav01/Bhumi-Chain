"use client";

export default function LandForms({ form, setForm, onDoAction, onClearForm }) {
  const inputClass = "bg-[#0f0f1a] border border-[#333] rounded px-[11px] py-[7px] text-[#e0e0e0] text-xs w-full box-border focus:outline-none focus:border-[#7c3aed]";
  const btnClass = "px-[18px] py-2 rounded-lg text-xs font-semibold cursor-pointer border transition-opacity hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed";
  const btnSmallClass = "px-2.5 py-1 text-xs rounded-md";
  const formCardClass = "bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] p-5 mb-4";
  const inputGridClass = "grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 mb-2.5";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Register Land */}
      <div className={formCardClass}>
        <div className="text-sm font-semibold mb-3 text-[#ccc]">Register New Land</div>
        <div className={inputGridClass}>
          <input className={inputClass} placeholder="Plot ID *" value={form.plotId} onChange={(e) => setForm({ ...form, plotId: e.target.value })} />
          <input className={inputClass} placeholder="Survey Number" value={form.surveyNumber} onChange={(e) => setForm({ ...form, surveyNumber: e.target.value })} />
          <input className={inputClass} placeholder="Owner *" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
          <input className={inputClass} placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <input className={inputClass} placeholder="Area (m²)" type="number" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
          <select className={inputClass} value={form.landType} onChange={(e) => setForm({ ...form, landType: e.target.value })}>
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
            onDoAction("register", {
              plotId: form.plotId,
              surveyNumber: form.surveyNumber,
              owner: form.owner,
              location: form.location,
              area: parseFloat(form.area) || 0,
              landType: form.landType,
            }).then((ok) => ok && onClearForm())
          }
        >
          Register Land
        </button>
      </div>

      {/* Transfer Land */}
      <div className={formCardClass}>
        <div className="text-sm font-semibold mb-3 text-[#ccc]">Transfer Land (Sale)</div>
        <p className="text-xs text-[#777] mb-2.5">Endorsed by Municipality · Malpot · Survey</p>
        <div className={inputGridClass}>
          <input className={inputClass} placeholder="Plot ID *" value={form.plotId} onChange={(e) => setForm({ ...form, plotId: e.target.value })} />
          <input className={inputClass} placeholder="Buyer *" value={form.buyer} onChange={(e) => setForm({ ...form, buyer: e.target.value })} />
          <input className={inputClass} placeholder="Price (Rs.)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </div>
        <button
          className={`${btnClass} bg-transparent text-[#7c3aed] border-[#7c3aed]`}
          disabled={!form.plotId || !form.buyer}
          onClick={() =>
            onDoAction("transfer", {
              plotId: form.plotId,
              buyer: form.buyer,
              price: parseFloat(form.price) || 0,
            }).then((ok) => ok && onClearForm())
          }
        >
          Transfer Land
        </button>
      </div>

      {/* Mortgage */}
      <div className={formCardClass}>
        <div className="text-sm font-semibold mb-3 text-[#ccc]">Set Mortgage</div>
        <div className={inputGridClass}>
          <input className={inputClass} placeholder="Plot ID *" value={form.plotId} onChange={(e) => setForm({ ...form, plotId: e.target.value })} />
          <input className={inputClass} placeholder="Bank *" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} />
          <input className={inputClass} placeholder="Amount (Rs.)" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <input className={inputClass} placeholder="Start Date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <input className={inputClass} placeholder="End Date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <button
            className={`${btnClass} bg-transparent text-amber-500 border-amber-500`}
            disabled={!form.plotId || !form.bank}
            onClick={() =>
              onDoAction("mortgage", {
                plotId: form.plotId,
                bank: form.bank,
                amount: parseFloat(form.amount) || 0,
                startDate: form.startDate,
                endDate: form.endDate,
              }).then((ok) => ok && onClearForm())
            }
          >
            Set Mortgage
          </button>
          <button
            className={`${btnClass} ${btnSmallClass} bg-transparent text-[#7c3aed] border-[#7c3aed]`}
            disabled={!form.plotId}
            onClick={() => onDoAction("clear-mortgage", { plotId: form.plotId }).then((ok) => ok && onClearForm())}
          >
            Clear Mortgage
          </button>
        </div>
      </div>

      {/* Dispute */}
      <div className={formCardClass}>
        <div className="text-sm font-semibold mb-3 text-[#ccc]">File Legal Dispute</div>
        <div className={inputGridClass}>
          <input className={inputClass} placeholder="Plot ID *" value={form.plotId} onChange={(e) => setForm({ ...form, plotId: e.target.value })} />
          <input className={inputClass} placeholder="Case Number *" value={form.caseNumber} onChange={(e) => setForm({ ...form, caseNumber: e.target.value })} />
          <input className={inputClass} placeholder="Court" value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} />
          <input className={inputClass} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <button
            className={`${btnClass} bg-transparent text-red-500 border-red-500`}
            disabled={!form.plotId || !form.caseNumber}
            onClick={() =>
              onDoAction("dispute", {
                plotId: form.plotId,
                caseNumber: form.caseNumber,
                court: form.court,
                description: form.description,
              }).then((ok) => ok && onClearForm())
            }
          >
            File Dispute
          </button>
          <button
            className={`${btnClass} ${btnSmallClass} bg-transparent text-[#7c3aed] border-[#7c3aed]`}
            disabled={!form.plotId}
            onClick={() => onDoAction("resolve-dispute", { plotId: form.plotId }).then((ok) => ok && onClearForm())}
          >
            Resolve Dispute
          </button>
        </div>
      </div>
    </div>
  );
}
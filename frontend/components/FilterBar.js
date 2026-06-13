"use client";

export default function FilterBar({ tab, setTab, filterOwner, setFilterOwner }) {
  const inputClass = "bg-[#0f0f1a] border border-[#333] rounded px-[11px] py-[7px] text-[#e0e0e0] text-xs w-full box-border focus:outline-none focus:border-[#7c3aed]";

  return (
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
  );
}
"use client";

export default function StatusBadge({ status }) {
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
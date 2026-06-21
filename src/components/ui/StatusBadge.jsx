// ── Reusable StatusBadge ─────────────────────────────────────────────────
const STATUS_STYLES = {
  stable:     { label: "Stable",     bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  critical:   { label: "Critical",   bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-500"     },
  admitted:   { label: "Admitted",   bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500"    },
  in_surgery: { label: "In Surgery", bg: "bg-violet-50",  text: "text-violet-700",  dot: "bg-violet-500"  },
  discharged: { label: "Discharged", bg: "bg-slate-100",  text: "text-slate-600",   dot: "bg-slate-400"   },
  scheduled:  { label: "Scheduled",  bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500"   },
  ongoing:    { label: "Ongoing",    bg: "bg-violet-50",  text: "text-violet-700",  dot: "bg-violet-500"  },
  completed:  { label: "Completed", bg: "bg-emerald-50",  text: "text-emerald-700", dot: "bg-emerald-500" },
  cancelled:  { label: "Cancelled", bg: "bg-slate-100",   text: "text-slate-500",   dot: "bg-slate-400"   },
  pending:    { label: "Pending",   bg: "bg-amber-50",    text: "text-amber-700",   dot: "bg-amber-500"   },
  available:  { label: "Available", bg: "bg-emerald-50",  text: "text-emerald-700", dot: "bg-emerald-500" },
  occupied:   { label: "Occupied",  bg: "bg-slate-100",   text: "text-slate-600",   dot: "bg-slate-400"   },
};

export default function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { label: status || "—", bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

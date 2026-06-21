// ── Reusable FormField ───────────────────────────────────────────────────
// type: "text" | "number" | "select" | "textarea"
export default function FormField({ label, unit, value, onChange, placeholder, type = "text", options, required = false }) {
  const base =
    "w-full rounded-lg px-3 py-2.5 text-sm text-slate-900 outline-none border-2 border-slate-100 bg-slate-50 focus:border-[#00A9E0] focus:bg-white transition-colors";

  return (
    <div>
      <label className="block text-[0.7rem] font-semibold text-slate-500 mb-1 tracking-wide uppercase">
        {label} {unit && <span className="text-slate-400 font-normal">({unit})</span>}
      </label>

      {type === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          {(options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`${base} resize-none`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={base}
        />
      )}
    </div>
  );
}

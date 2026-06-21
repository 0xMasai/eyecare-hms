// ── Reusable Modal ───────────────────────────────────────────────────────
export default function Modal({ open, onClose, title, subtitle, children, maxWidth = "max-w-lg" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-bold text-[#0D2C6E] text-base">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none flex-shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

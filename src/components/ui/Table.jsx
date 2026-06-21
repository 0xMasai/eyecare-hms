// ── Reusable Table ───────────────────────────────────────────────────────
// columns: [{ key, label, render?(row) }]
// rows:    array of plain objects, each ideally with a stable `id`
export default function Table({ columns, rows, onRowClick, emptyIcon = "📋", emptyLabel = "No records found" }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
        <p className="text-3xl mb-2">{emptyIcon}</p>
        <p className="text-sm font-medium text-slate-400">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id ?? i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-slate-100 last:border-0 transition-colors ${
                  onRowClick ? "cursor-pointer hover:bg-slate-50" : ""
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

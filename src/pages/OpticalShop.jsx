import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import {
  collection, query, where, onSnapshot, orderBy,
  updateDoc, doc, addDoc, getDoc, serverTimestamp,
} from "firebase/firestore";
import { format } from "date-fns";

// ── Shared brand primitives ────────────────────────────────────────────────
function PageHeader({ title, sub }) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 mb-0.5">
        <div className="w-1 h-5 rounded-full" style={{ background: "#00A9E0" }} />
        <h1 className="text-xl font-bold text-[#0D2C6E] tracking-tight">{title}</h1>
      </div>
      <p className="text-xs text-slate-500 pl-3">{sub}</p>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
      {children}
    </p>
  );
}

function NavyBtn({ onClick, disabled, children, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg font-semibold text-sm text-white transition-all active:scale-95 disabled:opacity-50 shadow-sm ${className}`}
      style={{ background: "linear-gradient(135deg, #0D2C6E 0%, #1a3f94 100%)" }}
    >
      {children}
    </button>
  );
}

// ── Option sets (matching the reference page) ──────────────────────────────
const FRAME_TYPES = ["Full Rim Plastic", "Full Rim Metal", "Semi-Rimless", "Rimless", "Children Frame", "Sports Frame", "Other"];
const LENS_TYPES  = ["Single Vision", "Bifocal", "Progressive (Varifocal)", "Reading Only", "Occupational"];
const LENS_MATS   = ["CR-39 Standard", "Polycarbonate", "High Index 1.60", "High Index 1.67", "Trivex", "Glass"];
const ADD_ONS     = ["Anti-Reflection (AR)", "UV 400 Protection", "Photochromic / Transitions", "Blue Light Filter", "Scratch Resistant", "Tinted"];
const SPH_VALUES  = Array.from({ length: 37 }, (_, i) => ((i * 0.25) - 9).toFixed(2)).map((v) => (parseFloat(v) > 0 ? "+" : "") + v);
const CYL_VALUES  = Array.from({ length: 21 }, (_, i) => (-5 + i * 0.25).toFixed(2));
const AXIS_VALUES = Array.from({ length: 180 }, (_, i) => String(i + 1));
const ADD_VALUES  = ["+0.75", "+1.00", "+1.25", "+1.50", "+1.75", "+2.00", "+2.25", "+2.50", "+2.75", "+3.00", "+3.25", "+3.50"];

const ORDER_STATUS_META = {
  PENDING:       { label: "Pending",       color: "bg-amber-50 text-amber-700",   border: "border-amber-200" },
  IN_PRODUCTION: { label: "In Production", color: "bg-blue-50 text-blue-700",     border: "border-blue-200" },
  READY:         { label: "Ready",         color: "bg-emerald-50 text-emerald-700", border: "border-emerald-200" },
  DISPENSED:     { label: "Dispensed",     color: "bg-slate-100 text-slate-600",  border: "border-slate-200" },
};

// ── Field helpers ──────────────────────────────────────────────────────────
function OSelect({ label, value, onChange, options, allowEmpty = false, required }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none appearance-none"
      >
        {allowEmpty && <option value="">Select…</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function OInput({ label, value, onChange, placeholder, type = "text", unit, required }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </p>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none ${unit ? "pr-14" : ""}`}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">{unit}</span>
        )}
      </div>
    </div>
  );
}

// ── Prescription eye panel ─────────────────────────────────────────────────
function RxEyePanel({ label, borderColor, accentBg, accentText, values, onChange }) {
  return (
    <div className={`rounded-xl border-2 ${borderColor} p-4 space-y-3`}>
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${accentBg} ${accentText}`}>
        👁 {label}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <OSelect label="SPH" value={values.sph} onChange={(v) => onChange("sph", v)} options={SPH_VALUES} />
        <OSelect label="CYL" value={values.cyl} onChange={(v) => onChange("cyl", v)} options={CYL_VALUES} />
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">AXIS</p>
          <select
            value={values.axis}
            onChange={(e) => onChange("axis", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none appearance-none"
          >
            {AXIS_VALUES.map((v) => <option key={v} value={v}>{v}°</option>)}
          </select>
        </div>
        <OSelect label="ADD" value={values.add} onChange={(v) => onChange("add", v)} options={ADD_VALUES} allowEmpty />
      </div>
    </div>
  );
}

const defaultRx = () => ({ sph: "0.00", cyl: "0.00", axis: "90", add: "" });

// ── Order detail view ──────────────────────────────────────────────────────
function OpticalOrderDetail({ visit, patient, clinicId, onBack }) {
  const [od, setOd]               = useState(defaultRx());
  const [os, setOs]               = useState(defaultRx());
  const [frameType, setFrameType] = useState("");
  const [frameBrand, setFrameBrand] = useState("");
  const [frameColor, setFrameColor] = useState("");
  const [lensType, setLensType]   = useState("");
  const [lensMat, setLensMat]     = useState("CR-39 Standard");
  const [addOns, setAddOns]       = useState([]);
  const [framePrice, setFramePrice] = useState("");
  const [lensPrice, setLensPrice] = useState("");
  const [notes, setNotes]         = useState("");
  const [errors, setErrors]       = useState({});
  const [saving, setSaving]       = useState(false);

  // Pull VA prescription if available — pre-fill for convenience
  useEffect(() => {
    const q = query(collection(db, "visual_acuity"), where("visitId", "==", visit.visitId));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const va = snap.docs[0].data();
        if (va.od) setOd({ sph: "0.00", cyl: "0.00", axis: "90", add: "", ...va.od });
        if (va.os) setOs({ sph: "0.00", cyl: "0.00", axis: "90", add: "", ...va.os });
      }
    });
    return unsub;
  }, [visit.visitId]);

  useEffect(() => {
    if (visit.status === "waiting") {
      updateDoc(doc(db, "visits", visit.visitId), { status: "in_consultation" }).catch(() => {});
    }
  }, [visit.visitId, visit.status]);

  const updateEye = (eye, key, val) => {
    if (eye === "od") setOd((p) => ({ ...p, [key]: val }));
    else              setOs((p) => ({ ...p, [key]: val }));
  };

  const toggleAddOn = (item) => {
    setAddOns((prev) => prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]);
  };

  const total = (parseFloat(framePrice) || 0) + (parseFloat(lensPrice) || 0);

  const validate = () => {
    const e = {};
    if (!frameType) e.frameType = "Required";
    if (!lensType)  e.lensType  = "Required";
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, "optical_orders"), {
        clinicId,
        visitId:    visit.visitId,
        patientId:  visit.patientId,
        prescription: { od, os },
        frameType, frameBrand, frameColor,
        lensType, lensMaterial: lensMat,
        addOns,
        framePrice: parseFloat(framePrice) || 0,
        lensPrice:  parseFloat(lensPrice)  || 0,
        totalPrice: total,
        notes: notes.trim(),
        status: "PENDING",
        createdAt: serverTimestamp(),
      });
      // Route to billing
      await updateDoc(doc(db, "visits", visit.visitId), {
        currentDepartment: "billing",
        status: "waiting",
      });
      onBack();
    } catch {
      alert("Failed to create optical order. Check connection.");
    }
    setSaving(false);
  };

  const isEmerg = visit.visitType === "Emergency";

  return (
    <div className="space-y-4" style={{ background: "#F7F9FC", minHeight: "100vh", padding: "1rem" }}>
      <button onClick={onBack} className="flex items-center gap-2 text-xs font-semibold text-[#0D2C6E] hover:opacity-70 transition-opacity">
        ← Back to queue
      </button>

      {/* Patient card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-white text-lg font-bold"
            style={{ background: isEmerg ? "#DC2626" : "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)" }}
          >
            {patient?.firstName?.[0]}{patient?.lastName?.[0]}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-[#0D2C6E]">{patient?.firstName} {patient?.lastName}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {patient?.gender} · {patient?.phone || "No phone on record"}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                isEmerg ? "bg-red-100 text-red-700" : "bg-teal-50 text-teal-700"
              }`}>
                {isEmerg ? "⚡ Emergency" : visit.visitType}
              </span>
              <span className="text-[11px] text-slate-400">
                {visit.createdAt?.toDate ? format(visit.createdAt.toDate(), "dd MMM yyyy · HH:mm") : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Spectacle Prescription */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <SectionLabel>Spectacle Prescription</SectionLabel>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <RxEyePanel
            label="Right Eye — OD"
            borderColor="border-blue-300"
            accentBg="bg-blue-50"
            accentText="text-blue-700"
            values={od}
            onChange={(k, v) => updateEye("od", k, v)}
          />
          <RxEyePanel
            label="Left Eye — OS"
            borderColor="border-teal-300"
            accentBg="bg-teal-50"
            accentText="text-teal-700"
            values={os}
            onChange={(k, v) => updateEye("os", k, v)}
          />
        </div>
      </div>

      {/* Frame */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <SectionLabel>Frame</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          <OSelect
            label="Frame Type" required
            value={frameType} onChange={setFrameType}
            options={FRAME_TYPES} allowEmpty
          />
          <OInput label="Brand / Name" value={frameBrand} onChange={setFrameBrand} placeholder="e.g. Ray-Ban, local" />
          <OInput label="Colour" value={frameColor} onChange={setFrameColor} placeholder="e.g. Black/Gold" />
        </div>
        {errors.frameType && <p className="text-[11px] text-red-500 mt-2">{errors.frameType}</p>}
      </div>

      {/* Lens */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <SectionLabel>Lens</SectionLabel>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <OSelect label="Lens Type" required value={lensType} onChange={setLensType} options={LENS_TYPES} allowEmpty />
          <OSelect label="Lens Material" value={lensMat} onChange={setLensMat} options={LENS_MATS} />
        </div>
        {errors.lensType && <p className="text-[11px] text-red-500 -mt-2 mb-2">{errors.lensType}</p>}
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">Lens Add-ons</p>
        <div className="flex flex-wrap gap-2">
          {ADD_ONS.map((a) => (
            <button
              key={a}
              onClick={() => toggleAddOn(a)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
                addOns.includes(a)
                  ? "text-white border-transparent"
                  : "bg-white text-slate-600 border-slate-200 hover:border-[#0D2C6E] hover:text-[#0D2C6E]"
              }`}
              style={addOns.includes(a) ? { background: "linear-gradient(135deg, #0D2C6E 0%, #1a3f94 100%)" } : {}}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <SectionLabel>Pricing</SectionLabel>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <OInput label="Frame Price" value={framePrice} onChange={setFramePrice} type="number" placeholder="e.g. 45000" unit="UGX" />
          <OInput label="Lens Price"  value={lensPrice}  onChange={setLensPrice}  type="number" placeholder="e.g. 85000" unit="UGX" />
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Total</p>
            <div className="w-full border border-slate-100 rounded-lg px-4 py-2.5 text-sm bg-slate-50 font-bold text-[#0D2C6E]">
              UGX {total.toLocaleString()}
            </div>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Special Instructions</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none resize-none"
            placeholder="Drill mount, segment height, progressive start distance…"
          />
        </div>
      </div>

      {/* Action */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <NavyBtn onClick={handleSave} disabled={saving} className="w-full py-3.5 px-5">
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creating order…
            </span>
          ) : "Create Optical Order & Send to Billing →"}
        </NavyBtn>
      </div>
    </div>
  );
}

// ── Orders list tab ────────────────────────────────────────────────────────
function OrdersTab({ clinicId }) {
  const [orders, setOrders]         = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    if (!clinicId) return;
    const q = query(
      collection(db, "optical_orders"),
      where("clinicId", "==", clinicId),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ orderId: d.id, ...d.data() })));
    });
  }, [clinicId]);

  const handleStatusChange = async (orderId, status) => {
    try {
      await updateDoc(doc(db, "optical_orders", orderId), { status, updatedAt: serverTimestamp() });
    } catch {
      alert("Failed to update order status.");
    }
  };

  const filtered = statusFilter === "ALL" ? orders : orders.filter((o) => o.status === statusFilter);

  return (
    <div className="space-y-3">
      {/* Filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {["ALL", "PENDING", "IN_PRODUCTION", "READY", "DISPENSED"].map((s) => {
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                active ? "text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
              style={active ? { background: "#0D2C6E" } : {}}
            >
              {s === "ALL" ? `All (${orders.length})` : s.replace("_", " ")}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center shadow-sm">
          <p className="text-3xl mb-3">🔍</p>
          <p className="font-semibold text-slate-700">No orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const meta = ORDER_STATUS_META[order.status] || ORDER_STATUS_META.PENDING;
            const rxSummary = (rx) =>
              rx ? `${rx.sph} / ${rx.cyl} × ${rx.axis}°${rx.add ? ` Add ${rx.add}` : ""}` : "—";
            return (
              <div key={order.orderId} className={`bg-white rounded-xl border-2 ${meta.border} p-5 shadow-sm`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${meta.color}`}>
                        {meta.label}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        #{order.orderId.slice(-6).toUpperCase()}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-900 text-sm">{order.patientId}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {order.createdAt?.toDate ? format(order.createdAt.toDate(), "dd MMM yyyy · HH:mm") : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[#0D2C6E]">UGX {(order.totalPrice || 0).toLocaleString()}</p>
                    <p className="text-xs text-slate-500">{order.lensType}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                  <div className="bg-blue-50 rounded-lg p-2.5">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">OD</p>
                    <p className="font-mono text-slate-700">{rxSummary(order.prescription?.od)}</p>
                  </div>
                  <div className="bg-teal-50 rounded-lg p-2.5">
                    <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mb-1">OS</p>
                    <p className="font-mono text-slate-700">{rxSummary(order.prescription?.os)}</p>
                  </div>
                </div>
                {order.addOns?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {order.addOns.map((a) => (
                      <span key={a} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{a}</span>
                    ))}
                  </div>
                )}
                {order.notes && (
                  <p className="text-xs text-slate-500 italic mb-3">📝 {order.notes}</p>
                )}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex-shrink-0">Update status:</p>
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.orderId, e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:border-[#00A9E0] focus:outline-none"
                  >
                    {Object.entries(ORDER_STATUS_META).map(([val, m]) => (
                      <option key={val} value={val}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Inventory tab (static sample — extend with live data as needed) ─────────
const SAMPLE_INVENTORY = [
  { name: "Full Rim Plastic", type: "Adult", stock: 24, price: 45000, reorder: 10 },
  { name: "Full Rim Metal",   type: "Adult", stock:  8, price: 55000, reorder:  5 },
  { name: "Semi-Rimless",     type: "Adult", stock: 15, price: 65000, reorder:  5 },
  { name: "Rimless",          type: "Adult", stock:  6, price: 75000, reorder:  5 },
  { name: "Children Frame",   type: "Child", stock: 18, price: 35000, reorder:  8 },
  { name: "Sports Frame",     type: "Adult", stock:  3, price: 85000, reorder:  5 },
];

function InventoryTab() {
  return (
    <div className="space-y-3">
      {SAMPLE_INVENTORY.map((item) => {
        const isCritical = item.stock <= 3;
        const isLow      = item.stock <= item.reorder;
        return (
          <div
            key={item.name}
            className={`bg-white rounded-xl border-2 p-4 shadow-sm ${
              isCritical ? "border-red-300" : isLow ? "border-amber-300" : "border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900 text-sm">{item.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.type} · UGX {item.price.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold" style={{ color: isCritical ? "#DC2626" : isLow ? "#D97706" : "#059669" }}>
                  {item.stock}
                </p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                  isCritical ? "bg-red-100 text-red-700" : isLow ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                }`}>
                  {isCritical ? "Critical" : isLow ? "Low" : "OK"}
                </span>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>Stock level</span>
                <span>Reorder at {item.reorder}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min((item.stock / (item.reorder * 3)) * 100, 100)}%`,
                    background: isCritical ? "#DC2626" : isLow ? "#D97706" : "#059669",
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function OpticalShop({ clinicId, userProfile }) {
  const [visits, setVisits]               = useState([]);
  const [patients, setPatients]           = useState({});
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [activeTab, setActiveTab]         = useState("queue");

  useEffect(() => {
    if (!clinicId) return;
    const q = query(
      collection(db, "visits"),
      where("clinicId", "==", clinicId),
      where("currentDepartment", "==", "optical"),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(q, async (snap) => {
      const data = snap.docs.map((d) => ({ visitId: d.id, ...d.data() }));
      setVisits(data);
      const updated = { ...patients };
      for (const v of data) {
        if (!updated[v.patientId]) {
          try {
            const pSnap = await getDoc(doc(db, "patients", v.patientId));
            if (pSnap.exists()) updated[v.patientId] = { patientId: v.patientId, ...pSnap.data() };
          } catch {}
        }
      }
      setPatients(updated);
    });
  }, [clinicId]);

  useEffect(() => {
    if (!selectedVisit) return;
    const updated = visits.find((v) => v.visitId === selectedVisit.visit.visitId);
    if (!updated) setSelectedVisit(null);
  }, [visits]);

  const handleSelectVisit = async (visit) => {
    let patient = patients[visit.patientId];
    if (!patient) {
      const snap = await getDoc(doc(db, "patients", visit.patientId));
      if (snap.exists()) patient = { patientId: visit.patientId, ...snap.data() };
    }
    setSelectedVisit({ visit, patient });
  };

  if (selectedVisit) {
    return (
      <OpticalOrderDetail
        visit={selectedVisit.visit}
        patient={selectedVisit.patient}
        clinicId={clinicId}
        onBack={() => setSelectedVisit(null)}
      />
    );
  }

  const sorted = [
    ...visits.filter((v) => v.visitType === "Emergency"),
    ...visits.filter((v) => v.visitType !== "Emergency"),
  ];

  const TABS = [
    { id: "queue",     label: `Queue (${visits.length})` },
    { id: "orders",    label: "All Orders" },
    { id: "inventory", label: "Inventory" },
  ];

  return (
    <div className="space-y-5" style={{ background: "#F7F9FC", minHeight: "100vh", padding: "1rem" }}>
      <PageHeader
        title="Optical Shop"
        sub={`${visits.length} patient${visits.length !== 1 ? "s" : ""} awaiting optical order`}
      />

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? "bg-white text-[#0D2C6E] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "queue" && (
        sorted.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center shadow-sm">
            <p className="text-4xl mb-3">👓</p>
            <p className="font-semibold text-slate-700 mb-1">Optical queue is clear</p>
            <p className="text-sm text-slate-400">Patients routed from Doctor will appear here in real time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((visit) => {
              const patient  = patients[visit.patientId];
              const isEmerg  = visit.visitType === "Emergency";
              const isActive = visit.status === "in_consultation";
              const time     = visit.createdAt?.toDate ? format(visit.createdAt.toDate(), "HH:mm") : "--:--";

              return (
                <button
                  key={visit.visitId}
                  onClick={() => handleSelectVisit(visit)}
                  className={`w-full bg-white rounded-xl border-2 p-5 text-left transition-all hover:shadow-md ${
                    isEmerg  ? "border-red-400"   :
                    isActive ? "border-teal-400"  : "border-slate-200 hover:border-teal-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0 ${isEmerg ? "bg-red-500" : ""}`}
                        style={!isEmerg ? { background: "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)" } : {}}
                      >
                        {patient?.firstName?.[0]}{patient?.lastName?.[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">
                          {patient ? `${patient.firstName} ${patient.lastName}` : "Loading…"}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {isEmerg && "⚡ "}{visit.visitType}{isActive && " · In progress"} · {time}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                        isEmerg  ? "bg-red-100 text-red-700"    :
                        isActive ? "bg-teal-100 text-teal-700"  : "bg-teal-50 text-teal-600"
                      }`}>
                        {isEmerg ? "Emergency" : isActive ? "In Progress" : "Waiting"}
                      </span>
                      <span className="text-slate-300">›</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}

      {activeTab === "orders"    && <OrdersTab clinicId={clinicId} />}
      {activeTab === "inventory" && <InventoryTab />}
    </div>
  );
}

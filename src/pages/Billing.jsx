import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import {
  collection, query, where, onSnapshot, orderBy,
  updateDoc, doc, addDoc, getDoc, serverTimestamp
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

// ── Default prices (UGX) ──────────────────────────────────────────────────
const SERVICE_PRICES = {
  "OPD Consultation":       10000,
  "Emergency Consultation": 20000,
  "Follow-up Consultation": 5000,
  "Lab Test":               15000,
};

// ── Billing visit detail ───────────────────────────────────────────────────
function BillingVisitDetail({ visit, patient, clinicId, onBack }) {
  const [lineItems, setLineItems]           = useState([]);
  const [pharmacyOrders, setPharmacyOrders] = useState([]);
  const [labTests, setLabTests]             = useState([]);
  const [consultations, setConsultations]   = useState([]);
  const [existingInvoice, setExistingInvoice] = useState(null);
  const [saving, setSaving]                 = useState(false);
  const [customItem, setCustomItem]         = useState("");
  const [customPrice, setCustomPrice]       = useState("");

  useEffect(() => {
    const q = query(collection(db, "invoices"), where("visitId", "==", visit.visitId));
    return onSnapshot(q, (snap) => {
      if (!snap.empty) setExistingInvoice({ invoiceId: snap.docs[0].id, ...snap.docs[0].data() });
    });
  }, [visit.visitId]);

  useEffect(() => {
    const q = query(
      collection(db, "pharmacy_orders"),
      where("visitId", "==", visit.visitId),
      where("status", "==", "dispensed")
    );
    return onSnapshot(q, (snap) => {
      setPharmacyOrders(snap.docs.map(d => ({ orderId: d.id, ...d.data() })));
    });
  }, [visit.visitId]);

  useEffect(() => {
    const q = query(collection(db, "lab_tests"), where("visitId", "==", visit.visitId));
    return onSnapshot(q, (snap) => {
      setLabTests(snap.docs.map(d => ({ labTestId: d.id, ...d.data() })));
    });
  }, [visit.visitId]);

  useEffect(() => {
    const q = query(collection(db, "consultations"), where("visitId", "==", visit.visitId));
    return onSnapshot(q, (snap) => {
      setConsultations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [visit.visitId]);

  // Auto-build line items
  useEffect(() => {
    if (existingInvoice) return;
    const items = [];
    const consultFee =
      visit.visitType === "Emergency"  ? SERVICE_PRICES["Emergency Consultation"]  :
      visit.visitType === "Follow-up"  ? SERVICE_PRICES["Follow-up Consultation"]  :
                                         SERVICE_PRICES["OPD Consultation"];
    items.push({ id: "consult", description: `${visit.visitType} Consultation`, quantity: 1, unitPrice: consultFee });
    labTests.forEach(t => items.push({ id: `lab-${t.labTestId}`, description: `Lab: ${t.testName}`, quantity: 1, unitPrice: SERVICE_PRICES["Lab Test"] }));
    pharmacyOrders.forEach(o => items.push({ id: `drug-${o.orderId}`, description: `${o.drugName} × ${o.quantity}`, quantity: parseInt(o.quantity) || 1, unitPrice: 5000 }));
    setLineItems(items);
  }, [labTests, pharmacyOrders, existingInvoice]);

  const total  = lineItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const isPaid = existingInvoice?.status === "paid";
  const isEmerg = visit.visitType === "Emergency";

  const handleAddCustomItem = () => {
    if (!customItem.trim() || !customPrice.trim()) return;
    setLineItems(prev => [
      ...prev,
      { id: `custom-${Date.now()}`, description: customItem.trim(), quantity: 1, unitPrice: parseInt(customPrice) || 0 },
    ]);
    setCustomItem("");
    setCustomPrice("");
  };

  const handleRemoveItem = (id) => setLineItems(prev => prev.filter(i => i.id !== id));

  const handleMarkPaid = async () => {
    setSaving(true);
    try {
      if (existingInvoice) {
        await updateDoc(doc(db, "invoices", existingInvoice.invoiceId), { status: "paid", paidAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, "invoices"), {
          clinicId, visitId: visit.visitId, patientId: visit.patientId,
          lineItems, totalAmount: total, status: "paid",
          createdAt: serverTimestamp(), paidAt: serverTimestamp(),
        });
      }
      await updateDoc(doc(db, "visits", visit.visitId), { currentDepartment: "done", status: "done" });
    } catch {
      alert("Failed to save invoice.");
    }
    setSaving(false);
  };

  const handleSaveInvoice = async () => {
    setSaving(true);
    try {
      if (existingInvoice) {
        await updateDoc(doc(db, "invoices", existingInvoice.invoiceId), { lineItems, totalAmount: total });
      } else {
        await addDoc(collection(db, "invoices"), {
          clinicId, visitId: visit.visitId, patientId: visit.patientId,
          lineItems, totalAmount: total, status: "pending", createdAt: serverTimestamp(),
        });
      }
    } catch {
      alert("Failed to save invoice.");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4" style={{ background: "#F7F9FC", minHeight: "100vh", padding: "1rem" }}>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-semibold text-[#0D2C6E] hover:opacity-70 transition-opacity"
      >
        ← Back to queue
      </button>

      {/* Patient card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-white text-lg font-bold"
               style={{ background: isEmerg ? "#DC2626" : "linear-gradient(135deg, #065F46 0%, #059669 100%)" }}>
            {patient?.firstName?.[0]}{patient?.lastName?.[0]}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-[#0D2C6E]">
              {patient?.firstName} {patient?.lastName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {patient?.gender} · {patient?.phone || "No phone on record"}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                isEmerg ? "bg-red-100 text-red-700" : "bg-emerald-50 text-emerald-700"
              }`}>
                {isEmerg ? "⚡ Emergency" : visit.visitType}
              </span>
              {isPaid && (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-600 text-white uppercase tracking-wide">
                  ✓ Paid
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Invoice */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <SectionLabel>Invoice</SectionLabel>
          {existingInvoice && (
            <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-2 py-1 rounded">
              #{existingInvoice.invoiceId.slice(-6).toUpperCase()}
            </span>
          )}
        </div>

        {/* Line items */}
        <div className="space-y-1 mb-4">
          {lineItems.map((item, idx) => (
            <div
              key={item.id}
              className={`flex items-center justify-between py-2.5 ${
                idx < lineItems.length - 1 ? "border-b border-slate-50" : ""
              }`}
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{item.description}</p>
                {item.quantity > 1 && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {item.quantity} × UGX {item.unitPrice.toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 ml-3">
                <p className="text-sm font-semibold text-slate-900">
                  UGX {(item.quantity * item.unitPrice).toLocaleString()}
                </p>
                {!isPaid && (
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="w-6 h-6 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between py-3 border-t-2 border-slate-200 mb-4">
          <p className="font-bold text-slate-900 text-sm uppercase tracking-wide">Total Due</p>
          <p className="text-xl font-bold" style={{ color: "#0D2C6E" }}>
            UGX {total.toLocaleString()}
          </p>
        </div>

        {/* Add custom item */}
        {!isPaid && (
          <div className="flex gap-2 mb-5">
            <input
              type="text"
              value={customItem}
              onChange={(e) => setCustomItem(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-4 py-2.5 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none"
              placeholder="Add service or item…"
            />
            <input
              type="number"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              className="w-28 border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none"
              placeholder="UGX"
            />
            <button
              onClick={handleAddCustomItem}
              disabled={!customItem.trim() || !customPrice.trim()}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 active:scale-95 transition-all"
              style={{ background: "#475569" }}
            >
              + Add
            </button>
          </div>
        )}

        {/* Action buttons */}
        {!isPaid ? (
          <div className="flex gap-3">
            <button
              onClick={handleSaveInvoice}
              disabled={saving}
              className="flex-1 py-3.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Invoice"}
            </button>
            <button
              onClick={handleMarkPaid}
              disabled={saving || !lineItems.length}
              className="flex-1 py-3.5 rounded-lg text-sm font-bold text-white disabled:opacity-60 active:scale-95 transition-all"
              style={{ background: "linear-gradient(135deg, #065F46 0%, #059669 100%)" }}
            >
              {saving ? "Processing…" : "✓ Mark as Paid"}
            </button>
          </div>
        ) : (
          <div className="rounded-xl p-5 text-center border border-emerald-200"
               style={{ background: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)" }}>
            <p className="font-bold text-emerald-800 text-base mb-0.5">✓ Payment Received</p>
            <p className="text-emerald-600 text-sm">
              UGX {total.toLocaleString()} · Patient discharged
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function Billing({ clinicId, userProfile }) {
  const [visits, setVisits]               = useState([]);
  const [patients, setPatients]           = useState({});
  const [selectedVisit, setSelectedVisit] = useState(null);

  useEffect(() => {
    if (!clinicId) return;
    const q = query(
      collection(db, "visits"),
      where("clinicId", "==", clinicId),
      where("currentDepartment", "==", "billing"),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(q, async (snap) => {
      const data = snap.docs.map(d => ({ visitId: d.id, ...d.data() }));
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
    const updated = visits.find(v => v.visitId === selectedVisit.visit.visitId);
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
      <BillingVisitDetail
        visit={selectedVisit.visit}
        patient={selectedVisit.patient}
        clinicId={clinicId}
        onBack={() => setSelectedVisit(null)}
      />
    );
  }

  const sorted = [
    ...visits.filter(v => v.visitType === "Emergency"),
    ...visits.filter(v => v.visitType !== "Emergency"),
  ];

  return (
    <div className="space-y-5" style={{ background: "#F7F9FC", minHeight: "100vh", padding: "1rem" }}>
      <PageHeader
        title="Billing"
        sub={`${visits.length} patient${visits.length !== 1 ? "s" : ""} awaiting payment`}
      />

      {sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center shadow-sm">
          <p className="text-4xl mb-3">💳</p>
          <p className="font-semibold text-slate-700 mb-1">No patients at billing</p>
          <p className="text-sm text-slate-400">
            Patients sent here from Pharmacy or Doctor will appear in real time.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((visit) => {
            const patient  = patients[visit.patientId];
            const isEmerg  = visit.visitType === "Emergency";
            const time     = visit.createdAt?.toDate ? format(visit.createdAt.toDate(), "HH:mm") : "--:--";

            return (
              <button
                key={visit.visitId}
                onClick={() => handleSelectVisit(visit)}
                className={`w-full bg-white rounded-xl border-2 p-5 text-left transition-all hover:shadow-md ${
                  isEmerg ? "border-red-400" : "border-slate-200 hover:border-emerald-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0 ${
                      isEmerg ? "bg-red-500" : ""
                    }`} style={!isEmerg ? { background: "linear-gradient(135deg, #065F46 0%, #059669 100%)" } : {}}>
                      {patient?.firstName?.[0]}{patient?.lastName?.[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">
                        {patient ? `${patient.firstName} ${patient.lastName}` : "Loading…"}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {isEmerg && "⚡ "}{visit.visitType} · {time}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                      isEmerg ? "bg-red-100 text-red-700" : "bg-emerald-50 text-emerald-700"
                    }`}>
                      {isEmerg ? "Emergency" : "Awaiting Payment"}
                    </span>
                    <span className="text-slate-300">›</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

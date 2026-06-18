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

// ── Send To menu ───────────────────────────────────────────────────────────
const SEND_TO_OPTIONS = [
  { value: "billing",      label: "Billing",        icon: "💳" },
  { value: "consultation", label: "Back to Doctor", icon: "👨‍⚕️" },
];

function SendToMenu({ visit }) {
  const [open, setOpen]       = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async (dept) => {
    setSending(true);
    try {
      await updateDoc(doc(db, "visits", visit.visitId), {
        currentDepartment: dept.value,
        status: "waiting",
      });
      setOpen(false);
    } catch {
      alert("Failed to route patient.");
    }
    setSending(false);
  };

  return (
    <div className="relative">
      <NavyBtn onClick={() => setOpen(!open)} disabled={sending} className="w-full py-3.5 px-5">
        {sending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Routing…
          </span>
        ) : "Route Patient →"}
      </NavyBtn>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 bottom-14 z-20 bg-white rounded-xl border border-slate-100 overflow-hidden"
               style={{ boxShadow: "0 20px 60px rgba(13,44,110,0.15)" }}>
            <div className="px-5 py-3 border-b border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select destination</p>
            </div>
            {SEND_TO_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSend(opt)}
                className="w-full text-left px-5 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 flex items-center gap-3"
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Pharmacy visit detail ──────────────────────────────────────────────────
function PharmacyVisitDetail({ visit, patient, clinicId, onBack }) {
  const [drugs, setDrugs]               = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [drugName, setDrugName]         = useState("");
  const [quantity, setQuantity]         = useState("");
  const [dose, setDose]                 = useState("");
  const [saving, setSaving]             = useState(false);

  useEffect(() => {
    const q = query(collection(db, "pharmacy_orders"), where("visitId", "==", visit.visitId));
    return onSnapshot(q, (snap) => {
      setDrugs(snap.docs.map(d => ({ orderId: d.id, ...d.data() })));
    });
  }, [visit.visitId]);

  useEffect(() => {
    const q = query(collection(db, "consultations"), where("visitId", "==", visit.visitId));
    return onSnapshot(q, (snap) => {
      setConsultations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [visit.visitId]);

  useEffect(() => {
    if (visit.status === "waiting") {
      updateDoc(doc(db, "visits", visit.visitId), { status: "in_consultation" }).catch(() => {});
    }
  }, [visit.visitId, visit.status]);

  const handleAddDrug = async () => {
    if (!drugName.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "pharmacy_orders"), {
        clinicId,
        visitId:   visit.visitId,
        patientId: visit.patientId,
        drugName:  drugName.trim(),
        quantity:  quantity.trim() || "1",
        dose:      dose.trim(),
        status:    "dispensed",
        createdAt: serverTimestamp(),
      });
      setDrugName("");
      setQuantity("");
      setDose("");
    } catch {
      alert("Failed to add drug.");
    }
    setSaving(false);
  };

  const handleRemoveDrug = async (orderId) => {
    try {
      await updateDoc(doc(db, "pharmacy_orders", orderId), { status: "cancelled" });
    } catch {}
  };

  const activeDrugs = drugs.filter(d => d.status !== "cancelled");
  const isEmerg     = visit.visitType === "Emergency";

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
               style={{ background: isEmerg ? "#DC2626" : "linear-gradient(135deg, #B45309 0%, #D97706 100%)" }}>
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
                isEmerg ? "bg-red-100 text-red-700" : "bg-amber-50 text-amber-700"
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

      {/* Doctor's notes */}
      {consultations.length > 0 && (
        <div className="bg-[#EEF3FF] rounded-xl border border-blue-200 p-5">
          <SectionLabel>Doctor's Prescription Notes</SectionLabel>
          {consultations.map((c) => (
            <div key={c.id} className="space-y-1.5 text-sm text-[#0D2C6E]">
              {c.diagnosis && <p><span className="font-semibold">Diagnosis:</span> <span className="text-slate-700">{c.diagnosis}</span></p>}
              {c.treatment && <p><span className="font-semibold">Treatment:</span> <span className="text-slate-700">{c.treatment}</span></p>}
            </div>
          ))}
        </div>
      )}

      {/* Drugs dispensed */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <SectionLabel>Drugs Dispensed ({activeDrugs.length})</SectionLabel>
        </div>

        {activeDrugs.length > 0 && (
          <div className="space-y-2 mb-4">
            {activeDrugs.map((drug) => (
              <div
                key={drug.orderId}
                className="flex items-center justify-between bg-amber-50 rounded-xl border border-amber-200 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{drug.drugName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Qty: {drug.quantity}{drug.dose ? ` · ${drug.dose}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveDrug(drug.orderId)}
                  className="text-red-400 hover:text-red-600 text-lg leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add drug */}
        <div className="space-y-2 pt-3 border-t border-slate-100">
          <input
            type="text"
            value={drugName}
            onChange={(e) => setDrugName(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none"
            placeholder="Drug name (e.g. Amoxicillin 500mg)…"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-20 border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none"
              placeholder="Qty"
            />
            <input
              type="text"
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-4 py-2.5 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none"
              placeholder="Dosage (e.g. 3× daily for 5 days)…"
            />
            <button
              onClick={handleAddDrug}
              disabled={saving || !drugName.trim()}
              className="px-4 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50 active:scale-95 transition-all"
              style={{ background: "linear-gradient(135deg, #B45309 0%, #D97706 100%)" }}
            >
              + Add
            </button>
          </div>
        </div>
      </div>

      {/* Route patient */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <SectionLabel>Route Patient</SectionLabel>
        <SendToMenu visit={visit} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function Pharmacy({ clinicId, userProfile }) {
  const [visits, setVisits]               = useState([]);
  const [patients, setPatients]           = useState({});
  const [selectedVisit, setSelectedVisit] = useState(null);

  useEffect(() => {
    if (!clinicId) return;
    const q = query(
      collection(db, "visits"),
      where("clinicId", "==", clinicId),
      where("currentDepartment", "==", "pharmacy"),
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
      <PharmacyVisitDetail
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
        title="Pharmacy"
        sub={`${visits.length} patient${visits.length !== 1 ? "s" : ""} awaiting dispensing`}
      />

      {sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center shadow-sm">
          <p className="text-4xl mb-3">💊</p>
          <p className="font-semibold text-slate-700 mb-1">Pharmacy queue is clear</p>
          <p className="text-sm text-slate-400">
            Patients sent here from Doctor or Lab will appear in real time.
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
                  isEmerg ? "border-red-400" : "border-slate-200 hover:border-amber-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0 ${
                      isEmerg ? "bg-red-500" : ""
                    }`} style={!isEmerg ? { background: "linear-gradient(135deg, #B45309 0%, #D97706 100%)" } : {}}>
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
                      isEmerg ? "bg-red-100 text-red-700" : "bg-amber-50 text-amber-700"
                    }`}>
                      {isEmerg ? "Emergency" : "At Pharmacy"}
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

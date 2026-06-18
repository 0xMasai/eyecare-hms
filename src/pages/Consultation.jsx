import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import {
  collection, query, where, onSnapshot, orderBy,
  updateDoc, doc, addDoc, getDocs, getDoc, serverTimestamp
} from "firebase/firestore";
import ConsultationForm from "../components/ConsultationForm";
import LabResults from "../components/LabResults";
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
      className={`rounded-lg font-semibold text-sm text-white transition-all active:scale-95 disabled:opacity-50 ${className}`}
      style={{ background: "linear-gradient(135deg, #0D2C6E 0%, #1a3f94 100%)" }}
    >
      {children}
    </button>
  );
}

// ── Route menu — now includes Optical Shop ─────────────────────────────────
const SEND_TO_OPTIONS = [
  { value: "lab",       label: "Laboratory",       icon: "🔬" },
  { value: "optical",   label: "Optical Shop",     icon: "👓" },
  { value: "pharmacy",  label: "Pharmacy",          icon: "💊" },
  { value: "billing",   label: "Billing",           icon: "💳" },
  { value: "reception", label: "Back to Reception", icon: "📋" },
];

function SendToMenu({ visit }) {
  const [open, setOpen]       = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async (dept) => {
    setSending(true);
    try {
      await updateDoc(doc(db, "visits", visit.visitId), {
        currentDepartment: dept.value,
        status: dept.value === "done" ? "done" : "waiting",
      });
      setOpen(false);
    } catch {
      alert("Failed to route patient. Check connection.");
    }
    setSending(false);
  };

  return (
    <div className="relative">
      <NavyBtn onClick={() => setOpen(!open)} disabled={sending} className="w-full py-3.5 px-5">
        {sending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Routing patient…
          </span>
        ) : "Route Patient →"}
      </NavyBtn>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 right-0 bottom-14 z-20 bg-white rounded-xl border border-slate-100 overflow-hidden"
            style={{ boxShadow: "0 20px 60px rgba(13,44,110,0.15)" }}
          >
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
            <div className="border-t border-slate-100">
              <button
                onClick={() => handleSend({ value: "done" })}
                className="w-full text-left px-5 py-3.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center gap-3"
              >
                <span>✓</span>
                <span>Discharge Patient</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── VA summary panel ───────────────────────────────────────────────────────
// Pulls the visual_acuity record for this visit and renders a compact summary
// so the doctor sees the pre-consultation measurements without leaving the page.
function VASummary({ visitId }) {
  const [va, setVa]         = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "visual_acuity"), where("visitId", "==", visitId));
    return onSnapshot(q, (snap) => {
      setVa(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
      setLoading(false);
    });
  }, [visitId]);

  if (loading) return <p className="text-xs text-slate-400 py-2">Loading VA data…</p>;
  if (!va)     return <p className="text-xs text-slate-400 py-2">No visual acuity recorded for this visit.</p>;

  const eyeRow = (label, eye, color) => {
    if (!eye) return null;
    return (
      <div className={`rounded-xl border-2 ${color} p-3`}>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{label}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {eye.unaided_dist   && <p><span className="text-slate-400">Unaided Dist:</span> <span className="font-semibold text-slate-800">{eye.unaided_dist}</span></p>}
          {eye.unaided_near   && <p><span className="text-slate-400">Unaided Near:</span> <span className="font-semibold text-slate-800">{eye.unaided_near}</span></p>}
          {eye.corrected_dist && <p><span className="text-slate-400">Corrected:</span> <span className="font-semibold text-slate-800">{eye.corrected_dist}</span></p>}
          {eye.pinhole        && <p><span className="text-slate-400">Pinhole:</span> <span className="font-semibold text-slate-800">{eye.pinhole}</span></p>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {eyeRow("Right Eye — OD", va.od, "border-blue-200")}
        {eyeRow("Left Eye — OS",  va.os, "border-teal-200")}
      </div>
      {va.iop && (va.iop.od || va.iop.os) && (
        <div className="flex items-center gap-4 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 text-xs">
          <span className="text-slate-500 font-semibold">IOP</span>
          {va.iop.od && <span>OD: <span className="font-bold text-slate-800">{va.iop.od} mmHg</span></span>}
          {va.iop.os && <span>OS: <span className="font-bold text-slate-800">{va.iop.os} mmHg</span></span>}
          {va.iop.method && <span className="text-slate-400">· {va.iop.method}</span>}
          {(parseFloat(va.iop.od) > 21 || parseFloat(va.iop.os) > 21) && (
            <span className="text-amber-700 font-bold">⚠️ Elevated</span>
          )}
        </div>
      )}
      {(va.colorVision && va.colorVision !== "Not tested") && (
        <p className="text-xs"><span className="text-slate-400">Colour Vision:</span> <span className="font-semibold text-slate-700">{va.colorVision}</span></p>
      )}
      {(va.coverTest && va.coverTest !== "Not tested") && (
        <p className="text-xs"><span className="text-slate-400">Cover Test:</span> <span className="font-semibold text-slate-700">{va.coverTest}</span></p>
      )}
      {va.remarks && (
        <p className="text-xs text-slate-600 italic border-l-2 border-slate-200 pl-3">{va.remarks}</p>
      )}
    </div>
  );
}

// ── Vitals summary panel ───────────────────────────────────────────────────
// Pulls the observations record so the doctor sees BP/pulse/etc at a glance.
function VitalsSummary({ visitId }) {
  const [obs, setObs]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "observations"), where("visitId", "==", visitId));
    return onSnapshot(q, (snap) => {
      setObs(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
      setLoading(false);
    });
  }, [visitId]);

  if (loading) return <p className="text-xs text-slate-400 py-2">Loading vitals…</p>;
  if (!obs)    return <p className="text-xs text-slate-400 py-2">No observations recorded for this visit.</p>;

  const items = [
    { label: "BP",   value: obs.bp_systolic && obs.bp_diastolic ? `${obs.bp_systolic}/${obs.bp_diastolic} mmHg` : null },
    { label: "Pulse", value: obs.pulse        ? `${obs.pulse} bpm`  : null },
    { label: "Temp",  value: obs.temperature  ? `${obs.temperature} °C` : null },
    { label: "SpO₂",  value: obs.spo2         ? `${obs.spo2}%`      : null },
    { label: "Weight",value: obs.weight       ? `${obs.weight} kg`  : null },
    { label: "Height",value: obs.height       ? `${obs.height} cm`  : null },
  ].filter((i) => i.value);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.label} className="bg-slate-50 rounded-lg border border-slate-100 px-3 py-2 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.label}</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">{item.value}</p>
          </div>
        ))}
      </div>
      {obs.notes && (
        <p className="text-xs text-slate-600 italic border-l-2 border-slate-200 pl-3">{obs.notes}</p>
      )}
    </div>
  );
}

// ── Investigation request panel ────────────────────────────────────────────
// Ophthalmic + general investigation types merged from the reference page.
const INVESTIGATION_TYPES = [
  // Ophthalmic
  "Visual Field Test (HVF)",
  "OCT Macula",
  "OCT Optic Nerve",
  "Fundus Photography",
  "B-Scan Ultrasound",
  "Corneal Topography (Pentacam)",
  "Pachymetry",
  "Fluorescein Angiography",
  // General / systemic
  "Blood Sugar (RBS)",
  "HbA1c",
  "Full Blood Count",
  "Electrolytes & Creatinine",
  "Thyroid Function Tests",
  "Other",
];
const INVESTIGATION_PRIORITIES = ["Routine", "Urgent", "Emergency"];

function InvestigationsPanel({ visitId, clinicId, doctorId }) {
  const [investigations, setInvestigations] = useState([]);
  const [type, setType]                     = useState("");
  const [priority, setPriority]             = useState("Routine");
  const [indication, setIndication]         = useState("");
  const [saving, setSaving]                 = useState(false);

  useEffect(() => {
    const q = query(collection(db, "investigations"), where("visitId", "==", visitId));
    return onSnapshot(q, (snap) => {
      setInvestigations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [visitId]);

  const handleRequest = async () => {
    if (!type) { alert("Select an investigation type."); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, "investigations"), {
        clinicId,
        visitId,
        type,
        priority,
        indication:  indication.trim(),
        result:      "",
        status:      "REQUESTED",
        requestedBy: doctorId || "doctor",
        requestedAt: serverTimestamp(),
        date:        new Date().toISOString().split("T")[0],
        createdAt:   serverTimestamp(),
      });
      setType("");
      setIndication("");
      setPriority("Routine");
    } catch {
      alert("Failed to request investigation.");
    }
    setSaving(false);
  };

  const priorityColor = (p) =>
    p === "Emergency" ? "bg-red-100 text-red-700" :
    p === "Urgent"    ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-600";

  const statusColor = (s) =>
    s === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-50 text-amber-700";

  return (
    <div className="space-y-3">
      {/* Existing investigations */}
      {investigations.length > 0 && (
        <div className="space-y-2 mb-1">
          {investigations.map((inv) => (
            <div key={inv.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{inv.type}</p>
                  {inv.indication && (
                    <p className="text-xs text-slate-500 mt-0.5 italic">{inv.indication}</p>
                  )}
                  {inv.result && (
                    <p className="text-xs text-emerald-700 mt-1 font-medium">Result: {inv.result}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${priorityColor(inv.priority)}`}>
                    {inv.priority}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${statusColor(inv.status)}`}>
                    {inv.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Request form */}
      <div className="pt-3 border-t border-slate-100 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Investigation Type</p>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none appearance-none"
            >
              <option value="">Select…</option>
              {INVESTIGATION_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Priority</p>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none appearance-none"
            >
              {INVESTIGATION_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Clinical Indication</p>
          <textarea
            value={indication}
            onChange={(e) => setIndication(e.target.value)}
            rows={2}
            className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none resize-none"
            placeholder="Reason for requesting this investigation…"
          />
        </div>
        <button
          onClick={handleRequest}
          disabled={saving || !type}
          className="w-full py-2.5 border border-[#0D2C6E] rounded-lg text-sm font-semibold text-[#0D2C6E] hover:bg-[#0D2C6E] hover:text-white transition-all disabled:opacity-40 active:scale-95"
        >
          {saving ? "Requesting…" : "+ Request Investigation"}
        </button>
      </div>
    </div>
  );
}

// ── Patient history ────────────────────────────────────────────────────────
function PatientHistory({ patientId, clinicId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const visitsQ  = query(
          collection(db, "visits"),
          where("patientId", "==", patientId),
          where("clinicId", "==", clinicId),
          orderBy("createdAt", "desc")
        );
        const snap      = await getDocs(visitsQ);
        const visitData = snap.docs.map((d) => ({ visitId: d.id, ...d.data() }));
        const cons      = {};
        const labs      = {};
        for (const vid of snap.docs.map((d) => d.id).slice(0, 10)) {
          const cSnap = await getDocs(query(collection(db, "consultations"), where("visitId", "==", vid)));
          cons[vid] = cSnap.docs.map((d) => d.data());
          const lSnap = await getDocs(query(collection(db, "lab_tests"), where("visitId", "==", vid)));
          labs[vid] = lSnap.docs.map((d) => d.data());
        }
        setHistory(visitData.slice(1).map((v) => ({
          ...v,
          consultations: cons[v.visitId] || [],
          labTests:      labs[v.visitId] || [],
        })));
      } catch {}
      setLoading(false);
    };
    if (patientId) load();
  }, [patientId, clinicId]);

  if (loading) return <p className="text-xs text-slate-400 py-2">Loading history…</p>;
  if (!history.length) return (
    <div className="text-center py-4 text-slate-400 text-sm bg-slate-50 rounded-lg">
      No previous visits found
    </div>
  );

  return (
    <div className="space-y-3">
      {history.slice(0, 5).map((v) => (
        <div key={v.visitId} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">
              {v.createdAt?.toDate ? format(v.createdAt.toDate(), "dd MMM yyyy") : "—"}
            </span>
            <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium uppercase tracking-wide">
              {v.visitType}
            </span>
          </div>
          {v.consultations.map((c, i) => (
            <div key={i} className="space-y-1 text-xs text-slate-700">
              {c.symptoms  && <p><span className="font-semibold text-slate-500">Symptoms:</span> {c.symptoms}</p>}
              {c.diagnosis && <p><span className="font-semibold text-slate-500">Diagnosis:</span> {c.diagnosis}</p>}
              {c.treatment && <p><span className="font-semibold text-slate-500">Treatment:</span> {c.treatment}</p>}
            </div>
          ))}
          {!v.consultations.length && (
            <p className="text-xs text-slate-400">No consultation notes recorded</p>
          )}
          {v.labTests.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-200 space-y-0.5">
              {v.labTests.map((t, i) => (
                <p key={i} className="text-xs text-slate-500">
                  🔬 {t.testName}: {t.status === "completed" ? t.results : "Pending"}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Visit detail ───────────────────────────────────────────────────────────
function VisitDetail({ visit, patient, clinicId, doctorId, onBack }) {
  const [showConsultForm, setShowConsultForm] = useState(false);
  const [consultations, setConsultations]     = useState([]);
  const [showHistory, setShowHistory]         = useState(false);

  useEffect(() => {
    const q = query(collection(db, "consultations"), where("visitId", "==", visit.visitId));
    return onSnapshot(q, (snap) => {
      setConsultations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [visit.visitId]);

  useEffect(() => {
    if (visit.status === "waiting") {
      updateDoc(doc(db, "visits", visit.visitId), { status: "in_consultation" }).catch(() => {});
    }
  }, [visit.visitId, visit.status]);

  const isEmerg = visit.visitType === "Emergency";

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
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-white text-lg font-bold"
            style={{ background: isEmerg ? "#DC2626" : "linear-gradient(135deg, #0D2C6E 0%, #00A9E0 100%)" }}
          >
            {patient?.firstName?.[0]}{patient?.lastName?.[0]}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-[#0D2C6E]">
              {patient?.firstName} {patient?.lastName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {patient?.gender} · DOB: {patient?.dob || "Not recorded"} · {patient?.phone || "No phone"}
            </p>
            {patient?.address && (
              <p className="text-xs text-slate-400 mt-0.5">📍 {patient.address}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                isEmerg ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-700"
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

      {/* Vitals summary — from Observations */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <SectionLabel>Vital Signs</SectionLabel>
        <VitalsSummary visitId={visit.visitId} />
      </div>

      {/* Visual Acuity summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <SectionLabel>Visual Acuity</SectionLabel>
        <VASummary visitId={visit.visitId} />
      </div>

      {/* Lab results */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <SectionLabel>Lab Results</SectionLabel>
        <LabResults
          visitId={visit.visitId}
          clinicId={clinicId}
          canAddTest={true}
          canEditResults={false}
        />
      </div>

      {/* Investigations */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <SectionLabel>Investigations</SectionLabel>
        <InvestigationsPanel
          visitId={visit.visitId}
          clinicId={clinicId}
          doctorId={doctorId}
        />
      </div>

      {/* Consultation notes */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <SectionLabel>Consultation Notes</SectionLabel>

        {consultations.length > 0 && (
          <div className="space-y-3 mb-4">
            {consultations.map((c) => (
              <div key={c.id} className="rounded-xl p-4 border border-emerald-200 bg-emerald-50">
                <div className="space-y-1.5 text-sm">
                  {c.symptoms  && <p><span className="font-semibold text-slate-600">Symptoms:</span>  <span className="text-slate-700">{c.symptoms}</span></p>}
                  {c.diagnosis && <p><span className="font-semibold text-slate-600">Diagnosis:</span> <span className="text-slate-700">{c.diagnosis}</span></p>}
                  {c.treatment && <p><span className="font-semibold text-slate-600">Treatment:</span> <span className="text-slate-700">{c.treatment}</span></p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {!consultations.length && !showConsultForm && (
          <NavyBtn onClick={() => setShowConsultForm(true)} className="w-full py-3.5 px-5">
            + Add Consultation Notes
          </NavyBtn>
        )}

        {showConsultForm && (
          <ConsultationForm
            visitId={visit.visitId}
            doctorId={doctorId}
            onSuccess={() => setShowConsultForm(false)}
            onCancel={() => setShowConsultForm(false)}
          />
        )}

        {consultations.length > 0 && !showConsultForm && (
          <button
            onClick={() => setShowConsultForm(true)}
            className="w-full py-3 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:border-[#0D2C6E] hover:text-[#0D2C6E] transition-all mt-3"
          >
            + Add Another Note
          </button>
        )}
      </div>

      {/* Route patient */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <SectionLabel>Route Patient</SectionLabel>
        <SendToMenu visit={visit} />
      </div>

      {/* Past history accordion */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
        >
          <span className="text-sm font-semibold text-[#0D2C6E]">📋 Patient Visit History</span>
          <span className="text-slate-400 text-xs">{showHistory ? "▲ Collapse" : "▼ Expand"}</span>
        </button>
        {showHistory && (
          <div className="px-5 pb-5 border-t border-slate-100">
            <div className="pt-4">
              <PatientHistory patientId={patient?.patientId} clinicId={clinicId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function Consultation({ clinicId, userProfile }) {
  const [visits, setVisits]               = useState([]);
  const [patients, setPatients]           = useState({});
  const [selectedVisit, setSelectedVisit] = useState(null);

  useEffect(() => {
    if (!clinicId) return;
    const q = query(
      collection(db, "visits"),
      where("clinicId", "==", clinicId),
      where("currentDepartment", "==", "consultation"),
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
    if (updated) setSelectedVisit((prev) => ({ ...prev, visit: updated }));
    else         setSelectedVisit(null);
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
      <VisitDetail
        visit={selectedVisit.visit}
        patient={selectedVisit.patient}
        clinicId={clinicId}
        doctorId={userProfile?.userId}
        onBack={() => setSelectedVisit(null)}
      />
    );
  }

  const sorted = [
    ...visits.filter((v) => v.visitType === "Emergency"),
    ...visits.filter((v) => v.visitType !== "Emergency"),
  ];

  return (
    <div className="space-y-5" style={{ background: "#F7F9FC", minHeight: "100vh", padding: "1rem" }}>
      <PageHeader
        title="Doctor's Queue"
        sub={`${visits.length} patient${visits.length !== 1 ? "s" : ""} waiting · consultation`}
      />

      {sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center shadow-sm">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-semibold text-slate-700 mb-1">No patients in queue</p>
          <p className="text-sm text-slate-400">Patients routed from Visual Acuity will appear here in real time.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((visit) => {
            const patient     = patients[visit.patientId];
            const isEmerg     = visit.visitType === "Emergency";
            const isInConsult = visit.status === "in_consultation";
            const time        = visit.createdAt?.toDate ? format(visit.createdAt.toDate(), "HH:mm") : "--:--";

            return (
              <button
                key={visit.visitId}
                onClick={() => handleSelectVisit(visit)}
                className={`w-full bg-white rounded-xl border-2 p-5 text-left transition-all hover:shadow-md ${
                  isEmerg     ? "border-red-400"   :
                  isInConsult ? "border-[#00A9E0]" : "border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0 ${isEmerg ? "bg-red-500" : ""}`}
                      style={!isEmerg ? { background: "linear-gradient(135deg, #0D2C6E 0%, #00A9E0 100%)" } : {}}
                    >
                      {patient?.firstName?.[0]}{patient?.lastName?.[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">
                        {patient ? `${patient.firstName} ${patient.lastName}` : "Loading…"}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {isEmerg && "⚡ "}{visit.visitType}
                        {isInConsult && " · In consultation"}
                        {" · "}{time}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                      isEmerg     ? "bg-red-100 text-red-700"   :
                      isInConsult ? "bg-blue-50 text-blue-700"  : "bg-amber-50 text-amber-700"
                    }`}>
                      {isEmerg ? "Emergency" : isInConsult ? "In Progress" : "Waiting"}
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

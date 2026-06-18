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

// ── Vital field ────────────────────────────────────────────────────────────
function VitalField({ label, value, onChange, placeholder, type = "number", unit, required, min, max, step, error }) {
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
          min={min}
          max={max}
          step={step}
          className={`w-full border rounded-lg px-4 py-2.5 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none ${
            error ? "border-red-300" : "border-slate-200"
          } ${unit ? "pr-14" : ""}`}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
            {unit}
          </span>
        )}
      </div>
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ── BMI calculator ─────────────────────────────────────────────────────────
function bmiValue(weight, height) {
  const w = parseFloat(weight);
  const h = parseFloat(height) / 100;
  if (!w || !h || h === 0) return null;
  return (w / (h * h)).toFixed(1);
}

function bmiCategory(bmi) {
  if (!bmi) return null;
  const b = parseFloat(bmi);
  if (b < 18.5) return { label: "Underweight", color: "text-blue-600" };
  if (b < 25)   return { label: "Normal",      color: "text-emerald-600" };
  if (b < 30)   return { label: "Overweight",  color: "text-amber-600" };
  return              { label: "Obese",         color: "text-red-600" };
}

// ── BP classification ──────────────────────────────────────────────────────
function bpCategory(sys, dia) {
  const s = parseInt(sys), d = parseInt(dia);
  if (!s || !d) return null;
  if (s < 120 && d < 80)  return { label: "Normal",          color: "text-emerald-600" };
  if (s < 130 && d < 80)  return { label: "Elevated",        color: "text-amber-500" };
  if (s < 140 || d < 90)  return { label: "Stage 1 HTN",     color: "text-orange-600" };
  if (s < 180 || d < 120) return { label: "Stage 2 HTN",     color: "text-red-600" };
  return                          { label: "Hypertensive Crisis", color: "text-red-700 font-bold" };
}

// ── Observation detail form ────────────────────────────────────────────────
function ObservationsDetail({ visit, patient, clinicId, onBack }) {
  const [form, setForm] = useState({
    bp_systolic: "", bp_diastolic: "", pulse: "",
    temperature: "", spo2: "", weight: "", height: "", notes: "",
  });
  const [errors, setErrors]   = useState({});
  const [saving, setSaving]   = useState(false);
  const [existing, setExisting] = useState(null);

  // Mark visit as in-progress on open
  useEffect(() => {
    if (visit.status === "waiting") {
      updateDoc(doc(db, "visits", visit.visitId), { status: "in_consultation" }).catch(() => {});
    }
  }, [visit.visitId, visit.status]);

  // Load any previously saved observations for this visit
  useEffect(() => {
    const q = query(collection(db, "observations"), where("visitId", "==", visit.visitId));
    return onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setExisting({ id: snap.docs[0].id, ...data });
        setForm({
          bp_systolic:  data.bp_systolic  || "",
          bp_diastolic: data.bp_diastolic || "",
          pulse:        data.pulse        || "",
          temperature:  data.temperature  || "",
          spo2:         data.spo2         || "",
          weight:       data.weight       || "",
          height:       data.height       || "",
          notes:        data.notes        || "",
        });
      }
    });
  }, [visit.visitId]);

  const set = (k, v) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.bp_systolic)  e.bp_systolic  = "Required";
    if (!form.bp_diastolic) e.bp_diastolic = "Required";
    if (!form.pulse)        e.pulse        = "Required";
    const s = parseInt(form.bp_systolic), d = parseInt(form.bp_diastolic);
    if (s && (s < 50 || s > 300))  e.bp_systolic  = "50 – 300 mmHg";
    if (d && (d < 30 || d > 200))  e.bp_diastolic = "30 – 200 mmHg";
    if (form.pulse && (parseInt(form.pulse) < 30 || parseInt(form.pulse) > 250))
      e.pulse = "30 – 250 bpm";
    if (form.spo2 && (parseInt(form.spo2) < 60 || parseInt(form.spo2) > 100))
      e.spo2 = "60 – 100 %";
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const payload = {
        clinicId,
        visitId:    visit.visitId,
        patientId:  visit.patientId,
        bp_systolic:  form.bp_systolic.trim(),
        bp_diastolic: form.bp_diastolic.trim(),
        pulse:        form.pulse.trim(),
        temperature:  form.temperature.trim(),
        spo2:         form.spo2.trim(),
        weight:       form.weight.trim(),
        height:       form.height.trim(),
        notes:        form.notes.trim(),
        recordedAt:   serverTimestamp(),
      };
      if (existing) {
        await updateDoc(doc(db, "observations", existing.id), payload);
      } else {
        await addDoc(collection(db, "observations"), { ...payload, createdAt: serverTimestamp() });
      }
      // Advance to visual acuity
      await updateDoc(doc(db, "visits", visit.visitId), {
        currentDepartment: "visual_acuity",
        status: "waiting",
      });
      onBack();
    } catch {
      alert("Failed to save observations. Check connection.");
    }
    setSaving(false);
  };

  const isEmerg = visit.visitType === "Emergency";
  const bmi     = bmiValue(form.weight, form.height);
  const bmiCat  = bmiCategory(bmi);
  const bpCat   = bpCategory(form.bp_systolic, form.bp_diastolic);

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
            style={{ background: isEmerg ? "#DC2626" : "linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)" }}
          >
            {patient?.firstName?.[0]}{patient?.lastName?.[0]}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-[#0D2C6E]">{patient?.firstName} {patient?.lastName}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {patient?.gender} · {patient?.dob || "DOB not recorded"} · {patient?.phone || "No phone"}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                isEmerg ? "bg-red-100 text-red-700" : "bg-violet-50 text-violet-700"
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

      {/* Blood Pressure */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <SectionLabel>Blood Pressure & Pulse</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          <VitalField label="Systolic" value={form.bp_systolic} onChange={(v) => set("bp_systolic", v)}
            placeholder="120" unit="mmHg" required min="50" max="300" error={errors.bp_systolic} />
          <VitalField label="Diastolic" value={form.bp_diastolic} onChange={(v) => set("bp_diastolic", v)}
            placeholder="80" unit="mmHg" required min="30" max="200" error={errors.bp_diastolic} />
          <VitalField label="Pulse" value={form.pulse} onChange={(v) => set("pulse", v)}
            placeholder="72" unit="bpm" required min="30" max="250" error={errors.pulse} />
        </div>
        {bpCat && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-500">BP Classification:</span>
            <span className={`text-xs font-bold ${bpCat.color}`}>{bpCat.label}</span>
          </div>
        )}
      </div>

      {/* Other vitals */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <SectionLabel>Other Vitals</SectionLabel>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <VitalField label="Temperature" value={form.temperature} onChange={(v) => set("temperature", v)}
            placeholder="36.6" unit="°C" step="0.1" min="30" max="45" />
          <VitalField label="SpO₂" value={form.spo2} onChange={(v) => set("spo2", v)}
            placeholder="98" unit="%" min="60" max="100" error={errors.spo2} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <VitalField label="Weight" value={form.weight} onChange={(v) => set("weight", v)}
            placeholder="Optional" unit="kg" step="0.1" min="1" max="300" />
          <VitalField label="Height" value={form.height} onChange={(v) => set("height", v)}
            placeholder="Optional" unit="cm" step="0.1" min="30" max="250" />
        </div>
        {bmi && bmiCat && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-500">BMI:</span>
            <span className="text-xs font-bold text-slate-800">{bmi}</span>
            <span className={`text-xs font-semibold ${bmiCat.color}`}>— {bmiCat.label}</span>
          </div>
        )}
      </div>

      {/* Nursing notes */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <SectionLabel>Nursing Notes</SectionLabel>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none resize-none"
          placeholder="Any relevant observations or patient complaints…"
        />
      </div>

      {/* Action */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <NavyBtn onClick={handleSave} disabled={saving} className="w-full py-3.5 px-5">
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving…
            </span>
          ) : "Save Vitals & Send to Visual Acuity →"}
        </NavyBtn>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function Observations({ clinicId, userProfile }) {
  const [visits, setVisits]               = useState([]);
  const [patients, setPatients]           = useState({});
  const [selectedVisit, setSelectedVisit] = useState(null);

  useEffect(() => {
  if (!clinicId) return;
  const q = query(
    collection(db, "visits"),
    where("clinicId", "==", clinicId),
    where("currentDepartment", "==", "observations"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, async (snap) => {
    const data = snap.docs.map((d) => ({ visitId: d.id, ...d.data() }));
    setVisits(data);
    for (const v of data) {
      setPatients((prev) => {
        if (prev[v.patientId]) return prev;
        getDoc(doc(db, "patients", v.patientId)).then((pSnap) => {
          if (pSnap.exists())
            setPatients((p) => ({ ...p, [v.patientId]: { patientId: v.patientId, ...pSnap.data() } }));
        }).catch(() => {});
        return prev;
      });
    }
  });
}, [clinicId]);

  // ... rest unchanged

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
      <ObservationsDetail
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

  return (
    <div className="space-y-5" style={{ background: "#F7F9FC", minHeight: "100vh", padding: "1rem" }}>
      <PageHeader
        title="Observations"
        sub={`${visits.length} patient${visits.length !== 1 ? "s" : ""} awaiting vitals`}
      />

      {sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center shadow-sm">
          <p className="text-4xl mb-3">🩺</p>
          <p className="font-semibold text-slate-700 mb-1">Observations queue is clear</p>
          <p className="text-sm text-slate-400">Patients routed from Reception will appear here in real time.</p>
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
                  isEmerg  ? "border-red-400"    :
                  isActive ? "border-violet-400" : "border-slate-200 hover:border-violet-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0 ${isEmerg ? "bg-red-500" : ""}`}
                      style={!isEmerg ? { background: "linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)" } : {}}
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
                      isEmerg  ? "bg-red-100 text-red-700"       :
                      isActive ? "bg-violet-100 text-violet-700" : "bg-violet-50 text-violet-600"
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
      )}
    </div>
  );
}

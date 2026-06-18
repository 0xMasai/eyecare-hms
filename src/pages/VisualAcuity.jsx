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

// ── VA option sets ─────────────────────────────────────────────────────────
const SNELLEN_DIST = ["6/6", "6/9", "6/12", "6/18", "6/24", "6/36", "6/60", "CF", "HM", "PL", "NPL"];
const SNELLEN_NEAR = ["N5", "N6", "N8", "N10", "N12", "N18", "N24", "N36", "N48"];
const IOP_METHODS  = ["NCT (Non-Contact)", "Goldmann", "iCare", "Perkins", "Schiotz"];
const COLOR_VISION = ["Not tested", "Normal", "Red-Green Deficiency", "Blue-Yellow Deficiency", "Total Colour Blindness"];
const COVER_TEST   = ["Not tested", "Orthophoric", "Esophoria", "Exophoria", "Hyperphoria", "Esotropia", "Exotropia"];

// ── Reusable select ────────────────────────────────────────────────────────
function VASelect({ label, value, onChange, options, allowEmpty = false }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{label}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none appearance-none"
      >
        {allowEmpty && <option value="">—</option>}
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function VAInput({ label, value, onChange, placeholder, unit, type = "number", min, max, step }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{label}</p>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className={`w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none ${unit ? "pr-14" : ""}`}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">{unit}</span>
        )}
      </div>
    </div>
  );
}

// ── Eye panel ──────────────────────────────────────────────────────────────
function EyePanel({ label, borderColor, accentBg, accentText, values, onChange }) {
  return (
    <div className={`rounded-xl border-2 ${borderColor} p-4 space-y-3`}>
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${accentBg} ${accentText}`}>
        👁 {label}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <VASelect
          label="Unaided Distance"
          value={values.unaided_dist}
          onChange={(v) => onChange("unaided_dist", v)}
          options={SNELLEN_DIST}
        />
        <VASelect
          label="Unaided Near"
          value={values.unaided_near}
          onChange={(v) => onChange("unaided_near", v)}
          options={SNELLEN_NEAR}
        />
        <VASelect
          label="Corrected Distance"
          value={values.corrected_dist}
          onChange={(v) => onChange("corrected_dist", v)}
          options={SNELLEN_DIST}
          allowEmpty
        />
        <VASelect
          label="Pinhole"
          value={values.pinhole}
          onChange={(v) => onChange("pinhole", v)}
          options={SNELLEN_DIST}
          allowEmpty
        />
      </div>
    </div>
  );
}

// ── Default eye state ──────────────────────────────────────────────────────
const defaultEye = () => ({ unaided_dist: "6/6", unaided_near: "N6", corrected_dist: "", pinhole: "" });

// ── Visual Acuity detail form ──────────────────────────────────────────────
function VisualAcuityDetail({ visit, patient, clinicId, onBack }) {
  const [od, setOd] = useState(defaultEye());         // Right eye
  const [os, setOs] = useState(defaultEye());         // Left eye
  const [iop, setIop] = useState({ od: "", os: "", method: "NCT (Non-Contact)" });
  const [colorVision, setColorVision] = useState("Not tested");
  const [coverTest, setCoverTest]     = useState("Not tested");
  const [remarks, setRemarks]         = useState("");
  const [saving, setSaving]           = useState(false);
  const [existing, setExisting]       = useState(null);

  const updateEye = (eye, key, val) => {
    if (eye === "od") setOd((prev) => ({ ...prev, [key]: val }));
    else              setOs((prev) => ({ ...prev, [key]: val }));
  };

  useEffect(() => {
    if (visit.status === "waiting") {
      updateDoc(doc(db, "visits", visit.visitId), { status: "in_consultation" }).catch(() => {});
    }
  }, [visit.visitId, visit.status]);

  // Load existing VA record for this visit
  useEffect(() => {
    const q = query(collection(db, "visual_acuity"), where("visitId", "==", visit.visitId));
    return onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setExisting({ id: snap.docs[0].id, ...data });
        if (data.od) setOd(data.od);
        if (data.os) setOs(data.os);
        if (data.iop) setIop(data.iop);
        if (data.colorVision) setColorVision(data.colorVision);
        if (data.coverTest)   setCoverTest(data.coverTest);
        if (data.remarks)     setRemarks(data.remarks);
      }
    });
  }, [visit.visitId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        clinicId,
        visitId:   visit.visitId,
        patientId: visit.patientId,
        od, os, iop,
        colorVision,
        coverTest,
        remarks: remarks.trim(),
        recordedAt: serverTimestamp(),
      };
      if (existing) {
        await updateDoc(doc(db, "visual_acuity", existing.id), payload);
      } else {
        await addDoc(collection(db, "visual_acuity"), { ...payload, createdAt: serverTimestamp() });
      }
      // Advance to consultation
      await updateDoc(doc(db, "visits", visit.visitId), {
        currentDepartment: "consultation",
        status: "waiting",
      });
      onBack();
    } catch {
      alert("Failed to save VA data. Check connection.");
    }
    setSaving(false);
  };

  const isEmerg = visit.visitType === "Emergency";

  // Flag abnormal VA for quick clinical signal
  const flagVA = (val) => ["CF", "HM", "PL", "NPL", "6/60", "6/36"].includes(val);
  const hasAbNormalVA =
    flagVA(od.unaided_dist) || flagVA(os.unaided_dist) ||
    flagVA(od.corrected_dist) || flagVA(os.corrected_dist);
  const highIOP =
    (parseFloat(iop.od) > 21) || (parseFloat(iop.os) > 21);

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
            style={{ background: isEmerg ? "#DC2626" : "linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)" }}
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
                isEmerg ? "bg-red-100 text-red-700" : "bg-sky-50 text-sky-700"
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

      {/* Clinical flags */}
      {(hasAbNormalVA || highIOP) && (
        <div className="rounded-xl border-2 border-amber-300 p-4 flex items-start gap-3"
             style={{ background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)" }}>
          <span className="text-xl">⚠️</span>
          <div className="space-y-0.5">
            {hasAbNormalVA && <p className="text-sm font-semibold text-amber-800">Reduced visual acuity detected — note for doctor</p>}
            {highIOP       && <p className="text-sm font-semibold text-amber-800">Elevated IOP detected ({">"}21 mmHg) — note for doctor</p>}
          </div>
        </div>
      )}

      {/* Visual Acuity - Eyes */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <SectionLabel>Visual Acuity</SectionLabel>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <EyePanel
            label="Right Eye — OD"
            borderColor="border-blue-300"
            accentBg="bg-blue-50"
            accentText="text-blue-700"
            values={od}
            onChange={(k, v) => updateEye("od", k, v)}
          />
          <EyePanel
            label="Left Eye — OS"
            borderColor="border-teal-300"
            accentBg="bg-teal-50"
            accentText="text-teal-700"
            values={os}
            onChange={(k, v) => updateEye("os", k, v)}
          />
        </div>
      </div>

      {/* IOP */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <SectionLabel>Intraocular Pressure (IOP)</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          <VAInput
            label="IOP OD"
            value={iop.od}
            onChange={(v) => setIop((p) => ({ ...p, od: v }))}
            placeholder="e.g. 14"
            unit="mmHg"
            step="0.1"
            min="0"
            max="80"
          />
          <VAInput
            label="IOP OS"
            value={iop.os}
            onChange={(v) => setIop((p) => ({ ...p, os: v }))}
            placeholder="e.g. 15"
            unit="mmHg"
            step="0.1"
            min="0"
            max="80"
          />
          <VASelect
            label="Method"
            value={iop.method}
            onChange={(v) => setIop((p) => ({ ...p, method: v }))}
            options={IOP_METHODS}
          />
        </div>
        {highIOP && (
          <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-semibold text-amber-700">
              ⚠️ IOP {parseFloat(iop.od) > 21 ? `OD ${iop.od}` : ""}{parseFloat(iop.od) > 21 && parseFloat(iop.os) > 21 ? " / " : ""}
              {parseFloat(iop.os) > 21 ? `OS ${iop.os}` : ""} mmHg — above normal range (≤21 mmHg)
            </p>
          </div>
        )}
      </div>

      {/* Additional tests */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <SectionLabel>Additional Tests</SectionLabel>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <VASelect
            label="Colour Vision (Ishihara)"
            value={colorVision}
            onChange={setColorVision}
            options={COLOR_VISION}
          />
          <VASelect
            label="Cover Test"
            value={coverTest}
            onChange={setCoverTest}
            options={COVER_TEST}
          />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Remarks</p>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none resize-none"
            placeholder="Media clear, disc normal, foveal reflex present…"
          />
        </div>
      </div>

      {/* Action */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <NavyBtn onClick={handleSave} disabled={saving} className="w-full py-3.5 px-5">
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving…
            </span>
          ) : "Save VA & Send to Doctor →"}
        </NavyBtn>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function VisualAcuity({ clinicId, userProfile }) {
  const [visits, setVisits]               = useState([]);
  const [patients, setPatients]           = useState({});
  const [selectedVisit, setSelectedVisit] = useState(null);

  useEffect(() => {
    if (!clinicId) return;
    const q = query(
      collection(db, "visits"),
      where("clinicId", "==", clinicId),
      where("currentDepartment", "==", "visual_acuity"),
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
      <VisualAcuityDetail
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
        title="Visual Acuity"
        sub={`${visits.length} patient${visits.length !== 1 ? "s" : ""} awaiting assessment`}
      />

      {sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center shadow-sm">
          <p className="text-4xl mb-3">👁</p>
          <p className="font-semibold text-slate-700 mb-1">Visual Acuity queue is clear</p>
          <p className="text-sm text-slate-400">Patients from Observations will appear here in real time.</p>
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
                  isActive ? "border-sky-400"   : "border-slate-200 hover:border-sky-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0 ${isEmerg ? "bg-red-500" : ""}`}
                      style={!isEmerg ? { background: "linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)" } : {}}
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
                      isEmerg  ? "bg-red-100 text-red-700"   :
                      isActive ? "bg-sky-100 text-sky-700"   : "bg-sky-50 text-sky-600"
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

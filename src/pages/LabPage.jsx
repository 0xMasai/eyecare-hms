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

// ── Send To routing menu ───────────────────────────────────────────────────
const SEND_TO_OPTIONS = [
  { value: "consultation", label: "Back to Doctor", icon: "👨‍⚕️" },
  { value: "pharmacy",     label: "Pharmacy",       icon: "💊" },
  { value: "billing",      label: "Billing",        icon: "💳" },
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
            Routing…
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
          </div>
        </>
      )}
    </div>
  );
}

// ── Test + investigation type lists ───────────────────────────────────────
// Standard lab tests (added to lab_tests collection)
const LAB_TEST_SUGGESTIONS = [
  "Full Blood Count",
  "Blood Sugar (RBS)",
  "HbA1c",
  "Electrolytes & Creatinine",
  "Liver Function Tests",
  "Thyroid Function Tests",
  "Lipid Profile",
  "Urine Analysis",
  "Malaria RDT",
  "HIV Screening",
  "Hepatitis B Surface Antigen",
  "Widal Test",
  "Blood Group & Cross Match",
  "Sickle Cell Screening",
  "Other",
];

// Ophthalmic / specialist investigations (read from investigations collection,
// requested by the doctor — lab enters the result here)
const OPHTHALMIC_INVESTIGATION_TYPES = [
  "Visual Field Test (HVF)",
  "OCT Macula",
  "OCT Optic Nerve",
  "Fundus Photography",
  "B-Scan Ultrasound",
  "Corneal Topography (Pentacam)",
  "Pachymetry",
  "Fluorescein Angiography",
];

// ── Investigation result entry ─────────────────────────────────────────────
function InvestigationResultRow({ inv }) {
  const [editing, setEditing] = useState(false);
  const [result, setResult]   = useState(inv.result || "");
  const [saving, setSaving]   = useState(false);
  const isDone = inv.status === "COMPLETED";

  const priorityColor = (p) =>
    p === "Emergency" ? "bg-red-100 text-red-700" :
    p === "Urgent"    ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-600";

  const handleSave = async () => {
    if (!result.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "investigations", inv.id), {
        result:      result.trim(),
        status:      "COMPLETED",
        completedAt: serverTimestamp(),
      });
      setEditing(false);
    } catch {
      alert("Failed to save result.");
    }
    setSaving(false);
  };

  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${isDone ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm">{inv.type}</p>
          {inv.indication && <p className="text-xs text-slate-500 italic mt-0.5">{inv.indication}</p>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${priorityColor(inv.priority)}`}>
            {inv.priority}
          </span>
          {isDone && (
            <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-2.5 py-1 rounded-full uppercase tracking-wide">
              ✓ Done
            </span>
          )}
        </div>
      </div>

      {isDone && inv.result && !editing && (
        <p className="text-sm text-slate-700 leading-relaxed mt-1">{inv.result}</p>
      )}

      {!isDone && !editing && (
        <button
          onClick={() => setEditing(true)}
          className="mt-2 text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)" }}
        >
          Enter Result
        </button>
      )}

      {editing && (
        <div className="mt-3 space-y-2">
          <textarea
            value={result}
            onChange={(e) => setResult(e.target.value)}
            rows={3}
            autoFocus
            className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none resize-none"
            placeholder="Enter result here…"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !result.trim()}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 active:scale-95 transition-all"
            >
              {saving ? "Saving…" : "✓ Save Result"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Lab visit detail ───────────────────────────────────────────────────────
function LabVisitDetail({ visit, patient, clinicId, onBack }) {
  // Standard lab tests
  const [tests, setTests]               = useState([]);
  const [editingId, setEditingId]       = useState(null);
  const [resultText, setResultText]     = useState("");
  const [saving, setSaving]             = useState(false);
  const [newTestName, setNewTestName]   = useState("");
  const [addingTest, setAddingTest]     = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Specialist investigations requested by doctor
  const [investigations, setInvestigations] = useState([]);

  // Tab: "tests" | "investigations"
  const [tab, setTab] = useState("tests");

  useEffect(() => {
    const q = query(collection(db, "lab_tests"), where("visitId", "==", visit.visitId));
    return onSnapshot(q, (snap) => {
      setTests(snap.docs.map((d) => ({ labTestId: d.id, ...d.data() })));
    });
  }, [visit.visitId]);

  useEffect(() => {
    const q = query(collection(db, "investigations"), where("visitId", "==", visit.visitId));
    return onSnapshot(q, (snap) => {
      setInvestigations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [visit.visitId]);

  useEffect(() => {
    if (visit.status === "waiting") {
      updateDoc(doc(db, "visits", visit.visitId), { status: "in_consultation" }).catch(() => {});
    }
  }, [visit.visitId, visit.status]);

  const handleAddTest = async (name) => {
    const testName = (name || newTestName).trim();
    if (!testName) return;
    setAddingTest(true);
    try {
      await addDoc(collection(db, "lab_tests"), {
        clinicId,
        visitId:   visit.visitId,
        patientId: visit.patientId,
        testName,
        status:    "pending",
        results:   "",
        createdAt: serverTimestamp(),
      });
      setNewTestName("");
      setShowSuggestions(false);
    } catch {
      alert("Failed to add test.");
    }
    setAddingTest(false);
  };

  const handleSaveResult = async (test) => {
    if (!resultText.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "lab_tests", test.labTestId), {
        results:     resultText.trim(),
        status:      "completed",
        completedAt: serverTimestamp(),
      });
      setEditingId(null);
      setResultText("");
    } catch {
      alert("Failed to save result.");
    }
    setSaving(false);
  };

  const allTestsDone = tests.length > 0 && tests.every((t) => t.status === "completed");
  const allInvDone   = investigations.length === 0 || investigations.every((i) => i.status === "COMPLETED");
  const allDone      = allTestsDone && allInvDone;
  const isEmerg      = visit.visitType === "Emergency";

  const testsDone = tests.filter((t) => t.status === "completed").length;
  const invDone   = investigations.filter((i) => i.status === "COMPLETED").length;

  const filteredSuggestions = LAB_TEST_SUGGESTIONS.filter(
    (s) => !newTestName || s.toLowerCase().includes(newTestName.toLowerCase())
  );

  const TABS = [
    { id: "tests",          label: `Lab Tests (${tests.length})` },
    { id: "investigations", label: `Investigations (${investigations.length})` },
  ];

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
              {patient?.gender} · {patient?.phone || "No phone on record"}
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

      {/* Progress summary */}
      {(tests.length > 0 || investigations.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Lab Tests</p>
            <p className="text-xl font-bold text-[#0D2C6E]">{testsDone}<span className="text-sm text-slate-400 font-normal">/{tests.length}</span></p>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: tests.length ? `${(testsDone / tests.length) * 100}%` : "0%", background: "linear-gradient(90deg, #5B21B6, #7C3AED)" }}
              />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Investigations</p>
            <p className="text-xl font-bold text-[#0D2C6E]">{invDone}<span className="text-sm text-slate-400 font-normal">/{investigations.length}</span></p>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: investigations.length ? `${(invDone / investigations.length) * 100}%` : "0%", background: "linear-gradient(90deg, #0D2C6E, #00A9E0)" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id ? "bg-white text-[#0D2C6E] shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Lab Tests tab ── */}
      {tab === "tests" && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          {tests.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No tests added yet</p>
          ) : (
            <div className="space-y-3 mb-4">
              {tests.map((test) => {
                const isEditing = editingId === test.labTestId;
                const isDone    = test.status === "completed";
                return (
                  <div
                    key={test.labTestId}
                    className={`rounded-xl border-2 p-4 transition-all ${isDone ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <p className="font-semibold text-slate-900 text-sm">{test.testName}</p>
                      {!isDone && !isEditing && (
                        <button
                          onClick={() => { setEditingId(test.labTestId); setResultText(""); }}
                          className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-all active:scale-95"
                          style={{ background: "linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)" }}
                        >
                          Enter Results
                        </button>
                      )}
                      {isDone && (
                        <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-2.5 py-1 rounded-full uppercase tracking-wide">
                          ✓ Complete
                        </span>
                      )}
                    </div>
                    {isDone && test.results && (
                      <p className="text-sm text-slate-700 mt-1 leading-relaxed">{test.results}</p>
                    )}
                    {isEditing && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={resultText}
                          onChange={(e) => setResultText(e.target.value)}
                          rows={3}
                          autoFocus
                          className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none resize-none"
                          placeholder="Enter lab results here…"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEditingId(null); setResultText(""); }}
                            className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveResult(test)}
                            disabled={saving || !resultText.trim()}
                            className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 active:scale-95 transition-all"
                          >
                            {saving ? "Saving…" : "✓ Save Result"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add test with suggestions */}
          <div className="pt-3 border-t border-slate-100 relative">
            <div className="flex gap-2">
              <input
                type="text"
                value={newTestName}
                onChange={(e) => { setNewTestName(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTest()}
                className="flex-1 border border-slate-200 rounded-lg px-4 py-2.5 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none"
                placeholder="Add test (e.g. Full Blood Count)…"
              />
              <button
                onClick={() => handleAddTest()}
                disabled={addingTest || !newTestName.trim()}
                className="px-4 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50 active:scale-95 transition-all"
                style={{ background: "linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)" }}
              >
                + Add
              </button>
            </div>
            {/* Suggestion dropdown */}
            {showSuggestions && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSuggestions(false)} />
                <div className="absolute left-0 right-0 top-14 z-20 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-52 overflow-y-auto">
                  {filteredSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => { handleAddTest(s); setShowSuggestions(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-700 transition-colors border-b border-slate-50 last:border-0"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Investigations tab ── */}
      {tab === "investigations" && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          {investigations.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-2xl mb-2">🔬</p>
              <p className="text-sm text-slate-400">No investigations requested by the doctor for this visit.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {investigations.map((inv) => (
                <InvestigationResultRow key={inv.id} inv={inv} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Completion banner */}
      {allDone && (tests.length > 0 || investigations.length > 0) && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <p className="text-sm text-emerald-700 font-semibold">
            ✓ All tests &amp; investigations complete — ready to route patient
          </p>
        </div>
      )}

      {/* Route patient */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <SectionLabel>Route Patient</SectionLabel>
        <SendToMenu visit={visit} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function LabPage({ clinicId, userProfile }) {
  const [visits, setVisits]               = useState([]);
  const [patients, setPatients]           = useState({});
  const [selectedVisit, setSelectedVisit] = useState(null);

  useEffect(() => {
    if (!clinicId) return;
    const q = query(
      collection(db, "visits"),
      where("clinicId", "==", clinicId),
      where("currentDepartment", "==", "lab"),
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
      <LabVisitDetail
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
        title="Laboratory"
        sub={`${visits.length} patient${visits.length !== 1 ? "s" : ""} in lab queue`}
      />

      {sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center shadow-sm">
          <p className="text-4xl mb-3">🔬</p>
          <p className="font-semibold text-slate-700 mb-1">Lab queue is clear</p>
          <p className="text-sm text-slate-400">
            Patients routed here from Reception or Doctor will appear in real time.
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
                  isEmerg ? "border-red-400" : "border-slate-200 hover:border-violet-300"
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
                        {isEmerg && "⚡ "}{visit.visitType} · {time}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                      isEmerg ? "bg-red-100 text-red-700" : "bg-violet-50 text-violet-700"
                    }`}>
                      {isEmerg ? "Emergency" : "In Lab"}
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

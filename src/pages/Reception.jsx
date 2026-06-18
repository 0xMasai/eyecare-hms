import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import {
  collection, query, where, onSnapshot, orderBy, updateDoc, doc
} from "firebase/firestore";
import PatientForm from "../components/PatientForm";
import VisitForm from "../components/VisitForm";
import { format } from "date-fns";

// ── Brand tokens ────────────────────────────────────────────────────────────
// Primary:  #0D2C6E  |  Accent: #00A9E0  |  Surface: #F7F9FC
// ────────────────────────────────────────────────────────────────────────────

const SEND_TO_OPTIONS = [
  { value: "observations",  label: "Observations",    icon: "🩺" },  // ← default first stop
  { value: "consultation",  label: "Doctor",          icon: "👨‍⚕️" },
  { value: "lab",           label: "Lab",             icon: "🔬" },
  { value: "pharmacy",      label: "Pharmacy",        icon: "💊" },
  { value: "billing",       label: "Billing",         icon: "💳" },
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
      alert("Failed to update. Check connection.");
    }
    setSending(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={sending}
        style={{ background: "linear-gradient(135deg, #0D2C6E 0%, #1a3f94 100%)" }}
        className="text-white px-4 py-2 rounded-lg text-xs font-semibold tracking-wide whitespace-nowrap active:scale-95 transition-all shadow-sm disabled:opacity-60 flex items-center gap-1.5"
      >
        {sending ? (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Routing…
          </span>
        ) : (
          <>Route <span className="opacity-70">→</span></>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-20 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden w-48"
               style={{ boxShadow: "0 20px 60px rgba(13,44,110,0.15)" }}>
            <div className="px-4 py-2.5 border-b border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Send to department</p>
            </div>
            {SEND_TO_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSend(opt)}
                className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
            <div className="border-t border-slate-100">
              <button
                onClick={async () => {
                  setSending(true);
                  await updateDoc(doc(db, "visits", visit.visitId), {
                    currentDepartment: "done",
                    status: "done",
                  });
                  setOpen(false);
                  setSending(false);
                }}
                className="w-full text-left px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center gap-3"
              >
                <span>✓</span>
                <span>Mark Complete</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PatientCard({ patient, onStartVisit }) {
  const initials = `${patient.firstName?.[0] || ""}${patient.lastName?.[0] || ""}`;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 hover:border-[#00A9E0] hover:shadow-sm transition-all">
      <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm text-white"
           style={{ background: "linear-gradient(135deg, #0D2C6E 0%, #00A9E0 100%)" }}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 truncate text-sm">
          {patient.firstName} {patient.lastName}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {patient.gender} · {patient.phone || "No phone on record"}
        </p>
      </div>
      <button
        onClick={() => onStartVisit(patient)}
        className="text-xs font-semibold text-[#0D2C6E] border border-[#0D2C6E] px-3 py-1.5 rounded-lg hover:bg-[#0D2C6E] hover:text-white transition-all active:scale-95"
      >
        + Visit
      </button>
    </div>
  );
}

const DEPT_META = {
  reception:    { label: "Reception",   color: "bg-slate-100 text-slate-600",    border: "border-slate-300"    },
  consultation: { label: "Doctor",      color: "bg-blue-50 text-blue-700",       border: "border-blue-300"     },
  lab:          { label: "Laboratory",  color: "bg-violet-50 text-violet-700",   border: "border-violet-300"   },
  pharmacy:     { label: "Pharmacy",    color: "bg-amber-50 text-amber-700",     border: "border-amber-300"    },
  billing:      { label: "Billing",     color: "bg-emerald-50 text-emerald-700", border: "border-emerald-300"  },
  done:         { label: "Discharged",  color: "bg-emerald-50 text-emerald-800", border: "border-emerald-400"  },
};

function VisitQueueCard({ visit, patientName }) {
  const dept    = visit.currentDepartment || "reception";
  const meta    = DEPT_META[dept] || DEPT_META.reception;
  const isHere  = dept === "reception";
  const isEmerg = visit.visitType === "Emergency";
  const time    = visit.createdAt?.toDate
    ? format(visit.createdAt.toDate(), "HH:mm")
    : "--:--";

  return (
    <div className={`bg-white rounded-xl border ${meta.border} p-4 transition-all ${isEmerg ? "border-l-4 border-l-red-500" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${isEmerg ? "bg-red-100 text-red-600" : "bg-[#EEF3FF] text-[#0D2C6E]"}`}>
            {patientName.split(" ").map(n => n[0]).slice(0,2).join("")}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${meta.color}`}>
                {meta.label}
              </span>
              {isEmerg && (
                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full uppercase tracking-wide">
                  ⚡ Emergency
                </span>
              )}
            </div>
            <p className="font-semibold text-slate-900 text-sm truncate">{patientName}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{visit.visitType} · {time}</p>
          </div>
        </div>
        {isHere && <SendToMenu visit={visit} />}
      </div>
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ value, label, accent }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
      <p className="text-2xl font-bold" style={{ color: accent }}>{value}</p>
      <p className="text-[11px] text-slate-500 font-medium mt-0.5 uppercase tracking-wide">{label}</p>
    </div>
  );
}

// ── Page header ────────────────────────────────────────────────────────────
function PageHeader({ title, sub, actions }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-1 h-5 rounded-full" style={{ background: "#00A9E0" }} />
          <h1 className="text-xl font-bold text-[#0D2C6E] tracking-tight">{title}</h1>
        </div>
        <p className="text-xs text-slate-500 pl-3">{sub}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">{actions}</div>
    </div>
  );
}

// ── Section label ──────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5 pl-0.5">
      {children}
    </p>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function Reception({ clinicId, userProfile }) {
  const [view, setView]                   = useState("queue");
  const [patients, setPatients]           = useState([]);
  const [visits, setVisits]               = useState([]);
  const [searchQuery, setSearchQuery]     = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientMap, setPatientMap]       = useState({});

  useEffect(() => {
    if (!clinicId) return;
    const q = query(
      collection(db, "patients"),
      where("clinicId", "==", clinicId),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ patientId: d.id, ...d.data() }));
      setPatients(data);
      const map = {};
      data.forEach((p) => { map[p.patientId] = `${p.firstName} ${p.lastName}`; });
      setPatientMap(map);
    });
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, "visits"),
      where("clinicId", "==", clinicId),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ visitId: d.id, ...d.data() }));
      setVisits(data.filter((v) => {
        if (!v.createdAt?.toDate) return true;
        return v.createdAt.toDate() >= today;
      }));
    });
  }, [clinicId]);

  const filteredPatients = patients.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.firstName?.toLowerCase().includes(q) ||
      p.lastName?.toLowerCase().includes(q) ||
      p.phone?.includes(q)
    );
  });

  const receptionVisits = visits.filter(
    (v) => !v.currentDepartment || v.currentDepartment === "reception"
  );
  const routedVisits = visits.filter(
    (v) => v.currentDepartment && v.currentDepartment !== "reception"
  );
  const activeCount  = visits.filter((v) => v.status !== "done").length;

  // ── Sub-views ──────────────────────────────────────────────────────────
  if (view === "register") {
    return (
      <PatientForm
        clinicId={clinicId}
        onSuccess={(patient) => { setSelectedPatient(patient); setView("startVisit"); }}
        onCancel={() => setView("queue")}
      />
    );
  }

  if (view === "startVisit" && selectedPatient) {
    return (
      <VisitForm
        clinicId={clinicId}
        patient={selectedPatient}
        onSuccess={() => { setSelectedPatient(null); setView("queue"); }}
        onCancel={() => setView(selectedPatient._fromSearch ? "search" : "queue")}
      />
    );
  }

  if (view === "search") {
    return (
      <div className="space-y-4" style={{ background: "#F7F9FC", minHeight: "100vh", padding: "1rem" }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setView("queue"); setSearchQuery(""); }}
            className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:border-[#0D2C6E] transition-colors shadow-sm"
          >
            ←
          </button>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-[#00A9E0]" />
              <h2 className="text-lg font-bold text-[#0D2C6E]">Patient Search</h2>
            </div>
          </div>
        </div>

        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm bg-white shadow-sm focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none"
            placeholder="Search by name or phone number…"
            autoFocus
          />
        </div>

        {searchQuery && (
          <div className="space-y-2">
            {filteredPatients.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-xl border border-slate-200">
                <p className="text-3xl mb-2">🔍</p>
                <p className="font-semibold text-slate-700 mb-1">No patient found</p>
                <p className="text-sm text-slate-400 mb-4">No records match "{searchQuery}"</p>
                <button
                  onClick={() => setView("register")}
                  className="text-sm font-semibold text-[#0D2C6E] border border-[#0D2C6E] px-4 py-2 rounded-lg hover:bg-[#0D2C6E] hover:text-white transition-all"
                >
                  Register as new patient →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPatients.slice(0, 10).map((p) => (
                  <PatientCard
                    key={p.patientId}
                    patient={p}
                    onStartVisit={(patient) => {
                      setSelectedPatient({ ...patient, _fromSearch: true });
                      setView("startVisit");
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Main queue view ────────────────────────────────────────────────────
  return (
    <div className="space-y-5" style={{ background: "#F7F9FC", minHeight: "100vh", padding: "1rem" }}>
      <PageHeader
        title="Reception"
        sub={`${visits.length} visits today · ${activeCount} active`}
        actions={
          <>
            <button
              onClick={() => setView("search")}
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 bg-white hover:border-[#0D2C6E] hover:text-[#0D2C6E] transition-all shadow-sm"
            >
              🔍 Search
            </button>
            <button
              onClick={() => setView("register")}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-white transition-all active:scale-95 shadow-sm"
              style={{ background: "linear-gradient(135deg, #0D2C6E 0%, #1a3f94 100%)" }}
            >
              + Register Patient
            </button>
          </>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={receptionVisits.length}                                         label="At Reception"   accent="#D97706" />
        <StatCard value={routedVisits.filter(v => v.status !== "done").length}           label="In Progress"    accent="#0D2C6E" />
        <StatCard value={visits.filter(v => v.status === "done").length}                 label="Discharged"     accent="#059669" />
      </div>

      {/* Waiting at reception */}
      <div>
        <SectionLabel>Waiting at Reception ({receptionVisits.length})</SectionLabel>
        {receptionVisits.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <p className="text-4xl mb-3">🏥</p>
            <p className="font-semibold text-slate-700 mb-1">No patients waiting</p>
            <p className="text-sm text-slate-400 mb-4">Register a patient or search existing records to begin</p>
            <button
              onClick={() => setView("register")}
              className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg shadow-sm transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #0D2C6E 0%, #1a3f94 100%)" }}
            >
              Register First Patient
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {[
              ...receptionVisits.filter((v) => v.visitType === "Emergency"),
              ...receptionVisits.filter((v) => v.visitType !== "Emergency"),
            ].map((visit) => (
              <VisitQueueCard
                key={visit.visitId}
                visit={visit}
                patientName={patientMap[visit.patientId] || "Unknown Patient"}
              />
            ))}
          </div>
        )}
      </div>

      {/* Patient tracker */}
      {routedVisits.length > 0 && (
        <div>
          <SectionLabel>Patient Tracker — Today ({routedVisits.length})</SectionLabel>
          <div className="space-y-2">
            {routedVisits.map((visit) => (
              <VisitQueueCard
                key={visit.visitId}
                visit={visit}
                patientName={patientMap[visit.patientId] || "Unknown Patient"}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent patients */}
      <div>
        <SectionLabel>Recent Patients</SectionLabel>
        <div className="space-y-2">
          {patients.slice(0, 5).map((p) => (
            <PatientCard
              key={p.patientId}
              patient={p}
              onStartVisit={(patient) => {
                setSelectedPatient(patient);
                setView("startVisit");
              }}
            />
          ))}
          {patients.length === 0 && (
            <div className="text-center py-6 text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
              No patients registered yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { format } from "date-fns";
import Table from "../components/ui/Table";
import Modal from "../components/ui/Modal";
import StatusBadge from "../components/ui/StatusBadge";
import FormField from "../components/ui/FormField";
import { scheduleSurgery } from "../services/surgeryService";
import SurgeryDetail from "./SurgeryDetail";

// ── Brand tokens ────────────────────────────────────────────────────────────
// Primary:  #0D2C6E  |  Accent: #00A9E0  |  Surface: #F7F9FC
// ────────────────────────────────────────────────────────────────────────────

const THEATRE_ROOMS = ["OT 1", "OT 2", "OT 3"]; // adjust to match your facility's actual theatres
const SURGERY_TYPES = ["Elective", "Emergency"];

// ── Schedule Surgery modal ────────────────────────────────────────────────
function ScheduleSurgeryModal({ open, onClose, clinicId, patientsById, activeAdmissionsByPatientId, doctors }) {
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [procedureName, setProcedureName] = useState("");
  const [surgeryType, setSurgeryType] = useState("Elective");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [theatreRoom, setTheatreRoom] = useState(THEATRE_ROOMS[0]);
  const [surgeon, setSurgeon] = useState("");
  const [anesthetist, setAnesthetist] = useState("");
  const [assistants, setAssistants] = useState("");
  const [nurses, setNurses] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const patientResults = !search
    ? []
    : Object.values(patientsById).filter((p) => {
        const q = search.toLowerCase();
        return (
          p.firstName?.toLowerCase().includes(q) ||
          p.lastName?.toLowerCase().includes(q) ||
          p.phone?.includes(q)
        );
      });

  const linkedAdmission = selectedPatient ? activeAdmissionsByPatientId[selectedPatient.patientId] : null;

  const reset = () => {
    setSearch(""); setSelectedPatient(null); setProcedureName(""); setSurgeryType("Elective");
    setDate(""); setStartTime(""); setEndTime(""); setTheatreRoom(THEATRE_ROOMS[0]);
    setSurgeon(""); setAnesthetist(""); setAssistants(""); setNurses(""); setError("");
  };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!selectedPatient || !procedureName || !date || !startTime || !endTime) {
      setError("Fill in patient, procedure, date, and both times before scheduling.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await scheduleSurgery(clinicId, {
        patientId: selectedPatient.patientId,
        patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
        admissionId: linkedAdmission?.admissionId || null,
        procedureName,
        surgeryType,
        date,
        startTime: `${date}T${startTime}`,
        endTime: `${date}T${endTime}`,
        theatreRoom,
        team: {
          surgeon, anesthetist,
          assistants: assistants.split(",").map((s) => s.trim()).filter(Boolean),
          nurses: nurses.split(",").map((s) => s.trim()).filter(Boolean),
        },
      });
      handleClose();
    } catch (e) {
      setError(e.message || "Failed to schedule surgery.");
    }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={handleClose} title="Schedule Surgery" maxWidth="max-w-lg">
      <div className="space-y-4">
        {!selectedPatient ? (
          <div>
            <FormField label="Find Patient" value={search} onChange={setSearch} placeholder="Search by name or phone…" />
            {search && (
              <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
                {patientResults.length === 0 ? (
                  <p className="text-xs text-slate-400 px-1">No matching patient found.</p>
                ) : (
                  patientResults.slice(0, 8).map((p) => (
                    <button
                      key={p.patientId}
                      onClick={() => setSelectedPatient(p)}
                      className="w-full text-left px-3 py-2 rounded-lg border border-slate-100 hover:border-[#00A9E0] hover:bg-slate-50 text-sm transition-colors"
                    >
                      <span className="font-medium text-slate-800">{p.firstName} {p.lastName}</span>
                      <span className="text-slate-400 ml-2">{p.gender} · {p.phone || "no phone"}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5">
              <div>
                <p className="font-semibold text-sm text-slate-800">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                <p className="text-xs text-slate-400">
                  {linkedAdmission
                    ? `Currently admitted · ${linkedAdmission.wardType === "male" ? "Male" : "Female"} Ward, Bed ${linkedAdmission.bedNumber}`
                    : "Not currently admitted"}
                </p>
              </div>
              <button onClick={() => setSelectedPatient(null)} className="text-xs text-[#00A9E0] font-semibold">Change</button>
            </div>

            <FormField label="Procedure" value={procedureName} onChange={setProcedureName} placeholder="Appendectomy" />

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Surgery Type" type="select" options={SURGERY_TYPES} value={surgeryType} onChange={setSurgeryType} />
              <FormField label="Theatre Room" type="select" options={THEATRE_ROOMS} value={theatreRoom} onChange={setTheatreRoom} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FormField label="Date" type="date" value={date} onChange={setDate} />
              <FormField label="Start" type="time" value={startTime} onChange={setStartTime} />
              <FormField label="End" type="time" value={endTime} onChange={setEndTime} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[0.7rem] font-semibold text-slate-500 mb-1 tracking-wide uppercase">Surgeon</label>
                <input
                  list="surgeon-options"
                  value={surgeon}
                  onChange={(e) => setSurgeon(e.target.value)}
                  placeholder="Dr. Name"
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-slate-900 outline-none border-2 border-slate-100 bg-slate-50 focus:border-[#00A9E0] focus:bg-white transition-colors"
                />
                <datalist id="surgeon-options">
                  {doctors.map((d) => <option key={d} value={d} />)}
                </datalist>
              </div>
              <FormField label="Anesthetist" value={anesthetist} onChange={setAnesthetist} placeholder="Name" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Assistants" value={assistants} onChange={setAssistants} placeholder="Comma-separated names" />
              <FormField label="Nurses" value={nurses} onChange={setNurses} placeholder="Comma-separated names" />
            </div>

            {error && (
              <div className="rounded-lg px-4 py-3 bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
            )}

            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #0D2C6E 0%, #1a3f94 100%)" }}
            >
              {saving ? "Scheduling…" : "Schedule Surgery →"}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function OperatingTheatre({ clinicId, userProfile }) {
  const [surgeries, setSurgeries]     = useState([]);
  const [patientsById, setPatientsById] = useState({});
  const [admissions, setAdmissions]   = useState([]);
  const [doctors, setDoctors]         = useState([]);
  const [statusFilter, setStatusFilter] = useState("upcoming");
  const [search, setSearch]           = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [selectedSurgeryId, setSelectedSurgeryId] = useState(null);

  useEffect(() => {
    if (!clinicId) return;
    const q = query(collection(db, "patients"), where("clinicId", "==", clinicId));
    return onSnapshot(q, (snap) => {
      const map = {};
      snap.docs.forEach((d) => { map[d.id] = { patientId: d.id, ...d.data() }; });
      setPatientsById(map);
    });
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId) return;
    const q = query(collection(db, "users"), where("clinicId", "==", clinicId), where("role", "==", "doctor"));
    return onSnapshot(q, (snap) => setDoctors(snap.docs.map((d) => d.data().name).filter(Boolean)));
  }, [clinicId]);

  // Clinic-wide admissions (not ward-filtered) so a surgery can auto-link to
  // whichever ward bed the patient currently holds, regardless of which ward.
  useEffect(() => {
    if (!clinicId) return;
    const q = query(collection(db, "admissions"), where("clinicId", "==", clinicId));
    return onSnapshot(q, (snap) => setAdmissions(snap.docs.map((d) => ({ admissionId: d.id, ...d.data() }))));
  }, [clinicId]);

  // NOTE: filters on clinicId + orders by startTime — Firestore will prompt
  // a one-click "create index" link the first time this runs.
  useEffect(() => {
    if (!clinicId) return;
    const q = query(collection(db, "surgeries"), where("clinicId", "==", clinicId), orderBy("startTime", "asc"));
    return onSnapshot(q, (snap) => setSurgeries(snap.docs.map((d) => ({ surgeryId: d.id, ...d.data() }))));
  }, [clinicId]);

  const activeAdmissionsByPatientId = {};
  admissions.forEach((a) => {
    if (a.status !== "discharged") activeAdmissionsByPatientId[a.patientId] = a;
  });

  const filtered = surgeries.filter((s) => {
    if (statusFilter === "upcoming" && (s.status === "completed" || s.status === "cancelled")) return false;
    if (statusFilter !== "upcoming" && statusFilter !== "all" && s.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return s.patientName?.toLowerCase().includes(q) || s.procedureName?.toLowerCase().includes(q);
  });

  // Derived from the live list, not a frozen copy, so status changes made
  // inside the detail panel are reflected immediately.
  const selectedSurgery = surgeries.find((s) => s.surgeryId === selectedSurgeryId) || null;

  const columns = [
    {
      key: "patientName", label: "Patient",
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900">{r.patientName}</p>
          <p className="text-[11px] text-slate-400">{r.procedureName}</p>
        </div>
      ),
    },
    {
      key: "surgeryType", label: "Type",
      render: (r) => (
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
          r.surgeryType === "Emergency" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
        }`}>
          {r.surgeryType}
        </span>
      ),
    },
    {
      key: "startTime", label: "When",
      render: (r) => (r.startTime?.toDate ? format(r.startTime.toDate(), "dd MMM, HH:mm") : "—"),
    },
    { key: "theatreRoom", label: "Theatre" },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  const todayCount = surgeries.filter((s) => s.date === format(new Date(), "yyyy-MM-dd")).length;
  const ongoingCount = surgeries.filter((s) => s.status === "ongoing").length;

  return (
    <div className="space-y-4" style={{ background: "#F7F9FC", minHeight: "100vh", padding: "1rem" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-1 h-5 rounded-full" style={{ background: "#00A9E0" }} />
            <h1 className="text-xl font-bold text-[#0D2C6E] tracking-tight">Operating Theatre</h1>
          </div>
          <p className="text-xs text-slate-500 pl-3">{todayCount} today · {ongoingCount} in progress</p>
        </div>
        <button
          onClick={() => setShowSchedule(true)}
          className="px-4 py-2.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap active:scale-95 transition-all shadow-sm"
          style={{ background: "linear-gradient(135deg, #0D2C6E 0%, #1a3f94 100%)" }}
        >
          + Schedule Surgery
        </button>
      </div>

      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by patient or procedure…"
          className="flex-1 rounded-lg px-3 py-2.5 text-sm border-2 border-slate-100 bg-white focus:border-[#00A9E0] outline-none transition-colors"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg px-3 py-2.5 text-sm border-2 border-slate-100 bg-white focus:border-[#00A9E0] outline-none transition-colors"
        >
          <option value="upcoming">Upcoming</option>
          <option value="scheduled">Scheduled</option>
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="all">All</option>
        </select>
      </div>

      <Table
        columns={columns}
        rows={filtered}
        onRowClick={(row) => setSelectedSurgeryId(row.surgeryId)}
        emptyIcon="🔪"
        emptyLabel="No surgeries match this view"
      />

      <ScheduleSurgeryModal
        open={showSchedule}
        onClose={() => setShowSchedule(false)}
        clinicId={clinicId}
        patientsById={patientsById}
        activeAdmissionsByPatientId={activeAdmissionsByPatientId}
        doctors={doctors}
      />

      {selectedSurgery && (
        <SurgeryDetail
          surgery={selectedSurgery}
          clinicId={clinicId}
          userProfile={userProfile}
          onClose={() => setSelectedSurgeryId(null)}
        />
      )}
    </div>
  );
}

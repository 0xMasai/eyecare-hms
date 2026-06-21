import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { format } from "date-fns";
import Table from "../components/ui/Table";
import Modal from "../components/ui/Modal";
import StatusBadge from "../components/ui/StatusBadge";
import FormField from "../components/ui/FormField";
import { ensureBedsSeeded, admitPatient } from "../services/wardService";
import AdmissionDetail from "./AdmissionDetail";

// ── Brand tokens ────────────────────────────────────────────────────────────
// Primary:  #0D2C6E  |  Accent: #00A9E0  |  Surface: #F7F9FC
// ────────────────────────────────────────────────────────────────────────────

const WARD_LABEL = { male: "Male Ward", female: "Female Ward" };

// ── Bed allocation strip ─────────────────────────────────────────────────
function BedStrip({ beds }) {
  const free = beds.filter((b) => b.status === "available").length;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
        Bed Allocation — {free} of {beds.length} free
      </p>
      <div className="flex flex-wrap gap-2">
        {beds.map((b) => (
          <div
            key={b.bedNumber}
            title={b.status === "available" ? "Available" : "Occupied"}
            className={`w-14 h-12 rounded-lg flex flex-col items-center justify-center text-[11px] font-bold ${
              b.status === "available"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-slate-100 text-slate-500 border border-slate-200"
            }`}
          >
            <span>{b.bedNumber}</span>
            <span className="text-[8px] font-medium opacity-70">{b.status === "available" ? "free" : "full"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Admit Patient modal ──────────────────────────────────────────────────
function AdmitModal({ open, onClose, clinicId, wardType, patientsById, beds, doctors }) {
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [age, setAge] = useState("");
  const [bedNumber, setBedNumber] = useState("");
  const [doctorAssigned, setDoctorAssigned] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const availableBeds = beds.filter((b) => b.status === "available");
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

  const reset = () => {
    setSearch(""); setSelectedPatient(null); setAge(""); setBedNumber("");
    setDoctorAssigned(""); setDiagnosis(""); setError("");
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!selectedPatient || !bedNumber) { setError("Select a patient and a bed before admitting."); return; }
    setSaving(true);
    setError("");
    try {
      await admitPatient(clinicId, {
        patientId: selectedPatient.patientId,
        patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
        age, gender: selectedPatient.gender, wardType, bedNumber,
        doctorAssigned, diagnosis,
      });
      handleClose();
    } catch (e) {
      setError(e.message || "Failed to admit patient.");
    }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={handleClose} title={`Admit Patient — ${WARD_LABEL[wardType]}`} maxWidth="max-w-md">
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
                <p className="text-xs text-slate-400">{selectedPatient.gender} · {selectedPatient.phone || "no phone"}</p>
              </div>
              <button onClick={() => setSelectedPatient(null)} className="text-xs text-[#00A9E0] font-semibold">Change</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Age" type="number" value={age} onChange={setAge} placeholder="34" />
              <div>
                <label className="block text-[0.7rem] font-semibold text-slate-500 mb-1 tracking-wide uppercase">Bed</label>
                <select
                  value={bedNumber}
                  onChange={(e) => setBedNumber(e.target.value)}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-slate-900 outline-none border-2 border-slate-100 bg-slate-50 focus:border-[#00A9E0] focus:bg-white transition-colors"
                >
                  <option value="">Select bed…</option>
                  {availableBeds.map((b) => (
                    <option key={b.bedNumber} value={b.bedNumber}>{b.bedNumber}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[0.7rem] font-semibold text-slate-500 mb-1 tracking-wide uppercase">Doctor Assigned</label>
              <input
                list="doctor-options"
                value={doctorAssigned}
                onChange={(e) => setDoctorAssigned(e.target.value)}
                placeholder="Dr. Name"
                className="w-full rounded-lg px-3 py-2.5 text-sm text-slate-900 outline-none border-2 border-slate-100 bg-slate-50 focus:border-[#00A9E0] focus:bg-white transition-colors"
              />
              <datalist id="doctor-options">
                {doctors.map((d) => <option key={d} value={d} />)}
              </datalist>
            </div>

            <FormField label="Diagnosis" type="textarea" value={diagnosis} onChange={setDiagnosis} placeholder="Working diagnosis / reason for admission…" />

            {error && (
              <div className="rounded-lg px-4 py-3 bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
            )}

            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #0D2C6E 0%, #1a3f94 100%)" }}
            >
              {saving ? "Admitting…" : `Admit to ${WARD_LABEL[wardType]} →`}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function WardPage({ clinicId, userProfile, wardType }) {
  const [admissions, setAdmissions]   = useState([]);
  const [patientsById, setPatientsById] = useState({});
  const [beds, setBeds]               = useState([]);
  const [doctors, setDoctors]         = useState([]);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [showAdmit, setShowAdmit]     = useState(false);
  const [selectedAdmissionId, setSelectedAdmissionId] = useState(null);

  // One-time bed provisioning, safe to call repeatedly.
  useEffect(() => { if (clinicId) ensureBedsSeeded(clinicId, wardType); }, [clinicId, wardType]);

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

  useEffect(() => {
    if (!clinicId) return;
    const q = query(collection(db, "beds"), where("clinicId", "==", clinicId), where("wardType", "==", wardType));
    return onSnapshot(q, (snap) => {
      setBeds(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.bedNumber.localeCompare(b.bedNumber)));
    });
  }, [clinicId, wardType]);

  // NOTE: this query filters on clinicId + wardType and orders by admissionDate —
  // Firestore will prompt a one-click "create index" link the first time it runs.
  useEffect(() => {
    if (!clinicId) return;
    const q = query(
      collection(db, "admissions"),
      where("clinicId", "==", clinicId),
      where("wardType", "==", wardType),
      orderBy("admissionDate", "desc")
    );
    return onSnapshot(q, (snap) => {
      setAdmissions(snap.docs.map((d) => ({ admissionId: d.id, ...d.data() })));
    });
  }, [clinicId, wardType]);

  const filtered = admissions.filter((a) => {
    if (statusFilter === "active" && a.status === "discharged") return false;
    if (statusFilter !== "active" && statusFilter !== "all" && a.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return a.patientName?.toLowerCase().includes(q) || a.bedNumber?.toLowerCase().includes(q);
  });

  // Derive the selected admission from the live list (rather than a frozen
  // copy) so the detail panel always reflects the latest condition/status.
  const selectedAdmission = admissions.find((a) => a.admissionId === selectedAdmissionId) || null;

  const columns = [
    {
      key: "patientName", label: "Patient",
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900">{r.patientName}</p>
          <p className="text-[11px] text-slate-400">{r.age ? `${r.age} yrs · ` : ""}{r.gender || "—"}</p>
        </div>
      ),
    },
    { key: "bedNumber", label: "Bed" },
    { key: "doctorAssigned", label: "Doctor", render: (r) => r.doctorAssigned || "—" },
    {
      key: "admissionDate", label: "Admitted",
      render: (r) => (r.admissionDate?.toDate ? format(r.admissionDate.toDate(), "dd MMM, HH:mm") : "—"),
    },
    {
      key: "status", label: "Status",
      render: (r) => <StatusBadge status={r.status === "discharged" ? "discharged" : r.condition} />,
    },
  ];

  const activeCount = admissions.filter((a) => a.status !== "discharged").length;
  const occupiedBeds = beds.filter((b) => b.status !== "available").length;

  return (
    <div className="space-y-4" style={{ background: "#F7F9FC", minHeight: "100vh", padding: "1rem" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-1 h-5 rounded-full" style={{ background: "#00A9E0" }} />
            <h1 className="text-xl font-bold text-[#0D2C6E] tracking-tight">{WARD_LABEL[wardType]}</h1>
          </div>
          <p className="text-xs text-slate-500 pl-3">{activeCount} admitted · {occupiedBeds}/{beds.length} beds in use</p>
        </div>
        <button
          onClick={() => setShowAdmit(true)}
          className="px-4 py-2.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap active:scale-95 transition-all shadow-sm"
          style={{ background: "linear-gradient(135deg, #0D2C6E 0%, #1a3f94 100%)" }}
        >
          + Admit Patient
        </button>
      </div>

      <BedStrip beds={beds} />

      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by patient or bed…"
          className="flex-1 rounded-lg px-3 py-2.5 text-sm border-2 border-slate-100 bg-white focus:border-[#00A9E0] outline-none transition-colors"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg px-3 py-2.5 text-sm border-2 border-slate-100 bg-white focus:border-[#00A9E0] outline-none transition-colors"
        >
          <option value="active">Active</option>
          <option value="admitted">Admitted</option>
          <option value="in_surgery">In Surgery</option>
          <option value="discharged">Discharged</option>
          <option value="all">All</option>
        </select>
      </div>

      <Table
        columns={columns}
        rows={filtered}
        onRowClick={(row) => setSelectedAdmissionId(row.admissionId)}
        emptyIcon="🛏️"
        emptyLabel="No patients match this view"
      />

      <AdmitModal
        open={showAdmit}
        onClose={() => setShowAdmit(false)}
        clinicId={clinicId}
        wardType={wardType}
        patientsById={patientsById}
        beds={beds}
        doctors={doctors}
      />

      {selectedAdmission && (
        <AdmissionDetail
          admission={selectedAdmission}
          clinicId={clinicId}
          userProfile={userProfile}
          onClose={() => setSelectedAdmissionId(null)}
        />
      )}
    </div>
  );
}

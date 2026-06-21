import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { format } from "date-fns";
import Modal from "../components/ui/Modal";
import FormField from "../components/ui/FormField";
import StatusBadge from "../components/ui/StatusBadge";
import {
  updatePreOp, updateSurgeryStatus, updateIntraOp, completeSurgery, cancelSurgery,
} from "../services/surgeryService";

const TABS = ["Pre-Op", "Intra-Op", "Post-Op"];

export default function SurgeryDetail({ surgery, clinicId, userProfile, onClose }) {
  const [tab, setTab] = useState("Pre-Op");
  const [busy, setBusy] = useState(false);

  const locked = surgery.status === "completed" || surgery.status === "cancelled";

  const start = async () => { setBusy(true); await updateSurgeryStatus(surgery, "ongoing"); setBusy(false); };
  const cancel = async () => { setBusy(true); await cancelSurgery(surgery.surgeryId); setBusy(false); onClose(); };

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth="max-w-2xl"
      title={surgery.patientName}
      subtitle={`${surgery.procedureName} · ${surgery.theatreRoom} · ${
        surgery.startTime?.toDate ? format(surgery.startTime.toDate(), "dd MMM, HH:mm") : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <StatusBadge status={surgery.status} />
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
          surgery.surgeryType === "Emergency" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
        }`}>
          {surgery.surgeryType}
        </span>
        {surgery.status === "scheduled" && (
          <div className="ml-auto flex gap-2">
            <button onClick={cancel} disabled={busy} className="text-[11px] font-semibold text-slate-400 hover:text-red-600">
              Cancel
            </button>
            <button
              onClick={start}
              disabled={busy}
              className="text-[11px] font-semibold text-white px-3 py-1.5 rounded-full"
              style={{ background: "#0D2C6E" }}
            >
              {busy ? "Starting…" : "Start Surgery →"}
            </button>
          </div>
        )}
      </div>

      <div className="bg-slate-50 rounded-lg px-3 py-2.5 mb-4 text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
        <span><strong className="text-slate-800">Surgeon:</strong> {surgery.team?.surgeon || "—"}</span>
        <span><strong className="text-slate-800">Anesthetist:</strong> {surgery.team?.anesthetist || "—"}</span>
        {surgery.team?.assistants?.length > 0 && (
          <span><strong className="text-slate-800">Assistants:</strong> {surgery.team.assistants.join(", ")}</span>
        )}
        {surgery.team?.nurses?.length > 0 && (
          <span><strong className="text-slate-800">Nurses:</strong> {surgery.team.nurses.join(", ")}</span>
        )}
      </div>

      <div className="flex gap-1 mb-4 border-b border-slate-100 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
              tab === t ? "border-[#00A9E0] text-[#0D2C6E]" : "border-transparent text-slate-400"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Pre-Op" && <PreOpTab surgery={surgery} disabled={locked} />}
      {tab === "Intra-Op" && <IntraOpTab surgery={surgery} disabled={locked} />}
      {tab === "Post-Op" && <PostOpTab surgery={surgery} clinicId={clinicId} onClose={onClose} />}
    </Modal>
  );
}

/* ── Pre-Op ───────────────────────────────────────────────────────────── */
function PreOpTab({ surgery, disabled }) {
  const [diagnosis, setDiagnosis] = useState(surgery.preOp?.diagnosis || "");
  const [consentStatus, setConsentStatus] = useState(surgery.preOp?.consentStatus || "pending");
  const [labResults, setLabResults] = useState(surgery.preOp?.labResults || "");
  const [notes, setNotes] = useState(surgery.preOp?.notes || "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    await updatePreOp(surgery.surgeryId, { diagnosis, consentStatus, labResults, notes });
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <FormField label="Diagnosis" type="textarea" value={diagnosis} onChange={setDiagnosis} placeholder="Pre-operative diagnosis…" />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Consent Status" type="select" options={["pending", "signed"]} value={consentStatus} onChange={setConsentStatus} />
        <FormField label="Lab Results" value={labResults} onChange={setLabResults} placeholder="Hb 12.5, normal coag…" />
      </div>
      <FormField label="Pre-Op Notes" type="textarea" value={notes} onChange={setNotes} placeholder="Fitness for surgery, allergies, special instructions…" />
      {!disabled && (
        <button
          onClick={submit}
          disabled={saving}
          className="text-xs font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-50"
          style={{ background: "#0D2C6E" }}
        >
          {saving ? "Saving…" : "Save Pre-Op Details"}
        </button>
      )}
    </div>
  );
}

/* ── Intra-Op ─────────────────────────────────────────────────────────── */
function IntraOpTab({ surgery, disabled }) {
  const [procedureDetails, setProcedureDetails] = useState(surgery.intraOp?.procedureDetails || "");
  const [complications, setComplications] = useState(surgery.intraOp?.complications || "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    await updateIntraOp(surgery.surgeryId, { procedureDetails, complications });
    setSaving(false);
  };

  if (surgery.status === "scheduled") {
    return <p className="text-xs text-slate-400">Intra-op details open once the surgery starts.</p>;
  }

  return (
    <div className="space-y-3">
      <FormField label="Procedure Details" type="textarea" value={procedureDetails} onChange={setProcedureDetails} placeholder="Steps performed, findings…" />
      <FormField label="Complications" type="textarea" value={complications} onChange={setComplications} placeholder="None, or describe…" />
      {!disabled && (
        <button
          onClick={submit}
          disabled={saving}
          className="text-xs font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-50"
          style={{ background: "#0D2C6E" }}
        >
          {saving ? "Saving…" : "Save Intra-Op Details"}
        </button>
      )}
    </div>
  );
}

/* ── Post-Op + complete & auto-route ─────────────────────────────────── */
function PostOpTab({ surgery, clinicId, onClose }) {
  const [recoveryStatus, setRecoveryStatus] = useState(surgery.postOp?.recoveryStatus || "");
  const [notes, setNotes] = useState(surgery.postOp?.notes || "");
  const [transferredToWard, setTransferredToWard] = useState(
    surgery.postOp?.transferredToWard || (surgery.admissionId ? "" : "male")
  );
  const [recoveryBed, setRecoveryBed] = useState("");
  const [beds, setBeds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // A standalone surgery (no prior ward admission) needs a fresh bed on
  // completion; one tied to an existing admission just releases its hold.
  const needsNewBed = !surgery.admissionId;

  useEffect(() => {
    if (!needsNewBed || !transferredToWard || !clinicId) return;
    const q = query(collection(db, "beds"), where("clinicId", "==", clinicId), where("wardType", "==", transferredToWard));
    return onSnapshot(q, (snap) => setBeds(snap.docs.map((d) => d.data())));
  }, [needsNewBed, transferredToWard, clinicId]);

  const isCompleted = surgery.status === "completed";

  const submit = async () => {
    if (needsNewBed && (!transferredToWard || !recoveryBed)) {
      setError("Select a recovery ward and bed.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await completeSurgery(clinicId, surgery, { recoveryStatus, notes, transferredToWard }, recoveryBed);
      onClose();
    } catch (e) {
      setError(e.message || "Failed to complete surgery.");
    }
    setSaving(false);
  };

  if (isCompleted) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-slate-700">Recovery: {surgery.postOp?.recoveryStatus || "—"}</p>
        <p className="text-slate-500">{surgery.postOp?.notes || "No notes recorded."}</p>
        {surgery.postOp?.transferredToWard && (
          <p className="text-slate-500">
            Transferred to {surgery.postOp.transferredToWard === "male" ? "Male" : "Female"} Ward.
          </p>
        )}
      </div>
    );
  }

  if (surgery.status !== "ongoing") {
    return <p className="text-xs text-slate-400">Post-op details open once the surgery is marked ongoing.</p>;
  }

  return (
    <div className="space-y-3">
      <FormField label="Recovery Status" value={recoveryStatus} onChange={setRecoveryStatus} placeholder="Stable, recovering in PACU" />
      <FormField label="Post-Op Notes" type="textarea" value={notes} onChange={setNotes} placeholder="Findings, instructions, complications…" />

      {needsNewBed ? (
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Transfer To Ward" type="select" options={["male", "female"]} value={transferredToWard} onChange={setTransferredToWard} />
          <div>
            <label className="block text-[0.7rem] font-semibold text-slate-500 mb-1 tracking-wide uppercase">Bed</label>
            <select
              value={recoveryBed}
              onChange={(e) => setRecoveryBed(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm text-slate-900 outline-none border-2 border-slate-100 bg-slate-50 focus:border-[#00A9E0] focus:bg-white transition-colors"
            >
              <option value="">Select bed…</option>
              {beds.filter((b) => b.status === "available").map((b) => (
                <option key={b.bedNumber} value={b.bedNumber}>{b.bedNumber}</option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          This patient already has a reserved bed — it will be released back to "admitted" on completion.
        </p>
      )}

      {error && <div className="rounded-lg px-4 py-3 bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

      <button
        onClick={submit}
        disabled={saving}
        className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60"
        style={{ background: "#0D2C6E" }}
      >
        {saving ? "Completing…" : "Complete Surgery →"}
      </button>
    </div>
  );
}

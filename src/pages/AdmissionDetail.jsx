import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { format } from "date-fns";
import Modal from "../components/ui/Modal";
import FormField from "../components/ui/FormField";
import StatusBadge from "../components/ui/StatusBadge";
import {
  addVitals, addNote, addMedication, recordAdministration,
  addLabTest, recordLabResult, setCondition, dischargePatient, transferWard,
} from "../services/wardService";

const TABS = ["Vitals", "Notes", "Medications", "Labs", "Discharge"];

// Live-subscribes to one of an admission's subcollections.
function useSubcollection(admissionId, name, orderField = "createdAt") {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!admissionId) return;
    const q = query(collection(db, "admissions", admissionId, name), orderBy(orderField, "desc"));
    return onSnapshot(q, (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [admissionId, name, orderField]);
  return items;
}

// Live-subscribes to the OTHER ward's beds, used only for the transfer panel.
function useOtherWardBeds(clinicId, currentWardType) {
  const otherWard = currentWardType === "male" ? "female" : "male";
  const [beds, setBeds] = useState([]);
  useEffect(() => {
    if (!clinicId) return;
    const q = query(collection(db, "beds"), where("clinicId", "==", clinicId), where("wardType", "==", otherWard));
    return onSnapshot(q, (snap) => setBeds(snap.docs.map((d) => d.data())));
  }, [clinicId, otherWard]);
  return { otherWard, beds };
}

export default function AdmissionDetail({ admission, clinicId, userProfile, onClose }) {
  const [tab, setTab] = useState("Vitals");
  const vitals          = useSubcollection(admission.admissionId, "vitals", "recordedAt");
  const notes           = useSubcollection(admission.admissionId, "notes");
  const medications     = useSubcollection(admission.admissionId, "medications");
  const administrations = useSubcollection(admission.admissionId, "administrations", "administeredAt");
  const labTests         = useSubcollection(admission.admissionId, "labTests", "orderedAt");

  const { otherWard, beds: otherWardBeds } = useOtherWardBeds(clinicId, admission.wardType);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferBed, setTransferBed]   = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState("");

  const isDischarged = admission.status === "discharged";

  const doTransfer = async () => {
    if (!transferBed) return;
    setTransferring(true);
    setTransferError("");
    try {
      await transferWard(clinicId, admission, otherWard, transferBed);
      onClose();
    } catch (e) {
      setTransferError(e.message || "Transfer failed.");
    }
    setTransferring(false);
  };

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth="max-w-2xl"
      title={admission.patientName}
      subtitle={`Bed ${admission.bedNumber} · ${admission.doctorAssigned || "No doctor assigned"}`}
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <StatusBadge status={isDischarged ? "discharged" : admission.condition} />
        {!isDischarged && (
          <>
            <div className="flex gap-1">
              {["stable", "critical"].map((c) => (
                <button
                  key={c}
                  onClick={() => setCondition(admission.admissionId, c)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border capitalize ${
                    admission.condition === c ? "border-[#0D2C6E] text-[#0D2C6E] bg-[#EEF3FF]" : "border-slate-200 text-slate-500"
                  }`}
                >
                  Mark {c}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowTransfer((v) => !v)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-slate-200 text-slate-500 ml-auto"
            >
              ⇄ Transfer Ward
            </button>
          </>
        )}
      </div>

      {showTransfer && (
        <div className="mb-4 bg-slate-50 rounded-lg p-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">Move to {otherWard === "male" ? "Male Ward" : "Female Ward"}, bed:</span>
          <select
            value={transferBed}
            onChange={(e) => setTransferBed(e.target.value)}
            className="rounded-md px-2 py-1.5 text-xs border border-slate-200 outline-none focus:border-[#00A9E0]"
          >
            <option value="">Select…</option>
            {otherWardBeds.filter((b) => b.status === "available").map((b) => (
              <option key={b.bedNumber} value={b.bedNumber}>{b.bedNumber}</option>
            ))}
          </select>
          <button onClick={doTransfer} disabled={transferring || !transferBed} className="text-xs font-semibold text-[#0D2C6E] disabled:opacity-50">
            {transferring ? "Moving…" : "Confirm"}
          </button>
          {transferError && <span className="text-xs text-red-600">{transferError}</span>}
        </div>
      )}

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

      {tab === "Vitals" && (
        <VitalsTab admissionId={admission.admissionId} vitals={vitals} userProfile={userProfile} disabled={isDischarged} />
      )}
      {tab === "Notes" && (
        <NotesTab admissionId={admission.admissionId} notes={notes} userProfile={userProfile} disabled={isDischarged} />
      )}
      {tab === "Medications" && (
        <MedicationsTab
          admissionId={admission.admissionId}
          medications={medications}
          administrations={administrations}
          userProfile={userProfile}
          disabled={isDischarged}
        />
      )}
      {tab === "Labs" && (
        <LabsTab admissionId={admission.admissionId} labTests={labTests} userProfile={userProfile} disabled={isDischarged} />
      )}
      {tab === "Discharge" && (
        <DischargeTab admission={admission} clinicId={clinicId} onClose={onClose} />
      )}
    </Modal>
  );
}

/* ── Vitals ───────────────────────────────────────────────────────────── */
function VitalsTab({ admissionId, vitals, userProfile, disabled }) {
  const [form, setForm] = useState({ temperature: "", bp: "", pulse: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    await addVitals(admissionId, form, userProfile?.name);
    setForm({ temperature: "", bp: "", pulse: "" });
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      {!disabled && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <FormField label="Temp" unit="°C" type="number" value={form.temperature} onChange={(v) => setForm({ ...form, temperature: v })} placeholder="36.5" />
            <FormField label="BP" unit="mmHg" value={form.bp} onChange={(v) => setForm({ ...form, bp: v })} placeholder="120/80" />
            <FormField label="Pulse" unit="bpm" type="number" value={form.pulse} onChange={(v) => setForm({ ...form, pulse: v })} placeholder="78" />
          </div>
          <button
            onClick={submit}
            disabled={saving || (!form.temperature && !form.bp && !form.pulse)}
            className="text-xs font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-50"
            style={{ background: "#0D2C6E" }}
          >
            {saving ? "Saving…" : "Record Vitals"}
          </button>
        </>
      )}
      <div className="space-y-1.5 max-h-56 overflow-y-auto pt-1">
        {vitals.length === 0 ? (
          <p className="text-xs text-slate-400">No vitals recorded yet.</p>
        ) : (
          vitals.map((v) => (
            <div key={v.id} className="text-xs bg-slate-50 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-slate-700">
                {v.temperature && `${v.temperature}°C`} {v.bp && `· BP ${v.bp}`} {v.pulse && `· ${v.pulse}bpm`}
              </span>
              <span className="text-slate-400 whitespace-nowrap">
                {v.recordedAt?.toDate ? format(v.recordedAt.toDate(), "dd MMM HH:mm") : ""} · {v.recordedBy}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Notes ────────────────────────────────────────────────────────────── */
function NotesTab({ admissionId, notes, userProfile, disabled }) {
  const [text, setText] = useState("");
  const [type, setType] = useState("nurse");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    await addNote(admissionId, text.trim(), type, userProfile?.name);
    setText("");
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      {!disabled && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {["nurse", "doctor"].map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border capitalize ${
                  type === t ? "border-[#0D2C6E] text-[#0D2C6E] bg-[#EEF3FF]" : "border-slate-200 text-slate-500"
                }`}
              >
                {t} note
              </button>
            ))}
          </div>
          <FormField label="Note" type="textarea" value={text} onChange={setText} placeholder="Observations, plan, instructions…" />
          <button
            onClick={submit}
            disabled={saving || !text.trim()}
            className="text-xs font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-50"
            style={{ background: "#0D2C6E" }}
          >
            {saving ? "Saving…" : "Add Note"}
          </button>
        </div>
      )}
      <div className="space-y-2 max-h-56 overflow-y-auto pt-1">
        {notes.length === 0 ? (
          <p className="text-xs text-slate-400">No notes yet.</p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="text-xs bg-slate-50 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-600 capitalize">{n.type} · {n.author}</span>
                <span className="text-slate-400">{n.createdAt?.toDate ? format(n.createdAt.toDate(), "dd MMM HH:mm") : ""}</span>
              </div>
              <p className="text-slate-700">{n.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Medications / drug chart ─────────────────────────────────────────── */
function MedicationsTab({ admissionId, medications, administrations, userProfile, disabled }) {
  const [form, setForm] = useState({ drugName: "", dose: "", route: "Oral", frequency: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.drugName.trim()) return;
    setSaving(true);
    await addMedication(admissionId, form, userProfile?.name);
    setForm({ drugName: "", dose: "", route: "Oral", frequency: "" });
    setSaving(false);
  };

  const administer = async (medId) => {
    await recordAdministration(admissionId, medId, "", userProfile?.name);
  };

  return (
    <div className="space-y-3">
      {!disabled && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Drug" value={form.drugName} onChange={(v) => setForm({ ...form, drugName: v })} placeholder="Amoxicillin" />
            <FormField label="Dose" value={form.dose} onChange={(v) => setForm({ ...form, dose: v })} placeholder="500mg" />
            <FormField label="Route" type="select" options={["Oral", "IV", "IM", "Topical"]} value={form.route} onChange={(v) => setForm({ ...form, route: v })} />
            <FormField label="Frequency" value={form.frequency} onChange={(v) => setForm({ ...form, frequency: v })} placeholder="3x daily" />
          </div>
          <button
            onClick={submit}
            disabled={saving || !form.drugName.trim()}
            className="text-xs font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-50"
            style={{ background: "#0D2C6E" }}
          >
            {saving ? "Saving…" : "Add to Drug Chart"}
          </button>
        </div>
      )}

      <div className="space-y-2 max-h-56 overflow-y-auto pt-1">
        {medications.length === 0 ? (
          <p className="text-xs text-slate-400">No medications charted yet.</p>
        ) : (
          medications.map((m) => {
            const given = administrations.filter((a) => a.medicationId === m.id);
            const lastGiven = given[0]?.administeredAt?.toDate ? format(given[0].administeredAt.toDate(), "dd MMM HH:mm") : null;
            return (
              <div key={m.id} className="text-xs bg-slate-50 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">{m.drugName} {m.dose}</span>
                  <span className="text-slate-400">{m.route} · {m.frequency}</span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-slate-400">
                    {given.length} dose(s) given{lastGiven ? ` · last ${lastGiven}` : ""}
                  </span>
                  {!disabled && (
                    <button onClick={() => administer(m.id)} className="text-[#00A9E0] font-semibold">+ Log dose given</button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ── Lab tests ────────────────────────────────────────────────────────── */
function LabsTab({ admissionId, labTests, userProfile, disabled }) {
  const [testName, setTestName] = useState("");
  const [saving, setSaving] = useState(false);
  const [resultDrafts, setResultDrafts] = useState({});

  const order = async () => {
    if (!testName.trim()) return;
    setSaving(true);
    await addLabTest(admissionId, testName.trim(), userProfile?.name);
    setTestName("");
    setSaving(false);
  };

  const saveResult = async (id) => {
    if (!resultDrafts[id]?.trim()) return;
    await recordLabResult(admissionId, id, resultDrafts[id].trim());
    setResultDrafts({ ...resultDrafts, [id]: "" });
  };

  return (
    <div className="space-y-3">
      {!disabled && (
        <div className="flex gap-2">
          <input
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            placeholder="Order a lab test…"
            className="flex-1 rounded-lg px-3 py-2.5 text-sm border-2 border-slate-100 bg-slate-50 focus:border-[#00A9E0] outline-none transition-colors"
          />
          <button
            onClick={order}
            disabled={saving || !testName.trim()}
            className="text-xs font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-50"
            style={{ background: "#0D2C6E" }}
          >
            Order
          </button>
        </div>
      )}
      <div className="space-y-2 max-h-56 overflow-y-auto pt-1">
        {labTests.length === 0 ? (
          <p className="text-xs text-slate-400">No lab tests ordered yet.</p>
        ) : (
          labTests.map((t) => (
            <div key={t.id} className="text-xs bg-slate-50 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-700">{t.testName}</span>
                <StatusBadge status={t.status} />
              </div>
              {t.status === "completed" ? (
                <p className="text-slate-600">Result: {t.result}</p>
              ) : !disabled ? (
                <div className="flex gap-2 mt-1.5">
                  <input
                    value={resultDrafts[t.id] || ""}
                    onChange={(e) => setResultDrafts({ ...resultDrafts, [t.id]: e.target.value })}
                    placeholder="Enter result…"
                    className="flex-1 rounded-md px-2 py-1.5 text-xs border border-slate-200 outline-none focus:border-[#00A9E0]"
                  />
                  <button onClick={() => saveResult(t.id)} className="text-[#00A9E0] font-semibold">Save</button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Discharge ────────────────────────────────────────────────────────── */
function DischargeTab({ admission, clinicId, onClose }) {
  const [summary, setSummary] = useState(admission.dischargeSummary || "");
  const [billingStatus, setBillingStatus] = useState(admission.billingStatus || "pending");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isDischarged = admission.status === "discharged";

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      await dischargePatient(clinicId, admission, { summary, billingStatus });
      onClose();
    } catch (e) {
      setError(e.message || "Failed to discharge.");
    }
    setSaving(false);
  };

  if (isDischarged) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-slate-700">
          Discharged {admission.dischargeDate?.toDate ? format(admission.dischargeDate.toDate(), "dd MMM yyyy, HH:mm") : ""}.
        </p>
        <p className="text-slate-500">{admission.dischargeSummary || "No summary recorded."}</p>
        <StatusBadge status={admission.billingStatus} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <FormField label="Discharge Summary" type="textarea" value={summary} onChange={setSummary} placeholder="Condition on discharge, follow-up instructions…" />
      <FormField label="Billing Status" type="select" options={["pending", "billed", "paid"]} value={billingStatus} onChange={setBillingStatus} />
      {error && <div className="rounded-lg px-4 py-3 bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      <button
        onClick={submit}
        disabled={saving}
        className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60"
        style={{ background: "#0D2C6E" }}
      >
        {saving ? "Discharging…" : "Discharge Patient →"}
      </button>
    </div>
  );
}

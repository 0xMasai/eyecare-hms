import { useState, useEffect, useCallback } from "react";
import { db, firebaseConfig } from "../firebase/config";
import {
  collection, query, where, onSnapshot, orderBy,
  getDocs, updateDoc, setDoc, deleteDoc, doc,
  serverTimestamp, getCountFromServer,
} from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { format, formatDistanceToNow } from "date-fns";

// ── Brand tokens (matches clinic app palette) ──────────────────────────────
// primary: #0D2C6E  accent: #00A9E0  surface: #F7F9FC  danger: #DC2626

const PLANS = [
  { value: "starter",      label: "Starter",      color: "bg-slate-100 text-slate-600",    dot: "#94A3B8" },
  { value: "professional", label: "Professional",  color: "bg-blue-50 text-blue-700",       dot: "#0D2C6E" },
  { value: "enterprise",   label: "Enterprise",    color: "bg-violet-50 text-violet-700",   dot: "#7C3AED" },
];
const getPlan = (v) => PLANS.find(p => p.value === v) || PLANS[0];

// ── Shared primitives ──────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
      {children}
    </p>
  );
}

function NavyBtn({ onClick, disabled, children, className = "", type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg font-semibold text-sm text-white transition-all active:scale-95 disabled:opacity-50 shadow-sm ${className}`}
      style={{ background: "linear-gradient(135deg, #0D2C6E 0%, #1a3f94 100%)" }}
    >
      {children}
    </button>
  );
}

function DangerBtn({ onClick, disabled, children, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg font-semibold text-sm text-white transition-all active:scale-95 disabled:opacity-50 shadow-sm bg-red-600 hover:bg-red-700 ${className}`}
    >
      {children}
    </button>
  );
}

function Input({ label, error, hint, ...props }) {
  return (
    <div>
      {label && (
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{label}</p>
      )}
      <input
        className={`w-full border rounded-lg px-4 py-2.5 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none ${
          error ? "border-red-300" : "border-slate-200"
        }`}
        {...props}
      />
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
      {hint && !error && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative bg-white w-full ${wide ? "sm:max-w-xl" : "sm:max-w-md"} rounded-t-2xl sm:rounded-2xl shadow-2xl z-10 max-h-[90vh] overflow-y-auto`}
        style={{ boxShadow: "0 32px 80px rgba(13,44,110,0.25)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full" style={{ background: "#00A9E0" }} />
            <h3 className="font-bold text-[#0D2C6E] text-sm">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors text-lg"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Spinner({ size = "md" }) {
  const sz = size === "sm" ? "w-4 h-4 border-2" : "w-8 h-8 border-4";
  return (
    <div
      className={`${sz} border-t-transparent rounded-full animate-spin`}
      style={{ borderColor: "#0D2C6E", borderTopColor: "transparent" }}
    />
  );
}

function Pill({ label, value, accent }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
      <p className="text-xl font-bold" style={{ color: accent }}>{value}</p>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

// ── ID generator ───────────────────────────────────────────────────────────
function genClinicId() {
  return "clinic_" + Math.random().toString(36).slice(2, 10).toUpperCase();
}

// ── Copy-to-clipboard helper ───────────────────────────────────────────────
function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div>
      {label && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>}
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-slate-100 rounded-lg px-3 py-2 text-xs font-mono text-[#0D2C6E] break-all">
          {value}
        </code>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 px-2.5 py-2 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-500 hover:border-[#0D2C6E] hover:text-[#0D2C6E] transition-all"
        >
          {copied ? "✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// CLINIC STATS HOOK — real-time counts from visits, users, invoices
// ══════════════════════════════════════════════════════════════════════════
function useClinicStats(clinicId) {
  const [stats, setStats] = useState({ visits: 0, staff: 0, revenue: 0, todayVisits: 0, loading: true });

  useEffect(() => {
    if (!clinicId) return;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    let v = 0, u = 0, rev = 0, tv = 0;
    let ready = 0;
    const check = () => { if (++ready >= 3) setStats({ visits: v, staff: u, revenue: rev, todayVisits: tv, loading: false }); };

    const u1 = onSnapshot(
      query(collection(db, "visits"), where("clinicId", "==", clinicId)),
      (snap) => {
        v  = snap.size;
        tv = snap.docs.filter(d => d.data().createdAt?.toDate?.() >= today).length;
        setStats(s => ({ ...s, visits: v, todayVisits: tv }));
        check();
      }
    );
    const u2 = onSnapshot(
      query(collection(db, "users"), where("clinicId", "==", clinicId), where("active", "!=", false)),
      (snap) => { u = snap.size; setStats(s => ({ ...s, staff: u })); check(); }
    );
    const u3 = onSnapshot(
      query(collection(db, "invoices"), where("clinicId", "==", clinicId), where("status", "==", "paid")),
      (snap) => {
        rev = snap.docs.reduce((s, d) => s + (d.data().totalAmount || 0), 0);
        setStats(s => ({ ...s, revenue: rev }));
        check();
      }
    );

    return () => { u1(); u2(); u3(); };
  }, [clinicId]);

  return stats;
}

// ══════════════════════════════════════════════════════════════════════════
// ONBOARD CLINIC MODAL
// Creates: clinics/{clinicId} doc + Firebase Auth account + users/{uid} doc
// ══════════════════════════════════════════════════════════════════════════
function OnboardClinicModal({ onClose, superAdminUid }) {
  const [step, setStep] = useState(1); // 1 = clinic details, 2 = admin account
  const [form, setForm] = useState({
    // Step 1 — clinic
    name: "", contactName: "", contactPhone: "", plan: "starter",
    // Step 2 — admin account
    adminEmail: "", adminFirstName: "", adminLastName: "", adminPassword: "",
  });
  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);
  const [showPw,  setShowPw]  = useState(false);
  const [success, setSuccess] = useState(null); // { clinicId, uid, email, password, name }
  const [apiError,setApiError]= useState("");

  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: "" })); setApiError(""); };

  // ── Validation per step ──────────────────────────────────────────────
  const validateStep1 = () => {
    const e = {};
    if (!form.name.trim())        e.name        = "Required";
    if (!form.contactName.trim()) e.contactName = "Required";
    return e;
  };
  const validateStep2 = () => {
    const e = {};
    if (!form.adminFirstName.trim()) e.adminFirstName = "Required";
    if (!form.adminLastName.trim())  e.adminLastName  = "Required";
    if (!form.adminEmail.trim())     e.adminEmail     = "Required";
    if (!form.adminEmail.includes("@")) e.adminEmail  = "Enter a valid email";
    if (form.adminPassword.length < 6)  e.adminPassword = "Min 6 characters";
    return e;
  };

  const handleNext = () => {
    const e = validateStep1();
    if (Object.keys(e).length) { setErrors(e); return; }
    setStep(2);
  };

  // ── Final submit — create Auth + Firestore docs ──────────────────────
  const handleCreate = async () => {
    const e = validateStep2();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    setApiError("");

    try {
      // 1. Generate the clinic ID first
      const clinicId = genClinicId();

      // 2. Create Firebase Auth user via secondary app (keeps superadmin session alive)
      const secondaryApp  = initializeApp(firebaseConfig, "onboard-" + Date.now());
      const secondaryAuth = getAuth(secondaryApp);

      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        form.adminEmail.trim().toLowerCase(),
        form.adminPassword
      );
      const adminUid = cred.user.uid;
      const fullName = `${form.adminFirstName.trim()} ${form.adminLastName.trim()}`;

      await updateProfile(cred.user, { displayName: fullName });
      await secondaryAuth.signOut();
      await deleteApp(secondaryApp);

      // 3. Write clinic doc
      await setDoc(doc(db, "clinics", clinicId), {
        clinicId,
        name:         form.name.trim(),
        contactName:  form.contactName.trim(),
        contactEmail: form.adminEmail.trim().toLowerCase(),
        contactPhone: form.contactPhone.trim(),
        plan:         form.plan,
        status:       "active",
        onboardedBy:  superAdminUid || "superadmin",
        createdAt:    serverTimestamp(),
        updatedAt:    serverTimestamp(),
      });

      // 4. Write clinic admin user doc — this is what App.jsx reads on login
      await setDoc(doc(db, "users", adminUid), {
        userId:             adminUid,
        clinicId,
        firstName:          form.adminFirstName.trim(),
        lastName:           form.adminLastName.trim(),
        name:               fullName,
        email:              form.adminEmail.trim().toLowerCase(),
        role:               "admin",
        active:             true,
        mustChangePassword: true,
        createdBy:          superAdminUid || "superadmin",
        createdAt:          serverTimestamp(),
      });

      setSuccess({
        clinicId,
        uid:      adminUid,
        email:    form.adminEmail.trim().toLowerCase(),
        password: form.adminPassword,
        name:     fullName,
        clinic:   form.name.trim(),
      });

    } catch (err) {
      const msg = err?.message || "Something went wrong.";
      setApiError(
        msg.includes("email-already-in-use")
          ? "An account with this email already exists in Firebase Auth."
          : msg.includes("permission-denied")
          ? "Permission denied — check your Firestore rules."
          : msg
      );
    }
    setSaving(false);
  };

  // ── Success screen ───────────────────────────────────────────────────
  if (success) {
    return (
      <Modal title="Clinic Onboarded ✅" onClose={onClose} wide>
        <div className="space-y-4">
          {/* Hero */}
          <div className="rounded-2xl p-4 text-center"
               style={{ background: "linear-gradient(135deg, #EEF3FF 0%, #dde8ff 100%)", border: "1px solid #c7d7ff" }}>
            <div className="text-3xl mb-2">🏥</div>
            <p className="font-bold text-[#0D2C6E] text-base">{success.clinic}</p>
            <p className="text-xs text-slate-500 mt-0.5">is live and ready to use</p>
          </div>

          {/* Credentials to share */}
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest flex items-center gap-1.5">
              ⚠️ Share these credentials with the clinic admin — visible once only
            </p>
            <CopyField label="Login Email"         value={success.email} />
            <CopyField label="Temporary Password"  value={success.password} />
            <p className="text-[11px] text-amber-600 leading-relaxed">
              The admin will be prompted to change their password on first login.
            </p>
          </div>

          {/* IDs for reference */}
          <div className="space-y-2.5">
            <CopyField label="Clinic ID"   value={success.clinicId} />
            <CopyField label="Admin UID"   value={success.uid} />
          </div>

          {/* What happens next */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <SectionLabel>What happens when they log in</SectionLabel>
            {[
              "They sign in at the clinic portal with the email & password above",
              `App.jsx reads their users/${success.uid} doc → role: admin, clinicId: ${success.clinicId}`,
              "They land on the Admin Dashboard scoped to their clinic only",
              "They should change their password immediately via Firebase Auth settings",
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 mt-0.5"
                      style={{ background: "#0D2C6E" }}>{i + 1}</span>
                <p className="text-[11px] text-slate-500 leading-relaxed">{s}</p>
              </div>
            ))}
          </div>

          <NavyBtn onClick={onClose} className="w-full py-3">Done</NavyBtn>
        </div>
      </Modal>
    );
  }

  // ── Step 1: Clinic details ───────────────────────────────────────────
  if (step === 1) {
    return (
      <Modal title="Onboard New Clinic — Step 1 of 2" onClose={onClose} wide>
        <div className="space-y-4">
          {/* Progress */}
          <div className="flex gap-1.5">
            <div className="flex-1 h-1 rounded-full" style={{ background: "#0D2C6E" }} />
            <div className="flex-1 h-1 rounded-full bg-slate-200" />
          </div>
          <p className="text-[11px] text-slate-400">Clinic information</p>

          <Input
            label="Clinic Name"
            value={form.name}
            onChange={e => set("name", e.target.value)}
            placeholder="e.g. Kampala Family Clinic"
            error={errors.name}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Contact Person"
              value={form.contactName}
              onChange={e => set("contactName", e.target.value)}
              placeholder="Dr. Sarah Nalwoga"
              error={errors.contactName}
            />
            <Input
              label="Phone"
              value={form.contactPhone}
              onChange={e => set("contactPhone", e.target.value)}
              placeholder="+256 7xx xxx xxx"
            />
          </div>

          {/* Plan selector */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Subscription Plan</p>
            <div className="grid grid-cols-3 gap-2">
              {PLANS.map(plan => (
                <button
                  key={plan.value}
                  type="button"
                  onClick={() => set("plan", plan.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    form.plan === plan.value
                      ? "border-[#0D2C6E] bg-[#EEF3FF]"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="w-2 h-2 rounded-full mb-2" style={{ background: plan.dot }} />
                  <p className={`text-xs font-bold ${form.plan === plan.value ? "text-[#0D2C6E]" : "text-slate-700"}`}>
                    {plan.label}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <NavyBtn onClick={handleNext} className="flex-1 py-3">
              Next: Admin Account →
            </NavyBtn>
          </div>
        </div>
      </Modal>
    );
  }

  // ── Step 2: Clinic admin account ─────────────────────────────────────
  return (
    <Modal title="Onboard New Clinic — Step 2 of 2" onClose={onClose} wide>
      <div className="space-y-4">
        {/* Progress */}
        <div className="flex gap-1.5">
          <div className="flex-1 h-1 rounded-full" style={{ background: "#0D2C6E" }} />
          <div className="flex-1 h-1 rounded-full" style={{ background: "#00A9E0" }} />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-400">Create admin login for <strong className="text-slate-700">{form.name}</strong></p>
          <button onClick={() => setStep(1)} className="text-[11px] text-[#0D2C6E] font-semibold hover:underline">← Back</button>
        </div>

        {/* Context banner */}
        <div className="rounded-xl bg-[#EEF3FF] border border-[#c7d7ff] px-4 py-3 flex items-start gap-2">
          <span className="text-base flex-shrink-0">🔑</span>
          <p className="text-[11px] text-[#0D2C6E] leading-relaxed">
            This creates a Firebase Auth account and links it to <strong>{form.name}</strong>. 
            The admin will sign in with these credentials and land directly on their clinic dashboard.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First Name"
            value={form.adminFirstName}
            onChange={e => set("adminFirstName", e.target.value)}
            placeholder="Felix"
            error={errors.adminFirstName}
          />
          <Input
            label="Last Name"
            value={form.adminLastName}
            onChange={e => set("adminLastName", e.target.value)}
            placeholder="Masai"
            error={errors.adminLastName}
          />
        </div>

        <Input
          label="Admin Email"
          type="email"
          value={form.adminEmail}
          onChange={e => set("adminEmail", e.target.value)}
          placeholder="admin@kampalafc.ug"
          error={errors.adminEmail}
          hint="This becomes their login email — must be unique in Firebase Auth."
        />

        {/* Password with toggle */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Temporary Password</p>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={form.adminPassword}
              onChange={e => set("adminPassword", e.target.value)}
              placeholder="Min 6 characters"
              className={`w-full border rounded-lg px-4 py-2.5 pr-10 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none ${
                errors.adminPassword ? "border-red-300" : "border-slate-200"
              }`}
            />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-base">
              {showPw ? "🙈" : "👁️"}
            </button>
          </div>
          {errors.adminPassword && <p className="text-[11px] text-red-500 mt-1">{errors.adminPassword}</p>}
          <p className="text-[11px] text-slate-400 mt-1.5">
            You'll see this on the next screen to copy and share. The admin should change it after first login.
          </p>
        </div>

        {/* API error */}
        {apiError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2">
            <span className="flex-shrink-0 mt-0.5">⚠️</span>
            <p className="text-sm text-red-700">{apiError}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => setStep(1)}
            className="flex-1 py-3 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            ← Back
          </button>
          <NavyBtn onClick={handleCreate} disabled={saving} className="flex-1 py-3">
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner size="sm" />
                Creating…
              </span>
            ) : "Create Clinic & Admin"}
          </NavyBtn>
        </div>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// EDIT CLINIC MODAL
// ══════════════════════════════════════════════════════════════════════════
function EditClinicModal({ clinic, onClose }) {
  const [form, setForm] = useState({
    name:         clinic.name         || "",
    contactName:  clinic.contactName  || "",
    contactEmail: clinic.contactEmail || "",
    contactPhone: clinic.contactPhone || "",
    plan:         clinic.plan         || "starter",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: "" })); };

  const handleSave = async () => {
    const e = {};
    if (!form.name.trim())        e.name        = "Required";
    if (!form.contactName.trim()) e.contactName = "Required";
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, "clinics", clinic.clinicId), {
        name:         form.name.trim(),
        contactName:  form.contactName.trim(),
        contactEmail: form.contactEmail.trim().toLowerCase(),
        contactPhone: form.contactPhone.trim(),
        plan:         form.plan,
        updatedAt:    serverTimestamp(),
      });
      onClose();
    } catch (err) {
      setErrors({ _api: err.message || "Failed to update." });
    }
    setSaving(false);
  };

  return (
    <Modal title="Edit Clinic" onClose={onClose} wide>
      <div className="space-y-4">
        <Input label="Clinic Name"    value={form.name}         onChange={e => set("name", e.target.value)}         error={errors.name} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Contact Person" value={form.contactName}  onChange={e => set("contactName", e.target.value)}  error={errors.contactName} />
          <Input label="Phone"          value={form.contactPhone} onChange={e => set("contactPhone", e.target.value)} />
        </div>
        <Input label="Contact Email" type="email" value={form.contactEmail} onChange={e => set("contactEmail", e.target.value)} />

        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Plan</p>
          <div className="grid grid-cols-3 gap-2">
            {PLANS.map(plan => (
              <button key={plan.value} type="button" onClick={() => set("plan", plan.value)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  form.plan === plan.value ? "border-[#0D2C6E] bg-[#EEF3FF]" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="w-2 h-2 rounded-full mb-2" style={{ background: plan.dot }} />
                <p className={`text-xs font-bold ${form.plan === plan.value ? "text-[#0D2C6E]" : "text-slate-700"}`}>{plan.label}</p>
              </button>
            ))}
          </div>
        </div>

        {errors._api && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{errors._api}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <NavyBtn onClick={handleSave} disabled={saving} className="flex-1 py-3">
            {saving ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" />Saving…</span> : "Save Changes"}
          </NavyBtn>
        </div>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// DELETE CONFIRM MODAL
// ══════════════════════════════════════════════════════════════════════════
function DeleteClinicModal({ clinic, onClose }) {
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    if (confirm !== clinic.name) { setError("Name doesn't match."); return; }
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "clinics", clinic.clinicId));
      onClose();
    } catch (err) {
      setError(err.message || "Failed to delete.");
    }
    setDeleting(false);
  };

  return (
    <Modal title="Delete Clinic" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-800 mb-1">⚠️ This cannot be undone</p>
          <p className="text-xs text-red-600 leading-relaxed">
            Deleting <strong>{clinic.name}</strong> removes only the clinic record. Visits, patients, invoices, and staff
            accounts linked to <code className="bg-red-100 px-1 rounded text-[10px]">{clinic.clinicId}</code> will remain
            in Firestore but will be orphaned. Delete those collections separately if needed.
          </p>
        </div>

        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
            Type <span className="text-red-600">{clinic.name}</span> to confirm
          </p>
          <input
            value={confirm}
            onChange={e => { setConfirm(e.target.value); setError(""); }}
            placeholder={clinic.name}
            className="w-full border border-red-200 rounded-lg px-4 py-2.5 text-sm bg-white focus:border-red-400 focus:outline-none"
          />
          {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <DangerBtn onClick={handleDelete} disabled={deleting || confirm !== clinic.name} className="flex-1 py-3">
            {deleting ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" />Deleting…</span> : "Delete Clinic"}
          </DangerBtn>
        </div>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// CLINIC DETAIL MODAL — drill-down stats
// ══════════════════════════════════════════════════════════════════════════
function ClinicDetailModal({ clinic, onClose }) {
  const stats = useClinicStats(clinic.clinicId);
  const plan  = getPlan(clinic.plan);

  return (
    <Modal title={clinic.name} onClose={onClose} wide>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #0D2C6E 0%, #00A9E0 100%)" }}
          >
            {clinic.name?.[0] || "C"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-slate-900">{clinic.name}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${plan.color}`}>
                {plan.label}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                clinic.status === "suspended"
                  ? "bg-red-50 text-red-600"
                  : "bg-emerald-50 text-emerald-700"
              }`}>
                {clinic.status === "suspended" ? "Suspended" : "Active"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">{clinic.clinicId}</p>
          </div>
        </div>

        {/* Live stats */}
        {stats.loading ? (
          <div className="flex items-center gap-2 py-2">
            <Spinner size="sm" /><p className="text-xs text-slate-400">Loading stats…</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Pill label="Total Visits"   value={stats.visits}      accent="#0D2C6E" />
            <Pill label="Today"          value={stats.todayVisits} accent="#D97706" />
            <Pill label="Active Staff"   value={stats.staff}       accent="#7C3AED" />
            <Pill label="Revenue (UGX)"
              value={stats.revenue >= 1_000_000
                ? `${(stats.revenue / 1_000_000).toFixed(1)}M`
                : stats.revenue >= 1_000
                ? `${(stats.revenue / 1_000).toFixed(0)}K`
                : stats.revenue.toLocaleString()}
              accent="#059669"
            />
          </div>
        )}

        {/* Contact details */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
          <SectionLabel>Contact Information</SectionLabel>
          {[
            { label: "Contact", value: clinic.contactName },
            { label: "Email",   value: clinic.contactEmail },
            { label: "Phone",   value: clinic.contactPhone || "—" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-xs font-semibold text-slate-700">{value || "—"}</p>
            </div>
          ))}
        </div>

        {/* Meta */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
          <SectionLabel>Record</SectionLabel>
          {[
            { label: "Clinic ID",  value: clinic.clinicId },
            { label: "Onboarded", value: clinic.createdAt?.toDate ? format(clinic.createdAt.toDate(), "dd MMM yyyy") : "—" },
            { label: "Last edit",  value: clinic.updatedAt?.toDate ? formatDistanceToNow(clinic.updatedAt.toDate(), { addSuffix: true }) : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-xs font-semibold text-slate-700 font-mono">{value}</p>
            </div>
          ))}
        </div>

        <button onClick={onClose}
          className="w-full py-3 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
          Close
        </button>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// CLINIC CARD
// ══════════════════════════════════════════════════════════════════════════
function ClinicCard({ clinic, onEdit, onToggleStatus, onDelete, onView }) {
  const stats     = useClinicStats(clinic.clinicId);
  const plan      = getPlan(clinic.plan);
  const isActive  = clinic.status !== "suspended";
  const initials  = clinic.name?.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "C";
  const addedAgo  = clinic.createdAt?.toDate
    ? formatDistanceToNow(clinic.createdAt.toDate(), { addSuffix: true })
    : "—";

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all ${
      isActive ? "border-slate-200" : "border-red-100 opacity-75"
    }`}>
      <div className="flex items-start gap-3 p-4 pb-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{
            background: isActive
              ? "linear-gradient(135deg, #0D2C6E 0%, #00A9E0 100%)"
              : "#94A3B8",
          }}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-slate-900 text-sm truncate">{clinic.name}</p>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">{clinic.clinicId}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${plan.color}`}>
                {plan.label}
              </span>
              {!isActive && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 uppercase tracking-wide">
                  Suspended
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live stats strip */}
      <div className="grid grid-cols-3 gap-px bg-slate-100 mx-4 rounded-xl overflow-hidden mb-3">
        {[
          { label: "Visits", value: stats.loading ? "…" : stats.visits,      color: "#0D2C6E" },
          { label: "Staff",  value: stats.loading ? "…" : stats.staff,       color: "#7C3AED" },
          { label: "Today",  value: stats.loading ? "…" : stats.todayVisits, color: "#D97706" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white py-2.5 text-center">
            <p className="text-base font-bold" style={{ color }}>{value}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
          </div>
        ))}
      </div>

      {/* Revenue */}
      <div className="mx-4 mb-3 rounded-xl px-3 py-2 flex items-center justify-between"
           style={{ background: "linear-gradient(135deg, #EEF3FF 0%, #dde8ff 100%)", border: "1px solid #c7d7ff" }}>
        <p className="text-[10px] font-bold text-[#0D2C6E] uppercase tracking-widest">Revenue</p>
        <p className="text-sm font-bold text-[#0D2C6E]">
          {stats.loading ? "…" : `UGX ${
            stats.revenue >= 1_000_000 ? `${(stats.revenue / 1_000_000).toFixed(1)}M`
            : stats.revenue >= 1_000   ? `${(stats.revenue / 1_000).toFixed(0)}K`
            : stats.revenue.toLocaleString()
          }`}
        </p>
      </div>

      {clinic.contactName && (
        <p className="text-[11px] text-slate-400 px-4 mb-3 truncate">
          👤 {clinic.contactName}
          {clinic.contactEmail && <span className="text-slate-300"> · {clinic.contactEmail}</span>}
        </p>
      )}

      <div className="flex items-center justify-between px-4 pb-4">
        <p className="text-[10px] text-slate-300 font-medium">Added {addedAgo}</p>
        <div className="flex gap-1.5">
          <button onClick={() => onView(clinic)}
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:border-[#00A9E0] hover:text-[#00A9E0] transition-all text-sm"
            title="View details">👁️</button>
          <button onClick={() => onEdit(clinic)}
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:border-[#0D2C6E] hover:text-[#0D2C6E] transition-all text-sm"
            title="Edit">✏️</button>
          <button onClick={() => onToggleStatus(clinic)}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all text-sm ${
              isActive
                ? "border-amber-200 text-amber-500 hover:border-amber-400 hover:bg-amber-50"
                : "border-emerald-200 text-emerald-500 hover:border-emerald-400 hover:bg-emerald-50"
            }`}
            title={isActive ? "Suspend" : "Reactivate"}>
            {isActive ? "⏸️" : "▶️"}
          </button>
          <button onClick={() => onDelete(clinic)}
            className="w-8 h-8 rounded-lg border border-red-200 flex items-center justify-center text-red-400 hover:border-red-400 hover:bg-red-50 transition-all text-sm"
            title="Delete">🗑️</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// CLINICS LIST PANEL
// ══════════════════════════════════════════════════════════════════════════
function ClinicsPanel({ superAdminUid, setShowOnboard }) {
  const [clinics,      setClinics]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [filterPlan,   setFilterPlan]   = useState("all");
  const [filterStatus, setFilterStatus] = useState("active");
  const [editTarget,   setEditTarget]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTarget,   setViewTarget]   = useState(null);

  useEffect(() => {
    const q = query(collection(db, "clinics"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setClinics(snap.docs.map(d => ({ ...d.data(), clinicId: d.id })));
      setLoading(false);
    });
  }, []);

  const handleToggleStatus = async (clinic) => {
    const next = clinic.status === "suspended" ? "active" : "suspended";
    const verb = next === "suspended" ? "Suspend" : "Reactivate";
    if (!confirm(`${verb} "${clinic.name}"?`)) return;
    await updateDoc(doc(db, "clinics", clinic.clinicId), { status: next, updatedAt: serverTimestamp() });
  };

  const filtered = clinics
    .filter(c => filterStatus === "all" ? true : filterStatus === "active" ? c.status !== "suspended" : c.status === "suspended")
    .filter(c => filterPlan  === "all" ? true : c.plan === filterPlan)
    .filter(c => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.name?.toLowerCase().includes(q) ||
        c.clinicId?.toLowerCase().includes(q) ||
        c.contactName?.toLowerCase().includes(q) ||
        c.contactEmail?.toLowerCase().includes(q)
      );
    });

  const activeCount    = clinics.filter(c => c.status !== "suspended").length;
  const suspendedCount = clinics.filter(c => c.status === "suspended").length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Clinics", value: clinics.length,   accent: "#0D2C6E" },
          { label: "Active",        value: activeCount,      accent: "#059669" },
          { label: "Suspended",     value: suspendedCount,   accent: "#DC2626" },
        ].map(({ label, value, accent }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ background: accent }} />
            <p className="text-2xl font-bold pl-2" style={{ color: accent }}>{value}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 pl-2">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <SectionLabel>By Plan</SectionLabel>
        <div className="flex gap-3 flex-wrap">
          {PLANS.map(plan => {
            const count = clinics.filter(c => c.plan === plan.value && c.status !== "suspended").length;
            return (
              <div key={plan.value} className={`flex-1 min-w-[80px] rounded-xl p-3 text-center border ${plan.color} border-current/10`}>
                <p className="text-lg font-bold">{count}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{plan.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, ID, or contact…"
            className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:border-[#00A9E0] focus:outline-none"
          />
          <NavyBtn onClick={() => setShowOnboard(true)} className="px-4 py-2.5 flex-shrink-0 whitespace-nowrap">
            + Onboard
          </NavyBtn>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {[
            { value: "active",    label: "Active" },
            { value: "suspended", label: "Suspended" },
            { value: "all",       label: "All" },
          ].map(f => (
            <button key={f.value} onClick={() => setFilterStatus(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                filterStatus === f.value ? "text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
              style={filterStatus === f.value ? { background: "#0D2C6E" } : {}}>
              {f.label}
            </button>
          ))}
          <div className="w-px bg-slate-200 mx-1" />
          <button onClick={() => setFilterPlan("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterPlan === "all" ? "text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600"
            }`}
            style={filterPlan === "all" ? { background: "#00A9E0" } : {}}>
            All Plans
          </button>
          {PLANS.map(plan => (
            <button key={plan.value} onClick={() => setFilterPlan(plan.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                filterPlan === plan.value ? "text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600"
              }`}
              style={filterPlan === plan.value ? { background: plan.dot } : {}}>
              {plan.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <Spinner />
          <p className="text-xs text-slate-400">Loading clinics…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">
          <p className="text-4xl mb-3">{search ? "🔍" : "🏥"}</p>
          <p className="font-semibold text-slate-700 mb-1">
            {search ? "No clinics match your search" : "No clinics onboarded yet"}
          </p>
          <p className="text-sm text-slate-400 mb-5">
            {search ? "Try a different name, ID, or contact." : "Get started by onboarding the first clinic."}
          </p>
          {!search && (
            <NavyBtn onClick={() => setShowOnboard(true)} className="px-5 py-2.5">
              + Onboard First Clinic
            </NavyBtn>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(clinic => (
            <ClinicCard
              key={clinic.clinicId}
              clinic={clinic}
              onEdit={setEditTarget}
              onToggleStatus={handleToggleStatus}
              onDelete={setDeleteTarget}
              onView={setViewTarget}
            />
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-[11px] text-slate-400 text-center">
          Showing {filtered.length} of {clinics.length} clinic{clinics.length !== 1 ? "s" : ""}
        </p>
      )}

      {editTarget   && <EditClinicModal   clinic={editTarget}   onClose={() => setEditTarget(null)}   />}
      {deleteTarget && <DeleteClinicModal clinic={deleteTarget} onClose={() => setDeleteTarget(null)} />}
      {viewTarget   && <ClinicDetailModal clinic={viewTarget}   onClose={() => setViewTarget(null)}   />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ANALYTICS PANEL — cross-clinic roll-up
// ══════════════════════════════════════════════════════════════════════════
function AnalyticsPanel() {
  const [clinics, setClinics] = useState([]);
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "clinics"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setClinics(snap.docs.map(d => ({ ...d.data(), clinicId: d.id })));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!clinics.length) return;
    const unsubs = [];
    const data   = clinics.map(c => ({ clinicId: c.clinicId, name: c.name, plan: c.plan, status: c.status, visits: 0, revenue: 0, staff: 0 }));

    clinics.forEach((clinic, idx) => {
      unsubs.push(onSnapshot(
        query(collection(db, "visits"), where("clinicId", "==", clinic.clinicId)),
        (snap) => { data[idx].visits = snap.size; setRows([...data]); }
      ));
      unsubs.push(onSnapshot(
        query(collection(db, "invoices"), where("clinicId", "==", clinic.clinicId), where("status", "==", "paid")),
        (snap) => { data[idx].revenue = snap.docs.reduce((s, d) => s + (d.data().totalAmount || 0), 0); setRows([...data]); }
      ));
      unsubs.push(onSnapshot(
        query(collection(db, "users"), where("clinicId", "==", clinic.clinicId)),
        (snap) => { data[idx].staff = snap.size; setRows([...data]); }
      ));
    });

    return () => unsubs.forEach(u => u());
  }, [clinics]);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalVisits  = rows.reduce((s, r) => s + r.visits, 0);
  const totalStaff   = rows.reduce((s, r) => s + r.staff, 0);
  const sorted       = [...rows].sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Clinics",        value: clinics.length, accent: "#0D2C6E" },
          { label: "Total Visits",   value: totalVisits,    accent: "#D97706" },
          { label: "Staff Accounts", value: totalStaff,     accent: "#7C3AED" },
          { label: "Total Revenue",
            value: totalRevenue >= 1_000_000 ? `${(totalRevenue / 1_000_000).toFixed(1)}M`
                 : totalRevenue >= 1_000     ? `${(totalRevenue / 1_000).toFixed(0)}K`
                 : totalRevenue.toLocaleString(),
            accent: "#059669",
          },
        ].map(({ label, value, accent }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ background: accent }} />
            <div className="pl-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
              <p className="text-2xl font-bold" style={{ color: accent }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <div className="w-1 h-4 rounded-full" style={{ background: "#00A9E0" }} />
          <p className="text-sm font-bold text-[#0D2C6E]">Revenue Leaderboard</p>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-auto">All time · Live</span>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 p-5"><Spinner size="sm" /><p className="text-xs text-slate-400">Loading…</p></div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No clinics yet</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {sorted.map((row, i) => {
              const plan = getPlan(row.plan);
              const pct  = totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0;
              return (
                <div key={row.clinicId} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="text-sm font-bold w-5 text-center flex-shrink-0"
                        style={{ color: i === 0 ? "#D97706" : i === 1 ? "#94A3B8" : i === 2 ? "#B45309" : "#CBD5E1" }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{row.name}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${plan.color}`}>{plan.label}</span>
                      {row.status === "suspended" && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 uppercase">Suspended</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                             style={{ width: `${Math.max(pct, row.revenue > 0 ? 2 : 0)}%`, background: "#0D2C6E" }} />
                      </div>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">{row.visits}v · {row.staff}s</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-[#0D2C6E]">
                      UGX {row.revenue >= 1_000_000 ? `${(row.revenue / 1_000_000).toFixed(1)}M`
                           : row.revenue >= 1_000   ? `${(row.revenue / 1_000).toFixed(0)}K`
                           : row.revenue.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-400">{pct.toFixed(1)}% of total</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <div className="w-1 h-4 rounded-full" style={{ background: "#00A9E0" }} />
          <p className="text-sm font-bold text-[#0D2C6E]">Visit Volume</p>
        </div>
        <div className="divide-y divide-slate-50">
          {[...rows].sort((a, b) => b.visits - a.visits).map((row, i) => {
            const pct = totalVisits > 0 ? (row.visits / totalVisits) * 100 : 0;
            return (
              <div key={row.clinicId} className="flex items-center gap-3 px-5 py-3">
                <p className="text-xs font-bold text-slate-300 w-5 text-center">{i + 1}</p>
                <p className="flex-1 text-sm font-medium text-slate-800 truncate">{row.name}</p>
                <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(pct, row.visits > 0 ? 4 : 0)}%`, background: "#D97706" }} />
                </div>
                <p className="text-sm font-bold text-slate-700 w-10 text-right">{row.visits}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// FIRESTORE INDEX GUIDE
// ══════════════════════════════════════════════════════════════════════════
function IndexGuidePanel() {
  const indexes = [
    { collection: "visits",    fields: ["clinicId", "createdAt"], reason: "All visit queries filtered by clinic" },
    { collection: "visits",    fields: ["clinicId", "status"],    reason: "Active visit counts per clinic" },
    { collection: "invoices",  fields: ["clinicId", "status"],    reason: "Paid invoice sums per clinic" },
    { collection: "invoices",  fields: ["clinicId", "paidAt"],    reason: "Revenue reports by date range" },
    { collection: "users",     fields: ["clinicId", "active"],    reason: "Active staff count per clinic" },
    { collection: "users",     fields: ["clinicId", "createdAt"], reason: "Staff panel ordering" },
    { collection: "lab_tests", fields: ["clinicId", "createdAt"], reason: "Lab report date filtering" },
    { collection: "patients",  fields: ["clinicId", "createdAt"], reason: "Patient report date filtering" },
    { collection: "clinics",   fields: ["createdAt"],             reason: "Super-admin clinic list ordering" },
  ];

  const [copied, setCopied] = useState(false);

  const firestoreJson = {
    indexes: indexes.map(idx => ({
      collectionGroup: idx.collection,
      queryScope: "COLLECTION",
      fields: idx.fields.map((f, i) => ({
        fieldPath: f,
        order: i === idx.fields.length - 1 ? "DESCENDING" : "ASCENDING",
      })),
    })),
    fieldOverrides: [],
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(firestoreJson, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full" style={{ background: "#00A9E0" }} />
            <p className="text-sm font-bold text-[#0D2C6E]">Required Firestore Indexes</p>
          </div>
          <button onClick={handleCopy}
            className="text-[10px] font-bold text-[#0D2C6E] border border-[#0D2C6E] px-2.5 py-1.5 rounded-lg hover:bg-[#0D2C6E] hover:text-white transition-all uppercase tracking-wide">
            {copied ? "✓ Copied" : "Copy JSON"}
          </button>
        </div>
        <div className="divide-y divide-slate-50">
          {indexes.map((idx, i) => (
            <div key={i} className="px-5 py-3.5 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <code className="text-xs font-bold text-[#0D2C6E] bg-[#EEF3FF] px-2 py-0.5 rounded">{idx.collection}</code>
                  {idx.fields.map(f => (
                    <code key={f} className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{f}</code>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">{idx.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-bold text-[#0D2C6E]">How to Apply</p>
        </div>
        <div className="p-5 space-y-3 text-xs text-slate-600 leading-relaxed">
          <p><strong>Option 1 — Firebase Console:</strong> Go to Firestore → Indexes → Composite → Create Index.</p>
          <p><strong>Option 2 — firestore.indexes.json:</strong> Click <em>Copy JSON</em> above, paste into <code className="bg-slate-100 px-1 rounded mx-1">firestore.indexes.json</code>, then run:</p>
          <code className="block bg-slate-900 text-emerald-400 rounded-xl px-4 py-3 font-mono">
            firebase deploy --only firestore:indexes
          </code>
          <p className="text-slate-400">Index builds usually complete within 2–5 minutes. Queries will throw a link in the browser console if an index is missing — click it to create it instantly.</p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ══════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: "clinics",   label: "Clinics",   icon: "🏥" },
  { id: "analytics", label: "Analytics", icon: "📊" },
  { id: "indexes",   label: "Indexes",   icon: "⚡" },
];

export default function SuperAdminDashboard({ userProfile, onSignOut }) {
  const [activeTab,   setActiveTab]   = useState("clinics");
  const [showOnboard, setShowOnboard] = useState(false);

  if (!userProfile || userProfile.role !== "superadmin") {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "#F7F9FC" }}>
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto mb-4 text-3xl">🔒</div>
          <p className="font-bold text-slate-900 mb-2">Access Denied</p>
          <p className="text-sm text-slate-500">
            This dashboard is restricted to super-administrators only.
            Your account role is <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{userProfile?.role || "unknown"}</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#F7F9FC", minHeight: "100vh" }}>
      <div className="px-4 pt-4 pb-0">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-1 h-5 rounded-full" style={{ background: "#00A9E0" }} />
              <h1 className="text-xl font-bold text-[#0D2C6E] tracking-tight">Super Admin</h1>
            </div>
            <p className="text-xs text-slate-400 pl-3">
              Platform control · {format(new Date(), "dd MMM yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-full">
              <span className="text-[11px] font-bold text-violet-700">🛡️ {userProfile.name || "Super Admin"}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-emerald-700">Live</span>
            </div>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all flex-shrink-0"
                title="Sign out"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-white text-[#0D2C6E] shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {activeTab === "clinics"   && <ClinicsPanel superAdminUid={userProfile.userId} setShowOnboard={setShowOnboard} />}
        {activeTab === "analytics" && <AnalyticsPanel />}
        {activeTab === "indexes"   && <IndexGuidePanel />}
      </div>

      {showOnboard && (
        <OnboardClinicModal
          onClose={() => setShowOnboard(false)}
          superAdminUid={userProfile.userId}
        />
      )}
    </div>
  );
}

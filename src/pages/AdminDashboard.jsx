import { useState, useEffect } from "react";
import { firebaseConfig, db } from "../firebase/config";
import {
  collection, query, where, onSnapshot, orderBy,
  getDocs, updateDoc, setDoc, doc, serverTimestamp
} from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
// import { getFunctions, httpsCallable } from "firebase/functions";

import { format } from "date-fns";

// ══════════════════════════════════════════════════════════════════════════
// BRAND TOKENS  primary: #0D2C6E  accent: #00A9E0  surface: #F7F9FC
// ══════════════════════════════════════════════════════════════════════════

const DEPT_META = {
  reception:    { label: "Reception",     icon: "🏥", color: "bg-slate-100 text-slate-700",    bar: "#94A3B8" },
  observations: { label: "Observations",  icon: "🩺", color: "bg-purple-50 text-purple-700",   bar: "#9333EA" },
  visual_acuity:{ label: "Visual Acuity", icon: "👁",  color: "bg-sky-50 text-sky-700",         bar: "#0EA5E9" },
  consultation: { label: "Doctor",        icon: "👨‍⚕️", color: "bg-blue-50 text-blue-700",       bar: "#0D2C6E" },
  lab:          { label: "Lab",           icon: "🔬", color: "bg-violet-50 text-violet-700",   bar: "#7C3AED" },
  optical:      { label: "Optical",       icon: "👓", color: "bg-teal-50 text-teal-700",       bar: "#14B8A6" },
  pharmacy:     { label: "Pharmacy",      icon: "💊", color: "bg-amber-50 text-amber-700",     bar: "#D97706" },
  billing:      { label: "Billing",       icon: "💳", color: "bg-emerald-50 text-emerald-700", bar: "#059669" },
  done:         { label: "Discharged",    icon: "✓",  color: "bg-slate-50 text-slate-600",     bar: "#00A9E0" },
};

// Role definitions — values must match what App.jsx role-routing expects
const ROLES = [
  { value: "admin",        label: "Administrator",   icon: "🛡️",  color: "bg-[#EEF3FF] text-[#0D2C6E]",   desc: "Full system access + staff management" },
  { value: "reception",    label: "Receptionist",    icon: "🏥",  color: "bg-slate-100 text-slate-700",    desc: "Patient registration & reception queue" },
  { value: "doctor",       label: "Doctor",          icon: "👨‍⚕️", color: "bg-blue-50 text-blue-700",       desc: "Consultation & patient records" },
  { value: "lab",          label: "Lab Technician",  icon: "🔬",  color: "bg-violet-50 text-violet-700",   desc: "Lab tests & results entry" },
  { value: "pharmacy",     label: "Pharmacist",      icon: "💊",  color: "bg-amber-50 text-amber-700",     desc: "Drug dispensing & pharmacy orders" },
  { value: "billing",      label: "Billing Officer", icon: "💳",  color: "bg-emerald-50 text-emerald-700", desc: "Invoice generation & payment processing" },
];

const getRoleMeta = (value) => ROLES.find(r => r.value === value) || ROLES[1];

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

function Input({ label, error, ...props }) {
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
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: "0 32px 80px rgba(13,44,110,0.2)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full" style={{ background: "#00A9E0" }} />
            <h3 className="font-bold text-[#0D2C6E] text-sm">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// STAFF MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════

// ── Add Staff modal — calls createStaffUser Cloud Function ─────────────────
function AddStaffModal({ clinicId, onClose, createdBy }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName:  "",
    email:     "",
    password:  "",
    role:      "reception",
  });
  const [errors,   setErrors]   = useState({});
  const [saving,   setSaving]   = useState(false);
  const [showPw,   setShowPw]   = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [apiError, setApiError] = useState("");

  const set = (k, v) => {
    setForm(prev => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors(prev => ({ ...prev, [k]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = "Required";
    if (!form.lastName.trim())  e.lastName  = "Required";
    if (!form.email.trim())     e.email     = "Required";
    if (!form.email.includes("@")) e.email  = "Enter a valid email";
    if (form.password.length < 6)  e.password = "Min 6 characters";
    return e;
  };

  const handleCreate = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    setApiError("");

    try {
      // Spawn a temporary secondary Firebase app so the admin session is never interrupted
      const secondaryApp  = initializeApp(firebaseConfig, "staff-creator-" + Date.now());
      const secondaryAuth = getAuth(secondaryApp);

      // Create the Auth user in the secondary app
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        form.email.trim().toLowerCase(),
        form.password
      );

      await updateProfile(cred.user, {
        displayName: `${form.firstName.trim()} ${form.lastName.trim()}`,
      });

      const uid = cred.user.uid;

      // Clean up the secondary app immediately — admin session untouched
      await secondaryAuth.signOut();
      await deleteApp(secondaryApp);

      // Write Firestore doc using the main app's db
      await setDoc(doc(db, "users", uid), {
        userId:             uid,
        clinicId,
        firstName:          form.firstName.trim(),
        lastName:           form.lastName.trim(),
        name:               `${form.firstName.trim()} ${form.lastName.trim()}`,
        email:              form.email.trim().toLowerCase(),
        role:               form.role,
        active:             true,
        mustChangePassword: true,
        createdBy:          createdBy || "admin",
        createdAt:          serverTimestamp(),
      });

      onClose();
    } catch (err) {
      const msg = err?.message || "Failed to create account.";
      setApiError(
        msg.includes("email-already-in-use")
          ? "An account with this email already exists."
          : msg.includes("permission-denied")
          ? "Only admins can create staff accounts."
          : msg
      );
    }
    setSaving(false);
  };

  return (
    <Modal title="Add Staff Account" onClose={onClose}>
      <div className="space-y-4">

        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First Name"
            value={form.firstName}
            onChange={e => set("firstName", e.target.value)}
            placeholder="e.g. Sarah"
            error={errors.firstName}
          />
          <Input
            label="Last Name"
            value={form.lastName}
            onChange={e => set("lastName", e.target.value)}
            placeholder="e.g. Nakato"
            error={errors.lastName}
          />
        </div>

        {/* Email */}
        <Input
          label="Email Address"
          type="email"
          value={form.email}
          onChange={e => set("email", e.target.value)}
          placeholder="sarah.nakato@clinic.ug"
          error={errors.email}
        />

        {/* Password */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
            Temporary Password
          </p>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={form.password}
              onChange={e => set("password", e.target.value)}
              placeholder="Min 6 characters"
              className={`w-full border rounded-lg px-4 py-2.5 pr-10 text-sm bg-white focus:border-[#00A9E0] focus:ring-1 focus:ring-[#00A9E0] focus:outline-none ${
                errors.password ? "border-red-300" : "border-slate-200"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPw ? "🙈" : "👁️"}
            </button>
          </div>
          {errors.password && <p className="text-[11px] text-red-500 mt-1">{errors.password}</p>}
          <p className="text-[11px] text-slate-400 mt-1.5">
            Share with the staff member — they can change it after signing in.
          </p>
        </div>

        {/* Role selector */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Role & Access Level</p>
          <div className="grid grid-cols-1 gap-2">
            {ROLES.map(role => (
              <button
                key={role.value}
                type="button"
                onClick={() => set("role", role.value)}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                  form.role === role.value
                    ? "border-[#0D2C6E] bg-[#EEF3FF]"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="text-lg flex-shrink-0">{role.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${form.role === role.value ? "text-[#0D2C6E]" : "text-slate-800"}`}>
                    {role.label}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">{role.desc}</p>
                </div>
                {form.role === role.value && (
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px]"
                    style={{ background: "#0D2C6E" }}
                  >
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* API error */}
        {apiError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2">
            <span className="text-red-500 flex-shrink-0 mt-0.5">⚠️</span>
            <p className="text-sm text-red-700">{apiError}</p>
          </div>
        )}

        {/* How login works — collapsed by default */}
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowInfo(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
          >
            <span className="text-[11px] font-semibold text-slate-500">ℹ️ How does staff login work?</span>
            <span className="text-slate-400 text-xs">{showInfo ? "▲" : "▼"}</span>
          </button>
          {showInfo && (
            <div className="px-4 py-3 border-t border-slate-200 bg-white">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                A Firebase Auth account is created with the email and password above. The staff member's
                role and clinic are stored in Firestore under{" "}
                <code className="bg-slate-100 px-1 rounded text-[10px]">users/&#123;uid&#125;</code>.
                They sign in at the clinic portal using their email and password.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <NavyBtn
            onClick={handleCreate}
            disabled={saving}
            className="flex-1 py-3"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating…
              </span>
            ) : "Create Account"}
          </NavyBtn>
        </div>
      </div>
    </Modal>
  );
}

// ── Edit Staff modal — updates users/{userId} in Firestore only ────────────
function EditStaffModal({ member, onClose }) {
  const [form, setForm] = useState({
    firstName: member.firstName || "",
    lastName:  member.lastName  || "",
    email:     member.email     || "",
    role:      member.role      || "reception",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = "Required";
    if (!form.lastName.trim())  e.lastName  = "Required";
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    try {
      await updateDoc(doc(db, "users", member.userId), {
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        // email is read-only — Firebase Auth email changes need a separate flow
        role:      form.role,
        name:      `${form.firstName.trim()} ${form.lastName.trim()}`,
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch (err) {
      alert("Failed to update: " + err.message);
    }
    setSaving(false);
  };

  return (
    <Modal title="Edit Staff Account" onClose={onClose}>
      <div className="space-y-4">

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First Name"
            value={form.firstName}
            onChange={e => set("firstName", e.target.value)}
            error={errors.firstName}
          />
          <Input
            label="Last Name"
            value={form.lastName}
            onChange={e => set("lastName", e.target.value)}
            error={errors.lastName}
          />
        </div>

        {/* Email — display only, can't change here */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Email Address</p>
          <div className="w-full border border-slate-100 rounded-lg px-4 py-2.5 text-sm bg-slate-50 text-slate-400">
            {form.email || "—"}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Email changes must be done via Firebase console.</p>
        </div>

        {/* Role selector */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Role & Access Level</p>
          <div className="grid grid-cols-1 gap-2">
            {ROLES.map(role => (
              <button
                key={role.value}
                type="button"
                onClick={() => set("role", role.value)}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                  form.role === role.value
                    ? "border-[#0D2C6E] bg-[#EEF3FF]"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="text-lg flex-shrink-0">{role.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${form.role === role.value ? "text-[#0D2C6E]" : "text-slate-800"}`}>
                    {role.label}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">{role.desc}</p>
                </div>
                {form.role === role.value && (
                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px]"
                        style={{ background: "#0D2C6E" }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <NavyBtn onClick={handleSave} disabled={saving} className="flex-1 py-3">
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving…
              </span>
            ) : "Save Changes"}
          </NavyBtn>
        </div>
      </div>
    </Modal>
  );
}

// ── Staff card ─────────────────────────────────────────────────────────────
function StaffCard({ member, onEdit, onToggleStatus }) {
  const role     = getRoleMeta(member.role);
  const isActive = member.active !== false;
  const initials = `${member.firstName?.[0] || ""}${member.lastName?.[0] || ""}`.toUpperCase();

  return (
    <div className={`bg-white rounded-xl border p-4 transition-all ${isActive ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
          style={{
            background: isActive
              ? "linear-gradient(135deg, #0D2C6E 0%, #00A9E0 100%)"
              : "#94A3B8",
          }}
        >
          {initials || "?"}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-900 text-sm">
              {member.firstName} {member.lastName}
            </p>
            {!isActive && (
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
                Inactive
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${role.color}`}>
              {role.icon} {role.label}
            </span>
            {member.email && (
              <span className="text-[11px] text-slate-400 truncate">{member.email}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => onEdit(member)}
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:border-[#0D2C6E] hover:text-[#0D2C6E] transition-all text-sm"
            title="Edit"
          >
            ✏️
          </button>
          <button
            onClick={() => onToggleStatus(member)}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all text-sm ${
              isActive
                ? "border-red-200 text-red-400 hover:border-red-400 hover:bg-red-50"
                : "border-emerald-200 text-emerald-500 hover:border-emerald-400 hover:bg-emerald-50"
            }`}
            title={isActive ? "Deactivate" : "Reactivate"}
          >
            {isActive ? "🚫" : "✓"}
          </button>
        </div>
      </div>

      {/* Created at */}
      {member.createdAt?.toDate && (
        <p className="text-[10px] text-slate-400 mt-2 pl-14">
          Added {format(member.createdAt.toDate(), "dd MMM yyyy")}
        </p>
      )}
    </div>
  );
}

// ── Staff panel ────────────────────────────────────────────────────────────
function StaffPanel({ clinicId, userProfile }) {
  const [staff,       setStaff]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showAdd,     setShowAdd]     = useState(false);
  const [editTarget,  setEditTarget]  = useState(null);
  const [filterRole,  setFilterRole]  = useState("all");

  // Read from users collection, filtered by clinicId
  useEffect(() => {
    if (!clinicId) return;
    const q = query(
      collection(db, "users"),
      where("clinicId", "==", clinicId),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setStaff(snap.docs.map(d => ({ userId: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [clinicId]);

  const handleToggleStatus = async (member) => {
    const next = member.active === false ? true : false;
    const verb = next ? "reactivate" : "deactivate";
    if (!confirm(`${verb.charAt(0).toUpperCase() + verb.slice(1)} ${member.firstName} ${member.lastName}?`)) return;
    await updateDoc(doc(db, "users", member.userId), { active: next });
  };

  const filtered = filterRole === "all"
    ? staff
    : staff.filter(m => m.role === filterRole);

  const activeCount   = staff.filter(m => m.active !== false).length;
  const inactiveCount = staff.filter(m => m.active === false).length;

  const roleCounts = {};
  ROLES.forEach(r => {
    roleCounts[r.value] = staff.filter(m => m.role === r.value && m.active !== false).length;
  });

  return (
    <div className="space-y-5">

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold" style={{ color: "#0D2C6E" }}>{staff.length}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Total Accounts</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Active</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-slate-400">{inactiveCount}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Inactive</p>
        </div>
      </div>

      {/* Role breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <SectionLabel>Access by Role</SectionLabel>
        <div className="space-y-2">
          {ROLES.map(role => {
            const count = roleCounts[role.value] || 0;
            return (
              <div key={role.value} className="flex items-center gap-3">
                <span className="text-sm w-5 text-center flex-shrink-0">{role.icon}</span>
                <p className="text-xs font-medium text-slate-600 w-32 flex-shrink-0">{role.label}</p>
                <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: count > 0 && activeCount > 0
                        ? `${Math.max((count / activeCount) * 100, 4)}%`
                        : "0%",
                      background: "#0D2C6E",
                    }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-700 w-4 text-right flex-shrink-0">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter + Add */}
      <div className="flex items-center gap-2">
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-1.5 min-w-max">
            <button
              onClick={() => setFilterRole("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterRole === "all"
                  ? "text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
              style={filterRole === "all" ? { background: "#0D2C6E" } : {}}
            >
              All
            </button>
            {ROLES.map(role => (
              <button
                key={role.value}
                onClick={() => setFilterRole(role.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  filterRole === role.value
                    ? "text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
                style={filterRole === role.value ? { background: "#0D2C6E" } : {}}
              >
                {role.icon} {role.label}
              </button>
            ))}
          </div>
        </div>
        <NavyBtn
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 flex-shrink-0 whitespace-nowrap"
        >
          + Add Staff
        </NavyBtn>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-10">
          <div
            className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-2"
            style={{ borderColor: "#0D2C6E", borderTopColor: "transparent" }}
          />
          <p className="text-xs text-slate-400">Loading staff…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center shadow-sm">
          <p className="text-3xl mb-3">👥</p>
          <p className="font-semibold text-slate-700 mb-1">No staff accounts yet</p>
          <p className="text-sm text-slate-400 mb-4">
            Create accounts for each staff member. They'll sign in with email and password.
          </p>
          <NavyBtn onClick={() => setShowAdd(true)} className="px-5 py-2.5">
            + Add First Staff Member
          </NavyBtn>
        </div>
      ) : (
        <div className="space-y-2">
          {[
            ...filtered.filter(m => m.active !== false),
            ...filtered.filter(m => m.active === false),
          ].map(member => (
            <StaffCard
              key={member.userId}
              member={member}
              onEdit={setEditTarget}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}

      {/* Permissions reference */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <SectionLabel>Role Permissions Reference</SectionLabel>
        <div className="space-y-2">
          {ROLES.map(role => (
            <div key={role.value} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide flex-shrink-0 ${role.color}`}>
                {role.icon} {role.label}
              </span>
              <p className="text-xs text-slate-500 leading-relaxed">{role.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      {showAdd && (
        <AddStaffModal
          clinicId={clinicId}
          onClose={() => setShowAdd(false)}
          createdBy={userProfile?.userId}
        />
      )}
      {editTarget && (
        <EditStaffModal
          member={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// DASHBOARD TAB
// ══════════════════════════════════════════════════════════════════════════

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ background: accent }} />
      <div className="pl-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-bold" style={{ color: accent }}>{value}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function DeptPipelineBar({ visits }) {
  const counts = {};
  Object.keys(DEPT_META).forEach(k => (counts[k] = 0));
  visits.forEach(v => {
    const dept = v.currentDepartment || "reception";
    if (counts[dept] !== undefined) counts[dept]++;
  });
  const total = visits.length || 1;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full" style={{ background: "#00A9E0" }} />
          <p className="text-sm font-bold text-[#0D2C6E]">Patient Pipeline</p>
        </div>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Today · Live</span>
      </div>
      <div className="space-y-3.5">
        {Object.entries(DEPT_META)
  .filter(([k]) => k !== "done" && k !== "reception")
  .map(([key, meta]) => {
          const count = counts[key] || 0;
          const pct   = Math.round((count / total) * 100);
          return (
            <div key={key} className="flex items-center gap-3">
              <div className="w-[88px] text-xs font-medium text-slate-600 flex items-center gap-1.5 flex-shrink-0">
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
              </div>
              <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: count > 0 ? `${Math.max(pct, 3)}%` : "0%", background: meta.bar }}
                />
              </div>
              <span className="text-xs font-bold text-slate-700 w-4 text-right flex-shrink-0">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VisitLogRow({ visit, patientMap }) {
  const dept     = visit.currentDepartment || "reception";
  const meta     = DEPT_META[dept] || DEPT_META.reception;
  const time     = visit.createdAt?.toDate ? format(visit.createdAt.toDate(), "HH:mm") : "--:--";
  const name     = patientMap[visit.patientId] || "—";
  const initials = name.split(" ").map(n => n[0]).slice(0, 2).join("");
  const isEmerg  = visit.visitType === "Emergency";

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 text-white ${isEmerg ? "bg-red-500" : ""}`}
          style={!isEmerg ? { background: "linear-gradient(135deg, #0D2C6E 0%, #00A9E0 100%)" } : {}}
        >
          {initials}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            {name}
            {isEmerg && (
              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">⚡</span>
            )}
          </p>
          <p className="text-[11px] text-slate-400">{visit.visitType} · {time}</p>
        </div>
      </div>
      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${meta.color}`}>
        {meta.icon} {meta.label}
      </span>
    </div>
  );
}

function DeptLoadTile({ meta, count }) {
  return (
    <div className={`rounded-xl p-3 text-center ${meta.color}`}>
      <p className="text-xl font-bold">{count}</p>
      <p className="text-[10px] font-semibold mt-0.5 uppercase tracking-wide">{meta.icon} {meta.label}</p>
    </div>
  );
}

function OverviewPanel({ clinicId }) {
  const [visits,     setVisits]     = useState([]);
  const [patientMap, setPatientMap] = useState({});
  const [revenue,    setRevenue]    = useState(0);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (!clinicId) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, "visits"),
      where("clinicId", "==", clinicId),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, async (snap) => {
      const all         = snap.docs.map(d => ({ visitId: d.id, ...d.data() }));
      const todayVisits = all.filter(v => v.createdAt?.toDate && v.createdAt.toDate() >= today);
      setVisits(todayVisits);
      const ids = [...new Set(todayVisits.map(v => v.patientId))];
      const map = { ...patientMap };
      for (const pid of ids) {
        if (!map[pid]) {
          try {
            const pSnap = await getDocs(query(collection(db, "patients"), where("__name__", "==", pid)));
            if (!pSnap.empty) {
              const p = pSnap.docs[0].data();
              map[pid] = `${p.firstName} ${p.lastName}`;
            }
          } catch {}
        }
      }
      setPatientMap(map);
      setLoading(false);
    });
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, "invoices"),
      where("clinicId", "==", clinicId),
      where("status", "==", "paid")
    );
    return onSnapshot(q, (snap) => {
      let total = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.paidAt?.toDate && data.paidAt.toDate() >= today) total += data.totalAmount || 0;
      });
      setRevenue(total);
    });
  }, [clinicId]);

  const activeVisits  = visits.filter(v => v.status !== "done");
  const doneVisits    = visits.filter(v => v.status === "done");
  const emergencies   = visits.filter(v => v.visitType === "Emergency" && v.status !== "done");
  const waitingAtDesk = visits.filter(v => !v.currentDepartment || v.currentDepartment === "reception");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div
            className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: "#0D2C6E", borderTopColor: "transparent" }}
          />
          <p className="text-slate-400 text-sm font-medium">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total Visits"  value={visits.length}        sub="today"         accent="#0D2C6E" />
        <KpiCard label="Active"        value={activeVisits.length}  sub="in system"     accent="#D97706" />
        <KpiCard label="Discharged"    value={doneVisits.length}    sub="completed"     accent="#059669" />
        <KpiCard
          label="Revenue"
          value={revenue >= 1000 ? `${(revenue / 1000).toFixed(0)}K` : revenue.toLocaleString()}
          sub="UGX collected"
          accent="#7C3AED"
        />
      </div>

      {emergencies.length > 0 && (
        <div
          className="rounded-xl border-2 border-red-300 p-4 flex items-center gap-3"
          style={{ background: "linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)" }}
        >
          <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 text-white text-lg animate-pulse">
            ⚡
          </div>
          <div>
            <p className="font-bold text-red-800 text-sm">
              {emergencies.length} Active Emergency{emergencies.length !== 1 ? " Cases" : ""}
            </p>
            <p className="text-xs text-red-600 mt-0.5">Check Reception and Doctor queues immediately</p>
          </div>
        </div>
      )}

      <DeptPipelineBar visits={visits} />

      {waitingAtDesk.length > 0 && (
        <div
          className="rounded-xl border border-amber-300 p-4 flex items-center gap-3"
          style={{ background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)" }}
        >
          <span className="text-xl">⏳</span>
          <p className="text-sm font-semibold text-amber-800">
            {waitingAtDesk.length} patient{waitingAtDesk.length !== 1 ? "s" : ""} at Reception — not yet routed
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-4 rounded-full" style={{ background: "#00A9E0" }} />
          <p className="text-sm font-bold text-[#0D2C6E]">Current Load by Department</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.entries(DEPT_META)
  .filter(([k]) => k !== "done")
  .map(([key, meta]) => {
              const count = visits.filter(
                v => (v.currentDepartment || "reception") === key && v.status !== "done"
              ).length;
              return <DeptLoadTile key={key} meta={meta} count={count} />;
            })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full" style={{ background: "#00A9E0" }} />
            <p className="text-sm font-bold text-[#0D2C6E]">Today's Visit Log</p>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {visits.length} total
          </span>
        </div>
        {visits.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm font-medium">No visits recorded today</p>
          </div>
        ) : (
          <div>
            {visits.slice(0, 20).map(visit => (
              <VisitLogRow key={visit.visitId} visit={visit} patientMap={patientMap} />
            ))}
            {visits.length > 20 && (
              <p className="text-xs text-slate-400 text-center pt-3">
                +{visits.length - 20} more visits today
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// REPORTS PANEL
// ══════════════════════════════════════════════════════════════════════════

function startOfDay(date) { const d = new Date(date); d.setHours(0,0,0,0); return d; }
function endOfDay(date)   { const d = new Date(date); d.setHours(23,59,59,999); return d; }
function dateRange(from, to) {
  const days = [];
  const cur  = startOfDay(new Date(from));
  const end  = startOfDay(new Date(to));
  while (cur <= end) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  return days;
}
function fmtDate(d)     { return format(d, "dd MMM"); }
function fmtDateFull(d) { return format(d, "dd MMM yyyy"); }
function isoDate(d)     { return format(d, "yyyy-MM-dd"); }

function BarChart({ data, color = "#0D2C6E", valueSuffix = "" }) {
  if (!data.length) return null;
  const max  = Math.max(...data.map(d => d.value), 1);
  const W    = 280;
  const H    = 100;
  const barW = Math.max(Math.floor((W - (data.length - 1) * 4) / data.length), 4);
  const gap  = data.length > 1 ? (W - barW * data.length) / (data.length - 1) : 0;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 28}`} style={{ width: "100%", minWidth: Math.max(data.length * 24, 200) }}>
        {data.map((d, i) => {
          const barH = Math.max(Math.round((d.value / max) * H), d.value > 0 ? 3 : 0);
          const x    = i * (barW + gap);
          const y    = H - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} rx="3" fill={color} opacity="0.85" />
              {d.value > 0 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="8" fill={color} fontWeight="700">
                  {d.value}{valueSuffix}
                </text>
              )}
              <text x={x + barW / 2} y={H + 16} textAnchor="middle" fontSize="8" fill="#94A3B8">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function HBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs text-slate-600 w-28 flex-shrink-0 truncate">{label}</p>
      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
             style={{ width: `${Math.max(pct, value > 0 ? 2 : 0)}%`, background: color }} />
      </div>
      <p className="text-xs font-bold text-slate-700 w-6 text-right flex-shrink-0">{value}</p>
    </div>
  );
}

function downloadCSV(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines   = [
    headers.join(","),
    ...rows.map(r =>
      headers.map(h => {
        const v = String(r[h] ?? "").replace(/"/g, '""');
        return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v}"` : v;
      }).join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function ReportCard({ title, icon, loading, children, onExport, exportLabel = "Export CSV" }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: "#00A9E0" }} />
          <span className="text-sm font-bold text-[#0D2C6E]">{icon} {title}</span>
        </div>
        {onExport && (
          <button
            onClick={onExport}
            className="text-[10px] font-bold text-[#0D2C6E] border border-[#0D2C6E] px-2.5 py-1.5 rounded-lg hover:bg-[#0D2C6E] hover:text-white transition-all uppercase tracking-wide"
          >
            ↓ {exportLabel}
          </button>
        )}
      </div>
      <div className="p-5">
        {loading ? (
          <div className="flex items-center gap-2 py-4">
            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                 style={{ borderColor: "#0D2C6E", borderTopColor: "transparent" }} />
            <p className="text-xs text-slate-400">Loading report data…</p>
          </div>
        ) : children}
      </div>
    </div>
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

function DateRangePicker({ from, to, onChange }) {
  const presets = [
    { label: "Today",   days: 0  },
    { label: "7 days",  days: 6  },
    { label: "30 days", days: 29 },
    { label: "90 days", days: 89 },
  ];
  const applyPreset = (days) => {
    const t = new Date();
    const f = new Date();
    f.setDate(f.getDate() - days);
    onChange(isoDate(f), isoDate(t));
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 flex-wrap">
        {presets.map(p => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.days)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:border-[#0D2C6E] hover:text-[#0D2C6E] bg-white transition-all"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="date"
          value={from}
          onChange={e => onChange(e.target.value, to)}
          max={to}
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:border-[#00A9E0] focus:outline-none"
        />
        <span className="text-xs text-slate-400 flex-shrink-0">to</span>
        <input
          type="date"
          value={to}
          onChange={e => onChange(from, e.target.value)}
          min={from}
          max={isoDate(new Date())}
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:border-[#00A9E0] focus:outline-none"
        />
      </div>
    </div>
  );
}

function ReportsPanel({ clinicId }) {
  const today   = isoDate(new Date());
  const weekAgo = isoDate(new Date(Date.now() - 6 * 86400000));

  const [from,     setFrom]     = useState(weekAgo);
  const [to,       setTo]       = useState(today);
  const [visits,   setVisits]   = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [labTests, setLabTests] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading,  setLoading]  = useState(false);

  const handleRange = (f, t) => { setFrom(f); setTo(t); };

useEffect(() => {
  if (!clinicId) return;
  setLoading(true);

  const fromDate = startOfDay(new Date(from));
  const toDate   = endOfDay(new Date(to));
  const inRange  = (ts) => { const t = ts?.toDate?.(); return t && t >= fromDate && t <= toDate; };

  // Track all unsubscribers
  const unsubs = [];
  let vData = [], iData = [], lData = [], pData = [];
  let resolved = 0;
  const total = 4;

  const tryFinish = () => {
    resolved++;
    if (resolved >= total) setLoading(false);
  };

  unsubs.push(onSnapshot(
    query(collection(db, "visits"), where("clinicId", "==", clinicId), orderBy("createdAt", "asc")),
    (snap) => {
      vData = snap.docs.map(d => ({ visitId: d.id, ...d.data() })).filter(v => inRange(v.createdAt));
      setVisits([...vData]);
      tryFinish();
    }
  ));

  unsubs.push(onSnapshot(
    query(collection(db, "invoices"), where("clinicId", "==", clinicId), where("status", "==", "paid")),
    (snap) => {
      iData = snap.docs.map(d => ({ invoiceId: d.id, ...d.data() })).filter(i => inRange(i.paidAt || i.createdAt));
      setInvoices([...iData]);
      tryFinish();
    }
  ));

  unsubs.push(onSnapshot(
    query(collection(db, "lab_tests"), where("clinicId", "==", clinicId)),
    (snap) => {
      lData = snap.docs.map(d => ({ labTestId: d.id, ...d.data() })).filter(l => inRange(l.createdAt));
      setLabTests([...lData]);
      tryFinish();
    }
  ));

  unsubs.push(onSnapshot(
    query(collection(db, "patients"), where("clinicId", "==", clinicId), orderBy("createdAt", "asc")),
    (snap) => {
      pData = snap.docs.map(d => ({ patientId: d.id, ...d.data() })).filter(p => inRange(p.createdAt));
      setPatients([...pData]);
      tryFinish();
    }
  ));

  return () => unsubs.forEach(u => u());
}, [clinicId, from, to]);

  const days          = dateRange(new Date(from), new Date(to));
  const totalRevenue  = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const discharged    = visits.filter(v => v.status === "done").length;
  const emergencies   = visits.filter(v => v.visitType === "Emergency").length;
  const dischargeRate = visits.length > 0 ? Math.round((discharged / visits.length) * 100) : 0;

  const visitsByDay = days.map(d => ({
    label: fmtDate(d),
    value: visits.filter(v => v.createdAt?.toDate && isoDate(v.createdAt.toDate()) === isoDate(d)).length,
  }));

  const revenueByDay = days.map(d => {
    const dayTotal = invoices
      .filter(i => { const ts = (i.paidAt || i.createdAt)?.toDate?.(); return ts && isoDate(ts) === isoDate(d); })
      .reduce((s, i) => s + (i.totalAmount || 0), 0);
    return { label: fmtDate(d), value: dayTotal, rawValue: dayTotal };
  });
  const revenueInK = revenueByDay.some(d => d.rawValue >= 1000);

  const catTotals = {};
  invoices.forEach(inv => {
    (inv.lineItems || []).forEach(item => {
      const desc = item.description || "";
      const cat  = desc.startsWith("Lab:") ? "Lab Tests" :
                   desc.toLowerCase().includes("consultation") ? "Consultations" : "Pharmacy & Other";
      catTotals[cat] = (catTotals[cat] || 0) + ((item.quantity || 1) * (item.unitPrice || 0));
    });
  });

  const visitTypes = {};
  visits.forEach(v => { const k = v.visitType || "OPD"; visitTypes[k] = (visitTypes[k] || 0) + 1; });

  const testCounts = {};
  labTests.forEach(t => { testCounts[t.testName] = (testCounts[t.testName] || 0) + 1; });
  const topTests   = Object.entries(testCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const labDone    = labTests.filter(t => t.status === "completed").length;
  const labPending = labTests.length - labDone;

  const drugCounts = {};
  invoices.forEach(inv => {
    (inv.lineItems || []).forEach(item => {
      const desc = item.description || "";
      if (!desc.includes("Consultation") && !desc.startsWith("Lab:")) {
        const name = desc.replace(/\s×\s\d+/, "").trim();
        if (name) drugCounts[name] = (drugCounts[name] || 0) + (item.quantity || 1);
      }
    });
  });
  const topDrugs = Object.entries(drugCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const genderCounts  = {};
  patients.forEach(p => { const g = (p.gender || "Unknown").trim(); genderCounts[g] = (genderCounts[g] || 0) + 1; });
  const uniquePatients = new Set(visits.map(v => v.patientId)).size;

  const exportDailySummary = () => {
    const rows = days.map(d => {
      const dv   = visits.filter(v => v.createdAt?.toDate && isoDate(v.createdAt.toDate()) === isoDate(d));
      const dRev = invoices.filter(i => { const ts = (i.paidAt || i.createdAt)?.toDate?.(); return ts && isoDate(ts) === isoDate(d); })
                           .reduce((s, i) => s + (i.totalAmount || 0), 0);
      return { Date: fmtDateFull(d), "Total Visits": dv.length, Emergencies: dv.filter(v => v.visitType === "Emergency").length, Discharged: dv.filter(v => v.status === "done").length, "Revenue (UGX)": dRev };
    });
    downloadCSV(`meditrack_daily_${from}_${to}.csv`, rows);
  };
  const exportRevenueFull = () => {
    downloadCSV(`meditrack_revenue_${from}_${to}.csv`, invoices.map(inv => ({
      Date: fmtDateFull((inv.paidAt || inv.createdAt)?.toDate?.() || new Date()),
      "Invoice Ref": inv.invoiceId.slice(-6).toUpperCase(),
      "Patient ID": inv.patientId,
      "Total (UGX)": inv.totalAmount || 0,
      Services: (inv.lineItems || []).map(l => l.description).join(" | "),
    })));
  };
  const exportVisitsFull = () => {
    downloadCSV(`meditrack_visits_${from}_${to}.csv`, visits.map(v => ({
      Date: fmtDateFull(v.createdAt?.toDate?.() || new Date()),
      "Visit Ref": v.visitId.slice(-6).toUpperCase(),
      Type: v.visitType || "OPD",
      Status: v.status || "—",
      Department: v.currentDepartment || "reception",
    })));
  };
  const exportLabFull = () => {
    downloadCSV(`meditrack_lab_${from}_${to}.csv`, labTests.map(t => ({
      Date: fmtDateFull(t.createdAt?.toDate?.() || new Date()),
      Test: t.testName, Status: t.status, Results: t.results || "—",
      "Visit Ref": (t.visitId || "").slice(-6).toUpperCase(),
    })));
  };

  const rangeLabel = from === to
    ? fmtDateFull(new Date(from))
    : `${fmtDateFull(new Date(from))} – ${fmtDateFull(new Date(to))}`;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full" style={{ background: "#00A9E0" }} />
          <p className="text-sm font-bold text-[#0D2C6E]">Report Period</p>
        </div>
        <DateRangePicker from={from} to={to} onChange={handleRange} />
        {!loading && (
          <p className="text-[11px] text-slate-400 mt-2.5">
            Showing data for <span className="font-semibold text-slate-600">{rangeLabel}</span>
            {" · "}<span>{days.length} day{days.length !== 1 ? "s" : ""}</span>
          </p>
        )}
      </div>

      <ReportCard title="Period Summary" icon="📋" loading={loading} onExport={exportDailySummary} exportLabel="Daily CSV">
        <div className="grid grid-cols-2 gap-2 mb-5 sm:grid-cols-4">
          <Pill label="Total Visits"   value={visits.length}       accent="#0D2C6E" />
          <Pill label="Discharged"     value={discharged}          accent="#059669" />
          <Pill label="Emergencies"    value={emergencies}         accent="#DC2626" />
          <Pill label="Discharge Rate" value={`${dischargeRate}%`} accent="#7C3AED" />
        </div>
        {Object.keys(visitTypes).length > 0 && (
          <div className="space-y-2.5 pt-4 border-t border-slate-100">
            <SectionLabel>Breakdown by Visit Type</SectionLabel>
            {Object.entries(visitTypes).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <HBar key={type} label={type} value={count} total={visits.length} color="#0D2C6E" />
            ))}
          </div>
        )}
        {visits.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No visits recorded in this period</p>}
      </ReportCard>

      <ReportCard title="Visit Trends" icon="📈" loading={loading} onExport={exportVisitsFull} exportLabel="Visits CSV">
        {visitsByDay.every(d => d.value === 0) ? (
          <p className="text-sm text-slate-400 text-center py-4">No visits in this period</p>
        ) : (
          <>
            <BarChart data={visitsByDay} color="#0D2C6E" />
            <div className="flex justify-between text-[11px] text-slate-400 mt-2 px-1">
              <span>Peak: <span className="font-semibold text-slate-600">{Math.max(...visitsByDay.map(d => d.value))} visits</span></span>
              <span>Avg: <span className="font-semibold text-slate-600">{(visits.length / Math.max(days.length, 1)).toFixed(1)}/day</span></span>
            </div>
          </>
        )}
      </ReportCard>

      <ReportCard title="Revenue Report" icon="💰" loading={loading} onExport={exportRevenueFull} exportLabel="Revenue CSV">
        <div className="rounded-xl p-4 mb-5 text-center"
             style={{ background: "linear-gradient(135deg, #EEF3FF 0%, #dde8ff 100%)", border: "1px solid #c7d7ff" }}>
          <p className="text-[10px] font-bold text-[#0D2C6E] uppercase tracking-widest mb-1">Total Revenue Collected</p>
          <p className="text-3xl font-bold text-[#0D2C6E]">
            UGX {totalRevenue >= 1_000_000 ? `${(totalRevenue / 1_000_000).toFixed(2)}M` :
                 totalRevenue >= 1_000     ? `${(totalRevenue / 1_000).toFixed(1)}K`     : totalRevenue.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {invoices.length} paid invoice{invoices.length !== 1 ? "s" : ""}
            {invoices.length > 0 && ` · avg UGX ${Math.round(totalRevenue / invoices.length).toLocaleString()}`}
          </p>
        </div>
        {revenueByDay.some(d => d.rawValue > 0) && (
          <div className="mb-5">
            <SectionLabel>Daily Revenue{revenueInK ? " (UGX '000s)" : " (UGX)"}</SectionLabel>
            <BarChart
              data={revenueByDay.map(d => ({ label: d.label, value: revenueInK ? Math.round(d.rawValue / 1000) : d.rawValue }))}
              color="#059669"
              valueSuffix={revenueInK ? "K" : ""}
            />
          </div>
        )}
        {Object.keys(catTotals).length > 0 && (
          <div className="space-y-2 pt-4 border-t border-slate-100">
            <SectionLabel>Revenue by Service Category</SectionLabel>
            {Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
              <div key={cat} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <p className="text-sm text-slate-700 font-medium">{cat}</p>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#0D2C6E]">UGX {amt >= 1000 ? `${(amt / 1000).toFixed(1)}K` : amt.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400">{Math.round((amt / totalRevenue) * 100)}% of total</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {invoices.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No paid invoices in this period</p>}
      </ReportCard>

      <ReportCard title="Laboratory Report" icon="🔬" loading={loading} onExport={labTests.length > 0 ? exportLabFull : undefined} exportLabel="Lab CSV">
        <div className="grid grid-cols-3 gap-2 mb-5">
          <Pill label="Tests Ordered" value={labTests.length} accent="#7C3AED" />
          <Pill label="Completed"     value={labDone}         accent="#059669" />
          <Pill label="Pending"       value={labPending}      accent="#D97706" />
        </div>
        {labTests.length > 0 && (
          <div className="mb-5">
            <div className="flex justify-between text-[11px] text-slate-500 mb-1.5">
              <span>Completion rate</span>
              <span className="font-semibold text-slate-700">{Math.round((labDone / labTests.length) * 100)}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                   style={{ width: `${Math.round((labDone / labTests.length) * 100)}%`, background: "linear-gradient(90deg, #7C3AED, #00A9E0)" }} />
            </div>
          </div>
        )}
        {topTests.length > 0 && (
          <div className="space-y-2.5 pt-4 border-t border-slate-100">
            <SectionLabel>Most Requested Tests</SectionLabel>
            {topTests.map(([name, count]) => (
              <HBar key={name} label={name} value={count} total={labTests.length} color="#7C3AED" />
            ))}
          </div>
        )}
        {labTests.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No lab tests recorded in this period</p>}
      </ReportCard>

      <ReportCard title="Patient Report" icon="👤" loading={loading}>
        <div className="grid grid-cols-2 gap-2 mb-5">
          <Pill label="New Registrations" value={patients.length} accent="#0D2C6E" />
          <Pill label="Unique Patients"   value={uniquePatients}  accent="#00A9E0" />
        </div>
        {Object.keys(genderCounts).length > 0 && (
          <div className="space-y-2.5 mb-4">
            <SectionLabel>Gender Split (New Registrations)</SectionLabel>
            {Object.entries(genderCounts).map(([g, c]) => (
              <HBar key={g} label={g} value={c} total={patients.length} color="#00A9E0" />
            ))}
          </div>
        )}
        {patients.length === 0 && visits.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">No patient data in this period</p>
        )}
      </ReportCard>

      {(topDrugs.length > 0 || !loading) && (
        <ReportCard title="Pharmacy Report" icon="💊" loading={loading}>
          {topDrugs.length > 0 ? (
            <div className="space-y-2.5">
              <SectionLabel>Most Dispensed Drugs</SectionLabel>
              {topDrugs.map(([name, count]) => (
                <HBar key={name} label={name} value={count} total={topDrugs.reduce((s, [, c]) => s + c, 0)} color="#D97706" />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">No pharmacy data in this period</p>
          )}
        </ReportCard>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ══════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "reports",  label: "Reports",  icon: "📑" },
  { id: "staff",    label: "Staff",    icon: "👥" },
];

export default function AdminDashboard({ clinicId, userProfile }) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div style={{ background: "#F7F9FC", minHeight: "100vh" }}>
      <div className="px-4 pt-4 pb-0">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-1 h-5 rounded-full" style={{ background: "#00A9E0" }} />
              <h1 className="text-xl font-bold text-[#0D2C6E] tracking-tight">Admin Dashboard</h1>
            </div>
            <p className="text-xs text-slate-500 pl-3">{format(new Date(), "EEEE, dd MMMM yyyy")}</p>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-emerald-700">Live</span>
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
        {activeTab === "overview" && <OverviewPanel clinicId={clinicId} />}
        {activeTab === "reports"  && <ReportsPanel  clinicId={clinicId} />}
        {activeTab === "staff"    && <StaffPanel    clinicId={clinicId} userProfile={userProfile} />}
      </div>
    </div>
  );
}

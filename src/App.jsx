import { useState, useEffect, useRef } from "react";
import { auth, db } from "./firebase/config";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import Reception from "./pages/Reception";
import Consultation from "./pages/Consultation";
import AdminDashboard from "./pages/AdminDashboard";
import LabPage from "./pages/LabPage";
import Pharmacy from "./pages/Pharmacy";
import Billing from "./pages/Billing";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import Observations from "./pages/Observations";
import VisualAcuity from "./pages/VisualAcuity";
import OpticalShop  from "./pages/OpticalShop";
import MaleWard from "./pages/MaleWard";
import FemaleWard from "./pages/FemaleWard";
import OperatingTheatre from "./pages/OperatingTheatre";

/* ─── Brand constants ─── */
const NAVY   = "#0D2C6E";
const BLUE   = "#1E8FE1";

/* ─── Logomark SVG ─── */
function LogoMark({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="74" height="74" rx="18" stroke={BLUE} strokeWidth="4" />
      <rect x="16" y="38" width="10" height="26" rx="3" fill="white" />
      <rect x="54" y="38" width="10" height="26" rx="3" fill="white" />
      <path d="M16 42 L40 62 L64 42" stroke="white" strokeWidth="9"
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="26" cy="30" r="7" fill="white" />
      <circle cx="54" cy="30" r="7" fill="white" />
      <rect x="36" y="12" width="8" height="20" rx="3" fill={BLUE} />
      <rect x="30" y="18" width="20" height="8" rx="3" fill={BLUE} />
    </svg>
  );
}

/* ─── Heartbeat SVG line (brand signature) ─── */
function HeartbeatLine() {
  return (
    <svg viewBox="0 0 480 36" className="w-full h-9 overflow-visible" aria-hidden="true">
      <style>{`
        .hb { stroke-dasharray: 1100; stroke-dashoffset: 1100;
              animation: drawHb 2.6s ease forwards 0.6s; }
        @keyframes drawHb { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) { .hb { animation: none; stroke-dashoffset: 0; } }
      `}</style>
      <path className="hb"
        d="M0,18 L130,18 L148,18 L162,3 L176,33 L190,3 L204,33 L218,18 L240,18 L480,18"
        fill="none" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round"
        style={{ opacity: 0.5 }}
      />
    </svg>
  );
}

/* ─── Trust signals for left panel ─── */
const TRUST = [
  { icon: "⚡", text: "Patient registered in under 30 seconds" },
  { icon: "🔬", text: "Lab results visible instantly — no lost results" },
  { icon: "📊", text: "Live admin dashboard, zero manual tallying" },
  { icon: "📱", text: "Built for low-end Android phones in Uganda" },
];

/* ══════════════════════════════════════════
   LOGIN SCREEN
═══════════════════════════════════════════ */
function LoginScreen() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPw,   setShowPw]   = useState(false);
  const emailRef = useRef(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError("Incorrect email or password. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* ── LEFT PANEL (navy brand) ── */}
      <div
        className="hidden md:flex md:w-[52%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: NAVY }}
      >
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* Blue glow */}
        <div className="absolute top-1/3 -left-20 w-80 h-80 rounded-full blur-3xl pointer-events-none"
          style={{ background: `${BLUE}18` }} />

       {/* Top — brand */}
<div className="relative z-10">
  <div className="flex items-center gap-3 mb-16">
    <LogoMark size={44} />
    <span className="text-[1.35rem] font-black tracking-tight text-white">
      MediTrack<span style={{ color: BLUE }}>Ug</span>
    </span>
  </div>

  <h1 className="text-[2.6rem] font-black leading-[1.1] tracking-[-0.03em] text-white mb-5">
    Eye hospital management<br />
    built for<br />
    <span style={{ color: BLUE }}>Uganda.</span>
  </h1>

  <p className="text-white/50 text-[1rem] leading-[1.75] max-w-sm">
    Real-time patient records, eye clinic workflows, lab results, and reporting — all in one system. No paper. No delays. No confusion.
  </p>
</div>
        {/* Middle — trust signals */}
        <div className="relative z-10 space-y-4 my-10">
          {TRUST.map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: `${BLUE}22`, border: `1px solid ${BLUE}44` }}>
                {icon}
              </span>
              <span className="text-[0.875rem] text-white/60 leading-snug">{text}</span>
            </div>
          ))}
        </div>

        {/* Bottom — heartbeat + tagline */}
        <div className="relative z-10">
          <HeartbeatLine />
          <p className="text-[0.7rem] font-bold tracking-[0.14em] uppercase mt-3"
            style={{ color: `${BLUE}99` }}>
            Connect. Care. Manage.
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL (login form) ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-12 sm:px-10">

        {/* Mobile-only brand header */}
        <div className="flex md:hidden items-center gap-2.5 mb-10">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: NAVY }}>
            <LogoMark size={28} />
          </div>
          <span className="text-[1.15rem] font-black tracking-tight" style={{ color: NAVY }}>
            MediTrack<span style={{ color: BLUE }}>Ug</span>
          </span>
        </div>

        <div className="w-full max-w-[380px]">

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-[1.75rem] font-black tracking-[-0.025em] mb-1.5"
              style={{ color: NAVY }}>
              Sign in
            </h2>
            <p className="text-[0.9rem] text-gray-400">
              Enter your clinic credentials to continue.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <label className="block text-[0.8rem] font-semibold text-gray-500 mb-1.5 tracking-wide uppercase">
                Email address
              </label>
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl px-4 py-3.5 text-[0.95rem] text-gray-900 outline-none transition-all duration-150"
                style={{
                  border: "2px solid #EEF2F7",
                  background: "#F9FAFC",
                }}
                onFocus={(e) => { e.target.style.borderColor = BLUE; e.target.style.background = "white"; }}
                onBlur={(e)  => { e.target.style.borderColor = "#EEF2F7"; e.target.style.background = "#F9FAFC"; }}
                placeholder="doctor@clinic.ug"
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[0.8rem] font-semibold text-gray-500 tracking-wide uppercase">
                  Password
                </label>
                <button
                  type="button"
                  className="text-[0.78rem] font-medium transition-colors"
                  style={{ color: BLUE }}
                  onMouseEnter={(e) => e.target.style.color = NAVY}
                  onMouseLeave={(e) => e.target.style.color = BLUE}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl px-4 py-3.5 pr-12 text-[0.95rem] text-gray-900 outline-none transition-all duration-150"
                  style={{
                    border: "2px solid #EEF2F7",
                    background: "#F9FAFC",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = BLUE; e.target.style.background = "white"; }}
                  onBlur={(e)  => { e.target.style.borderColor = "#EEF2F7"; e.target.style.background = "#F9FAFC"; }}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? (
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 rounded-xl px-4 py-3.5"
                style={{ background: "#FEF2F2", border: "1.5px solid #FECACA" }}>
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[0.85rem] text-red-700">{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-4 rounded-xl text-[0.95rem] font-bold text-white transition-all duration-200 disabled:opacity-50 active:scale-[0.98] mt-1"
              style={{
                background: loading ? BLUE : NAVY,
                boxShadow: "0 4px 20px rgba(13,44,110,0.25)",
              }}
              onMouseEnter={(e) => { if (!loading) e.target.style.background = BLUE; }}
              onMouseLeave={(e) => { if (!loading) e.target.style.background = NAVY; }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2.5">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign in to MediTrackUg →"
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-[0.8rem] text-gray-400 text-center leading-relaxed">
              Access is restricted to authorised clinic staff.<br />
              Contact your clinic admin if you need an account.
            </p>
          </div>

          {/* Role badge row */}
          <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
            {["Reception", "Doctor", "Lab", "Pharmacy", "Billing", "Admin"].map((r) => (
              <span key={r}
                className="text-[0.68rem] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "#EBF5FD", color: BLUE }}>
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   NAVBAR
═══════════════════════════════════════════ */
function NavBar({ userProfile, onSignOut, currentPage, setCurrentPage }) {
  const role = userProfile?.role;
  const scrollRef = useRef(null);
  const [showLeftFade,  setShowLeftFade]  = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const navItems = [
    { id: "reception",     label: "Reception",         icon: "🏥", roles: ["admin", "reception"] },
    { id: "observations",  label: "Observations",      icon: "🩺", roles: ["admin", "reception"] },
    { id: "visual_acuity", label: "Visual Acuity",     icon: "👁",  roles: ["admin", "reception"] },
    { id: "consultation",  label: "Doctor",            icon: "👨‍⚕️", roles: ["admin", "doctor"] },
    { id: "lab",           label: "Lab",               icon: "🔬", roles: ["admin", "lab"] },
    { id: "male_ward",     label: "Male Ward",         icon: "🛏️", roles: ["admin", "doctor", "ward_male"] },
    { id: "female_ward",   label: "Female Ward",       icon: "🛏️", roles: ["admin", "doctor", "ward_female"] },
    { id: "ot",            label: "Operating Theatre", icon: "🔪", roles: ["admin", "doctor", "ot"] },
    { id: "optical",       label: "Optical",           icon: "👓", roles: ["admin", "optical"] },
    { id: "pharmacy",      label: "Pharmacy",          icon: "💊", roles: ["admin", "pharmacy"] },
    { id: "billing",       label: "Billing",           icon: "💳", roles: ["admin", "billing"] },
    { id: "dashboard",     label: "Dashboard",         icon: "📊", roles: ["admin"] },
  ].filter((item) => item.roles.includes(role));

  const updateFades = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 4);
    setShowRightFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateFades();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateFades, { passive: true });
    window.addEventListener("resize", updateFades);
    return () => {
      el.removeEventListener("scroll", updateFades);
      window.removeEventListener("resize", updateFades);
    };
  }, [navItems.length]);

  // Keep the active tab scrolled into view when it changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeBtn = el.querySelector(`[data-navid="${currentPage}"]`);
    activeBtn?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [currentPage]);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      {/* Top row: brand + user chip + sign out — always uncrowded */}
      <div className="flex items-center justify-between px-4 py-2.5 gap-3">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: NAVY }}>
            <svg width="18" height="18" viewBox="0 0 80 80" fill="none">
              <rect x="16" y="38" width="10" height="26" rx="3" fill="white"/>
              <rect x="54" y="38" width="10" height="26" rx="3" fill="white"/>
              <path d="M16 42 L40 62 L64 42" stroke="white" strokeWidth="9"
                strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <circle cx="26" cy="30" r="7" fill="white"/>
              <circle cx="54" cy="30" r="7" fill="white"/>
              <rect x="36" y="12" width="8" height="20" rx="3" fill={BLUE}/>
              <rect x="30" y="18" width="20" height="8" rx="3" fill={BLUE}/>
            </svg>
          </div>
          <span className="font-extrabold text-sm tracking-tight hidden sm:inline" style={{ color: NAVY }}>
            MediTrack<span style={{ color: BLUE }}>Ug</span>
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-2 px-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[0.6rem] font-bold text-white"
              style={{ background: BLUE }}>
              {userProfile?.name?.[0] ?? "U"}
            </div>
            <span className="text-[0.78rem] font-medium text-gray-600 max-w-[100px] truncate">
              {userProfile?.name}
            </span>
          </div>
          <button
            onClick={onSignOut}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Sign out"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tab strip: own horizontally-scrolling row, same pattern on every breakpoint */}
      <div className="relative border-t border-gray-100">
        {showLeftFade && (
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10"
            style={{ background: "linear-gradient(90deg, white, transparent)" }} />
        )}
        {showRightFade && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10"
            style={{ background: "linear-gradient(270deg, white, transparent)" }} />
        )}

        <div
          ref={scrollRef}
          className="flex overflow-x-auto px-2"
          style={{ scrollbarWidth: "none" }}
        >
          {navItems.map((item) => {
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                data-navid={item.id}
                onClick={() => setCurrentPage(item.id)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-[0.8rem] font-medium whitespace-nowrap transition-colors flex-shrink-0"
                style={{
                  color: active ? BLUE : "#6b7280",
                  borderBottom: active ? `2.5px solid ${BLUE}` : "2.5px solid transparent",
                }}
              >
                <span className="text-[0.85rem]">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/* ══════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════ */
export default function App() {
  const [user,        setUser]        = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [currentPage, setCurrentPage] = useState("reception");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const profileDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (profileDoc.exists()) {
          const profile = profileDoc.data();
          setUserProfile(profile);
          // ── role → default landing page ──────────────────────────────
          const defaults = {
            superadmin: "superadmin", // handled separately — no page needed
            doctor:     "consultation",
            lab:        "lab",
            pharmacy:   "pharmacy",
            billing:    "billing",
            admin:      "dashboard",
          };
          setCurrentPage(defaults[profile.role] ?? "reception");
        } else {
          setUserProfile({
            userId:   firebaseUser.uid,
            clinicId: "demo-clinic",
            name:     firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Staff",
            role:     "admin",
            email:    firebaseUser.email,
          });
          setCurrentPage("dashboard");
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  /* ── Loading splash ─────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <svg className="w-12 h-12 animate-spin mx-auto mb-4" fill="none" viewBox="0 0 24 24"
            style={{ color: NAVY }}>
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
            <path className="opacity-90" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p className="text-[0.875rem] font-medium text-gray-400">Loading MediTrackUg...</p>
        </div>
      </div>
    );
  }

  /* ── Not authenticated ──────────────────────────────────────────────── */
  if (!user) return <LoginScreen />;

  /* ── Super-admin: render standalone dashboard, no clinic NavBar ─────── */
  if (userProfile?.role === "superadmin") {
    return (
      <SuperAdminDashboard
        userProfile={userProfile}
        onSignOut={() => signOut(auth)}
      />
    );
  }

  /* ── Clinic staff: regular app ──────────────────────────────────────── */
  const clinicId = userProfile?.clinicId ?? "demo-clinic";

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        userProfile={userProfile}
        onSignOut={() => signOut(auth)}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      />
      <main className="max-w-5xl mx-auto px-4 py-6">
        {currentPage === "reception"    && <Reception    clinicId={clinicId} userProfile={userProfile} />}
        {currentPage === "observations"  && <Observations  clinicId={clinicId} userProfile={userProfile} />}
        {currentPage === "visual_acuity" && <VisualAcuity clinicId={clinicId} userProfile={userProfile} />}
        {currentPage === "consultation" && <Consultation clinicId={clinicId} userProfile={userProfile} />}
        {currentPage === "lab"          && <LabPage      clinicId={clinicId} userProfile={userProfile} />}
        {currentPage === "male_ward"    && <MaleWard         clinicId={clinicId} userProfile={userProfile} />}
        {currentPage === "female_ward"  && <FemaleWard       clinicId={clinicId} userProfile={userProfile} />}
        {currentPage === "ot"           && <OperatingTheatre clinicId={clinicId} userProfile={userProfile} />}
        {currentPage === "pharmacy"     && <Pharmacy     clinicId={clinicId} userProfile={userProfile} />}
        {currentPage === "optical"    && <OpticalShop    clinicId={clinicId} userProfile={userProfile} />}
        {currentPage === "billing"      && <Billing      clinicId={clinicId} userProfile={userProfile} />}
        {currentPage === "dashboard"    && <AdminDashboard clinicId={clinicId} userProfile={userProfile} />}
      </main>
    </div>
  );
}

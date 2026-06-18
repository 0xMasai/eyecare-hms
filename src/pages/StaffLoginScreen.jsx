/**
 * StaffLoginScreen
 * Full-screen PIN pad shown when no staff session exists.
 * Plug into your App.jsx around the tab router.
 *
 * Props:
 *   onLogin(pin) — async fn from useStaffAuth, returns true/false
 *   error        — string from useStaffAuth
 *   loading      — bool from useStaffAuth
 *   clinicName   — string, e.g. "Kampala Health Clinic"
 */

import { useState } from "react";

const PAD_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "⌫"];

export default function StaffLoginScreen({ onLogin, error, loading, clinicName = "MediTrack" }) {
  const [pin, setPin] = useState("");

  const handleKey = async (key) => {
    if (key === "⌫") {
      setPin(prev => prev.slice(0, -1));
      return;
    }
    if (key === null) return;
    const next = pin + String(key);
    setPin(next);
    if (next.length === 4) {
      const ok = await onLogin(next);
      if (!ok) setPin("");
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-10"
      style={{ background: "linear-gradient(160deg, #0D2C6E 0%, #0a2055 60%, #061540 100%)" }}
    >
      {/* Logo area */}
      <div className="mb-8 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
          style={{ background: "linear-gradient(135deg, #00A9E0 0%, #0078a8 100%)" }}
        >
          <span className="text-white text-2xl">🏥</span>
        </div>
        <h1 className="text-white text-2xl font-bold tracking-tight">{clinicName}</h1>
        <p className="text-white/50 text-sm mt-1">Staff Access — Enter PIN</p>
      </div>

      {/* PIN dots */}
      <div className="flex gap-4 mb-6">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full border-2 transition-all duration-150 ${
              pin.length > i
                ? "border-[#00A9E0] bg-[#00A9E0]"
                : "border-white/30 bg-transparent"
            }`}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-500/20 border border-red-500/40 rounded-xl px-4 py-2.5 text-sm text-red-200 text-center max-w-xs">
          {error}
        </div>
      )}

      {/* PIN pad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {PAD_KEYS.map((key, idx) => {
          if (key === null) {
            return <div key={idx} />;
          }
          return (
            <button
              key={idx}
              onClick={() => handleKey(key)}
              disabled={loading || (key !== "⌫" && pin.length >= 4)}
              className={`h-16 rounded-2xl text-xl font-semibold transition-all active:scale-95 disabled:opacity-40 ${
                key === "⌫"
                  ? "bg-white/10 text-white/70 hover:bg-white/20"
                  : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
              }`}
              style={key !== "⌫" && pin.length < 4 ? { backdropFilter: "blur(8px)" } : {}}
            >
              {loading && pin.length === 4 && key !== "⌫" ? (
                <span className="flex items-center justify-center">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </span>
              ) : key}
            </button>
          );
        })}
      </div>

      <p className="text-white/30 text-xs mt-8 text-center">
        Contact your administrator if you've forgotten your PIN.
      </p>
    </div>
  );
}

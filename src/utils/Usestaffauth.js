/**
 * useStaffAuth — MediTrack staff PIN login hook
 *
 * Usage:
 *   const { staffProfile, login, logout, loading } = useStaffAuth(clinicId);
 *
 * staffProfile shape:
 *   { staffId, firstName, lastName, email, role, clinicId }
 *
 * Role → permitted app tab:
 *   admin        → all tabs (dashboard, reception, consultation, lab, pharmacy, billing)
 *   receptionist → reception
 *   doctor       → consultation
 *   lab          → lab
 *   pharmacist   → pharmacy
 *   billing      → billing
 */

import { useState, useEffect, useCallback } from "react";
import { db } from "../firebase/config";
import {
  collection, query, where, getDocs, limit
} from "firebase/firestore";

// ── Role → permitted tabs mapping ─────────────────────────────────────────
export const ROLE_TABS = {
  admin:        ["dashboard", "reception", "consultation", "lab", "pharmacy", "billing"],
  receptionist: ["reception"],
  doctor:       ["consultation"],
  lab:          ["lab"],
  pharmacist:   ["pharmacy"],
  billing:      ["billing"],
};

export const ROLE_DEFAULT_TAB = {
  admin:        "dashboard",
  receptionist: "reception",
  doctor:       "consultation",
  lab:          "lab",
  pharmacist:   "pharmacy",
  billing:      "billing",
};

const SESSION_KEY = "meditrack_staff_session";

// ── Hook ──────────────────────────────────────────────────────────────────
export function useStaffAuth(clinicId) {
  const [staffProfile, setStaffProfile] = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");

  // Restore session from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only restore if same clinic
        if (parsed.clinicId === clinicId) {
          setStaffProfile(parsed);
        }
      }
    } catch {}
    setLoading(false);
  }, [clinicId]);

  // Login with PIN
  const login = useCallback(async (pin) => {
    setError("");
    setLoading(true);
    try {
      if (!pin || pin.length !== 4) {
        setError("PIN must be 4 digits.");
        setLoading(false);
        return false;
      }

      const q = query(
        collection(db, "staff"),
        where("clinicId", "==", clinicId),
        where("pin",      "==", pin),
        where("status",   "==", "active"),
        limit(1)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setError("Invalid PIN or account inactive.");
        setLoading(false);
        return false;
      }

      const data    = snap.docs[0].data();
      const profile = {
        staffId:   snap.docs[0].id,
        firstName: data.firstName,
        lastName:  data.lastName,
        email:     data.email || "",
        role:      data.role,
        clinicId,
      };

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(profile));
      setStaffProfile(profile);
      setLoading(false);
      return true;
    } catch (e) {
      setError("Login failed. Check connection.");
      setLoading(false);
      return false;
    }
  }, [clinicId]);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setStaffProfile(null);
  }, []);

  const canAccess = useCallback((tab) => {
    if (!staffProfile) return false;
    const permitted = ROLE_TABS[staffProfile.role] || [];
    return permitted.includes(tab);
  }, [staffProfile]);

  return { staffProfile, login, logout, loading, error, canAccess };
}
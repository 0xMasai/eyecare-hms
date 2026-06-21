import { db } from "../firebase/config";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, runTransaction, writeBatch,
} from "firebase/firestore";

/* ════════════════════════════════════════════════════════════════════════
   WARD SERVICE
   Firestore collections used:
     beds       — { clinicId, wardType, bedNumber, status, currentAdmissionId }
     admissions — { clinicId, patientId, patientName, age, gender, visitId,
                    wardType, bedNumber, admissionDate, doctorAssigned,
                    diagnosis, condition, status, dischargeDate,
                    dischargeSummary, billingStatus, createdAt }
       admissions/{id}/vitals          — { temperature, bp, pulse, recordedBy, recordedAt }
       admissions/{id}/notes           — { text, type ("doctor"|"nurse"), author, createdAt }
       admissions/{id}/medications     — { drugName, dose, route, frequency, prescribedBy, createdAt }
       admissions/{id}/administrations — { medicationId, notes, administeredBy, administeredAt }
       admissions/{id}/labTests        — { testName, status, result, orderedBy, orderedAt, resultAt }
   admission.status   tracks WORKFLOW: "admitted" | "in_surgery" | "discharged"
   admission.condition tracks CLINICAL state shown on the badge: "stable" | "critical"
   ════════════════════════════════════════════════════════════════════════ */

const bedId = (clinicId, wardType, bedNumber) => `${clinicId}_${wardType}_${bedNumber}`;

// ── Bed provisioning ─────────────────────────────────────────────────────
// Creates a baseline set of beds for a ward the first time it's used.
// Safe to call on every page load — it's a no-op once beds already exist.
export async function ensureBedsSeeded(clinicId, wardType, bedCount = 12) {
  const existing = await getDocs(
    query(collection(db, "beds"), where("clinicId", "==", clinicId), where("wardType", "==", wardType))
  );
  if (existing.size > 0) return;

  const prefix = wardType === "male" ? "M" : "F";
  const batch = writeBatch(db);
  for (let i = 1; i <= bedCount; i++) {
    const bedNumber = `${prefix}-${String(i).padStart(2, "0")}`;
    batch.set(doc(db, "beds", bedId(clinicId, wardType, bedNumber)), {
      clinicId, wardType, bedNumber, status: "available", currentAdmissionId: null,
    });
  }
  await batch.commit();
}

// ── Admit ────────────────────────────────────────────────────────────────
// Atomically claims a bed and opens an admission, so two staff can't admit
// two different patients into the same bed at the same time.
export async function admitPatient(clinicId, {
  patientId, patientName, age, gender, wardType, bedNumber,
  doctorAssigned, diagnosis, visitId = null,
}) {
  const bedRef = doc(db, "beds", bedId(clinicId, wardType, bedNumber));
  const admissionRef = doc(collection(db, "admissions"));

  await runTransaction(db, async (tx) => {
    const bedSnap = await tx.get(bedRef);
    if (!bedSnap.exists() || bedSnap.data().status !== "available") {
      throw new Error("That bed is no longer available — pick another.");
    }
    tx.set(admissionRef, {
      clinicId, patientId, patientName, age: age || null, gender: gender || null,
      visitId, wardType, bedNumber,
      admissionDate: serverTimestamp(),
      doctorAssigned: doctorAssigned || "", diagnosis: diagnosis || "",
      condition: "stable", status: "admitted",
      dischargeDate: null, dischargeSummary: "", billingStatus: "pending",
      createdAt: serverTimestamp(),
    });
    tx.update(bedRef, { status: "occupied", currentAdmissionId: admissionRef.id });
  });

  // If this admission originated from an outpatient visit, move it off the
  // reception/consultation queues and into the ward queue.
  if (visitId) {
    await updateDoc(doc(db, "visits", visitId), {
      currentDepartment: wardType === "male" ? "male_ward" : "female_ward",
      status: "admitted",
    });
  }
  return admissionRef.id;
}

// ── Condition / status ───────────────────────────────────────────────────
export async function setCondition(admissionId, condition) {
  await updateDoc(doc(db, "admissions", admissionId), { condition });
}

// ── Vitals ───────────────────────────────────────────────────────────────
export async function addVitals(admissionId, vitals, recordedBy) {
  await addDoc(collection(db, "admissions", admissionId, "vitals"), {
    ...vitals, recordedBy: recordedBy || "Unknown", recordedAt: serverTimestamp(),
  });
}

// ── Notes (doctor + nurse) ───────────────────────────────────────────────
export async function addNote(admissionId, text, type, author) {
  await addDoc(collection(db, "admissions", admissionId, "notes"), {
    text, type: type || "nurse", author: author || "Unknown", createdAt: serverTimestamp(),
  });
}

// ── Medications / drug chart ─────────────────────────────────────────────
export async function addMedication(admissionId, med, prescribedBy) {
  const ref = await addDoc(collection(db, "admissions", admissionId, "medications"), {
    ...med, prescribedBy: prescribedBy || "Unknown", createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function recordAdministration(admissionId, medicationId, notes, administeredBy) {
  await addDoc(collection(db, "admissions", admissionId, "administrations"), {
    medicationId, notes: notes || "",
    administeredBy: administeredBy || "Unknown", administeredAt: serverTimestamp(),
  });
}

// ── Lab tests ────────────────────────────────────────────────────────────
export async function addLabTest(admissionId, testName, orderedBy) {
  const ref = await addDoc(collection(db, "admissions", admissionId, "labTests"), {
    testName, status: "pending", result: "",
    orderedBy: orderedBy || "Unknown", orderedAt: serverTimestamp(), resultAt: null,
  });
  return ref.id;
}

export async function recordLabResult(admissionId, labTestId, result) {
  await updateDoc(doc(db, "admissions", admissionId, "labTests", labTestId), {
    result, status: "completed", resultAt: serverTimestamp(),
  });
}

// ── Transfer between wards ───────────────────────────────────────────────
export async function transferWard(clinicId, admission, toWardType, toBedNumber) {
  const fromBedRef = doc(db, "beds", bedId(clinicId, admission.wardType, admission.bedNumber));
  const toBedRef = doc(db, "beds", bedId(clinicId, toWardType, toBedNumber));
  const admissionRef = doc(db, "admissions", admission.admissionId);

  await runTransaction(db, async (tx) => {
    const toBedSnap = await tx.get(toBedRef);
    if (!toBedSnap.exists() || toBedSnap.data().status !== "available") {
      throw new Error("Target bed is no longer available — pick another.");
    }
    tx.update(fromBedRef, { status: "available", currentAdmissionId: null });
    tx.update(toBedRef, { status: "occupied", currentAdmissionId: admission.admissionId });
    tx.update(admissionRef, { wardType: toWardType, bedNumber: toBedNumber });
  });
}

// ── Discharge ────────────────────────────────────────────────────────────
export async function dischargePatient(clinicId, admission, { summary, billingStatus }) {
  await updateDoc(doc(db, "admissions", admission.admissionId), {
    status: "discharged",
    dischargeDate: serverTimestamp(),
    dischargeSummary: summary || "",
    billingStatus: billingStatus || "pending",
  });
  await updateDoc(doc(db, "beds", bedId(clinicId, admission.wardType, admission.bedNumber)), {
    status: "available", currentAdmissionId: null,
  });
}

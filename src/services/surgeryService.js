import { db } from "../firebase/config";
import {
  collection, doc, getDocs, addDoc, updateDoc,
  query, where, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { admitPatient } from "./wardService";

/* ════════════════════════════════════════════════════════════════════════
   SURGERY / OPERATING THEATRE SERVICE
   Firestore collection: surgeries — {
     clinicId, patientId, patientName, admissionId (nullable),
     procedureName, surgeryType ("Emergency"|"Elective"),
     date ("YYYY-MM-DD"), startTime, endTime (Timestamps), theatreRoom,
     team: { surgeon, assistants[], anesthetist, nurses[] },
     preOp: { diagnosis, consentStatus, labResults, notes },
     intraOp: { procedureDetails, complications },
     postOp: { recoveryStatus, notes, transferredToWard },
     status: "scheduled" | "ongoing" | "completed" | "cancelled",
     createdAt,
   }

   NOTE on double-booking: this does a best-effort read-then-write conflict
   check immediately before scheduling. Two bookings submitted at the exact
   same instant could theoretically still race past each other — Firestore
   transactions can't run an arbitrary query, only point reads. For a fully
   race-proof guarantee, move this check into a Cloud Function or model each
   (room, day) as its own document with per-slot fields. For clinic-scale
   booking volume this check is more than sufficient in practice.
   ════════════════════════════════════════════════════════════════════════ */

export async function checkTheatreConflict(clinicId, theatreRoom, date, startTime, endTime, excludeSurgeryId = null) {
  const snap = await getDocs(query(
    collection(db, "surgeries"),
    where("clinicId", "==", clinicId),
    where("theatreRoom", "==", theatreRoom),
    where("date", "==", date)
  ));

  const newStart = new Date(startTime).getTime();
  const newEnd = new Date(endTime).getTime();

  return snap.docs.some((d) => {
    if (d.id === excludeSurgeryId) return false;
    const s = d.data();
    if (s.status === "cancelled") return false;
    const existStart = s.startTime?.toDate ? s.startTime.toDate().getTime() : new Date(s.startTime).getTime();
    const existEnd = s.endTime?.toDate ? s.endTime.toDate().getTime() : new Date(s.endTime).getTime();
    return newStart < existEnd && newEnd > existStart; // overlap
  });
}

export async function scheduleSurgery(clinicId, data) {
  const conflict = await checkTheatreConflict(clinicId, data.theatreRoom, data.date, data.startTime, data.endTime);
  if (conflict) {
    throw new Error(`${data.theatreRoom} is already booked over that time slot on ${data.date}.`);
  }
  const ref = await addDoc(collection(db, "surgeries"), {
    clinicId,
    patientId: data.patientId,
    patientName: data.patientName,
    admissionId: data.admissionId || null,
    procedureName: data.procedureName,
    surgeryType: data.surgeryType || "Elective",
    date: data.date,
    startTime: Timestamp.fromDate(new Date(data.startTime)),
    endTime: Timestamp.fromDate(new Date(data.endTime)),
    theatreRoom: data.theatreRoom,
    team: {
      surgeon: data.team?.surgeon || "",
      assistants: data.team?.assistants || [],
      anesthetist: data.team?.anesthetist || "",
      nurses: data.team?.nurses || [],
    },
    preOp: {
      diagnosis: data.preOp?.diagnosis || "",
      consentStatus: data.preOp?.consentStatus || "pending",
      labResults: data.preOp?.labResults || "",
      notes: data.preOp?.notes || "",
    },
    intraOp: { procedureDetails: "", complications: "" },
    postOp: { recoveryStatus: "", notes: "", transferredToWard: null },
    status: "scheduled",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePreOp(surgeryId, preOp) {
  await updateDoc(doc(db, "surgeries", surgeryId), { preOp });
}

// Moves a surgery through its lifecycle. When a surgery tied to a ward
// admission goes "ongoing", the patient's bed is held via an "in_surgery"
// admission status so it can't be reassigned while they're in theatre.
export async function updateSurgeryStatus(surgery, status) {
  await updateDoc(doc(db, "surgeries", surgery.surgeryId), { status });
  if (status === "ongoing" && surgery.admissionId) {
    await updateDoc(doc(db, "admissions", surgery.admissionId), { status: "in_surgery" });
  }
}

export async function updateIntraOp(surgeryId, intraOp) {
  await updateDoc(doc(db, "surgeries", surgeryId), { intraOp });
}

// Completing a surgery auto-routes the patient back to a ward:
//  • if they already had a bed reserved (admissionId set), it's simply
//    released back to "admitted" — no new bed needed.
//  • otherwise (e.g. a day-case booked without a prior admission), a new
//    admission + bed is opened in whichever ward postOp.transferredToWard names.
export async function completeSurgery(clinicId, surgery, postOp, recoveryBedNumber) {
  await updateDoc(doc(db, "surgeries", surgery.surgeryId), { postOp, status: "completed" });

  if (surgery.admissionId) {
    await updateDoc(doc(db, "admissions", surgery.admissionId), { status: "admitted" });
  } else if (postOp.transferredToWard && recoveryBedNumber) {
    await admitPatient(clinicId, {
      patientId: surgery.patientId,
      patientName: surgery.patientName,
      wardType: postOp.transferredToWard,
      bedNumber: recoveryBedNumber,
      doctorAssigned: surgery.team?.surgeon || "",
      diagnosis: `Post-operative recovery — ${surgery.procedureName}`,
    });
  }
}

export async function cancelSurgery(surgeryId) {
  await updateDoc(doc(db, "surgeries", surgeryId), { status: "cancelled" });
}

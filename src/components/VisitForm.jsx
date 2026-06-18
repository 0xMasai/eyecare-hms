import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { collection, addDoc, getDocs, updateDoc, increment, query, where, onSnapshot, serverTimestamp } from "firebase/firestore";

const VISIT_TYPES = ["OPD", "Emergency", "Follow-up"];

const DEFAULT_DEPARTMENTS = [
  { departmentId: "general", name: "General" },
  { departmentId: "maternity", name: "Maternity" },
  { departmentId: "paediatrics", name: "Paediatrics" },
  { departmentId: "lab", name: "Laboratory" },
];

export default function VisitForm({ clinicId, patient, onSuccess, onCancel }) {
  const [visitType, setVisitType] = useState("OPD");
  const [departmentId, setDepartmentId] = useState("general");
  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "departments"), where("clinicId", "==", clinicId));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setDepartments(snap.docs.map((d) => ({ departmentId: d.id, ...d.data() })));
      }
    });
    return unsub;
  }, [clinicId]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const visitRef = await addDoc(collection(db, "visits"), {
        clinicId,
        patientId: patient.patientId,
        visitType,
        departmentId,
        status: "waiting",
        currentDepartment: "reception", // ← patient starts at reception
        createdAt: serverTimestamp(),
      });

      // Update daily stats
      const today = new Date().toISOString().split("T")[0];
      const statsQuery = query(
        collection(db, "daily_stats"),
        where("clinicId", "==", clinicId),
        where("date", "==", today)
      );
      const statsSnap = await getDocs(statsQuery);
      if (statsSnap.empty) {
        await addDoc(collection(db, "daily_stats"), {
          clinicId,
          date: today,
          totalPatients: 1,
          totalVisits: 1,
        });
      } else {
        await updateDoc(statsSnap.docs[0].ref, {
          totalVisits: increment(1),
          totalPatients: increment(1),
        });
      }

      onSuccess({ visitId: visitRef.id, visitType, departmentId, patientId: patient.patientId });
    } catch (err) {
      alert("Failed to start visit. Check connection.");
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <span className="text-blue-600 text-lg">🏥</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Start Visit</h2>
          <p className="text-sm text-gray-500">
            {patient.firstName} {patient.lastName}
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Visit Type</label>
          <div className="grid grid-cols-3 gap-2">
            {VISIT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setVisitType(type)}
                className={`py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                  visitType === type
                    ? type === "Emergency"
                      ? "bg-red-600 border-red-600 text-white"
                      : "bg-blue-600 border-blue-600 text-white"
                    : "border-gray-200 text-gray-700 hover:border-blue-300"
                }`}
              >
                {type === "Emergency" && "⚡ "}
                {type}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
          <div className="grid grid-cols-2 gap-2">
            {departments.map((dept) => (
              <button
                key={dept.departmentId}
                type="button"
                onClick={() => setDepartmentId(dept.departmentId)}
                className={`py-3 px-4 rounded-xl border-2 text-sm font-medium text-left transition-colors ${
                  departmentId === dept.departmentId
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-gray-200 text-gray-700 hover:border-blue-300"
                }`}
              >
                {dept.name}
              </button>
            ))}
          </div>
        </div>

        {visitType === "Emergency" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
            <span className="text-red-500">⚡</span>
            <p className="text-sm text-red-700 font-medium">Emergency visit — patient will be seen first</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-4 border-2 border-gray-200 rounded-xl text-gray-600 font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-4 bg-green-600 text-white rounded-xl font-semibold disabled:opacity-60 active:scale-95 transition-transform"
          >
            {saving ? "Starting..." : "▶ Start Visit"}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { db } from "../firebase/config";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function ConsultationForm({ visitId, doctorId, onSuccess, onCancel }) {
  const [form, setForm] = useState({
    symptoms: "",
    diagnosis: "",
    treatment: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.symptoms || !form.diagnosis || !form.treatment) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "consultations"), {
        visitId,
        doctorId,
        symptoms: form.symptoms.trim(),
        diagnosis: form.diagnosis.trim(),
        treatment: form.treatment.trim(),
        notes: form.notes.trim(),
        createdAt: serverTimestamp(),
      });
      // ← No status update here. Doctor routes patient manually via "Send to →"
      onSuccess();
    } catch (err) {
      alert("Failed to save consultation. Check connection.");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Symptoms <span className="text-red-500">*</span>
        </label>
        <textarea
          value={form.symptoms}
          onChange={set("symptoms")}
          rows={2}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none resize-none"
          placeholder="e.g. Fever for 3 days, headache, loss of appetite"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Diagnosis <span className="text-red-500">*</span>
        </label>
        <textarea
          value={form.diagnosis}
          onChange={set("diagnosis")}
          rows={2}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none resize-none"
          placeholder="e.g. Malaria confirmed, mild anaemia"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Treatment / Prescription <span className="text-red-500">*</span>
        </label>
        <textarea
          value={form.treatment}
          onChange={set("treatment")}
          rows={3}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none resize-none"
          placeholder="e.g. Artemether 80mg twice daily for 3 days, Panadol for fever"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Additional Notes <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={form.notes}
          onChange={set("notes")}
          rows={2}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none resize-none"
          placeholder="e.g. Patient to return in 3 days if no improvement"
        />
      </div>

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
          disabled={saving || !form.symptoms || !form.diagnosis || !form.treatment}
          className="flex-1 py-4 bg-green-600 text-white rounded-xl font-semibold disabled:opacity-40 active:scale-95 transition-transform"
        >
          {saving ? "Saving..." : "✓ Save Notes"}
        </button>
      </div>
    </div>
  );
}

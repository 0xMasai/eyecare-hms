import { useState } from "react";
import { db } from "../firebase/config";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function PatientForm({ clinicId, onSuccess, onCancel }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dob: "",
    phone: "",
    address: "",
    nextOfKin: "",
  });

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.gender) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "patients"), {
        ...form,
        clinicId,
        createdAt: serverTimestamp(),
      });
      onSuccess({ patientId: ref.id, ...form });
    } catch (err) {
      alert("Failed to save patient. Check connection.");
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">New Patient</h2>
        <div className="flex gap-1">
          <div className={`w-8 h-2 rounded-full ${step >= 1 ? "bg-blue-600" : "bg-gray-200"}`} />
          <div className={`w-8 h-2 rounded-full ${step >= 2 ? "bg-blue-600" : "bg-gray-200"}`} />
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Step 1 — Basic Info</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input
                type="text"
                value={form.firstName}
                onChange={set("firstName")}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
                placeholder="e.g. Sarah"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input
                type="text"
                value={form.lastName}
                onChange={set("lastName")}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
                placeholder="e.g. Nakato"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Gender *</label>
            <div className="grid grid-cols-3 gap-2">
              {["Female", "Male", "Other"].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, gender: g }))}
                  className={`py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                    form.gender === g
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-gray-200 text-gray-700 hover:border-blue-300"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
            <input
              type="date"
              value={form.dob}
              onChange={set("dob")}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
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
              onClick={() => setStep(2)}
              disabled={!form.firstName || !form.lastName || !form.gender}
              className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-40 active:scale-95 transition-transform"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Step 2 — Contact</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={form.phone}
              onChange={set("phone")}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
              placeholder="e.g. 0700 123 456"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Area / Village</label>
            <input
              type="text"
              value={form.address}
              onChange={set("address")}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
              placeholder="e.g. Nakawa, Kampala"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Next of Kin (Name & Phone)</label>
            <input
              type="text"
              value={form.nextOfKin}
              onChange={set("nextOfKin")}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
              placeholder="e.g. John Mukasa 0701 234 567"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 py-4 border-2 border-gray-200 rounded-xl text-gray-600 font-medium"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-4 bg-green-600 text-white rounded-xl font-semibold disabled:opacity-60 active:scale-95 transition-transform"
            >
              {saving ? "Saving..." : "✓ Register Patient"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";

function LabTestCard({ test, canEdit, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [results, setResults] = useState(test.results || "");
  const [saving, setSaving] = useState(false);

  const isPending = test.status === "pending" || !test.results;

  const handleSave = async () => {
    if (!results.trim()) return;
    setSaving(true);
    try {
      await onUpdate(test.labTestId, results);
      setEditing(false);
    } catch {
      alert("Failed to update lab result.");
    }
    setSaving(false);
  };

  return (
    <div className={`rounded-xl border-2 p-4 ${isPending ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              isPending ? "bg-amber-200 text-amber-800" : "bg-green-200 text-green-800"
            }`}>
              {isPending ? "⏳ Pending" : "✓ Completed"}
            </span>
            <span className="text-sm font-semibold text-gray-900">{test.testName}</span>
          </div>

          {isPending ? (
            <p className="text-sm text-amber-700 mt-1">Waiting for lab results...</p>
          ) : (
            <div className="mt-1">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Results</p>
              <p className="text-sm text-gray-800 font-medium">{test.results}</p>
            </div>
          )}
        </div>

        {canEdit && isPending && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs bg-white border border-amber-300 text-amber-700 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap"
          >
            Add Results
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 space-y-2">
          <textarea
            value={results}
            onChange={(e) => setResults(e.target.value)}
            rows={2}
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none"
            placeholder="Enter lab results here..."
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !results.trim()}
              className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Results"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LabResults({ visitId, clinicId, canAddTest, canEditResults }) {
  const [tests, setTests] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [testName, setTestName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visitId) return;
    const q = query(collection(db, "lab_tests"), where("visitId", "==", visitId));
    const unsub = onSnapshot(q, (snap) => {
      setTests(snap.docs.map((d) => ({ labTestId: d.id, ...d.data() })));
    });
    return unsub;
  }, [visitId]);

  const handleAddTest = async () => {
    if (!testName.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "lab_tests"), {
        visitId,
        clinicId,
        testName: testName.trim(),
        results: "",
        status: "pending",
        departmentId: "lab",
        createdAt: serverTimestamp(),
      });
      setTestName("");
      setShowAdd(false);
    } catch {
      alert("Failed to add lab test.");
    }
    setSaving(false);
  };

  const handleUpdateResult = async (labTestId, results) => {
    await updateDoc(doc(db, "lab_tests", labTestId), {
      results,
      status: "completed",
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          🔬 Lab Tests ({tests.length})
        </h4>
        {canAddTest && !showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-medium"
          >
            + Request Test
          </button>
        )}
      </div>

      {tests.length === 0 && (
        <div className="text-sm text-gray-400 py-3 text-center bg-gray-50 rounded-xl">
          No lab tests ordered for this visit
        </div>
      )}

      {tests.map((test) => (
        <LabTestCard
          key={test.labTestId}
          test={test}
          canEdit={canEditResults}
          onUpdate={handleUpdateResult}
        />
      ))}

      {showAdd && (
        <div className="bg-white border-2 border-blue-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Request Lab Test</p>
          <input
            type="text"
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
            placeholder="e.g. Full Blood Count, Malaria RDT, HIV Test"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleAddTest}
              disabled={saving || !testName.trim()}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add Test"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

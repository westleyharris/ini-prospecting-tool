import { useState, useEffect } from "react";
import type { Plant } from "../api/plants";
import {
  fetchVisits,
  createVisit,
  deleteVisit,
  getVisitFileUrl,
  type Visit,
  type VisitFile,
} from "../api/visits";

interface PlantVisitsProps {
  plant: Plant;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function PlantVisits({ plant, onClose, onUpdate }: PlantVisitsProps) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchVisits(plant.id);
      setVisits(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [plant.id]);

  const handleAddVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitDate) {
      alert("Visit date is required.");
      return;
    }
    setAdding(true);
    try {
      await createVisit({
        plant_id: plant.id,
        visit_date: visitDate,
        notes: notes.trim() || undefined,
        file: file ?? undefined,
      });
      setShowAddForm(false);
      setVisitDate("");
      setNotes("");
      setFile(null);
      await load();
      onUpdate?.();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to add visit");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (visit: Visit) => {
    if (!confirm(`Delete visit from ${visit.visit_date}?`)) return;
    setDeletingId(visit.id);
    try {
      await deleteVisit(visit.id);
      setVisits((prev) => prev.filter((v) => v.id !== visit.id));
      onUpdate?.();
    } catch (err) {
      console.error(err);
      alert("Failed to delete visit");
    } finally {
      setDeletingId(null);
    }
  };

  const visitsWithFiles = visits as (Visit & { files?: VisitFile[] })[];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Visits — {plant.name ?? "Plant"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-4 border-b border-gray-200">
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {showAddForm ? "Cancel" : "Add visit"}
          </button>
          {showAddForm && (
            <form onSubmit={handleAddVisit} className="mt-4 space-y-3 p-4 bg-gray-50 rounded-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visit date</label>
                <input
                  type="date"
                  required
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="block w-full rounded border-gray-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="block w-full rounded border-gray-300 text-sm"
                  placeholder="Visit details..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Report (Word or PDF)
                </label>
                <input
                  type="file"
                  accept=".doc,.docx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              <button
                type="submit"
                disabled={adding}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {adding ? "Adding..." : "Save visit"}
              </button>
            </form>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-gray-500">Loading visits...</p>
          ) : visits.length === 0 ? (
            <p className="text-gray-500">No visits yet. Add a visit to upload a report.</p>
          ) : (
            <ul className="space-y-4">
              {visitsWithFiles.map((visit) => (
                <li key={visit.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="font-medium text-gray-900">{visit.visit_date}</p>
                      {visit.notes && (
                        <p className="text-sm text-gray-600 mt-1">{visit.notes}</p>
                      )}
                      {(visit.files ?? []).length > 0 && (
                        <div className="mt-2 space-y-1">
                          {(visit.files ?? []).map((f) => (
                            <a
                              key={f.id}
                              href={getVisitFileUrl(visit.id, f.filename)}
                              download={f.original_name}
                              className="block text-sm text-blue-600 hover:underline"
                            >
                              📄 {f.original_name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(visit)}
                      disabled={deletingId === visit.id}
                      className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                    >
                      {deletingId === visit.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

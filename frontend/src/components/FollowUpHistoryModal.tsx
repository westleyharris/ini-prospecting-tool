import { useState, useEffect } from "react";
import type { Plant, FollowUpHistoryEntry } from "../api/plants";
import { fetchFollowUpHistory } from "../api/plants";

const OUTCOME_LABELS: Record<string, string> = {
  called: "Called",
  emailed: "Emailed",
  met: "Met in person",
  no_answer: "No answer",
  voicemail: "Left voicemail",
  other: "Other",
};

const OUTCOME_COLORS: Record<string, string> = {
  called: "bg-green-100 text-green-800",
  emailed: "bg-blue-100 text-blue-800",
  met: "bg-emerald-100 text-emerald-800",
  no_answer: "bg-gray-100 text-gray-700",
  voicemail: "bg-amber-100 text-amber-800",
  other: "bg-gray-100 text-gray-700",
};

const TYPE_LABELS: Record<string, string> = {
  call: "Call",
  email: "Email",
  visit: "Visit",
  other: "Other",
};

interface FollowUpHistoryModalProps {
  plant: Plant;
  onClose: () => void;
}

export default function FollowUpHistoryModal({ plant, onClose }: FollowUpHistoryModalProps) {
  const [history, setHistory] = useState<FollowUpHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFollowUpHistory(plant.id)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [plant.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Follow-up history</h2>
            <p className="text-sm text-gray-500 mt-0.5">{plant.name ?? "Plant"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-sm text-gray-500">Loading history…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-500">No follow-up activity recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {history.map((entry) => (
                <li key={entry.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                            OUTCOME_COLORS[entry.outcome] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {OUTCOME_LABELS[entry.outcome] ?? entry.outcome}
                        </span>
                        <span className="text-xs text-gray-500">{entry.completed_date}</span>
                      </div>
                      {entry.notes && (
                        <p className="mt-1.5 text-sm text-gray-700 whitespace-pre-wrap">{entry.notes}</p>
                      )}
                      {entry.next_follow_up_date && (
                        <p className="mt-2 text-xs text-gray-500">
                          Next follow-up scheduled:{" "}
                          <span className="font-medium text-gray-700">{entry.next_follow_up_date}</span>
                          {entry.next_follow_up_type && (
                            <span className="ml-1">
                              · {TYPE_LABELS[entry.next_follow_up_type] ?? entry.next_follow_up_type}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

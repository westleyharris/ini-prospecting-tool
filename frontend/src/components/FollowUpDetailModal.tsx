import { useEffect, useState } from "react";
import type { Plant } from "../api/plants";
import { updatePlant } from "../api/plants";
import { getDisplayType } from "../utils/plant";
import PlantContacts from "./PlantContacts";

const TYPE_LABELS: Record<string, string> = {
  call: "Call",
  email: "Email",
  visit: "Visit",
  other: "Other",
};

interface FollowUpDetailModalProps {
  plant: Plant;
  dueLabel?: string;
  onClose: () => void;
  onUpdated: (plant: Plant) => void;
  onComplete: () => void;
  onEdit: () => void;
  onHistory: () => void;
}

export default function FollowUpDetailModal({
  plant,
  dueLabel,
  onClose,
  onUpdated,
  onComplete,
  onEdit,
  onHistory,
}: FollowUpDetailModalProps) {
  const [notes, setNotes] = useState(plant.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const notesDirty = notes !== (plant.notes ?? "");

  useEffect(() => {
    setNotes(plant.notes ?? "");
  }, [plant.id, plant.notes]);

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      const updated = await updatePlant(plant.id, { notes: notes.trim() || null });
      onUpdated(updated);
    } catch (err) {
      console.error(err);
      alert("Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const typeLabel = plant.follow_up_type
    ? (TYPE_LABELS[plant.follow_up_type] ?? plant.follow_up_type)
    : null;
  const displayType = getDisplayType(plant);
  const location = [plant.city, plant.state].filter(Boolean).join(", ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{plant.name ?? "Plant"}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {dueLabel && (
                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{dueLabel}</span>
              )}
              {typeLabel && (
                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{typeLabel}</span>
              )}
              {plant.follow_up_date && (
                <span className="text-xs text-gray-500">{plant.follow_up_date}</span>
              )}
              {plant.current_customer === 1 && (
                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">Customer</span>
              )}
              {plant.contacted === 1 && (
                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-50 text-brand-navy-600">Contacted</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onComplete}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Complete
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="px-3 py-1.5 text-xs font-medium rounded-md text-gray-600 hover:bg-gray-100"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onHistory}
              className="px-3 py-1.5 text-xs font-medium rounded-md text-gray-500 hover:bg-gray-100"
            >
              History
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-1"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-4 border-b border-gray-100">
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {(plant.formatted_address ?? location) && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-gray-400 mb-0.5">Address</p>
                  <p className="text-gray-800">{plant.formatted_address ?? location}</p>
                </div>
              )}
              {plant.phone && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-0.5">Phone</p>
                  <a href={`tel:${plant.phone}`} className="text-brand-navy-600 hover:underline">{plant.phone}</a>
                </div>
              )}
              {plant.website && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-0.5">Website</p>
                  <a
                    href={plant.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-navy-600 hover:underline truncate block"
                  >
                    {plant.website.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
              {displayType && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-0.5">Type</p>
                  <p className="text-gray-800">{displayType}</p>
                </div>
              )}
              {plant.google_maps_uri && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-0.5">Maps</p>
                  <a
                    href={plant.google_maps_uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-navy-600 hover:underline"
                  >
                    Open in Google Maps
                  </a>
                </div>
              )}
            </div>

            {plant.follow_up_notes && (
              <div>
                <p className="text-xs font-medium text-gray-400 mb-0.5">Follow-up notes</p>
                <p className="text-sm text-gray-800">{plant.follow_up_notes}</p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-400">Plant notes</p>
                {notesDirty && (
                  <button
                    type="button"
                    onClick={saveNotes}
                    disabled={savingNotes}
                    className="text-xs font-medium text-brand-navy-600 hover:text-brand-navy disabled:opacity-50"
                  >
                    {savingNotes ? "Saving…" : "Save notes"}
                  </button>
                )}
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Context for this plant…"
                className="w-full rounded-lg border border-gray-300 text-sm px-3 py-2 placeholder-gray-400 focus:border-brand-lime focus:ring-1 focus:ring-brand-lime resize-y min-h-[88px]"
              />
            </div>
          </div>

          <div className="px-5 py-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Contacts</h3>
            <p className="text-xs text-gray-500 mb-2">Call, email, or log outreach without leaving this follow-up.</p>
            <PlantContacts plant={plant} embedded />
          </div>
        </div>
      </div>
    </div>
  );
}

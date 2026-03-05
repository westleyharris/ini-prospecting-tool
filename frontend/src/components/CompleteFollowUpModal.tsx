import { useState } from "react";
import type { Plant } from "../api/plants";
import { completeFollowUp } from "../api/plants";

const OUTCOME_OPTIONS = [
  { value: "called", label: "Called" },
  { value: "emailed", label: "Emailed" },
  { value: "met", label: "Met in person" },
  { value: "no_answer", label: "No answer" },
  { value: "voicemail", label: "Left voicemail" },
  { value: "other", label: "Other" },
];

const TYPE_OPTIONS = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "visit", label: "Visit" },
  { value: "other", label: "Other" },
];

interface CompleteFollowUpModalProps {
  plant: Plant;
  onClose: () => void;
  onCompleted: (updatedPlant: Plant) => void;
}

export default function CompleteFollowUpModal({ plant, onClose, onCompleted }: CompleteFollowUpModalProps) {
  const defaultNextDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  };

  const [outcome, setOutcome] = useState("called");
  const [notes, setNotes] = useState("");
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextDate, setNextDate] = useState(defaultNextDate());
  const [nextType, setNextType] = useState("call");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await completeFollowUp(plant.id, {
        outcome,
        notes: notes.trim() || null,
        next_follow_up_date: scheduleNext ? nextDate : null,
        next_follow_up_type: scheduleNext ? nextType : null,
      });
      onCompleted(result.plant);
    } catch (err) {
      console.error(err);
      alert("Failed to complete follow-up");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Complete follow-up</h2>
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
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {plant.follow_up_date && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-600">
              Scheduled for{" "}
              <span className="font-medium text-gray-900">{plant.follow_up_date}</span>
              {plant.follow_up_type && (
                <span className="ml-1 capitalize text-gray-500">· {plant.follow_up_type}</span>
              )}
              {plant.follow_up_notes && (
                <p className="mt-1 text-gray-500 italic">{plant.follow_up_notes}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">How'd it go?</label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            >
              {OUTCOME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Who you spoke with, what was discussed, next steps…"
              className="block w-full rounded-lg border border-gray-300 text-sm placeholder-gray-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-none px-3 py-2"
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={scheduleNext}
                onChange={(e) => setScheduleNext(e.target.checked)}
                className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-sm font-medium text-gray-700">Schedule next follow-up</span>
            </label>
            {scheduleNext && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                  <select
                    value={nextType}
                    onChange={(e) => setNextType(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 bg-white text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 px-3 py-2"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Mark complete"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

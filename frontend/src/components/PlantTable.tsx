import { useState } from "react";
import type { Plant } from "../api/plants";
import { updatePlant, deletePlant, deletePlantsBulk } from "../api/plants";
import PlantContacts from "./PlantContacts";
import PlantVisits from "./PlantVisits";
import PlantProjects from "./PlantProjects";

function formatOpeningHours(json: string | null): string {
  if (!json) return "";
  try {
    const data = JSON.parse(json);
    const desc = data.weekdayDescriptions as string[] | undefined;
    return desc?.join("\n") ?? "";
  } catch {
    return "";
  }
}

function formatOpeningHoursShort(json: string | null): string {
  const full = formatOpeningHours(json);
  if (!full) return "—";
  const first = full.split("\n")[0];
  return first ? first.replace(/^[^:]+:\s*/, "") : "—";
}

function formatPriceLevel(level: string): string {
  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: "Free",
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
  };
  return map[level] ?? level.replace("PRICE_LEVEL_", "");
}

/** Prefer AI-generated summary over editorial when available */
function getSummary(plant: { generative_summary?: string | null; editorial_summary?: string | null }): string | null {
  return plant.generative_summary ?? plant.editorial_summary ?? null;
}

import { getDisplayType } from "../utils/plant";

interface PlantTableProps {
  plants: Plant[];
  loading: boolean;
  onUpdate: () => void;
  /** When true, omit the outer card wrapper (for embedding in parent card) */
  embedded?: boolean;
}

export default function PlantTable({ plants, loading, onUpdate, embedded }: PlantTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contacted, setContacted] = useState<boolean>(false);
  const [currentCustomer, setCurrentCustomer] = useState<boolean>(false);
  const [followUpDate, setFollowUpDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [contactsPlant, setContactsPlant] = useState<Plant | null>(null);
  const [visitsPlant, setVisitsPlant] = useState<Plant | null>(null);
  const [projectsPlant, setProjectsPlant] = useState<Plant | null>(null);

  const startEdit = (plant: Plant) => {
    setEditingId(plant.id);
    setContacted(plant.contacted === 1);
    setCurrentCustomer(plant.current_customer === 1);
    setFollowUpDate(plant.follow_up_date ?? "");
    setNotes(plant.notes ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await updatePlant(editingId, {
        contacted,
        current_customer: currentCustomer,
        follow_up_date: followUpDate || null,
        notes: notes || null,
      });
      setEditingId(null);
      onUpdate();
    } catch (err) {
      console.error(err);
      alert("Failed to update plant");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plant: Plant) => {
    if (!confirm(`Remove "${plant.name ?? "this plant"}" from the database?`)) return;
    setDeletingId(plant.id);
    try {
      await deletePlant(plant.id);
      setEditingId((id) => (id === plant.id ? null : id));
      setSelectedIds((s) => {
        const next = new Set(s);
        next.delete(plant.id);
        return next;
      });
      onUpdate();
    } catch (err) {
      console.error(err);
      alert("Failed to delete plant");
    } finally {
      setDeletingId(null);
    }
  };

  const allSelected = plants.length > 0 && selectedIds.size === plants.length;
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(plants.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Remove ${ids.length} plant${ids.length === 1 ? "" : "s"} from the database?`)) return;
    setBulkDeleting(true);
    try {
      const result = await deletePlantsBulk(ids);
      setSelectedIds(new Set());
      setEditingId(null);
      onUpdate();
      alert(`Removed ${result.deleted} plant${result.deleted === 1 ? "" : "s"}`);
    } catch (err) {
      console.error(err);
      alert("Failed to delete plants");
    } finally {
      setBulkDeleting(false);
    }
  };

  const cardClass = embedded ? "" : "bg-white rounded-lg shadow overflow-hidden";

  if (loading) {
    return (
      <div className={cardClass}>
        <div className="p-8 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-full mb-4" />
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      {someSelected && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
          <span className="text-sm text-gray-600">
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {bulkDeleting ? "Removing..." : "Remove selected"}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Clear selection
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/80">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300"
                  title="Select all"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                Photo
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                Address
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Distance
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Website
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Relevance
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Summary
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Hours
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rating
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Visits
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Projects
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contacted
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Follow-up
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Notes
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {plants.length === 0 ? (
              <tr>
                <td colSpan={22} className="px-4 py-8 text-center text-gray-500">
                  No plants
                </td>
              </tr>
            ) : (
              plants.map((plant, idx) => (
                <tr key={plant.id} className={idx % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50/50 hover:bg-gray-100"}>
                  <td className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(plant.id)}
                      onChange={() => toggleSelect(plant.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3 w-12">
                    {plant.photo_name ? (
                      <img
                        src={`/api/plants/${plant.id}/photo`}
                        alt=""
                        className="w-10 h-10 object-cover rounded border border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded border border-gray-200 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                        —
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <span className="flex items-center gap-1">
                      {plant.name ?? "—"}
                      {plant.google_maps_uri && (
                        <a
                          href={plant.google_maps_uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-blue-600"
                          title="Open in Google Maps"
                        >
                          ↗
                        </a>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-[240px]" title={plant.formatted_address ?? undefined}>
                    <span className="line-clamp-2">{plant.formatted_address ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {[plant.city, plant.state].filter(Boolean).join(", ") || plant.postal_code || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 tabular-nums">
                    {plant.distance_miles != null ? `${plant.distance_miles} mi` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {plant.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {plant.website ? (
                      <a
                        href={plant.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate block max-w-[120px]"
                      >
                        {plant.website.replace(/^https?:\/\//, "").slice(0, 25)}…
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                        plant.business_status === "OPERATIONAL"
                          ? "bg-green-100 text-green-800"
                          : plant.business_status === "CLOSED_PERMANENTLY"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {plant.business_status ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500" title={plant.types ?? undefined}>
                    {getDisplayType(plant) || "—"}
                  </td>
                  <td className="px-4 py-3" title={plant.manufacturing_reason ?? undefined}>
                    {plant.manufacturing_relevance ? (
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                          plant.manufacturing_relevance === "high"
                            ? "bg-emerald-100 text-emerald-800"
                            : plant.manufacturing_relevance === "medium"
                              ? "bg-blue-100 text-blue-800"
                              : plant.manufacturing_relevance === "low"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {plant.manufacturing_relevance}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-[180px]">
                    <div className="truncate" title={getSummary(plant) ?? undefined}>
                      {getSummary(plant) ?? "—"}
                    </div>
                    {plant.generative_summary && (
                      <span className="text-[10px] text-gray-400" title="Summarized with Gemini">
                        Gemini
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-[140px] truncate" title={formatOpeningHours(plant.regular_opening_hours)}>
                    {formatOpeningHoursShort(plant.regular_opening_hours)}
                  </td>
                  <td className="px-4 py-3">
                    {plant.price_level ? (
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-amber-50 text-amber-800">
                        {formatPriceLevel(plant.price_level)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {plant.rating != null ? (
                      <span title={`${plant.user_rating_count ?? 0} reviews`}>
                        {plant.rating}★
                        {plant.user_rating_count != null && (
                          <span className="text-gray-400 ml-1">
                            ({plant.user_rating_count})
                          </span>
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setVisitsPlant(plant)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {plant.visit_count ?? 0}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setProjectsPlant(plant)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {plant.project_count ?? 0}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === plant.id ? (
                      <input
                        type="checkbox"
                        checked={contacted}
                        onChange={(e) => setContacted(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                    ) : (
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          plant.contacted === 1
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {plant.contacted === 1 ? "Yes" : "No"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === plant.id ? (
                      <input
                        type="checkbox"
                        checked={currentCustomer}
                        onChange={(e) => setCurrentCustomer(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                    ) : (
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          plant.current_customer === 1
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {plant.current_customer === 1 ? "Yes" : "No"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {editingId === plant.id ? (
                      <input
                        type="date"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm text-sm"
                      />
                    ) : (
                      plant.follow_up_date ?? "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs">
                    {editingId === plant.id ? (
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Notes..."
                        className="block w-full rounded-md border-gray-300 shadow-sm text-sm"
                      />
                    ) : (
                      <span className="truncate block">
                        {plant.notes ?? "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {editingId === plant.id ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={cancelEdit}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2 flex-wrap">
                        <button
                          onClick={() => setContactsPlant(plant)}
                          className="px-2.5 py-1 text-xs font-medium rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100"
                        >
                          Contacts
                        </button>
                        <button
                          onClick={() => setVisitsPlant(plant)}
                          className="px-2.5 py-1 text-xs font-medium rounded-md bg-sky-50 text-sky-700 hover:bg-sky-100"
                        >
                          Visits
                        </button>
                        <button
                          onClick={() => setProjectsPlant(plant)}
                          className="px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                        >
                          Projects
                        </button>
                        <button
                          onClick={() => startEdit(plant)}
                          className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(plant)}
                          disabled={deletingId === plant.id}
                          className="px-2.5 py-1 text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          {deletingId === plant.id ? "…" : "Remove"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {contactsPlant && (
        <PlantContacts
          plant={contactsPlant}
          onClose={() => setContactsPlant(null)}
        />
      )}
      {visitsPlant && (
        <PlantVisits
          plant={visitsPlant}
          onClose={() => setVisitsPlant(null)}
          onUpdate={onUpdate}
        />
      )}
      {projectsPlant && (
        <PlantProjects
          plant={projectsPlant}
          onClose={() => setProjectsPlant(null)}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

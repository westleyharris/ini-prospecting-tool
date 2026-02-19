import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  /** Optional controlled selection (persists across pages when used with pagination) */
  selectedIds?: Set<string>;
  onSelectionChange?: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** All plant IDs matching current filters (for "Select all N plants") */
  allFilteredIds?: string[];
  totalFilteredCount?: number;
}

export default function PlantTable({
  plants,
  loading,
  onUpdate,
  embedded,
  selectedIds: controlledSelectedIds,
  onSelectionChange,
  allFilteredIds = [],
  totalFilteredCount = 0,
}: PlantTableProps) {
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());
  const selectedIds = controlledSelectedIds ?? internalSelectedIds;
  const setSelectedIds = onSelectionChange ?? setInternalSelectedIds;

  const [editPlant, setEditPlant] = useState<Plant | null>(null);
  const [contacted, setContacted] = useState<boolean>(false);
  const [currentCustomer, setCurrentCustomer] = useState<boolean>(false);
  const [followUpDate, setFollowUpDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [contactsPlant, setContactsPlant] = useState<Plant | null>(null);
  const [visitsPlant, setVisitsPlant] = useState<Plant | null>(null);
  const [projectsPlant, setProjectsPlant] = useState<Plant | null>(null);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [notesTooltip, setNotesTooltip] = useState<{ content: string; left: number; top: number; bottom: number } | null>(null);

  useEffect(() => {
    if (openActionsId === null) return;
    const close = (e: MouseEvent) => {
      if (actionsMenuRef.current?.contains(e.target as Node)) return;
      setOpenActionsId(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [openActionsId]);

  useEffect(() => {
    if (editPlant) {
      setContacted(editPlant.contacted === 1);
      setCurrentCustomer(editPlant.current_customer === 1);
      setFollowUpDate(editPlant.follow_up_date ?? "");
      setNotes(editPlant.notes ?? "");
    }
  }, [editPlant]);

  const openEditModal = (plant: Plant) => {
    setOpenActionsId(null);
    setEditPlant(plant);
  };

  const closeEditModal = () => {
    setEditPlant(null);
  };

  const saveEdit = async () => {
    if (!editPlant) return;
    setSaving(true);
    try {
      await updatePlant(editPlant.id, {
        contacted,
        current_customer: currentCustomer,
        follow_up_date: followUpDate || null,
        notes: notes || null,
      });
      setEditPlant(null);
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
      setEditPlant((p) => (p?.id === plant.id ? null : p));
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

  const pageIds = plants.map((p) => p.id);
  const allSelectedOnPage = plants.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someSelectedOnPage = pageIds.some((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;
  const allFilteredSelected = totalFilteredCount > 0 && selectedIds.size >= totalFilteredCount;

  const toggleSelectAllOnPage = () => {
    if (allSelectedOnPage) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(allFilteredIds));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
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
      setEditPlant(null);
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
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-600">
            {selectedIds.size} selected
          </span>
          {totalFilteredCount > 0 && selectedIds.size < totalFilteredCount && (
            <button
              type="button"
              onClick={selectAllFiltered}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Select all {totalFilteredCount} plants
            </button>
          )}
          {allFilteredSelected && totalFilteredCount > 0 && (
            <span className="text-sm text-gray-500">(all matching filters)</span>
          )}
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {bulkDeleting ? "Removing..." : "Remove selected"}
          </button>
          <button
            type="button"
            onClick={clearSelection}
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
                  checked={allSelectedOnPage}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelectedOnPage && !allSelectedOnPage;
                  }}
                  onChange={toggleSelectAllOnPage}
                  className="rounded border-gray-300"
                  title={allFilteredSelected ? "Deselect all on page" : "Select all on page"}
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
                <tr
                  key={plant.id}
                  className={`h-[4.75rem] ${idx % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50/50 hover:bg-gray-100"}`}
                >
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
                      type="button"
                      onClick={() => setVisitsPlant(plant)}
                      title="View and add visits for this plant"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/60"
                    >
                      <span aria-hidden>📋</span>
                      {plant.visit_count ?? 0}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setProjectsPlant(plant)}
                      title="View and add projects — create new or open existing"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60"
                    >
                      <span aria-hidden>📁</span>
                      {plant.project_count ?? 0}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        plant.contacted === 1 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {plant.contacted === 1 ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        plant.current_customer === 1 ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {plant.current_customer === 1 ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {plant.follow_up_date ?? "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-sm text-gray-500 max-w-xs h-[3.25rem] max-h-[3.25rem] overflow-hidden align-top ${(plant.notes ?? "").trim() ? "cursor-help" : ""}`}
                    style={{ height: "3.25rem", maxHeight: "3.25rem" }}
                    onMouseEnter={(e) => {
                      const content = (plant.notes ?? "").trim();
                      if (!content) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      setNotesTooltip({
                        content,
                        left: rect.left,
                        top: rect.top,
                        bottom: rect.bottom,
                      });
                    }}
                    onMouseLeave={() => setNotesTooltip(null)}
                  >
                    <span className="line-clamp-3 block overflow-hidden text-ellipsis h-[3.25rem]">
                      {plant.notes ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <div className="flex justify-end items-center gap-1.5" ref={openActionsId === plant.id ? actionsMenuRef : undefined}>
                      <button
                        type="button"
                        onClick={() => setContactsPlant(plant)}
                        title="View and manage contacts"
                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60"
                      >
                        Contacts
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenActionsId((id) => (id === plant.id ? null : plant.id))}
                          title="More actions"
                          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 border border-transparent hover:border-gray-200"
                          aria-expanded={openActionsId === plant.id}
                          aria-haspopup="true"
                        >
                          <span className="sr-only">Actions</span>
                          <span aria-hidden>⋮</span>
                        </button>
                        {openActionsId === plant.id && (
                          <div className="absolute right-0 top-full mt-0.5 z-10 py-1 min-w-[120px] bg-white rounded-lg shadow-lg border border-gray-200">
                            <button
                              type="button"
                              onClick={() => openEditModal(plant)}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              Edit plant
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionsId(null);
                                handleDelete(plant);
                              }}
                              disabled={deletingId === plant.id}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId === plant.id ? "Removing…" : "Remove plant"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editPlant && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeEditModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Edit plant — {editPlant.name ?? "Plant"}</h2>
              <button type="button" onClick={closeEditModal} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={contacted}
                  onChange={(e) => setContacted(e.target.checked)}
                  className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-sm font-medium text-gray-700">Contacted</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={currentCustomer}
                  onChange={(e) => setCurrentCustomer(e.target.checked)}
                  className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-sm font-medium text-gray-700">Current customer</span>
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up date</label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 shadow-sm text-sm focus:border-sky-500 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this plant…"
                  rows={6}
                  className="block w-full min-h-[140px] rounded-lg border border-gray-300 shadow-sm text-sm placeholder-gray-400 focus:border-sky-500 focus:ring-sky-500 resize-y"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {notesTooltip &&
        createPortal(
          <div
            className="fixed z-[9999] w-72 max-w-[90vw] p-3 bg-amber-100 text-gray-900 text-xs rounded-lg shadow-xl whitespace-pre-wrap break-words border border-amber-300 pointer-events-none"
            style={
              notesTooltip.top < 220
                ? { left: notesTooltip.left, top: notesTooltip.bottom + 8 }
                : { left: notesTooltip.left, top: notesTooltip.top - 8, transform: "translateY(-100%)" }
            }
          >
            {notesTooltip.content}
          </div>,
          document.body
        )}
    </div>
  );
}

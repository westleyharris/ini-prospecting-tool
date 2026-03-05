import { useState, useEffect, useMemo } from "react";
import { fetchVisits, deleteVisit, getVisitFileUrl, type Visit, type VisitFile } from "../api/visits";

type VisitWithFiles = Visit & { files?: VisitFile[] };

function fileIcon(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "📕";
  if (ext === "doc" || ext === "docx") return "📘";
  return "📄";
}

function formatDate(dateStr: string): string {
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

interface NotesCellProps {
  notes: string;
}

function NotesCell({ notes }: NotesCellProps) {
  const [expanded, setExpanded] = useState(false);
  const limit = 120;
  if (notes.length <= limit) return <span>{notes}</span>;
  return (
    <span>
      {expanded ? notes : notes.slice(0, limit) + "…"}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="ml-1 text-blue-600 hover:underline font-medium whitespace-nowrap"
      >
        {expanded ? "less" : "more"}
      </button>
    </span>
  );
}

export default function ReportsPage() {
  const [visits, setVisits] = useState<VisitWithFiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filesOnly, setFilesOnly] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchVisits();
      setVisits(data as VisitWithFiles[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (visit: VisitWithFiles) => {
    if (!confirm(`Delete visit from ${visit.visit_date} for ${visit.plant_name ?? "this plant"}?`)) return;
    setDeletingId(visit.id);
    try {
      await deleteVisit(visit.id);
      setVisits((prev) => prev.filter((v) => v.id !== visit.id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete visit");
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visits.filter((v) => {
      if (filesOnly && (!v.files || v.files.length === 0)) return false;
      if (!q) return true;
      return (
        (v.plant_name ?? "").toLowerCase().includes(q) ||
        (v.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [visits, search, filesOnly]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">
          All visits and uploaded reports. Add visits from the Dashboard via plant → Visits.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search plants or notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filesOnly}
            onChange={(e) => setFilesOnly(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">With reports only</span>
        </label>
        {!loading && (
          <span className="text-xs text-gray-400 ml-auto">
            {filtered.length === visits.length
              ? `${visits.length} visit${visits.length === 1 ? "" : "s"}`
              : `${filtered.length} of ${visits.length}`}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-4 bg-gray-200 rounded" style={{ width: `${70 + n * 8}%` }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-gray-500 text-center text-sm">
            {visits.length === 0
              ? "No visits yet. Add visits from the Dashboard via a plant's Visits button."
              : "No results — try adjusting your search or filters."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Visit date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Files</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filtered.map((visit) => (
                  <tr key={visit.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {visit.plant_name ?? "—"}
                      {(visit.plant_city || visit.plant_state) && (
                        <div className="text-xs font-normal text-gray-400">
                          {[visit.plant_city, visit.plant_state].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {formatDate(visit.visit_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs">
                      {visit.notes ? <NotesCell notes={visit.notes} /> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {visit.files && visit.files.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {visit.files.map((f) => (
                            <a
                              key={f.id}
                              href={getVisitFileUrl(visit.id, f.filename)}
                              download={f.original_name}
                              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                            >
                              <span>{fileIcon(f.original_name)}</span>
                              <span className="truncate max-w-[200px]">{f.original_name}</span>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleDelete(visit)}
                        disabled={deletingId === visit.id}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        {deletingId === visit.id ? "Deleting…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

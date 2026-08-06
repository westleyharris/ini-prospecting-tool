import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  HiDocumentText,
  HiDocument,
  HiCpuChip,
  HiClipboardDocumentList,
  HiPhoto,
  HiMagnifyingGlass,
  HiArrowTopRightOnSquare,
} from "react-icons/hi2";
import { deleteVisit, getVisitFileUrl } from "../api/visits";
import { deleteMapping } from "../api/mappings";
import { fetchReports, type Report, type ReportKind } from "../api/reports";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return <HiDocumentText className="w-4 h-4 shrink-0 text-red-500" />;
  if (ext === "doc" || ext === "docx") return <HiDocumentText className="w-4 h-4 shrink-0 text-brand-navy-600" />;
  return <HiDocument className="w-4 h-4 shrink-0 text-gray-400" />;
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

function NotesCell({ notes }: { notes: string }) {
  const [expanded, setExpanded] = useState(false);
  const limit = 120;
  if (notes.length <= limit) return <span>{notes}</span>;
  return (
    <span>
      {expanded ? notes : notes.slice(0, limit) + "…"}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="ml-1 text-brand-navy-600 hover:underline font-medium whitespace-nowrap"
      >
        {expanded ? "less" : "more"}
      </button>
    </span>
  );
}

/** Type chip shown in the first column so the two report kinds read apart at a glance. */
function KindBadge({ kind }: { kind: ReportKind }) {
  const meta =
    kind === "mapping"
      ? { label: "Mapping", Icon: HiCpuChip, className: "bg-brand-navy/5 text-brand-navy-600 border-brand-navy/15" }
      : { label: "Visit", Icon: HiClipboardDocumentList, className: "bg-amber-50 text-amber-700 border-amber-200" };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-black uppercase tracking-wider ${meta.className}`}
    >
      <meta.Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

const FILTERS: { key: "all" | ReportKind; label: string }[] = [
  { key: "all", label: "All" },
  { key: "visit", label: "Visits" },
  { key: "mapping", label: "Mappings" },
];

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | ReportKind>("all");
  const [attachmentsOnly, setAttachmentsOnly] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setReports(await fetchReports());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (report: Report) => {
    const what =
      report.kind === "mapping"
        ? `mapping "${report.title}"`
        : `visit from ${formatDate(report.date)}`;
    if (!confirm(`Delete ${what} for ${report.plant_name ?? "this plant"}?`)) return;

    setDeletingId(report.id);
    try {
      if (report.kind === "mapping") await deleteMapping(report.id);
      else await deleteVisit(report.id);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    } catch (err) {
      console.error(err);
      alert(`Failed to delete ${report.kind}`);
    } finally {
      setDeletingId(null);
    }
  };

  const counts = useMemo(
    () => ({
      all: reports.length,
      visit: reports.filter((r) => r.kind === "visit").length,
      mapping: reports.filter((r) => r.kind === "mapping").length,
    }),
    [reports]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (kindFilter !== "all" && r.kind !== kindFilter) return false;
      if (attachmentsOnly && r.attachmentCount === 0) return false;
      if (!q) return true;
      const title = r.kind === "mapping" ? r.title : "";
      return (
        (r.plant_name ?? "").toLowerCase().includes(q) ||
        (r.notes ?? "").toLowerCase().includes(q) ||
        title.toLowerCase().includes(q)
      );
    });
  }, [reports, search, kindFilter, attachmentsOnly]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        subtitle="Plant visits and equipment mappings collected in the field."
      />

      {/* Type filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setKindFilter(key)}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                kindFilter === key
                  ? "bg-brand-navy text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {label}
              <span className={`ml-1.5 tabular-nums ${kindFilter === key ? "text-brand-lime" : "text-gray-400"}`}>
                {counts[key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Search + attachments */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search plants, notes, mappings…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:border-brand-lime focus:ring-1 focus:ring-brand-lime"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={attachmentsOnly}
            onChange={(e) => setAttachmentsOnly(e.target.checked)}
            className="rounded border-gray-300 text-brand-navy-600 focus:ring-brand-lime"
          />
          <span className="text-sm text-gray-700">With attachments only</span>
        </label>
        {!loading && (
          <span className="text-xs text-gray-400 ml-auto">
            {filtered.length === reports.length
              ? `${reports.length} report${reports.length === 1 ? "" : "s"}`
              : `${filtered.length} of ${reports.length}`}
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
          <EmptyState
            Icon={HiDocumentText}
            title={reports.length === 0 ? "No reports yet" : "No results"}
            hint={
              reports.length === 0
                ? "Log a visit from a plant on the Dashboard, or start a mapping from the Mappings page."
                : "Try adjusting your search or filters."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contents</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filtered.map((report) => (
                  <tr key={`${report.kind}-${report.id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <KindBadge kind={report.kind} />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {report.plant_name ?? "—"}
                      {(report.plant_city || report.plant_state) && (
                        <div className="text-xs font-normal text-gray-400">
                          {[report.plant_city, report.plant_state].filter(Boolean).join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {formatDate(report.date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs">
                      {report.kind === "mapping" ? (
                        <div className="flex flex-col gap-0.5">
                          <Link
                            to={`/mappings/${report.id}`}
                            className="font-medium text-brand-navy-600 hover:underline"
                          >
                            {report.title}
                          </Link>
                          {report.notes && (
                            <span className="text-xs text-gray-400">
                              <NotesCell notes={report.notes} />
                            </span>
                          )}
                        </div>
                      ) : report.notes ? (
                        <NotesCell notes={report.notes} />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {report.kind === "mapping" ? (
                        <div className="flex items-center gap-3 text-sm text-gray-600 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <HiCpuChip className="w-4 h-4 text-gray-400" />
                            {report.machineCount}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <HiPhoto className="w-4 h-4 text-gray-400" />
                            {report.photoCount}
                          </span>
                        </div>
                      ) : report.files.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {report.files.map((f) => (
                            <a
                              key={f.id}
                              href={getVisitFileUrl(report.id, f.filename)}
                              download={f.original_name}
                              className="inline-flex items-center gap-1 text-sm text-brand-navy-600 hover:underline"
                            >
                              <FileIcon filename={f.original_name} />
                              <span className="truncate max-w-[200px]">{f.original_name}</span>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-3">
                        {report.kind === "mapping" && (
                          <Link
                            to={`/mappings/${report.id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-brand-navy-600 hover:underline"
                          >
                            Open <HiArrowTopRightOnSquare className="w-3 h-3" />
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(report)}
                          disabled={deletingId === report.id}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          {deletingId === report.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
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

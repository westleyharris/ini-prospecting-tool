import { useState, useEffect, useMemo } from "react";
import { fetchPlants, updatePlant, type Plant } from "../api/plants";
import CompleteFollowUpModal from "../components/CompleteFollowUpModal";
import FollowUpHistoryModal from "../components/FollowUpHistoryModal";

function getTodayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateAtMidnight(dateStr: string): Date | null {
  const d = new Date(`${dateStr}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function getDiffDays(dateStr: string): number | null {
  const target = parseDateAtMidnight(dateStr);
  if (!target) return null;
  const today = getTodayMidnight();
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function relativeLabel(diffDays: number): string {
  if (diffDays < 0) {
    const n = Math.abs(diffDays);
    return n === 1 ? "1 day overdue" : `${n} days overdue`;
  }
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return `In ${diffDays} days`;
}

const TYPE_LABELS: Record<string, string> = {
  call: "Call",
  email: "Email",
  visit: "Visit",
  other: "Other",
};

const TYPE_COLORS: Record<string, string> = {
  call: "bg-blue-50 text-blue-700 border-blue-200/60",
  email: "bg-violet-50 text-violet-700 border-violet-200/60",
  visit: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  other: "bg-gray-50 text-gray-600 border-gray-200",
};

interface EditFollowUpModalProps {
  plant: Plant;
  onClose: () => void;
  onSaved: (updatedPlant: Plant) => void;
}

function EditFollowUpModal({ plant, onClose, onSaved }: EditFollowUpModalProps) {
  const [date, setDate] = useState(plant.follow_up_date ?? "");
  const [type, setType] = useState(plant.follow_up_type ?? "");
  const [notes, setNotes] = useState(plant.follow_up_notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updatePlant(plant.id, {
        follow_up_date: date || null,
        follow_up_type: type || null,
        follow_up_notes: notes.trim() || null,
      });
      onSaved(updated);
    } catch (err) {
      console.error(err);
      alert("Failed to save follow-up");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Edit follow-up</h2>
            <p className="text-sm text-gray-500 mt-0.5">{plant.name ?? "Plant"}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 text-sm px-3 py-2 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white text-sm px-3 py-2 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              >
                <option value="">— none —</option>
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="visit">Visit</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What to discuss, context…"
              className="block w-full rounded-lg border border-gray-300 text-sm px-3 py-2 placeholder-gray-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type Section = "overdue" | "today" | "week" | "scheduled";

function classifyPlant(diffDays: number): Section {
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 7) return "week";
  return "scheduled";
}

interface SectionConfig {
  key: Section;
  label: string;
  dotClass: string;
  badgeClass: string;
}

const SECTIONS: SectionConfig[] = [
  { key: "overdue", label: "Overdue", dotClass: "bg-red-500", badgeClass: "text-red-700 bg-red-50" },
  { key: "today", label: "Due today", dotClass: "bg-sky-500", badgeClass: "text-sky-700 bg-sky-50" },
  { key: "week", label: "Due this week", dotClass: "bg-amber-400", badgeClass: "text-amber-700 bg-amber-50" },
  { key: "scheduled", label: "Upcoming", dotClass: "bg-gray-300", badgeClass: "text-gray-600 bg-gray-50" },
];

// ─── Mini calendar ────────────────────────────────────────────────────────────

const DOT_COLORS: Record<Section, string> = {
  overdue: "bg-red-500",
  today: "bg-sky-500",
  week: "bg-amber-400",
  scheduled: "bg-gray-300",
};

interface MiniCalendarProps {
  plants: Plant[];
}

function MiniCalendar({ plants }: MiniCalendarProps) {
  const today = getTodayMidnight();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const dateMap = useMemo(() => {
    const priority: Record<Section, number> = { overdue: 0, today: 1, week: 2, scheduled: 3 };
    const map: Record<string, Section> = {};
    for (const plant of plants) {
      if (!plant.follow_up_date) continue;
      const diff = getDiffDays(plant.follow_up_date);
      if (diff === null) continue;
      const section = classifyPlant(diff);
      const existing = map[plant.follow_up_date];
      if (!existing || priority[section] < priority[existing]) {
        map[plant.follow_up_date] = section;
      }
    }
    return map;
  }, [plants]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr = today.toISOString().slice(0, 10);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 select-none">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-800">{monthLabel}</span>
        <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 mb-0.5">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="h-7" />;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const section = dateMap[dateStr];
          const isToday = dateStr === todayStr;
          return (
            <div key={i} className="flex flex-col items-center justify-center h-7">
              <span className={`text-[11px] w-5 h-5 flex items-center justify-center rounded-full leading-none font-medium ${
                isToday ? "bg-sky-600 text-white" : "text-gray-600"
              }`}>
                {day}
              </span>
              {section && (
                <div className={`w-1 h-1 rounded-full mt-px ${DOT_COLORS[section]}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-x-2 gap-y-1">
        {(["overdue", "today", "week", "scheduled"] as Section[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT_COLORS[s]}`} />
            <span className="text-[10px] text-gray-400">
              {s === "overdue" ? "Overdue" : s === "today" ? "Today" : s === "week" ? "This week" : "Upcoming"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface PlantWithDiff {
  plant: Plant;
  diffDays: number;
}

export default function FollowUpsPage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [completeTarget, setCompleteTarget] = useState<Plant | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Plant | null>(null);
  const [editTarget, setEditTarget] = useState<Plant | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchPlants({ limit: 50000 });
      setPlants(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updatePlantInList = (updated: Plant) => {
    setPlants((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const sections = useMemo<Record<Section, PlantWithDiff[]>>(() => {
    const result: Record<Section, PlantWithDiff[]> = { overdue: [], today: [], week: [], scheduled: [] };
    for (const plant of plants) {
      if (!plant.follow_up_date) continue;
      const diffDays = getDiffDays(plant.follow_up_date);
      if (diffDays === null) continue;
      result[classifyPlant(diffDays)].push({ plant, diffDays });
    }
    result.overdue.sort((a, b) => a.diffDays - b.diffDays);
    result.today.sort((a, b) => (a.plant.name ?? "").localeCompare(b.plant.name ?? ""));
    result.week.sort((a, b) => a.diffDays - b.diffDays);
    result.scheduled.sort((a, b) => a.diffDays - b.diffDays);
    return result;
  }, [plants]);

  const totalCount = SECTIONS.reduce((acc, s) => acc + sections[s.key].length, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Follow-ups</h1>
        {!loading && (
          <p className="text-sm text-gray-500 mt-1">
            {totalCount === 0
              ? "No follow-ups scheduled"
              : `${totalCount} follow-up${totalCount === 1 ? "" : "s"} scheduled`}
            {sections.overdue.length > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                {sections.overdue.length} overdue
              </span>
            )}
          </p>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : totalCount === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-base font-medium text-gray-500">No follow-ups scheduled</p>
          <p className="text-sm mt-1">Set follow-up dates on plants from the Dashboard to see them here.</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sections list */}
          <div className="flex-1 min-w-0 space-y-6">
            {SECTIONS.filter((s) => sections[s.key].length > 0).map((sectionConfig) => {
              const items = sections[sectionConfig.key];
              return (
                <section key={sectionConfig.key}>
                  {/* Section header */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sectionConfig.dotClass}`} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {sectionConfig.label}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">{items.length}</span>
                    <div className="flex-1 border-t border-gray-200" />
                  </div>

                  {/* Items */}
                  <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {items.map(({ plant, diffDays }) => (
                      <div key={plant.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50/60 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {plant.name ?? "Unknown plant"}
                            </span>
                            {plant.follow_up_type && (
                              <span className={`inline-flex px-1.5 py-px text-[10px] font-medium rounded border ${
                                TYPE_COLORS[plant.follow_up_type] ?? "bg-gray-50 text-gray-600 border-gray-200"
                              }`}>
                                {TYPE_LABELS[plant.follow_up_type] ?? plant.follow_up_type}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`text-xs font-medium px-1.5 py-px rounded ${sectionConfig.badgeClass}`}>
                              {relativeLabel(diffDays)}
                            </span>
                            {[plant.city, plant.state].filter(Boolean).length > 0 && (
                              <span className="text-xs text-gray-400">
                                {[plant.city, plant.state].filter(Boolean).join(", ")}
                              </span>
                            )}
                            {plant.follow_up_notes && (
                              <span className="text-xs text-gray-400 italic truncate" title={plant.follow_up_notes}>
                                {plant.follow_up_notes}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setCompleteTarget(plant)}
                            className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            Complete
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditTarget(plant)}
                            className="px-2.5 py-1.5 text-xs font-medium rounded-md text-gray-600 hover:bg-gray-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setHistoryTarget(plant)}
                            className="px-2.5 py-1.5 text-xs font-medium rounded-md text-gray-400 hover:bg-gray-100"
                          >
                            History
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Sidebar: calendar */}
          <div className="w-full lg:w-56 shrink-0">
            <MiniCalendar plants={plants} />
          </div>
        </div>
      )}

      {completeTarget && (
        <CompleteFollowUpModal
          plant={completeTarget}
          onClose={() => setCompleteTarget(null)}
          onCompleted={(updatedPlant) => { updatePlantInList(updatedPlant); setCompleteTarget(null); }}
        />
      )}
      {editTarget && (
        <EditFollowUpModal
          plant={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(updatedPlant) => { updatePlantInList(updatedPlant); setEditTarget(null); }}
        />
      )}
      {historyTarget && (
        <FollowUpHistoryModal
          plant={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  );
}

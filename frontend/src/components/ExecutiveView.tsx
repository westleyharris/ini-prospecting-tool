import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  HiXMark, HiPencilSquare, HiPlus, HiTrash, HiArrowUp, HiArrowDown,
  HiEyeSlash, HiArrowPath,
} from "react-icons/hi2";
import type { Mapping, MappingMachine, MappingPhoto } from "../api/mappings";
import { photoUrl } from "../api/mappings";
import { updatePlant } from "../api/plants";
import { assessMachine, buildPlantNarrative, lifeFor } from "../data/machineAssessment";
import { LIFECYCLE_META } from "../data/obsoleteEquipment";
import {
  applyBriefLayout,
  activeDeliverables,
  CHART_DEFS,
  columnFor,
  documentedSlices,
  flagSlices,
  interfaceSlices,
  lifecycleSlices,
  linesOf,
  machineTone,
  newDeliverable,
  newNote,
  parseBrief,
  photoSlices,
  processColumns,
  snapshotMapColumns,
  suggestDeliverables,
  type ChartId,
  type ChartSlice,
  type ExecDeliverable,
  type ExecLine,
  type ExecutiveBrief,
  type ProcessType,
} from "../data/executiveBrief";

const PILL: Record<ReturnType<typeof machineTone>, { bg: string; ink: string }> = {
  ok: { bg: "#22c55e", ink: "#ffffff" },
  mature: { bg: "#ca8a04", ink: "#ffffff" },
  eol: { bg: "#e07a5f", ink: "#ffffff" },
  empty: { bg: "#94a3b8", ink: "#ffffff" },
};

const FLOW = "bg-neutral-700";

const LINE_RAIL = ["#6d28d9", "#1d4ed8", "#15803d", "#c2410c", "#0f766e", "#7c3aed"];

export function ExecutiveView({
  mapping,
  initialBrief,
  plantId,
  editable = false,
}: {
  mapping: Mapping;
  initialBrief?: string | null;
  plantId?: string;
  editable?: boolean;
}) {
  const [brief, setBrief] = useState<ExecutiveBrief>(() => parseBrief(initialBrief));
  const [editing, setEditing] = useState(false);
  const [openMachine, setOpenMachine] = useState<MappingMachine | null>(null);
  const saveTimer = useRef<number>();
  const canEdit = editable && Boolean(plantId);

  function persist(next: ExecutiveBrief) {
    setBrief(next);
    if (!canEdit) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      updatePlant(plantId!, { executive_brief: JSON.stringify(next) }).catch((err) => {
        console.error(err);
      });
    }, 450);
  }

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  const layout = useMemo(() => applyBriefLayout(mapping, brief), [mapping, brief]);
  const columns = useMemo(() => processColumns(layout, brief), [layout, brief]);
  const visibleMachines = layout.flatMap((l) => l.machines);
  const allLines = linesOf(mapping);
  const hiddenLines = allLines.filter((l) => brief.hiddenLineIds.includes(l.id));
  const hiddenMachines = allLines
    .flatMap((l) => l.machines.map((m) => ({ line: l, machine: m })))
    .filter((x) => brief.hiddenMachineIds.includes(x.machine.id));

  const narrative = buildPlantNarrative(mapping);
  const intro = brief.intro ?? narrative.story;
  const deliverables = activeDeliverables(mapping, brief);
  const reportDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const location = [mapping.city, mapping.state].filter(Boolean).join(", ");

  const show = (section: string) => !brief.hiddenSections.includes(section);
  function hideSection(section: string) {
    persist({ ...brief, hiddenSections: [...brief.hiddenSections, section] });
  }
  function showSection(section: string) {
    persist({ ...brief, hiddenSections: brief.hiddenSections.filter((s) => s !== section) });
  }

  return (
    <div className="space-y-5 pb-8">
      <header className="bg-white border border-brand-navy/15 shadow-sm px-5 py-5 sm:px-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-navy/45">
              Executive summary
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold text-brand-navy tracking-tight mt-1">
              {mapping.plant_name ?? mapping.name}
            </h1>
            <p className="text-sm text-brand-navy/55 mt-1">
              {location || mapping.name}
              {mapping.source_lines && mapping.source_lines.length > 1
                ? ` · ${mapping.source_lines.length} lines`
                : ""}
              {` · ${reportDate}`}
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className={`shrink-0 print:hidden inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border transition-colors ${
                editing
                  ? "bg-brand-navy text-white border-brand-navy"
                  : "bg-white text-brand-navy border-brand-navy/20 hover:border-brand-navy"
              }`}
            >
              <HiPencilSquare className="w-4 h-4" />
              {editing ? "Done" : "Edit"}
            </button>
          )}
        </div>

        {editing ? (
          <textarea
            value={intro}
            onChange={(e) => persist({ ...brief, intro: e.target.value })}
            rows={4}
            className="mt-4 w-full text-[15px] leading-relaxed text-brand-navy/80 border border-brand-navy/15 px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
          />
        ) : (
          <p className="mt-4 text-[15px] leading-relaxed text-brand-navy/75 max-w-3xl">{intro}</p>
        )}
        {editing && brief.intro != null && (
          <button
            type="button"
            onClick={() => persist({ ...brief, intro: null })}
            className="mt-2 text-xs font-semibold text-brand-navy/50 hover:text-brand-navy"
          >
            Reset to auto summary
          </button>
        )}
      </header>

      {editing && brief.hiddenSections.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {brief.hiddenSections.filter((s) => s !== "offers").map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => showSection(s)}
              className="text-xs font-semibold px-2 py-1 border border-dashed border-brand-navy/30 text-brand-navy/60 hover:border-brand-navy"
            >
              Restore {s}
            </button>
          ))}
        </div>
      )}

      {show("coverage") && (
        <CoverageMap
          mapping={mapping}
          brief={brief}
          layout={layout}
          columns={columns}
          editing={editing}
          onChange={persist}
          onOpen={setOpenMachine}
          onHide={() => hideSection("coverage")}
          hiddenLines={hiddenLines}
          hiddenMachines={hiddenMachines}
        />
      )}

      {show("deliverables") && (
        <DeliverablesCard
          items={deliverables}
          editing={editing}
          onChange={(deliverables) => persist({ ...brief, deliverables })}
          onReset={() => persist({ ...brief, deliverables: null })}
          onHide={() => hideSection("deliverables")}
          customized={brief.deliverables != null}
          mapping={mapping}
        />
      )}

      {show("charts") && (
        <ChartsCard
          mapping={mapping}
          machines={visibleMachines}
          brief={brief}
          editing={editing}
          onChange={persist}
          onHide={() => hideSection("charts")}
        />
      )}

      {(show("notes") && (brief.notes.length > 0 || editing)) && (
        <NotesCard
          notes={brief.notes}
          editing={editing}
          onChange={(notes) => persist({ ...brief, notes })}
          onHide={() => hideSection("notes")}
        />
      )}

      {editing && !show("notes") && (
        <button
          type="button"
          onClick={() => {
            showSection("notes");
            if (brief.notes.length === 0) persist({ ...brief, hiddenSections: brief.hiddenSections.filter((s) => s !== "notes"), notes: [newNote()] });
          }}
          className="text-sm font-semibold text-brand-navy/55 hover:text-brand-navy"
        >
          + Add notes section
        </button>
      )}

      {openMachine && (
        <MachinePopup machine={openMachine} onClose={() => setOpenMachine(null)} />
      )}
    </div>
  );
}

function SectionChrome({
  title, subtitle, editing, onHide, children, extra,
}: {
  title: string;
  subtitle?: string;
  editing: boolean;
  onHide?: () => void;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-white border border-brand-navy/15 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-3 border-b border-brand-navy/10">
        <div>
          <h2 className="text-base font-semibold text-brand-navy">{title}</h2>
          {subtitle && <p className="text-xs text-brand-navy/45 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {extra}
          {editing && onHide && (
            <button type="button" onClick={onHide} title="Remove this block"
              className="p-1.5 text-brand-navy/40 hover:text-red-700">
              <HiEyeSlash className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function CoverageMap({
  mapping, brief, layout, columns, editing, onChange, onOpen, onHide, hiddenLines, hiddenMachines,
}: {
  mapping: Mapping;
  brief: ExecutiveBrief;
  layout: ExecLine[];
  columns: ProcessType[];
  editing: boolean;
  onChange: (b: ExecutiveBrief) => void;
  onOpen: (m: MappingMachine) => void;
  onHide: () => void;
  hiddenLines: ExecLine[];
  hiddenMachines: { line: ExecLine; machine: MappingMachine }[];
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const plant = mapping.plant_name ?? mapping.name;
  const location = [mapping.city, mapping.state].filter(Boolean).join(", ");
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
  const cols = columns.length ? columns : [{ id: "other", label: "Stations", match: /.*/ }];
  const gridCols = `5.75rem repeat(${cols.length}, minmax(11.5rem, 1fr))`;
  const schematicMin = Math.max(720, 92 + cols.length * 184);

  function mutate(patch: (b: ExecutiveBrief) => ExecutiveBrief) {
    onChange(patch(snapshotMapColumns(brief, layout)));
  }

  function dropOn(line: ExecLine, processId: string | null, beforeId?: string) {
    if (!dragId) return;
    const srcLine = layout.find((l) => l.machines.some((m) => m.id === dragId));
    if (srcLine && srcLine.id !== line.id) {
      setDragId(null);
      return;
    }
    mutate((b) => {
      const next = { ...b, processByMachine: { ...b.processByMachine }, machineOrder: { ...b.machineOrder } };
      if (processId) next.processByMachine[dragId] = processId;
      const ids = [...(next.machineOrder[line.id] ?? line.machines.map((m) => m.id))];
      const without = ids.filter((id) => id !== dragId);
      const at = beforeId ? without.indexOf(beforeId) : -1;
      if (at >= 0) without.splice(at, 0, dragId);
      else without.push(dragId);
      next.machineOrder[line.id] = without;
      return next;
    });
    setDragId(null);
  }

  function renameCol(id: string, label: string) {
    mutate((b) => ({
      ...b,
      mapColumns: (b.mapColumns ?? []).map((c) => c.id === id ? { ...c, label } : c),
    }));
  }

  function moveCol(i: number, dir: number) {
    mutate((b) => {
      const list = [...(b.mapColumns ?? [])];
      const j = i + dir;
      if (j < 0 || j >= list.length) return b;
      const [item] = list.splice(i, 1);
      list.splice(j, 0, item);
      return { ...b, mapColumns: list };
    });
  }

  function deleteCol(id: string) {
    mutate((b) => {
      const remaining = (b.mapColumns ?? []).filter((c) => c.id !== id);
      const fallback = remaining[remaining.length - 1]?.id;
      const processByMachine = { ...b.processByMachine };
      for (const [mid, pid] of Object.entries(processByMachine)) {
        if (pid === id) {
          if (fallback) processByMachine[mid] = fallback;
          else delete processByMachine[mid];
        }
      }
      return { ...b, mapColumns: remaining.length ? remaining : null, processByMachine };
    });
  }

  function addCol() {
    mutate((b) => ({
      ...b,
      mapColumns: [...(b.mapColumns ?? []), { id: crypto.randomUUID(), label: "New section" }],
    }));
  }

  return (
    <SectionChrome
      title="Coverage map"
      subtitle="Each row is a line. Conveyors run in and out of stations; extra machines in a section branch off."
      editing={editing}
      onHide={onHide}
      extra={editing ? (
        <button type="button" onClick={addCol}
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-navy/55 hover:text-brand-navy print:hidden">
          <HiPlus className="w-3.5 h-3.5" /> Add header
        </button>
      ) : undefined}
    >
      <CoverageMapMobile
        layout={layout}
        cols={cols}
        brief={brief}
        editing={editing}
        onOpen={onOpen}
        onHideMachine={(id) => onChange({ ...brief, hiddenMachineIds: [...brief.hiddenMachineIds, id] })}
        onHideLine={(id) => onChange({ ...brief, hiddenLineIds: [...brief.hiddenLineIds, id] })}
      />

      <div className="hidden md:block print:block overflow-x-auto coverage-map-scroll">
        <div
          className="coverage-schematic border-y md:border border-neutral-300 print:min-w-0 print:w-full"
          style={{ minWidth: schematicMin }}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-brand-navy text-white min-w-0 overflow-hidden print:px-2 print:py-1.5">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-lime shrink-0">I&amp;I</span>
              <span className="text-sm font-semibold truncate print:text-[11px]">
                {plant}{location ? ` · ${location}` : ""}
              </span>
            </div>
            <span className="text-[11px] uppercase tracking-wider text-white/50 shrink-0 print:text-[8px] print:tracking-normal">
              {date}
            </span>
          </div>

          <div className="grid coverage-grid bg-neutral-100 border-b border-neutral-300" style={{ gridTemplateColumns: gridCols, ["--map-cols" as string]: cols.length }}>
            <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 flex items-end">
              Line
            </div>
            {cols.map((c, i) => (
              <div key={c.id} className="px-1.5 py-1.5 text-center border-l border-neutral-300 min-w-0">
                {editing ? (
                  <div className="flex items-center gap-0.5">
                    <input
                      value={c.label}
                      onChange={(e) => renameCol(c.id, e.target.value)}
                      className="flex-1 min-w-0 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-600 bg-white border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:border-brand-navy"
                    />
                    <button type="button" title="Move left" disabled={i === 0} onClick={() => moveCol(i, -1)}
                      className="p-0.5 text-slate-400 hover:text-brand-navy disabled:opacity-20">
                      <HiArrowUp className="w-3 h-3 -rotate-90" />
                    </button>
                    <button type="button" title="Move right" disabled={i === cols.length - 1} onClick={() => moveCol(i, 1)}
                      className="p-0.5 text-slate-400 hover:text-brand-navy disabled:opacity-20">
                      <HiArrowDown className="w-3 h-3 -rotate-90" />
                    </button>
                    <button type="button" title="Remove section" onClick={() => deleteCol(c.id)}
                      className="p-0.5 text-slate-400 hover:text-red-700">
                      <HiXMark className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 leading-tight py-1 truncate print:text-[7px] print:py-0.5 print:leading-tight">
                    {c.label}
                  </p>
                )}
              </div>
            ))}
          </div>

          {layout.map((line, li) => (
            <div
              key={line.id}
              className="grid coverage-grid border-b border-neutral-300 bg-white"
              style={{ gridTemplateColumns: gridCols, ["--map-cols" as string]: cols.length }}
            >
              <div
                className="flex items-center justify-between gap-1 px-2.5 py-3 text-white text-[11px] font-bold uppercase tracking-wider print:px-1 print:py-1 print:text-[8px]"
                style={{ background: LINE_RAIL[li % LINE_RAIL.length] }}
              >
                <span className="leading-tight">{line.name.replace(/ - mapping$/i, "")}</span>
                {editing && (
                  <button type="button" title="Remove line" onClick={() => onChange({ ...brief, hiddenLineIds: [...brief.hiddenLineIds, line.id] })}
                    className="p-0.5 opacity-80 hover:opacity-100 print:hidden">
                    <HiXMark className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {cols.map((col) => {
                const cell = line.machines.filter((m) => columnFor(m, brief, cols).id === col.id);
                return (
                  <FlowCell
                    key={col.id}
                    machines={cell}
                    editing={editing}
                    dragId={dragId}
                    onDropCell={() => dropOn(line, col.id)}
                    onOpen={onOpen}
                    onDragStart={setDragId}
                    onDropBefore={(id) => dropOn(line, col.id, id)}
                    onHide={(id) => onChange({ ...brief, hiddenMachineIds: [...brief.hiddenMachineIds, id] })}
                  />
                );
              })}
            </div>
          ))}

          {layout.length === 0 && (
            <p className="px-5 py-8 text-sm text-brand-navy/45 text-center">No stations on the map. Restore a line below.</p>
          )}
        </div>
      </div>

      {editing && (
        <div className="px-5 py-2.5 border-t border-slate-100 bg-white print:hidden">
          <button type="button" onClick={addCol}
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-navy/60 hover:text-brand-navy">
            <HiPlus className="w-4 h-4" /> Add a section header
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 px-5 py-2.5 bg-neutral-50 border-t border-neutral-300 text-[11px] text-neutral-500">
        <span className="inline-flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm inline-block" style={{ background: PILL.ok.bg }} /> Documented</span>
        <span className="inline-flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm inline-block" style={{ background: PILL.mature.bg }} /> Mature platform</span>
        <span className="inline-flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm inline-block" style={{ background: PILL.eol.bg }} /> Discontinued</span>
        <span className="ml-auto">{visibleCount(layout)} stations shown</span>
      </div>

      {editing && (hiddenLines.length > 0 || hiddenMachines.length > 0) && (
        <div className="px-5 py-3 border-t border-slate-200 bg-white space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Hidden</p>
          <div className="flex flex-wrap gap-2">
            {hiddenLines.map((l) => (
              <button key={l.id} type="button"
                onClick={() => onChange({ ...brief, hiddenLineIds: brief.hiddenLineIds.filter((id) => id !== l.id) })}
                className="text-xs px-2 py-1 border border-dashed border-slate-300 text-slate-600 hover:border-brand-navy">
                Restore line: {l.name}
              </button>
            ))}
            {hiddenMachines.map(({ machine }) => (
              <button key={machine.id} type="button"
                onClick={() => onChange({ ...brief, hiddenMachineIds: brief.hiddenMachineIds.filter((id) => id !== machine.id) })}
                className="text-xs px-2 py-1 border border-dashed border-slate-300 text-slate-600 hover:border-brand-navy">
                Restore {machine.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </SectionChrome>
  );
}

function CoverageMapMobile({
  layout, cols, brief, editing, onOpen, onHideMachine, onHideLine,
}: {
  layout: ExecLine[];
  cols: ProcessType[];
  brief: ExecutiveBrief;
  editing: boolean;
  onOpen: (m: MappingMachine) => void;
  onHideMachine: (id: string) => void;
  onHideLine: (id: string) => void;
}) {
  return (
    <div className="md:hidden print:hidden px-3 py-3 space-y-3">
      <p className="text-[12px] text-neutral-500 px-0.5">
        Each card is a line, top to bottom in process order. Tap a station to open it.
      </p>
      {layout.map((line, li) => {
        const stages = cols
          .map((col) => ({
            col,
            machines: line.machines.filter((m) => columnFor(m, brief, cols).id === col.id),
          }))
          .filter((s) => s.machines.length > 0);
        return (
          <div key={line.id} className="rounded-xl overflow-hidden border border-neutral-300 bg-white">
            <div
              className="flex items-center justify-between gap-2 px-3 py-2 text-white"
              style={{ background: LINE_RAIL[li % LINE_RAIL.length] }}
            >
              <p className="text-[12px] font-bold uppercase tracking-wider truncate">
                {line.name.replace(/ - mapping$/i, "")}
              </p>
              {editing && (
                <button type="button" title="Remove line" onClick={() => onHideLine(line.id)} className="p-0.5 opacity-80">
                  <HiXMark className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="px-3 py-3 flex flex-col items-center">
              {stages.map((stage, si) => (
                <div key={stage.col.id} className="w-full flex flex-col items-center">
                  {si > 0 && <span aria-hidden className={`block w-[2px] h-3 ${FLOW}`} />}
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-400 mb-1.5">
                    {stage.col.label}
                  </p>
                  <div className="flex items-stretch justify-center gap-2 w-full max-w-sm">
                    {stage.machines.length > 1 && (
                      <span aria-hidden className={`w-[2px] self-stretch ${FLOW} my-[10px] shrink-0`} />
                    )}
                    <div className={`flex ${stage.machines.length > 1 ? "flex-1 flex-col gap-2" : ""} items-stretch min-w-0`}>
                      {stage.machines.map((m) => (
                        <div key={m.id} className="flex items-center min-w-0">
                          {stage.machines.length > 1 && <span aria-hidden className={`block w-2.5 h-[2px] shrink-0 ${FLOW}`} />}
                          <MachinePill
                            machine={m}
                            editing={editing}
                            dragging={false}
                            fill={stage.machines.length > 1}
                            onOpen={() => onOpen(m)}
                            onDragStart={() => {}}
                            onHide={() => onHideMachine(m.id)}
                          />
                          {stage.machines.length > 1 && <span aria-hidden className={`block w-2.5 h-[2px] shrink-0 ${FLOW}`} />}
                        </div>
                      ))}
                    </div>
                    {stage.machines.length > 1 && (
                      <span aria-hidden className={`w-[2px] self-stretch ${FLOW} my-[10px] shrink-0`} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {layout.length === 0 && (
        <p className="px-2 py-6 text-sm text-brand-navy/45 text-center">No stations on the map.</p>
      )}
    </div>
  );
}

function visibleCount(layout: ExecLine[]) {
  return layout.reduce((s, l) => s + l.machines.length, 0);
}

function FlowLine() {
  return <span aria-hidden className={`block flex-1 h-[2px] ${FLOW} min-w-[0.5rem]`} />;
}

function FlowStub() {
  return <span aria-hidden className={`block w-2.5 h-[2px] shrink-0 ${FLOW}`} />;
}

function FlowCell({
  machines, editing, dragId, onDropCell, onOpen, onDragStart, onDropBefore, onHide,
}: {
  machines: MappingMachine[];
  editing: boolean;
  dragId: string | null;
  onDropCell: () => void;
  onOpen: (m: MappingMachine) => void;
  onDragStart: (id: string) => void;
  onDropBefore: (id: string) => void;
  onHide: (id: string) => void;
}) {
  const branched = machines.length > 1;
  return (
    <div
      onDragOver={(e) => { if (editing) e.preventDefault(); }}
      onDrop={() => onDropCell()}
      className="flex items-center border-l border-neutral-300 min-h-[4.5rem] min-w-0 overflow-hidden bg-white py-3 print:min-h-[2.35rem] print:py-1"
    >
      {machines.length === 0 ? (
        <FlowLine />
      ) : branched ? (
        <>
          <FlowLine />
          <span aria-hidden className={`w-[2px] self-stretch ${FLOW} my-[11px] shrink-0`} />
          <div className="flex flex-col gap-1.5 min-w-0 max-w-full">
            {machines.map((m) => (
              <div key={m.id} className="flex items-center min-w-0">
                <FlowStub />
                <MachinePill
                  machine={m}
                  editing={editing}
                  dragging={dragId === m.id}
                  fill
                  onOpen={() => onOpen(m)}
                  onDragStart={() => onDragStart(m.id)}
                  onDropBefore={() => onDropBefore(m.id)}
                  onHide={() => onHide(m.id)}
                />
                <FlowStub />
              </div>
            ))}
          </div>
          <span aria-hidden className={`w-[2px] self-stretch ${FLOW} my-[11px] shrink-0`} />
          <FlowLine />
        </>
      ) : (
        <>
          <FlowLine />
          <MachinePill
            machine={machines[0]}
            editing={editing}
            dragging={dragId === machines[0].id}
            onOpen={() => onOpen(machines[0])}
            onDragStart={() => onDragStart(machines[0].id)}
            onDropBefore={() => onDropBefore(machines[0].id)}
            onHide={() => onHide(machines[0].id)}
          />
          <FlowLine />
        </>
      )}
    </div>
  );
}

function MachinePill({
  machine, editing, dragging, fill, onOpen, onDragStart, onDropBefore, onHide,
}: {
  machine: MappingMachine;
  editing: boolean;
  dragging: boolean;
  fill?: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDropBefore?: () => void;
  onHide: () => void;
}) {
  const tone = PILL[machineTone(machine)];
  return (
    <div
      draggable={editing}
      onDragStart={onDragStart}
      onDragOver={(e) => { if (editing) e.preventDefault(); }}
      onDrop={(e) => { e.stopPropagation(); onDropBefore?.(); }}
      className={`relative group z-10 min-w-0 max-w-full ${fill ? "flex-1" : ""} ${dragging ? "opacity-40" : ""}`}
    >
      <button
        type="button"
        onClick={onOpen}
        title={machine.name}
        className="coverage-pill w-full px-2 py-1 text-[11px] font-bold uppercase tracking-normal rounded-sm text-center leading-snug line-clamp-2 print:line-clamp-none"
        style={{ background: tone.bg, color: tone.ink }}
      >
        {machine.name}
      </button>
      {editing && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onHide(); }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-slate-300 text-slate-500 flex items-center justify-center opacity-0 group-hover:opacity-100 print:hidden"
          title="Remove from map"
        >
          <HiXMark className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function DeliverablesCard({
  items, editing, onChange, onReset, onHide, customized, mapping,
}: {
  items: ExecDeliverable[];
  editing: boolean;
  onChange: (d: ExecDeliverable[]) => void;
  onReset: () => void;
  onHide: () => void;
  customized: boolean;
  mapping: Mapping;
}) {
  return (
    <SectionChrome
      title="What this visit delivered"
      subtitle="Only what was actually recorded — not a generic catalog."
      editing={editing}
      onHide={onHide}
      extra={editing && customized ? (
        <button type="button" onClick={onReset} className="text-xs font-semibold text-brand-navy/50 hover:text-brand-navy inline-flex items-center gap-1">
          <HiArrowPath className="w-3.5 h-3.5" /> Reset to mapped
        </button>
      ) : undefined}
    >
      <ol className="divide-y divide-slate-100">
        {items.map((item, i) => (
          <li key={item.id} className="px-5 sm:px-7 py-3.5 flex gap-4">
            <span className="text-sm font-semibold text-brand-navy/30 tabular-nums w-6 shrink-0 pt-0.5">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="flex-1 min-w-0">
              {editing ? (
                <>
                  <input
                    value={item.title}
                    onChange={(e) => onChange(snapshot(items, mapping).map((x) => x.id === item.id ? { ...x, title: e.target.value } : x))}
                    className="w-full font-semibold text-brand-navy bg-transparent border-b border-transparent focus:border-brand-navy/20 focus:outline-none"
                  />
                  <textarea
                    value={item.body}
                    onChange={(e) => onChange(snapshot(items, mapping).map((x) => x.id === item.id ? { ...x, body: e.target.value } : x))}
                    rows={2}
                    className="mt-1 w-full text-sm text-brand-navy/70 bg-transparent resize-y focus:outline-none"
                  />
                </>
              ) : (
                <>
                  <p className="font-semibold text-brand-navy">{item.title}</p>
                  <p className="text-sm text-brand-navy/65 mt-0.5 leading-relaxed">{item.body}</p>
                </>
              )}
            </div>
            {editing && (
              <div className="flex flex-col gap-1 shrink-0">
                <button type="button" disabled={i === 0} onClick={() => onChange(move(snapshot(items, mapping), i, -1))} className="p-0.5 text-slate-400 hover:text-brand-navy disabled:opacity-20"><HiArrowUp className="w-3.5 h-3.5" /></button>
                <button type="button" disabled={i === items.length - 1} onClick={() => onChange(move(snapshot(items, mapping), i, 1))} className="p-0.5 text-slate-400 hover:text-brand-navy disabled:opacity-20"><HiArrowDown className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => onChange(snapshot(items, mapping).filter((x) => x.id !== item.id))} className="p-0.5 text-slate-400 hover:text-red-700"><HiTrash className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {editing && (
        <div className="px-5 sm:px-7 py-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onChange([...snapshot(items, mapping), newDeliverable()])}
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-navy/60 hover:text-brand-navy"
          >
            <HiPlus className="w-4 h-4" /> Add a line
          </button>
        </div>
      )}
    </SectionChrome>
  );
}

function snapshot(items: ExecDeliverable[], mapping: Mapping): ExecDeliverable[] {
  return items.length ? items.map((x) => ({ ...x })) : suggestDeliverables(mapping);
}

function move<T>(arr: T[], i: number, dir: number): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(i, 1);
  next.splice(j, 0, item);
  return next;
}

function ChartsCard({
  mapping, machines, brief, editing, onChange, onHide,
}: {
  mapping: Mapping;
  machines: MappingMachine[];
  brief: ExecutiveBrief;
  editing: boolean;
  onChange: (b: ExecutiveBrief) => void;
  onHide: () => void;
}) {
  const data: Record<ChartId, ChartSlice[]> = {
    documented: documentedSlices(mapping, machines),
    lifecycle: lifecycleSlices(machines),
    flags: flagSlices(machines),
    interface: interfaceSlices(machines),
    photos: photoSlices(machines),
  };
  const visible = CHART_DEFS.filter((c) => !brief.hiddenCharts.includes(c.id) && data[c.id].length > 0);
  const hidden = CHART_DEFS.filter((c) => brief.hiddenCharts.includes(c.id));

  return (
    <SectionChrome
      title="The numbers"
      subtitle="Built from this mapping — hide any chart that does not help the conversation."
      editing={editing}
      onHide={onHide}
    >
      {visible.length === 0 ? (
        <p className="px-5 py-8 text-sm text-brand-navy/45 text-center">No chart data yet. Record equipment or observations on a station.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-px bg-slate-100">
          {visible.map((def) => (
            <div key={def.id} className="bg-white px-5 py-4 relative group">
              {editing && (
                <button type="button" onClick={() => onChange({ ...brief, hiddenCharts: [...brief.hiddenCharts, def.id] })}
                  className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-700 opacity-0 group-hover:opacity-100" title="Remove chart">
                  <HiXMark className="w-4 h-4" />
                </button>
              )}
              <p className="text-sm font-semibold text-brand-navy">{def.title}</p>
              <p className="text-[11px] text-slate-400 mb-3">{def.hint}</p>
              {def.id === "flags" || def.id === "documented" ? (
                <BarChart slices={data[def.id]} />
              ) : (
                <DonutChart slices={data[def.id]} />
              )}
            </div>
          ))}
        </div>
      )}
      {editing && hidden.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap gap-2">
          {hidden.map((c) => (
            <button key={c.id} type="button"
              onClick={() => onChange({ ...brief, hiddenCharts: brief.hiddenCharts.filter((id) => id !== c.id) })}
              className="text-xs px-2 py-1 border border-dashed border-slate-300 text-slate-600">
              Restore {c.title}
            </button>
          ))}
        </div>
      )}
    </SectionChrome>
  );
}

function BarChart({ slices }: { slices: ChartSlice[] }) {
  const max = Math.max(...slices.map((s) => s.value), 1);
  return (
    <div className="space-y-2">
      {slices.map((s) => (
        <div key={s.label}>
          <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
            <span className="truncate pr-2">{s.label}</span>
            <span className="tabular-nums font-semibold">{s.value}</span>
          </div>
          <div className="h-2 bg-slate-100 overflow-hidden">
            <div className="h-full" style={{ width: `${(s.value / max) * 100}%`, background: s.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ slices }: { slices: ChartSlice[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = 36;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width="96" height="96" viewBox="0 0 96 96" className="shrink-0">
        <g transform="rotate(-90 48 48)">
          {slices.map((s) => {
            const len = (s.value / total) * c;
            const dash = `${len} ${c - len}`;
            const el = (
              <circle key={s.label} cx="48" cy="48" r={r} fill="none" stroke={s.color} strokeWidth="14"
                strokeDasharray={dash} strokeDashoffset={-offset} />
            );
            offset += len;
            return el;
          })}
        </g>
        <text x="48" y="52" textAnchor="middle" className="fill-brand-navy" fontSize="16" fontWeight="700">{total}</text>
      </svg>
      <ul className="space-y-1 min-w-0">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[12px] text-slate-600">
            <i className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="truncate">{s.label}</span>
            <span className="ml-auto tabular-nums font-semibold text-brand-navy">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NotesCard({
  notes, editing, onChange, onHide,
}: {
  notes: ExecutiveBrief["notes"];
  editing: boolean;
  onChange: (n: ExecutiveBrief["notes"]) => void;
  onHide: () => void;
}) {
  return (
    <SectionChrome title="Notes" editing={editing} onHide={onHide}>
      <div className="divide-y divide-slate-100">
        {notes.map((n) => (
          <div key={n.id} className="px-5 sm:px-7 py-4">
            {editing ? (
              <>
                <div className="flex items-center gap-2">
                  <input value={n.title} onChange={(e) => onChange(notes.map((x) => x.id === n.id ? { ...x, title: e.target.value } : x))}
                    className="flex-1 font-semibold text-brand-navy bg-transparent focus:outline-none border-b border-transparent focus:border-brand-navy/20" />
                  <button type="button" onClick={() => onChange(notes.filter((x) => x.id !== n.id))} className="text-slate-400 hover:text-red-700">
                    <HiTrash className="w-4 h-4" />
                  </button>
                </div>
                <textarea value={n.body} onChange={(e) => onChange(notes.map((x) => x.id === n.id ? { ...x, body: e.target.value } : x))}
                  rows={3} placeholder="Write a short note for the customer…"
                  className="mt-2 w-full text-sm text-brand-navy/75 resize-y focus:outline-none" />
              </>
            ) : (
              <>
                <p className="font-semibold text-brand-navy">{n.title}</p>
                <p className="text-sm text-brand-navy/70 mt-1 whitespace-pre-wrap leading-relaxed">{n.body}</p>
              </>
            )}
          </div>
        ))}
      </div>
      {editing && (
        <div className="px-5 py-3 border-t border-slate-100">
          <button type="button" onClick={() => onChange([...notes, newNote()])} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-navy/60 hover:text-brand-navy">
            <HiPlus className="w-4 h-4" /> Add a note
          </button>
        </div>
      )}
    </SectionChrome>
  );
}

function MachinePopup({ machine, onClose }: { machine: MappingMachine; onClose: () => void }) {
  const a = assessMachine(machine);
  const photos = machine.photos ?? [];
  const [hero, setHero] = useState<MappingPhoto | null>(photos[0] ?? null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const specs: { label: string; rows: { k: string; v: string }[]; life?: ReturnType<typeof lifeFor> }[] = [];
  const plcRows = [
    ["Make", machine.plc_make], ["Model", machine.plc_model], ["Series", machine.plc_series], ["P/N", machine.plc_part_no],
  ].filter((x): x is [string, string] => Boolean(x[1]));
  if (plcRows.length) specs.push({ label: "PLC", rows: plcRows.map(([k, v]) => ({ k, v })), life: lifeFor(machine, "plc") });
  const hmiRows = [["Make", machine.hmi_make], ["Model", machine.hmi_model], ["P/N", machine.hmi_part_no]].filter((x): x is [string, string] => Boolean(x[1]));
  if (hmiRows.length) specs.push({ label: "HMI", rows: hmiRows.map(([k, v]) => ({ k, v })), life: lifeFor(machine, "hmi") });
  const servoRows = [
    ["Drive", [machine.servo_drive_make, machine.servo_drive_model].filter(Boolean).join(" ")],
    ["Motor", [machine.servo_motor_make, machine.servo_motor_model].filter(Boolean).join(" ")],
    ["Motor P/N", machine.servo_motor_part_no],
  ].filter((x): x is [string, string] => Boolean(x[1]));
  if (servoRows.length) specs.push({ label: "Servo", rows: servoRows.map(([k, v]) => ({ k, v })), life: lifeFor(machine, "servo") });

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-brand-navy/50" />
      <div
        className="relative z-[81] w-full sm:max-w-3xl max-h-[92dvh] overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 py-3 bg-white border-b border-slate-200">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{machine.line_name ?? "Station"}</p>
            <h3 className="text-lg font-semibold text-brand-navy truncate">{machine.name}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-brand-navy" aria-label="Close">
            <HiXMark className="w-5 h-5" />
          </button>
        </div>

        {hero && (
          <img src={photoUrl(machine.id, hero.filename, "view")} alt="" className="w-full max-h-72 object-cover bg-slate-100" />
        )}
        {photos.length > 1 && (
          <div className="flex gap-1.5 px-4 py-2 overflow-x-auto bg-slate-50 border-b border-slate-100">
            {photos.map((p) => (
              <button key={p.id} type="button" onClick={() => setHero(p)} className={`shrink-0 w-14 h-14 overflow-hidden border-2 ${hero?.id === p.id ? "border-brand-navy" : "border-transparent"}`}>
                <img src={photoUrl(machine.id, p.filename, "thumb")} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="px-5 py-4 space-y-4">
          {specs.length === 0 && photos.length === 0 && (
            <p className="text-sm text-slate-400">No equipment details recorded for this station.</p>
          )}
          {specs.map((s) => {
            const meta = s.life && s.life.status !== "unknown" ? LIFECYCLE_META[s.life.status] : null;
            return (
              <div key={s.label}>
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
                  {meta && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 border" style={{ color: meta.ink, background: meta.bg, borderColor: meta.border }}>
                      {meta.label}{s.life?.eolYear ? ` · ${s.life.eolYear}` : ""}
                    </span>
                  )}
                </div>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {s.rows.map((r) => (
                    <div key={r.k} className="bg-slate-50 px-2.5 py-2">
                      <dt className="text-[10px] uppercase tracking-wider text-slate-400">{r.k}</dt>
                      <dd className="text-sm font-semibold text-brand-navy">{r.v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}

          {a.flags.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">What we saw</p>
              <ul className="space-y-1.5">
                {a.flags.map((f) => (
                  <li key={f.key} className="text-sm text-brand-navy/80 leading-snug">
                    <span className="font-semibold">{f.label}.</span> {f.pitch}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
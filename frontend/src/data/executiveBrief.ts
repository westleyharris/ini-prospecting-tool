import type { Mapping, MappingMachine } from "../api/mappings";
import { assessMachine, lifeFor } from "./machineAssessment";
import { FLAG_DEFS } from "./observations";
import { FLOOR_OFFERS } from "./deckOffers";

/** Saved layout for the plant executive summary. Edits hide/reorder display only. */
export interface ExecDeliverable {
  id: string;
  title: string;
  body: string;
}

export interface ExecNote {
  id: string;
  title: string;
  body: string;
}

export interface MapColumn {
  id: string;
  label: string;
}

export interface ExecutiveBrief {
  version: 1;
  hiddenLineIds: string[];
  hiddenMachineIds: string[];
  lineOrder: string[];
  machineOrder: Record<string, string[]>;
  processByMachine: Record<string, string>;
  mapColumns: MapColumn[] | null;
  hiddenSections: string[];
  hiddenCharts: string[];
  hiddenOffers: string[];
  extraOffers: string[];
  deliverables: ExecDeliverable[] | null;
  notes: ExecNote[];
  intro: string | null;
}

export const EMPTY_BRIEF: ExecutiveBrief = {
  version: 1,
  hiddenLineIds: [],
  hiddenMachineIds: [],
  lineOrder: [],
  machineOrder: {},
  processByMachine: {},
  mapColumns: null,
  hiddenSections: [],
  hiddenCharts: [],
  hiddenOffers: [],
  extraOffers: [],
  deliverables: null,
  notes: [],
  intro: null,
};

export function parseBrief(raw: string | null | undefined): ExecutiveBrief {
  if (!raw) return { ...EMPTY_BRIEF, machineOrder: {}, processByMachine: {}, mapColumns: null };
  try {
    const p = JSON.parse(raw) as Partial<ExecutiveBrief>;
    return {
      version: 1,
      hiddenLineIds: p.hiddenLineIds ?? [],
      hiddenMachineIds: p.hiddenMachineIds ?? [],
      lineOrder: p.lineOrder ?? [],
      machineOrder: p.machineOrder ?? {},
      processByMachine: p.processByMachine ?? {},
      mapColumns: p.mapColumns ?? null,
      hiddenSections: p.hiddenSections ?? [],
      hiddenCharts: p.hiddenCharts ?? [],
      hiddenOffers: p.hiddenOffers ?? [],
      extraOffers: p.extraOffers ?? [],
      deliverables: p.deliverables ?? null,
      notes: p.notes ?? [],
      intro: p.intro ?? null,
    };
  } catch {
    return { ...EMPTY_BRIEF, machineOrder: {}, processByMachine: {}, mapColumns: null };
  }
}

export interface ProcessType {
  id: string;
  label: string;
  match: RegExp;
}

export const PROCESS_TYPES: ProcessType[] = [
  { id: "blow", label: "Blow molders", match: /blow\s*mold|sbo|blomax|contour/i },
  { id: "depal", label: "Depalletizers", match: /depal/i },
  { id: "rinser", label: "Rinsers", match: /rinse/i },
  { id: "filler", label: "Fillers", match: /fill/i },
  { id: "seamer", label: "Seamers", match: /seam/i },
  { id: "capper", label: "Cappers", match: /capp|crowner/i },
  { id: "label", label: "Labelers", match: /label/i },
  { id: "warmer", label: "Warmers", match: /warm/i },
  { id: "pasteur", label: "Pasteurizers", match: /pasteur|htst/i },
  { id: "cooler", label: "Coolers", match: /cooler|cool\s*tunnel/i },
  { id: "inspector", label: "Inspectors", match: /inspect|heuft|filtec|empty.?bottle/i },
  { id: "coder", label: "Coders", match: /coder|inkjet|laser\s*date/i },
  { id: "packer", label: "Packers", match: /pack|tray|wraparound|variopac|hicone|hartness|mead|douglas|denester/i },
  { id: "pallet", label: "Palletizers", match: /pallet|modulpal|\bpai\b|wyard/i },
  { id: "wrapper", label: "Wrappers", match: /wrapper|wulftec|octopus|stretch/i },
  { id: "conveyor", label: "Conveyors", match: /convey/i },
  { id: "mixer", label: "Mix / blend", match: /mixer|blend|batch/i },
  { id: "cip", label: "CIP", match: /\bcip\b/i },
];

export const OTHER_PROCESS: ProcessType = { id: "other", label: "Other", match: /.*/ };

export function classifyProcess(name: string, override?: string): ProcessType {
  if (override) {
    return PROCESS_TYPES.find((p) => p.id === override) ?? (override === "other" ? OTHER_PROCESS : OTHER_PROCESS);
  }
  const hit = PROCESS_TYPES.find((p) => p.match.test(name));
  return hit ?? OTHER_PROCESS;
}

export interface ExecLine {
  id: string;
  name: string;
  machines: MappingMachine[];
}

export function linesOf(mapping: Mapping): ExecLine[] {
  const machines = mapping.machines ?? [];
  const sources = mapping.source_lines;
  if (sources && sources.length > 0) {
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      machines: machines.filter((m) => m.mapping_id === s.id),
    }));
  }
  return [{ id: mapping.id, name: mapping.name, machines }];
}

export function applyBriefLayout(mapping: Mapping, brief: ExecutiveBrief): ExecLine[] {
  const lines = linesOf(mapping);
  const byId = new Map(lines.map((l) => [l.id, l]));
  const order = brief.lineOrder.length
    ? [...brief.lineOrder.filter((id) => byId.has(id)), ...lines.map((l) => l.id).filter((id) => !brief.lineOrder.includes(id))]
    : lines.map((l) => l.id);

  return order
    .filter((id) => !brief.hiddenLineIds.includes(id))
    .map((id) => {
      const line = byId.get(id)!;
      const ids = brief.machineOrder[id];
      const visible = line.machines.filter((m) => !brief.hiddenMachineIds.includes(m.id));
      if (!ids?.length) return { ...line, machines: visible };
      const map = new Map(visible.map((m) => [m.id, m]));
      const ordered = [
        ...ids.map((mid) => map.get(mid)).filter((m): m is MappingMachine => Boolean(m)),
        ...visible.filter((m) => !ids.includes(m.id)),
      ];
      return { ...line, machines: ordered };
    })
    .filter((l) => l.machines.length > 0);
}

export function processColumns(lines: ExecLine[], brief: ExecutiveBrief): ProcessType[] {
  if (brief.mapColumns?.length) {
    return brief.mapColumns.map((c) => ({
      id: c.id,
      label: c.label,
      match: PROCESS_TYPES.find((p) => p.id === c.id)?.match ?? /.*/,
    }));
  }
  const seen = new Set<string>();
  for (const line of lines) {
    for (const m of line.machines) {
      seen.add(classifyProcess(m.name, brief.processByMachine[m.id]).id);
    }
  }
  const cols = PROCESS_TYPES.filter((p) => seen.has(p.id));
  if (seen.has("other")) cols.push(OTHER_PROCESS);
  return cols.length ? cols : [OTHER_PROCESS];
}

export function snapshotMapColumns(brief: ExecutiveBrief, lines: ExecLine[]): ExecutiveBrief {
  if (brief.mapColumns?.length) return brief;
  return {
    ...brief,
    mapColumns: processColumns(lines, brief).map((c) => ({ id: c.id, label: c.label })),
  };
}

/** Resolve which coverage-map column a station belongs to. */
export function columnFor(
  machine: MappingMachine,
  brief: ExecutiveBrief,
  columns: ProcessType[],
): ProcessType {
  const override = brief.processByMachine[machine.id];
  if (override) {
    const hit = columns.find((c) => c.id === override);
    if (hit) return hit;
  }
  const auto = classifyProcess(machine.name);
  return columns.find((c) => c.id === auto.id)
    ?? columns.find((c) => c.id === "other")
    ?? columns[columns.length - 1]
    ?? OTHER_PROCESS;
}

export type MachineTone = "ok" | "mature" | "eol" | "empty";

export function machineTone(machine: MappingMachine): MachineTone {
  const a = assessMachine(machine);
  if (a.worst.status === "unsupported" || a.worst.status === "discontinued") return "eol";
  if (a.worst.status === "mature") return "mature";
  return "ok";
}

export const CHART_DEFS = [
  { id: "documented", title: "What we recorded", hint: "Stations with a PLC, HMI, drive, servo, or photo" },
  { id: "lifecycle", title: "Controller health", hint: "Current vs mature vs discontinued" },
  { id: "flags", title: "Where the pain is", hint: "Opportunity flags across the survey" },
  { id: "interface", title: "How the operator runs it", hint: "None / pushbuttons / graphical HMI" },
  { id: "photos", title: "Photo coverage", hint: "Stations with field photos vs specs only" },
] as const;

export type ChartId = (typeof CHART_DEFS)[number]["id"];

export function suggestDeliverables(mapping: Mapping): ExecDeliverable[] {
  const machines = mapping.machines ?? [];
  const n = machines.length;
  const lines = mapping.source_lines?.length ?? 1;
  const plc = machines.filter((m) => m.plc_make || m.plc_model).length;
  const hmi = machines.filter((m) => m.hmi_make || m.hmi_model).length;
  const vfd = machines.filter((m) => m.vfd_make || m.vfd_model).length;
  const servo = machines.filter((m) => m.servo_drive_make || m.servo_drive_model).length;
  const photos = machines.reduce((s, m) => s + (m.photos ?? []).length, 0);
  const withPhotos = machines.filter((m) => (m.photos ?? []).length > 0).length;
  const assessments = machines.map(assessMachine);
  const eol = assessments.filter((a) => a.hasEol).length;
  const flags = assessments.reduce((s, a) => s + a.flags.length, 0);
  const scada = assessments.filter((a) => a.flags.some((f) => f.key === "no_scada" || f.key === "no_utilities")).length;
  const safety = assessments.filter((a) => a.flags.some((f) => f.key === "estop_unlit" || f.key === "hardwired_safety")).length;

  const out: ExecDeliverable[] = [];
  if (n) {
    out.push({
      id: "coverage",
      title: "Plant coverage map",
      body: `${n} station${n === 1 ? "" : "s"} across ${lines} line${lines === 1 ? "" : "s"}, in process order as found on the floor.`,
    });
  }
  if (plc) {
    out.push({
      id: "plc",
      title: "PLC identification",
      body: `${plc} controller${plc === 1 ? "" : "s"} documented — make, model, and published lifecycle.`,
    });
  }
  if (hmi) {
    out.push({
      id: "hmi",
      title: "HMI identification",
      body: `${hmi} operator interface${hmi === 1 ? "" : "s"} recorded so we know who can see a fault today.`,
    });
  }
  if (vfd) {
    out.push({
      id: "drives",
      title: "Drive identification",
      body: `${vfd} VFD${vfd === 1 ? "" : "s"} documented (make, model, horsepower where available).`,
    });
  }
  if (servo) {
    out.push({
      id: "servo",
      title: "Servo packages",
      body: `${servo} servo drive/motor package${servo === 1 ? "" : "s"} identified.`,
    });
  }
  if (photos) {
    out.push({
      id: "photos",
      title: "Field photo record",
      body: `${photos} photo${photos === 1 ? "" : "s"} across ${withPhotos} station${withPhotos === 1 ? "" : "s"} — cabinets, nameplates, and overview.`,
    });
  }
  if (eol) {
    out.push({
      id: "lifecycle",
      title: "Lifecycle findings",
      body: `${eol} station${eol === 1 ? "" : "s"} on discontinued or unsupported hardware, with a named successor.`,
    });
  }
  if (flags) {
    out.push({
      id: "ops",
      title: "Operations & recovery notes",
      body: `${flags} floor observation${flags === 1 ? "" : "s"} — visibility, diagnostics, islands, backups.`,
    });
  }
  if (scada) {
    out.push({
      id: "scada",
      title: "SCADA & utility gap",
      body: `${scada} station${scada === 1 ? "" : "s"} with no plant overview or no gas/water/air/power visibility.`,
    });
  }
  if (safety) {
    out.push({
      id: "safety",
      title: "Safety visibility",
      body: `${safety} station${safety === 1 ? "" : "s"} where a latched e-stop or dropped safety circuit is not obvious on the HMI.`,
    });
  }
  if (out.length === 0) {
    out.push({
      id: "visit",
      title: "Site survey",
      body: "Stations recorded on this visit. Add equipment details in Edit to widen the deliverable.",
    });
  }
  return out;
}

export function activeDeliverables(mapping: Mapping, brief: ExecutiveBrief): ExecDeliverable[] {
  return brief.deliverables ?? suggestDeliverables(mapping);
}

export interface ChartSlice {
  label: string;
  value: number;
  color: string;
}

export function documentedSlices(mapping: Mapping, machines: MappingMachine[]): ChartSlice[] {
  const plc = machines.filter((m) => m.plc_make || m.plc_model).length;
  const hmi = machines.filter((m) => m.hmi_make || m.hmi_model).length;
  const vfd = machines.filter((m) => m.vfd_make || m.vfd_model).length;
  const servo = machines.filter((m) => m.servo_drive_make || m.servo_drive_model).length;
  const photos = machines.filter((m) => (m.photos ?? []).length > 0).length;
  void mapping;
  return [
    { label: "PLC", value: plc, color: "#1d4ed8" },
    { label: "HMI", value: hmi, color: "#7c3aed" },
    { label: "Drives", value: vfd, color: "#b45309" },
    { label: "Servo", value: servo, color: "#15803d" },
    { label: "Photos", value: photos, color: "#0f766e" },
  ].filter((s) => s.value > 0);
}

export function lifecycleSlices(machines: MappingMachine[]): ChartSlice[] {
  let current = 0, mature = 0, eol = 0, unknown = 0;
  for (const m of machines) {
    const plc = lifeFor(m, "plc");
    const status = plc.status !== "unknown" ? plc.status : assessMachine(m).worst.status;
    if (status === "discontinued" || status === "unsupported") eol += 1;
    else if (status === "mature") mature += 1;
    else if (m.plc_make || m.plc_model) current += 1;
    else unknown += 1;
  }
  return [
    { label: "Current / unnamed", value: current, color: "#16a34a" },
    { label: "Mature", value: mature, color: "#ca8a04" },
    { label: "Discontinued", value: eol, color: "#e07a5f" },
    { label: "No PLC recorded", value: unknown, color: "#94a3b8" },
  ].filter((s) => s.value > 0);
}

export function flagSlices(machines: MappingMachine[]): ChartSlice[] {
  const counts = new Map<string, number>();
  for (const m of machines) {
    for (const f of assessMachine(m).flags) {
      counts.set(f.key, (counts.get(f.key) ?? 0) + 1);
    }
  }
  const palette = ["#00182e", "#0d3355", "#164569", "#1d4ed8", "#0f766e", "#7c3aed", "#b45309", "#e07a5f"];
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key, value], i) => ({
      label: FLAG_DEFS.find((d) => d.key === key)?.label ?? key,
      value,
      color: palette[i % palette.length],
    }));
}

export function interfaceSlices(machines: MappingMachine[]): ChartSlice[] {
  let none = 0, pb = 0, gui = 0, unset = 0;
  for (const m of machines) {
    const v = assessMachine(m).observations.operator_interface;
    if (v === "none") none += 1;
    else if (v === "pushbuttons") pb += 1;
    else if (v === "graphical") gui += 1;
    else unset += 1;
  }
  return [
    { label: "Graphical HMI", value: gui, color: "#16a34a" },
    { label: "Pushbuttons only", value: pb, color: "#ca8a04" },
    { label: "No interface", value: none, color: "#e07a5f" },
    { label: "Not recorded", value: unset, color: "#cbd5e1" },
  ].filter((s) => s.value > 0);
}

export function photoSlices(machines: MappingMachine[]): ChartSlice[] {
  const withP = machines.filter((m) => (m.photos ?? []).length > 0).length;
  const specsOnly = machines.filter((m) => (m.photos ?? []).length === 0 && (m.plc_make || m.hmi_make || m.vfd_make)).length;
  const empty = machines.length - withP - specsOnly;
  return [
    { label: "Has photos", value: withP, color: "#0f766e" },
    { label: "Specs, no photos", value: specsOnly, color: "#ca8a04" },
    { label: "Name only", value: empty, color: "#cbd5e1" },
  ].filter((s) => s.value > 0);
}

export function defaultOfferKeys(mapping: Mapping): string[] {
  const flags = new Set((mapping.machines ?? []).flatMap((m) => assessMachine(m).flags.map((f) => f.key)));
  const keys: string[] = [];
  if (flags.has("no_scada") || flags.has("no_historian") || flags.has("no_andon") || flags.has("island") || flags.size === 0) {
    keys.push("scada");
  }
  if (flags.has("no_utilities") || flags.has("no_scada") || flags.size === 0) keys.push("utilities");
  if (flags.has("estop_unlit") || flags.has("hardwired_safety")) keys.push("estop");
  if (flags.has("panel_hvac")) keys.push("hvac");
  if (keys.length === 0) keys.push("scada", "utilities");
  return [...new Set(keys)];
}

export function visibleOffers(mapping: Mapping, brief: ExecutiveBrief) {
  const keys = [...new Set([...defaultOfferKeys(mapping), ...brief.extraOffers])]
    .filter((k) => !brief.hiddenOffers.includes(k));
  return FLOOR_OFFERS.filter((o) => keys.includes(o.key));
}

export function newNote(): ExecNote {
  return { id: crypto.randomUUID(), title: "Note", body: "" };
}

export function newDeliverable(): ExecDeliverable {
  return { id: crypto.randomUUID(), title: "Deliverable", body: "" };
}

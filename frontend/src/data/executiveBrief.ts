import type { Mapping, MappingMachine } from "../api/mappings";
import { assessMachine, lifeFor } from "./machineAssessment";
import { checkAsset, type LifecycleStatus } from "./obsoleteEquipment";
import {
  FLAG_DEFS,
  FLAG_GROUPS,
  observationsAreEmpty,
  parseObservations,
  type MachineObservations,
} from "./observations";
import { FLOOR_OFFERS } from "./deckOffers";
import { vfdUnitCount, vfdsOf } from "./vfds";
import { servoUnitCount, servosOf } from "./servos";

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
  { id: "documented", title: "What we recorded", hint: "PLCs and HMIs by station. VFDs and servos by quantity.", kind: "bar", wide: false },
  { id: "plcFamilies", title: "Controllers installed", hint: "Stations by controller family.", kind: "donut", wide: false },
  { id: "hmiFamilies", title: "HMIs installed", hint: "Stations by operator-interface family.", kind: "donut", wide: false },
  { id: "vfdFamilies", title: "Drives installed", hint: "VFD quantity by family.", kind: "donut", wide: false },
  { id: "servoFamilies", title: "Servos installed", hint: "Servo quantity by drive family.", kind: "donut", wide: false },
  { id: "horsepower", title: "Drive horsepower", hint: "Installed HP, counted by quantity.", kind: "column", wide: false },
  { id: "voltage", title: "Drive voltage", hint: "Installed drives by supply voltage.", kind: "column", wide: false },
  { id: "process", title: "Station types", hint: "How the line is built, from station names.", kind: "bar", wide: true },
  { id: "lines", title: "Stations per line", hint: "Where the survey sits across lines.", kind: "bar", wide: true },
  { id: "assetHealth", title: "Health by equipment", hint: "PLCs and HMIs by station. VFDs and servos by quantity.", kind: "stack", wide: true },
  { id: "lifecycle", title: "Controller health", hint: "Stations by the controller's lifecycle.", kind: "donut", wide: false },
  { id: "network", title: "How stations talk", hint: "Ethernet vs DeviceNet vs DH+ / RIO", kind: "donut", wide: false },
  { id: "interface", title: "How the operator runs it", hint: "None / pushbuttons / graphical HMI", kind: "donut", wide: false },
  { id: "diagnostics", title: "What the mechanic can see", hint: "None, fault text only, or diagnostics that help.", kind: "donut", wide: false },
  { id: "recovery", title: "How a stop gets cleared", hint: "From the panel, or only with a laptop.", kind: "donut", wide: false },
  { id: "backup", title: "Program backup on file", hint: "Stations with an image we can restore.", kind: "donut", wide: false },
  { id: "drawings", title: "Drawings on site", hint: "Stations with prints the crew can open.", kind: "donut", wide: false },
  { id: "balance", title: "Line balance", hint: "Starving, blocked, or balanced.", kind: "donut", wide: false },
  { id: "changeover", title: "Changeover pain", hint: "High pain vs low pain.", kind: "donut", wide: false },
  { id: "themes", title: "Where the pain sits", hint: "Stations with at least one flag in each theme.", kind: "column", wide: false },
  { id: "flags", title: "Floor flags", hint: "The most common observations.", kind: "bar", wide: true },
  { id: "survey", title: "Floor survey coverage", hint: "Stations with observations vs name only.", kind: "donut", wide: false },
  { id: "photos", title: "Photo coverage", hint: "Stations with field photos vs specs only.", kind: "donut", wide: false },
  { id: "photoKinds", title: "What the photos show", hint: "PLC, HMI, drive, servo, and machine shots.", kind: "donut", wide: false },
] as const;

export type ChartId = (typeof CHART_DEFS)[number]["id"];

export const CHART_GROUPS: { title: string; ids: ChartId[] }[] = [
  { title: "What's installed", ids: ["documented", "plcFamilies", "hmiFamilies", "vfdFamilies", "servoFamilies", "horsepower", "voltage", "process", "lines"] },
  { title: "Lifecycle", ids: ["assetHealth", "lifecycle"] },
  { title: "What the floor looks like", ids: ["network", "interface", "diagnostics", "recovery", "backup", "drawings", "balance", "changeover", "themes", "flags"] },
  { title: "How complete the record is", ids: ["survey", "photos", "photoKinds"] },
];

export function suggestDeliverables(mapping: Mapping): ExecDeliverable[] {
  const machines = mapping.machines ?? [];
  const n = machines.length;
  const lines = mapping.source_lines?.length ?? 1;
  const plc = machines.filter((m) => m.plc_make || m.plc_model).length;
  const hmi = machines.filter((m) => m.hmi_make || m.hmi_model).length;
  const vfd = vfdUnitCount(machines);
  const vfdKinds = machines.reduce((sum, m) => sum + vfdsOf(m).length, 0);
  const servo = servoUnitCount(machines);
  const servoKinds = machines.reduce((sum, m) => sum + servosOf(m).length, 0);
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
      body: vfdKinds > 1
        ? `${vfd} VFDs across ${vfdKinds} models — make, model, horsepower, and quantity.`
        : `${vfd} VFD${vfd === 1 ? "" : "s"} documented — make, model, horsepower, and quantity.`,
    });
  }
  if (servo) {
    out.push({
      id: "servo",
      title: "Servo packages",
      body: servoKinds > 1
        ? `${servo} servos across ${servoKinds} axes — drive, motor, and quantity.`
        : `${servo} servo${servo === 1 ? "" : "s"} documented — drive, motor, and quantity.`,
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
  /** Set on stacked-bar segments. Rows that share a group draw as one bar. */
  group?: string;
}

const SLICE_COLORS = ["#1d4ed8", "#7c3aed", "#b45309", "#15803d", "#0f766e", "#e07a5f", "#0d3355", "#ca8a04", "#db2777", "#64748b"];

const MAKE_LABEL: Record<string, string> = {
  ab: "Allen-Bradley",
  "a b": "Allen-Bradley",
  "allen bradley": "Allen-Bradley",
  allenbradley: "Allen-Bradley",
  rockwell: "Allen-Bradley",
  "rockwell automation": "Allen-Bradley",
  "ge fanuc": "GE",
  "ge automation": "GE",
  ge: "GE",
  modicon: "Schneider",
  "schneider electric": "Schneider",
  schneider: "Schneider",
  "mitsubishi electric": "Mitsubishi",
  mitsubishi: "Mitsubishi",
  "siemens ag": "Siemens",
  siemens: "Siemens",
  "yaskawa electric": "Yaskawa",
  yaskawa: "Yaskawa",
  "sew eurodrive": "SEW",
  sew: "SEW",
  omron: "Omron",
  danfoss: "Danfoss",
  abb: "ABB",
  lenze: "Lenze",
  "bosch rexroth": "Bosch Rexroth",
  rexroth: "Bosch Rexroth",
  indramat: "Indramat",
  bosch: "Bosch Rexroth",
  fanuc: "Fanuc",
  automationdirect: "AutomationDirect",
  "automation direct": "AutomationDirect",
  magnetek: "Magnetek",
  eaton: "Eaton",
  "cutler hammer": "Eaton",
};

function displayMake(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  const key = t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (MAKE_LABEL[key]) return MAKE_LABEL[key];
  if (t.length <= 4 && t === t.toUpperCase()) return t;
  return t.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function installedLabel(
  life: { family?: string },
  make: string | null | undefined,
  model: string | null | undefined,
): string {
  if (life.family) return life.family;
  const named = (model ?? "").trim();
  if (named) return named;
  return displayMake(make) || "Unspecified";
}

function bump(map: Map<string, number>, label: string, n = 1) {
  if (!label || n <= 0) return;
  map.set(label, (map.get(label) ?? 0) + n);
}

function rankedSlices(counts: Map<string, number>, limit = 6): ChartSlice[] {
  const entries = [...counts.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (entries.length === 0) return [];
  const head = entries.slice(0, limit);
  const rest = entries.slice(limit).reduce((sum, [, n]) => sum + n, 0);
  const slices = head.map(([label, value], i) => ({
    label,
    value,
    color: SLICE_COLORS[i % SLICE_COLORS.length],
  }));
  if (rest > 0) slices.push({ label: "Other", value: rest, color: "#94a3b8" });
  return slices;
}

function answeredSlices(
  machines: MappingMachine[],
  read: (obs: MachineObservations) => string,
  options: { value: string; label: string; color: string }[],
): ChartSlice[] {
  const counts = new Map(options.map((o) => [o.value, 0]));
  let unset = 0;
  for (const m of machines) {
    const v = read(parseObservations(m.observations));
    if (counts.has(v)) counts.set(v, (counts.get(v) ?? 0) + 1);
    else unset += 1;
  }
  const answered = [...counts.values()].reduce((a, b) => a + b, 0);
  if (answered === 0) return [];
  const slices = options
    .filter((o) => (counts.get(o.value) ?? 0) > 0)
    .map((o) => ({ label: o.label, value: counts.get(o.value) ?? 0, color: o.color }));
  if (unset > 0) slices.push({ label: "Not recorded", value: unset, color: "#cbd5e1" });
  return slices;
}

export function documentedSlices(mapping: Mapping, machines: MappingMachine[]): ChartSlice[] {
  const plc = machines.filter((m) => m.plc_make || m.plc_model).length;
  const hmi = machines.filter((m) => m.hmi_make || m.hmi_model).length;
  const vfd = vfdUnitCount(machines);
  const servo = servoUnitCount(machines);
  const photos = machines.filter((m) => (m.photos ?? []).length > 0).length;
  void mapping;
  return [
    { label: "PLC", value: plc, color: "#1d4ed8" },
    { label: "HMI", value: hmi, color: "#7c3aed" },
    { label: "VFDs", value: vfd, color: "#b45309" },
    { label: "Servos", value: servo, color: "#15803d" },
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
    .slice(0, 8)
    .map(([key, value], i) => ({
      label: FLAG_DEFS.find((d) => d.key === key)?.label ?? key,
      value,
      color: palette[i % palette.length],
    }));
}

export function networkSlices(machines: MappingMachine[]): ChartSlice[] {
  let ethernet = 0, dnet = 0, dh = 0, island = 0, other = 0, unset = 0;
  for (const m of machines) {
    const v = assessMachine(m).observations.network;
    if (v === "ethernet") ethernet += 1;
    else if (v === "devicenet") dnet += 1;
    else if (v === "dh_rio") dh += 1;
    else if (v === "island") island += 1;
    else if (v === "other") other += 1;
    else unset += 1;
  }
  if (ethernet + dnet + dh + island + other === 0) return [];
  return [
    { label: "Ethernet", value: ethernet, color: "#16a34a" },
    { label: "DeviceNet", value: dnet, color: "#ca8a04" },
    { label: "DH+ / RIO", value: dh, color: "#e07a5f" },
    { label: "Island", value: island, color: "#64748b" },
    { label: "Other", value: other, color: "#7c3aed" },
    { label: "Not recorded", value: unset, color: "#cbd5e1" },
  ].filter((s) => s.value > 0);
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
  if (none + pb + gui === 0) return [];
  return [
    { label: "Graphical HMI", value: gui, color: "#16a34a" },
    { label: "Pushbuttons only", value: pb, color: "#ca8a04" },
    { label: "No interface", value: none, color: "#e07a5f" },
    { label: "Not recorded", value: unset, color: "#cbd5e1" },
  ].filter((s) => s.value > 0);
}

export function photoSlices(machines: MappingMachine[]): ChartSlice[] {
  const withP = machines.filter((m) => (m.photos ?? []).length > 0).length;
  const specsOnly = machines.filter((m) => (m.photos ?? []).length === 0 && (m.plc_make || m.hmi_make || vfdsOf(m).length > 0)).length;
  const empty = machines.length - withP - specsOnly;
  return [
    { label: "Has photos", value: withP, color: "#0f766e" },
    { label: "Specs, no photos", value: specsOnly, color: "#ca8a04" },
    { label: "Name only", value: empty, color: "#cbd5e1" },
  ].filter((s) => s.value > 0);
}

export function plcFamilySlices(machines: MappingMachine[]): ChartSlice[] {
  const counts = new Map<string, number>();
  for (const m of machines) {
    if (!m.plc_make && !m.plc_model && !m.plc_series && !m.plc_part_no) continue;
    const life = lifeFor(m, "plc");
    bump(counts, installedLabel(life, m.plc_make, m.plc_model || m.plc_series));
  }
  return rankedSlices(counts);
}

export function hmiFamilySlices(machines: MappingMachine[]): ChartSlice[] {
  const counts = new Map<string, number>();
  for (const m of machines) {
    if (!m.hmi_make && !m.hmi_model && !m.hmi_part_no) continue;
    const life = lifeFor(m, "hmi");
    bump(counts, installedLabel(life, m.hmi_make, m.hmi_model));
  }
  return rankedSlices(counts);
}

export function vfdFamilySlices(machines: MappingMachine[]): ChartSlice[] {
  const counts = new Map<string, number>();
  for (const m of machines) {
    for (const v of vfdsOf(m)) {
      const life = checkAsset("drive", { make: v.make, model: v.model, extra: m.notes });
      bump(counts, installedLabel(life, v.make, v.model), v.quantity);
    }
  }
  return rankedSlices(counts);
}

export function servoFamilySlices(machines: MappingMachine[]): ChartSlice[] {
  const counts = new Map<string, number>();
  for (const m of machines) {
    for (const v of servosOf(m)) {
      const drive = checkAsset("servo", { make: v.drive_make, model: v.drive_model, extra: m.notes });
      const motor = checkAsset("servo", {
        make: v.motor_make, model: v.motor_model, partNo: v.motor_part_no, extra: m.notes,
      });
      const label = v.drive_make || v.drive_model
        ? installedLabel(drive, v.drive_make, v.drive_model)
        : installedLabel(motor, v.motor_make, v.motor_model || v.motor_part_no);
      bump(counts, label, v.quantity);
    }
  }
  return rankedSlices(counts);
}

type HealthBand = "unsupported" | "discontinued" | "mature" | "current";

const HEALTH_BANDS: { id: HealthBand; label: string; color: string }[] = [
  { id: "unsupported", label: "Unsupported", color: "#b91c1c" },
  { id: "discontinued", label: "Discontinued", color: "#e07a5f" },
  { id: "mature", label: "Mature", color: "#ca8a04" },
  { id: "current", label: "Current", color: "#16a34a" },
];

function healthBand(status: LifecycleStatus | "unknown"): HealthBand {
  if (status === "unsupported" || status === "discontinued" || status === "mature") return status;
  return "current";
}

function emptyBands(): Record<HealthBand, number> {
  return { unsupported: 0, discontinued: 0, mature: 0, current: 0 };
}

export function assetHealthSlices(machines: MappingMachine[]): ChartSlice[] {
  const rows: { group: string; counts: Record<HealthBand, number> }[] = [
    { group: "PLC", counts: emptyBands() },
    { group: "HMI", counts: emptyBands() },
    { group: "VFD", counts: emptyBands() },
    { group: "Servo", counts: emptyBands() },
  ];
  const rank: Record<LifecycleStatus | "unknown", number> = {
    unsupported: 3, discontinued: 2, mature: 1, unknown: 0,
  };
  for (const m of machines) {
    if (m.plc_make || m.plc_model || m.plc_series || m.plc_part_no) {
      rows[0].counts[healthBand(lifeFor(m, "plc").status)] += 1;
    }
    if (m.hmi_make || m.hmi_model || m.hmi_part_no) {
      rows[1].counts[healthBand(lifeFor(m, "hmi").status)] += 1;
    }
    for (const v of vfdsOf(m)) {
      const life = checkAsset("drive", { make: v.make, model: v.model, extra: m.notes });
      rows[2].counts[healthBand(life.status)] += v.quantity;
    }
    for (const v of servosOf(m)) {
      const drive = checkAsset("servo", { make: v.drive_make, model: v.drive_model, extra: m.notes });
      const motor = checkAsset("servo", {
        make: v.motor_make, model: v.motor_model, partNo: v.motor_part_no, extra: m.notes,
      });
      const status = rank[drive.status] >= rank[motor.status] ? drive.status : motor.status;
      rows[3].counts[healthBand(status)] += v.quantity;
    }
  }
  const slices: ChartSlice[] = [];
  for (const row of rows) {
    const total = HEALTH_BANDS.reduce((sum, b) => sum + row.counts[b.id], 0);
    if (total === 0) continue;
    for (const b of HEALTH_BANDS) {
      if (row.counts[b.id] === 0) continue;
      slices.push({ group: row.group, label: b.label, value: row.counts[b.id], color: b.color });
    }
  }
  return slices;
}

function hpNumber(raw: string | null): number | null {
  if (!raw) return null;
  const match = raw.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return n > 0 && n < 5000 ? n : null;
}

export function horsepowerSlices(machines: MappingMachine[]): ChartSlice[] {
  const bands: { label: string; color: string; test: (n: number) => boolean; value: number }[] = [
    { label: "≤5", color: "#0f766e", test: (n) => n <= 5, value: 0 },
    { label: "6–20", color: "#1d4ed8", test: (n) => n <= 20, value: 0 },
    { label: "21–50", color: "#7c3aed", test: (n) => n <= 50, value: 0 },
    { label: "51–100", color: "#b45309", test: (n) => n <= 100, value: 0 },
    { label: "100+", color: "#e07a5f", test: () => true, value: 0 },
  ];
  let any = false;
  for (const m of machines) {
    for (const v of vfdsOf(m)) {
      const hp = hpNumber(v.hp);
      if (hp == null) continue;
      any = true;
      const band = bands.find((b) => b.test(hp));
      if (band) band.value += v.quantity;
    }
  }
  if (!any) return [];
  return bands.filter((b) => b.value > 0).map(({ label, value, color }) => ({ label, value, color }));
}

function voltageBand(raw: string | null): string | null {
  if (!raw) return null;
  const match = raw.match(/(\d{3})/);
  if (!match) return null;
  const n = Number(match[1]);
  if (n >= 200 && n <= 240) return "208–240 V";
  if (n >= 380 && n <= 420) return "380–415 V";
  if (n >= 440 && n <= 500) return "460–480 V";
  if (n >= 540 && n <= 600) return "575–600 V";
  return `${n} V`;
}

export function voltageSlices(machines: MappingMachine[]): ChartSlice[] {
  const counts = new Map<string, number>();
  for (const m of machines) {
    for (const v of vfdsOf(m)) {
      const band = voltageBand(v.voltage);
      if (band) bump(counts, band, v.quantity);
    }
  }
  const order = ["208–240 V", "380–415 V", "460–480 V", "575–600 V"];
  const entries = [...counts.entries()].sort((a, b) => {
    const ia = order.indexOf(a[0]);
    const ib = order.indexOf(b[0]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return entries.map(([label, value], i) => ({ label, value, color: SLICE_COLORS[i % SLICE_COLORS.length] }));
}

export function processSlices(machines: MappingMachine[], brief: ExecutiveBrief): ChartSlice[] {
  const counts = new Map<string, { label: string; value: number }>();
  for (const m of machines) {
    const p = classifyProcess(m.name, brief.processByMachine[m.id]);
    const cur = counts.get(p.id) ?? { label: p.label, value: 0 };
    cur.value += 1;
    counts.set(p.id, cur);
  }
  if (![...counts.keys()].some((id) => id !== "other")) return [];
  return [...counts.values()]
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((r, i) => ({ label: r.label, value: r.value, color: SLICE_COLORS[i % SLICE_COLORS.length] }));
}

export function lineSlices(mapping: Mapping, machines: MappingMachine[]): ChartSlice[] {
  const lines = linesOf(mapping);
  if (lines.length < 2) return [];
  const visible = new Set(machines.map((m) => m.id));
  const rows = lines
    .map((l) => ({ label: l.name, value: l.machines.filter((m) => visible.has(m.id)).length }))
    .filter((r) => r.value > 0);
  if (rows.length < 2) return [];
  return rows.map((r, i) => ({ ...r, color: SLICE_COLORS[i % SLICE_COLORS.length] }));
}

export function diagnosticsSlices(machines: MappingMachine[]): ChartSlice[] {
  return answeredSlices(machines, (o) => o.diagnostics, [
    { value: "useful", label: "Useful", color: "#16a34a" },
    { value: "faults", label: "Faults only", color: "#ca8a04" },
    { value: "none", label: "None", color: "#e07a5f" },
  ]);
}

export function recoverySlices(machines: MappingMachine[]): ChartSlice[] {
  return answeredSlices(machines, (o) => o.recoverability, [
    { value: "panel_ok", label: "From the panel", color: "#16a34a" },
    { value: "laptop_required", label: "Laptop required", color: "#e07a5f" },
    { value: "unknown", label: "Unknown", color: "#94a3b8" },
  ]);
}

export function backupSlices(machines: MappingMachine[]): ChartSlice[] {
  return answeredSlices(machines, (o) => o.backup_on_file, [
    { value: "yes", label: "Yes", color: "#16a34a" },
    { value: "no", label: "No", color: "#e07a5f" },
    { value: "unknown", label: "Unknown", color: "#94a3b8" },
  ]);
}

export function drawingSlices(machines: MappingMachine[]): ChartSlice[] {
  return answeredSlices(machines, (o) => o.drawings_on_site, [
    { value: "yes", label: "On site", color: "#16a34a" },
    { value: "no", label: "Not on site", color: "#e07a5f" },
    { value: "unknown", label: "Unknown", color: "#94a3b8" },
  ]);
}

export function balanceSlices(machines: MappingMachine[]): ChartSlice[] {
  return answeredSlices(machines, (o) => o.bottleneck, [
    { value: "balanced", label: "Balanced", color: "#16a34a" },
    { value: "starving", label: "Starving", color: "#e07a5f" },
    { value: "blocked", label: "Blocked", color: "#b45309" },
    { value: "unknown", label: "Unknown", color: "#94a3b8" },
  ]);
}

export function changeoverSlices(machines: MappingMachine[]): ChartSlice[] {
  return answeredSlices(machines, (o) => o.changeover, [
    { value: "low", label: "Low pain", color: "#16a34a" },
    { value: "high", label: "High pain", color: "#e07a5f" },
    { value: "unknown", label: "Unknown", color: "#94a3b8" },
  ]);
}

export function themeSlices(machines: MappingMachine[]): ChartSlice[] {
  const colors: Record<(typeof FLAG_GROUPS)[number]["id"], string> = {
    operations: "#1d4ed8",
    safety: "#e07a5f",
    plant: "#7c3aed",
    reliability: "#b45309",
  };
  const counts = new Map(FLAG_GROUPS.map((g) => [g.id, 0]));
  for (const m of machines) {
    const groups = new Set<(typeof FLAG_GROUPS)[number]["id"]>();
    for (const f of assessMachine(m).flags) {
      const group = FLAG_DEFS.find((d) => d.key === f.key)?.group;
      if (group) groups.add(group);
    }
    for (const g of groups) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return FLAG_GROUPS
    .map((g) => ({ label: g.label, value: counts.get(g.id) ?? 0, color: colors[g.id] }))
    .filter((s) => s.value > 0);
}

const PHOTO_KIND: Record<string, string> = {
  plc: "PLC",
  hmi: "HMI",
  vfd: "VFD",
  servo: "Servo",
  machine: "Machine",
  other: "Other",
};

export function photoKindSlices(machines: MappingMachine[]): ChartSlice[] {
  const counts = new Map<string, number>();
  for (const m of machines) {
    for (const p of m.photos ?? []) bump(counts, PHOTO_KIND[p.category] ?? "Other");
  }
  const order = ["PLC", "HMI", "VFD", "Servo", "Machine", "Other"];
  return [...counts.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([label, value], i) => ({ label, value, color: SLICE_COLORS[i % SLICE_COLORS.length] }));
}

export function surveySlices(machines: MappingMachine[]): ChartSlice[] {
  const filled = machines.filter((m) => !observationsAreEmpty(parseObservations(m.observations))).length;
  if (filled === 0) return [];
  const empty = machines.length - filled;
  return [
    { label: "Surveyed", value: filled, color: "#16a34a" },
    { label: "Not surveyed", value: empty, color: "#cbd5e1" },
  ].filter((s) => s.value > 0);
}

export function headlineStats(machines: MappingMachine[]): { label: string; value: number }[] {
  const plc = machines.filter((m) => m.plc_make || m.plc_model).length;
  const hmi = machines.filter((m) => m.hmi_make || m.hmi_model).length;
  const photos = machines.reduce((sum, m) => sum + (m.photos ?? []).length, 0);
  const eol = machines.filter((m) => assessMachine(m).hasEol).length;
  const surveyed = machines.filter((m) => !observationsAreEmpty(parseObservations(m.observations))).length;
  return [
    { label: "Stations", value: machines.length },
    { label: "Controllers", value: plc },
    { label: "HMIs", value: hmi },
    { label: "VFDs", value: vfdUnitCount(machines) },
    { label: "Servos", value: servoUnitCount(machines) },
    { label: "EOL stations", value: eol },
    { label: "Surveyed", value: surveyed },
    { label: "Photos", value: photos },
  ].filter((s) => s.value > 0);
}

export function slicesFor(
  id: ChartId,
  mapping: Mapping,
  machines: MappingMachine[],
  brief: ExecutiveBrief,
): ChartSlice[] {
  switch (id) {
    case "documented": return documentedSlices(mapping, machines);
    case "plcFamilies": return plcFamilySlices(machines);
    case "hmiFamilies": return hmiFamilySlices(machines);
    case "vfdFamilies": return vfdFamilySlices(machines);
    case "servoFamilies": return servoFamilySlices(machines);
    case "horsepower": return horsepowerSlices(machines);
    case "voltage": return voltageSlices(machines);
    case "process": return processSlices(machines, brief);
    case "lines": return lineSlices(mapping, machines);
    case "assetHealth": return assetHealthSlices(machines);
    case "lifecycle": return lifecycleSlices(machines);
    case "network": return networkSlices(machines);
    case "interface": return interfaceSlices(machines);
    case "diagnostics": return diagnosticsSlices(machines);
    case "recovery": return recoverySlices(machines);
    case "backup": return backupSlices(machines);
    case "drawings": return drawingSlices(machines);
    case "balance": return balanceSlices(machines);
    case "changeover": return changeoverSlices(machines);
    case "themes": return themeSlices(machines);
    case "flags": return flagSlices(machines);
    case "survey": return surveySlices(machines);
    case "photos": return photoSlices(machines);
    case "photoKinds": return photoKindSlices(machines);
  }
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

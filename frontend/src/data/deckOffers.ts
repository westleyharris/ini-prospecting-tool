import type { Mapping, MappingMachine } from "../api/mappings";
import type { FlagKey } from "./observations";
import { assessMachine, type MachineAssessment } from "./machineAssessment";
import { buildRiskRegister, type RiskLevel, type RiskRegister } from "./riskRegister";
import { machineTag } from "./consolidateMappings";

export interface StationExample {
  machine: MappingMachine;
  index: number;
  tag: string;
  assessment: MachineAssessment;
  score: number;
  why: string;
}

export interface ThemeExample {
  key: string;
  title: string;
  pitch: string;
  station?: StationExample;
}

const LEVEL_WEIGHT: Record<RiskLevel, number> = {
  critical: 8,
  high: 5,
  moderate: 3,
  watch: 1,
};

function stationScore(
  machine: MappingMachine,
  assessment: MachineAssessment,
  register: RiskRegister,
): { score: number; why: string } {
  let score = 0;
  const bits: string[] = [];
  const hits = register.findings.filter((f) => f.machines.some((m) => m.id === machine.id));
  for (const f of hits) {
    score += LEVEL_WEIGHT[f.level];
    if (f.status === "unsupported") score += 3;
    if (bits.length < 2 && f.status !== "mature") {
      bits.push(`${f.make} ${f.model}`.trim());
    }
  }
  for (const flag of assessment.flags) {
    score += 2;
    if (flag.key === "trapped_modern") score += 3;
  }
  if ((machine.photos ?? []).length > 0) score += 1;

  const why =
    bits[0]
      ? `${bits.join(" · ")}${assessment.flags[0] ? ` · ${assessment.flags[0].label}` : ""}`
      : assessment.flags[0]?.label ?? "Documented station";
  return { score, why };
}

/** Highest-risk stations for an executive deck — never one slide per machine. */
export function pickCriticalExamples(mapping: Mapping, limit = 4): StationExample[] {
  const machines = mapping.machines ?? [];
  const register = buildRiskRegister(mapping);
  const ranked: StationExample[] = machines.map((machine, index) => {
    const assessment = assessMachine(machine);
    const { score, why } = stationScore(machine, assessment, register);
    return {
      machine, index, tag: machineTag(machine, index), assessment, score, why,
    };
  });
  return ranked
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || (b.machine.photos?.length ?? 0) - (a.machine.photos?.length ?? 0))
    .slice(0, limit);
}

const THEMES: { key: FlagKey; title: string; pitch: string }[] = [
  { key: "trapped_modern", title: "Unlock hardware already paid for", pitch: "Modern drives sitting behind a legacy PLC. Replace the processor and the data they bought is finally on the screen." },
  { key: "no_scada", title: "One picture of the plant", pitch: "A SCADA overview is running, starved, down, and why — not a radio call to the floor." },
  { key: "no_utilities", title: "See the gas, water, and air you pay for", pitch: "Unmetered utilities are a blank check. Line-level flow and kWh turn a leak into a trend." },
  { key: "no_visibility", title: "Operator can see why it stopped", pitch: "Pushbuttons and a blinking light are not a recovery plan. Fault text on an HMI is." },
  { key: "island", title: "The line as one picture", pitch: "Stations that cannot talk cannot be balanced. Ethernet into a simple overview is the first measurement." },
  { key: "hardwired_safety", title: "Safety status, not a guess", pitch: "When the circuit drops, the crew should see which gate or e-stop opened — not walk the line." },
  { key: "estop_unlit", title: "See the latched e-stop", pitch: "An illuminated actuator tells you it is pressed from twenty feet. A dark mushroom does not." },
  { key: "panel_hvac", title: "Keep the cabinet alive", pitch: "Failed panel air conditioners cook drives. HVAC is cheaper than the next overtemp trip." },
  { key: "no_backup", title: "A restore, not a rewrite", pitch: "If this processor dies tonight, recovery should be an image restore — not tribal knowledge." },
  { key: "no_diagnostics", title: "Mechanics recover from the panel", pitch: "A laptop and a 1990s cable is not a maintenance plan." },
];

/** One example per upgrade type, preferring stations not already used as critical examples. */
export function pickThemeExamples(mapping: Mapping, usedIds: Set<string>, limit = 4): ThemeExample[] {
  const machines = mapping.machines ?? [];
  const register = buildRiskRegister(mapping);
  const stations = machines.map((machine, index) => {
    const assessment = assessMachine(machine);
    const { score, why } = stationScore(machine, assessment, register);
    return { machine, index, tag: machineTag(machine, index), assessment, score, why } satisfies StationExample;
  });

  const out: ThemeExample[] = [];
  for (const theme of THEMES) {
    if (out.length >= limit) break;
    const hit = stations
      .filter((s) => s.assessment.flags.some((f) => f.key === theme.key))
      .sort((a, b) => Number(usedIds.has(a.machine.id)) - Number(usedIds.has(b.machine.id)) || b.score - a.score)[0];
    if (!hit) continue;
    out.push({ key: theme.key, title: theme.title, pitch: theme.pitch, station: hit });
  }
  return out;
}

export interface FloorOffer {
  key: string;
  eyebrow: string;
  title: string;
  pitch: string;
  bullets: string[];
  /** Key into /deck-refs/{photo}.jpg */
  photo?: string;
}

/** Always-on plant work that is not just obsolescence — shown even when untagged. */
export const FLOOR_OFFERS: FloorOffer[] = [
  {
    key: "scada",
    eyebrow: "Plant systems",
    title: "SCADA — one picture of the plant",
    photo: "scada",
    pitch: "Most plants still run on radios and whiteboards. A SCADA overview is the difference between knowing the filler is down and walking the line to find out. It is also the only way gas, water, and production become the same conversation.",
    bullets: [
      "Every station reports running, starved, blocked, or down — and why.",
      "Alarms go to the right person instead of a horn nobody owns.",
      "Counts, OEE, and first-hour production become a number, not a whiteboard.",
    ],
  },
  {
    key: "utilities",
    eyebrow: "Energy & utilities",
    title: "See the gas, water, and air you already pay for",
    photo: "utilities",
    pitch: "The meter house knows what the plant used. The line does not. A leak, a stuck valve, a CIP that never ends, or a compressor running all weekend is invisible until the invoice.",
    bullets: [
      "Natural gas / CO2, city water, wastewater, steam, and compressed air at the line — not only at the fence.",
      "kWh per unit and demand peaks. Energy is a process number, not a facilities surprise.",
      "CIP water, chemical, rinse time, and return temperature — quality and the utility bill on one trend.",
    ],
  },
  {
    key: "estop",
    eyebrow: "Safety",
    title: "Illuminated e-stops",
    photo: "estop",
    pitch: "Most lines still have a dark mushroom somewhere. When it is latched, nobody can see it from the other end of the cell. The crew spends the next twenty minutes walking e-stops instead of running product.",
    bullets: [
      "Replace incandescent or unlit mushrooms with LED illuminated actuators.",
      "When it is pressed, it lights. Reset is obvious from across the line.",
      "Fewer ‘it won’t start’ calls that were just a pulled e-stop on the far side.",
    ],
  },
  {
    key: "hvac",
    eyebrow: "Panel climate",
    title: "Cabinet air conditioner replacement",
    photo: "cabinet",
    pitch: "A sealed panel with a dead air conditioner is a slow failure. Drives derate, processors trip on overtemp, and it always happens on the hottest afternoon of the year.",
    bullets: [
      "Failed or undersized panel HVAC is a one-day swap, not a controls project.",
      "Heat is what kills VFDs and aging PLCs sitting inches from each other.",
      "Filter, condensate, and setpoint while we are in the cabinet.",
    ],
  },
];

export const ALSO_ON_THE_FLOOR: { title: string; body: string }[] = [
  { title: "Historian & trends", body: "Yesterday’s downtime is a memory until speed, flow, and faults live in a historian operations can pull." },
  { title: "Andon & reason codes", body: "First-hour production stops being a guess. The supervisor sees mechanical vs material vs quality." },
  { title: "Lot / CIP traceability", body: "Which batch ran at 2 a.m., which CIP cycle, which recipe. Quality should not need a clipboard." },
  { title: "Recipes on the HMI", body: "Changeover lives in someone’s head until it is a recipe. SKU swaps stop being off-spec nights." },
  { title: "Remote support", body: "A current platform plus a managed path in means we can be on the machine without a plane ticket." },
  { title: "Program backups", body: "Image every processor and drive. A failure becomes a restore, not a rewrite from memory." },
];

/** What a plant SCADA actually puts on the screen — used as a justification grid. */
export const SCADA_PAYOFFS: { title: string; body: string }[] = [
  { title: "Gas & CO2", body: "Burner, oven, and carbonation use as a trend. A stuck valve is a number, not a month-end surprise." },
  { title: "Water & wastewater", body: "Make-up, rinse, and discharge by line. CIP that never ends shows up before the city meter does." },
  { title: "Steam", body: "Trap leaks and idle headers cost steam all shift. Flow at the user is the only honest number." },
  { title: "Compressed air", body: "The most expensive utility most plants never meter. Weekend leaks are a compressor that never sleeps." },
  { title: "Electricity", body: "kWh per unit and demand peaks. Energy becomes a process KPI, not a facilities invoice." },
  { title: "Production & OEE", body: "Counts in/out, starve, block, and reject. Line balance stops being an opinion." },
  { title: "Alarms", body: "The right person, the first time. Not a horn on the wall that everyone has learned to ignore." },
  { title: "Safety status", body: "Which gate, e-stop, or relay opened. The circuit drop stops being a scavenger hunt." },
  { title: "Lot, CIP, recipes", body: "Batch, cycle, and SKU on the record. Quality and changeover stop living on paper." },
];

import type { Mapping, MappingMachine } from "../api/mappings";
import { checkObsolete, type EquipmentCategory } from "./obsoleteEquipment";

/**
 * Obsolescence risk register.
 *
 * Walks every machine in a mapping, checks each control/drive asset against the
 * vendor lifecycle table, then groups identical assets so the register reads as
 * "SLC 5/04 — 3 units" rather than repeating the same finding per machine.
 */

export type RiskLevel = "critical" | "high" | "moderate";

export interface RiskFinding {
  key: string;
  category: EquipmentCategory;
  /** Display label — a drive finding may be a VFD or a servo drive */
  categoryLabel: string;
  make: string;
  model: string;
  /** Machines running this asset, in sheet order */
  machines: { id: string; tag: string; name: string }[];
  unitCount: number;
  eolYear?: number;
  note: string;
  successor?: string;
  score: number;
  level: RiskLevel;
  breakdown: { age: number; exposure: number; migration: number };
}

export interface RiskRegister {
  findings: RiskFinding[];
  /** Machines carrying at least one obsolete asset */
  affectedMachines: number;
  totalMachines: number;
  counts: Record<RiskLevel, number>;
  /** Total obsolete units across the plant */
  totalUnits: number;
}

interface Candidate {
  category: EquipmentCategory;
  categoryLabel: string;
  make: string | null;
  model: string | null;
  series?: string | null;
}

/**
 * Field techs type the same asset several ways — "SLC 5/04" and "SLC 5/04 CPU",
 * "AB" and "Allen-Bradley". Grouping on the raw strings would split one finding
 * into several and understate how exposed the plant actually is, so the register
 * groups on a normalized key while still displaying the cleanest label seen.
 */
const MAKE_ALIASES: Record<string, string> = {
  ab: "allen-bradley",
  "a b": "allen-bradley",
  "allen bradley": "allen-bradley",
  allenbradley: "allen-bradley",
  "allen bradley rockwell": "allen-bradley",
  rockwell: "allen-bradley",
  "rockwell automation": "allen-bradley",
  ge: "ge",
  "ge fanuc": "ge",
  "schneider electric": "schneider",
  "mitsubishi electric": "mitsubishi",
  "omron corporation": "omron",
};

/** Descriptor words that don't identify the product itself. */
const NOISE_TOKENS = new Set([
  "cpu", "processor", "module", "controller", "control", "unit", "series",
  "plc", "hmi", "panel", "terminal", "drive", "vfd", "inverter", "servo",
]);

function normText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeMake(make: string): string {
  const n = normText(make);
  return MAKE_ALIASES[n] ?? n;
}

function normalizeModel(model: string): string {
  return normText(model)
    .split(" ")
    .filter((t) => t && !NOISE_TOKENS.has(t))
    .join(" ");
}

function candidatesFor(m: MappingMachine): Candidate[] {
  return [
    { category: "plc", categoryLabel: "PLC", make: m.plc_make, model: m.plc_model, series: m.plc_series },
    { category: "hmi", categoryLabel: "HMI", make: m.hmi_make, model: m.hmi_model },
    { category: "drive", categoryLabel: "VFD", make: m.vfd_make, model: m.vfd_model },
    { category: "drive", categoryLabel: "Servo", make: m.servo_drive_make, model: m.servo_drive_model },
  ];
}

/**
 * Risk score, 2–7. Deliberately simple so it can be explained on the printed sheet:
 *   age       how long ago the vendor discontinued it
 *   exposure  how many units in this plant depend on it
 *   migration whether a documented successor exists
 */
function scoreOf(eolYear: number | undefined, unitCount: number, hasSuccessor: boolean) {
  const now = new Date().getFullYear();
  let age: number;
  if (eolYear === undefined) {
    age = 2; // legacy platform, discontinued long enough ago that we don't track the date
  } else {
    const years = now - eolYear;
    age = years >= 10 ? 3 : years >= 5 ? 2 : 1;
  }
  const exposure = unitCount >= 3 ? 3 : unitCount === 2 ? 2 : 1;
  const migration = hasSuccessor ? 0 : 1;
  return { age, exposure, migration, total: age + exposure + migration };
}

function levelOf(score: number): RiskLevel {
  if (score >= 6) return "critical";
  if (score >= 4) return "high";
  return "moderate";
}

export function buildRiskRegister(mapping: Mapping): RiskRegister {
  const machines = mapping.machines ?? [];
  const grouped = new Map<string, RiskFinding>();
  const affected = new Set<string>();

  machines.forEach((machine, idx) => {
    const tag = `M-${String(idx + 1).padStart(2, "0")}`;

    for (const c of candidatesFor(machine)) {
      const result = checkObsolete(c.category, c.make, c.model, c.series);
      if (!result.obsolete) continue;

      affected.add(machine.id);

      const make = (c.make ?? "").trim();
      const model = [c.model, c.series].filter(Boolean).join(" ").trim();
      const key = `${c.category}|${normalizeMake(make)}|${normalizeModel(model)}`;

      const existing = grouped.get(key);
      if (existing) {
        existing.machines.push({ id: machine.id, tag, name: machine.name });
        existing.unitCount += 1;
        // Keep the cleanest labels: the fullest make, the least cluttered model
        if (make.length > existing.make.length) existing.make = make;
        if (model && (!existing.model || model.length < existing.model.length)) existing.model = model;
      } else {
        grouped.set(key, {
          key,
          category: c.category,
          categoryLabel: c.categoryLabel,
          make,
          model,
          machines: [{ id: machine.id, tag, name: machine.name }],
          unitCount: 1,
          eolYear: result.eolYear,
          note: result.note ?? "",
          successor: result.successor,
          score: 0,
          level: "moderate",
          breakdown: { age: 0, exposure: 0, migration: 0 },
        });
      }
    }
  });

  const findings = [...grouped.values()].map((f) => {
    const s = scoreOf(f.eolYear, f.unitCount, Boolean(f.successor));
    return {
      ...f,
      score: s.total,
      level: levelOf(s.total),
      breakdown: { age: s.age, exposure: s.exposure, migration: s.migration },
    };
  });

  // Highest risk first; break ties by how much of the plant is exposed
  findings.sort((a, b) => b.score - a.score || b.unitCount - a.unitCount || a.categoryLabel.localeCompare(b.categoryLabel));

  const counts: Record<RiskLevel, number> = { critical: 0, high: 0, moderate: 0 };
  let totalUnits = 0;
  for (const f of findings) {
    counts[f.level] += 1;
    totalUnits += f.unitCount;
  }

  return {
    findings,
    affectedMachines: affected.size,
    totalMachines: machines.length,
    counts,
    totalUnits,
  };
}

export const RISK_META: Record<RiskLevel, { label: string; ink: string; bg: string; border: string }> = {
  critical: { label: "Critical", ink: "#7f1d1d", bg: "#fee2e2", border: "#dc2626" },
  high:     { label: "High",     ink: "#7c2d12", bg: "#ffedd5", border: "#ea580c" },
  moderate: { label: "Moderate", ink: "#78350f", bg: "#fef3c7", border: "#d97706" },
};

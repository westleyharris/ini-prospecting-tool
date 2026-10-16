import type { Mapping, MappingMachine } from "../api/mappings";
import { checkAsset, type EquipmentCategory, type LifecycleStatus } from "./obsoleteEquipment";
import { machineTag } from "./consolidateMappings";

/**
 * Lifecycle risk register.
 *
 * Walks every machine in a mapping, checks each control/drive asset against the
 * vendor lifecycle table, then groups identical assets so the register reads as
 * "PLC-5/20 — 3 units" rather than repeating the same finding per machine.
 */

export type RiskLevel = "critical" | "high" | "moderate" | "watch";

export interface RiskFinding {
  key: string;
  category: EquipmentCategory;
  categoryLabel: string;
  make: string;
  model: string;
  machines: { id: string; tag: string; name: string }[];
  unitCount: number;
  eolYear?: number;
  note: string;
  successor?: string;
  status: LifecycleStatus;
  score: number;
  level: RiskLevel;
  breakdown: { age: number; exposure: number; migration: number };
}

export interface RiskRegister {
  findings: RiskFinding[];
  affectedMachines: number;
  totalMachines: number;
  counts: Record<RiskLevel, number>;
  totalUnits: number;
}

interface Candidate {
  category: EquipmentCategory;
  categoryLabel: string;
  make: string | null;
  model: string | null;
  series?: string | null;
  partNo?: string | null;
}

const NOISE_TOKENS = new Set([
  "cpu", "processor", "module", "controller", "control", "unit", "series",
  "plc", "hmi", "panel", "terminal", "drive", "vfd", "inverter", "servo",
]);

function normText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeModel(model: string): string {
  return normText(model)
    .split(" ")
    .filter((t) => t && !NOISE_TOKENS.has(t))
    .join(" ");
}

function candidatesFor(m: MappingMachine): Candidate[] {
  return [
    { category: "plc", categoryLabel: "PLC", make: m.plc_make, model: m.plc_model, series: m.plc_series, partNo: m.plc_part_no },
    { category: "hmi", categoryLabel: "HMI", make: m.hmi_make, model: m.hmi_model, partNo: m.hmi_part_no },
    { category: "drive", categoryLabel: "VFD", make: m.vfd_make, model: m.vfd_model },
    { category: "servo", categoryLabel: "Servo", make: m.servo_drive_make, model: m.servo_drive_model },
    { category: "servo", categoryLabel: "Servo motor", make: m.servo_motor_make, model: m.servo_motor_model, partNo: m.servo_motor_part_no },
  ];
}

function yearsPast(eolYear: number | undefined): number {
  if (eolYear == null) return 0;
  return Math.max(0, new Date().getFullYear() - eolYear);
}

/**
 * Risk score. Explained on the printed sheet:
 *   age       years since last-ship (unsupported and 8+ year-old discontinued score highest)
 *   exposure  how many units in this plant depend on it
 *   migration whether a documented successor exists
 *
 * Controllers are a special case: a discontinued PLC is a line-down event,
 * so PLC-5 / PLC-2 / PLC-3 land Critical even at a single unit. A successor
 * existing does not make last-ship-2017 hardware "moderate."
 */
function scoreOf(
  status: LifecycleStatus,
  eolYear: number | undefined,
  unitCount: number,
  hasSuccessor: boolean,
  category: EquipmentCategory,
) {
  const years = yearsPast(eolYear);
  let age: number;
  if (status === "mature") {
    age = 1;
  } else if (status === "unsupported") {
    age = 4;
  } else if (years >= 8) {
    age = 4;
  } else if (years >= 5) {
    age = 3;
  } else {
    age = 2;
  }
  if (category === "plc" && status !== "mature") age += 2;
  const exposure = unitCount >= 10 ? 3 : unitCount >= 3 ? 2 : 1;
  const migration = hasSuccessor ? 0 : 1;
  return { age, exposure, migration, total: age + exposure + migration };
}

function levelOf(
  status: LifecycleStatus,
  score: number,
  category: EquipmentCategory,
  eolYear: number | undefined,
): RiskLevel {
  if (status === "mature") return "watch";
  const years = yearsPast(eolYear);
  if (category === "plc") {
    if (status === "unsupported" || years >= 5 || eolYear == null) return "critical";
    return "high";
  }
  if (status === "unsupported") return score >= 5 ? "critical" : "high";
  if (score >= 7) return "critical";
  if (score >= 5) return "high";
  return "moderate";
}

export function buildRiskRegister(mapping: Mapping): RiskRegister {
  const machines = mapping.machines ?? [];
  const grouped = new Map<string, RiskFinding>();
  const affected = new Set<string>();

  machines.forEach((machine, idx) => {
    const tag = machineTag(machine, idx);
    const name = machine.line_name ? `${machine.line_name} · ${machine.name}` : machine.name;

    for (const c of candidatesFor(machine)) {
      const result = checkAsset(c.category, {
        make: c.make, model: c.model, series: c.series, partNo: c.partNo,
        extra: machine.notes,
      });
      if (result.status === "unknown") continue;

      affected.add(machine.id);

      const make = (result.brand || (c.make ?? "").trim());
      const model = (result.family || [c.model, c.series].filter(Boolean).join(" ").trim() || (c.partNo ?? "").trim());
      const key = `${c.category}|${result.family ?? normalizeModel(model)}|${result.status}`;

      const existing = grouped.get(key);
      if (existing) {
        existing.machines.push({ id: machine.id, tag, name });
        existing.unitCount += 1;
        if (make.length > existing.make.length) existing.make = make;
        if (model && (!existing.model || (result.family && existing.model !== result.family) || model.length < existing.model.length)) {
          existing.model = result.family || model;
        }
      } else {
        grouped.set(key, {
          key,
          category: c.category,
          categoryLabel: c.categoryLabel,
          make,
          model,
          machines: [{ id: machine.id, tag, name }],
          unitCount: 1,
          eolYear: result.eolYear,
          note: result.note ?? "",
          successor: result.successor,
          status: result.status,
          score: 0,
          level: "moderate",
          breakdown: { age: 0, exposure: 0, migration: 0 },
        });
      }
    }
  });

  const findings = [...grouped.values()].map((f) => {
    const s = scoreOf(f.status, f.eolYear, f.unitCount, Boolean(f.successor), f.category);
    return {
      ...f,
      score: s.total,
      level: levelOf(f.status, s.total, f.category, f.eolYear),
      breakdown: { age: s.age, exposure: s.exposure, migration: s.migration },
    };
  });

  const levelRank: Record<RiskLevel, number> = { critical: 4, high: 3, moderate: 2, watch: 1 };
  findings.sort(
    (a, b) =>
      levelRank[b.level] - levelRank[a.level] ||
      b.score - a.score ||
      (a.eolYear ?? 9999) - (b.eolYear ?? 9999) ||
      b.unitCount - a.unitCount ||
      a.categoryLabel.localeCompare(b.categoryLabel)
  );

  const counts: Record<RiskLevel, number> = { critical: 0, high: 0, moderate: 0, watch: 0 };
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
  watch:    { label: "Watch",    ink: "#1e3a5f", bg: "#e8eef5", border: "#64748b" },
};

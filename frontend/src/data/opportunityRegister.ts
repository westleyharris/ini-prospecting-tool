import type { Mapping } from "../api/mappings";
import { assessMachine } from "./machineAssessment";
import { FLAG_DEFS, type FlagKey } from "./observations";
import { buildRiskRegister } from "./riskRegister";

export interface OpportunityFinding {
  key: FlagKey;
  label: string;
  short: string;
  pitch: string;
  machines: { id: string; tag: string; name: string }[];
  unitCount: number;
}

export interface OpportunityRegister {
  findings: OpportunityFinding[];
  affectedMachines: number;
  totalFlags: number;
  totalMachines: number;
}

export function buildOpportunityRegister(mapping: Mapping): OpportunityRegister {
  const machines = mapping.machines ?? [];
  const grouped = new Map<FlagKey, OpportunityFinding>();
  const affected = new Set<string>();

  machines.forEach((machine, idx) => {
    const tag = `M-${String(idx + 1).padStart(2, "0")}`;
    const assessment = assessMachine(machine);
    for (const flag of assessment.flags) {
      affected.add(machine.id);
      const existing = grouped.get(flag.key);
      if (existing) {
        existing.machines.push({ id: machine.id, tag, name: machine.name });
        existing.unitCount += 1;
      } else {
        grouped.set(flag.key, {
          key: flag.key,
          label: flag.label,
          short: flag.short,
          pitch: flag.pitch,
          machines: [{ id: machine.id, tag, name: machine.name }],
          unitCount: 1,
        });
      }
    }
  });

  const risk = buildRiskRegister(mapping);
  for (const f of risk.findings) {
    if (f.status !== "discontinued" && f.status !== "unsupported") continue;
    if (f.unitCount !== 1 || !f.machines[0]) continue;
    const m = f.machines[0];
    const existing = grouped.get("single_source");
    if (existing) {
      if (!existing.machines.some((x) => x.id === m.id)) {
        existing.machines.push(m);
        existing.unitCount += 1;
      }
    } else {
      const def = FLAG_DEFS.find((d) => d.key === "single_source")!;
      grouped.set("single_source", {
        key: "single_source",
        label: def.label,
        short: def.short,
        pitch: def.pitch,
        machines: [m],
        unitCount: 1,
      });
    }
    affected.add(m.id);
  }

  const order = FLAG_DEFS.map((f) => f.key);
  const findings = [...grouped.values()].sort(
    (a, b) => b.unitCount - a.unitCount || order.indexOf(a.key) - order.indexOf(b.key)
  );

  return {
    findings,
    affectedMachines: affected.size,
    totalFlags: findings.reduce((s, f) => s + f.unitCount, 0),
    totalMachines: machines.length,
  };
}

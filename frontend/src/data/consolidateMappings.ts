import type { Mapping, MappingMachine, SourceLine } from "../api/mappings";

/** Station tag used on drawings, the register, and the deck. */
export function machineTag(machine: MappingMachine, index: number): string {
  if (machine.display_tag) return machine.display_tag;
  return `M-${String(index + 1).padStart(2, "0")}`;
}

/** Prefix + sequence for the lime/white tag pill. L01-M-01 → { L01, 01 }. */
export function tagParts(machine: MappingMachine, index: number): { prefix: string; seq: string } {
  const tag = machineTag(machine, index);
  const match = tag.match(/^(L\d+)-M-(\d+)$/);
  if (match) return { prefix: match[1], seq: match[2] };
  return { prefix: "M", seq: String(index + 1).padStart(2, "0") };
}

export function drawingNumber(mapping: Mapping): string {
  const consolidated = (mapping.source_lines?.length ?? 0) > 1;
  const id = consolidated ? mapping.plant_id : mapping.id;
  return `${consolidated ? "PLT" : "MAP"}-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export interface LineGroup {
  lineName: string | null;
  machines: { machine: MappingMachine; index: number }[];
}

/** Group stations in sheet order. A single mapping is one unnamed group. */
export function groupMachinesByLine(machines: MappingMachine[]): LineGroup[] {
  if (!machines.some((m) => m.line_name)) {
    return [{ lineName: null, machines: machines.map((machine, index) => ({ machine, index })) }];
  }
  const groups: LineGroup[] = [];
  machines.forEach((machine, index) => {
    const lineName = machine.line_name ?? "Line";
    const last = groups[groups.length - 1];
    if (last && last.lineName === lineName) last.machines.push({ machine, index });
    else groups.push({ lineName, machines: [{ machine, index }] });
  });
  return groups;
}

/**
 * Fold every line mapping at a plant into one Mapping the drawing, register,
 * and deck already know how to render. Per-line mappings are unchanged.
 */
export function consolidateMappings(mappings: Mapping[]): Mapping {
  if (mappings.length === 0) {
    throw new Error("No mappings to consolidate");
  }

  const sorted = [...mappings].sort((a, b) => {
    const byDate = a.created_at.localeCompare(b.created_at);
    return byDate !== 0 ? byDate : a.name.localeCompare(b.name);
  });

  const first = sorted[0];
  const machines: MappingMachine[] = [];
  const source_lines: SourceLine[] = [];

  sorted.forEach((mapping, li) => {
    const lineTag = `L${String(li + 1).padStart(2, "0")}`;
    const lineMachines = mapping.machines ?? [];
    source_lines.push({
      id: mapping.id,
      name: mapping.name,
      machine_count: lineMachines.length,
      photo_count: lineMachines.reduce((s, m) => s + (m.photos ?? []).length, 0),
    });
    lineMachines.forEach((m, mi) => {
      machines.push({
        ...m,
        line_name: mapping.name,
        display_tag: `${lineTag}-M-${String(mi + 1).padStart(2, "0")}`,
      });
    });
  });

  const plant = first.plant_name ?? "Plant";
  return {
    ...first,
    id: `plant:${first.plant_id}`,
    name: sorted.length === 1 ? first.name : `${plant} — all lines`,
    notes: source_lines.map((l, i) => `L${String(i + 1).padStart(2, "0")} ${l.name}`).join(" · "),
    machines,
    machine_count: machines.length,
    photo_count: machines.reduce((s, m) => s + (m.photos ?? []).length, 0),
    source_lines,
  };
}

export function isConsolidated(mapping: Mapping): boolean {
  return (mapping.source_lines?.length ?? 0) > 1;
}

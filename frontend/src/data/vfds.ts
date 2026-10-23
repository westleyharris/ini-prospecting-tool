import type { MachineVfd, MappingMachine } from "../api/mappings";

/** How many of one drive model are installed. Blank or junk values count as 1, capped at 999. */
export function normalizeQty(value: number | null | undefined): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(999, n);
}

function row(v: MachineVfd): MachineVfd {
  return { ...v, quantity: normalizeQty(v.quantity) };
}

/**
 * Drives on a machine.
 * An array (including empty) is the saved list. When the array is missing, the
 * legacy single make/model/hp/voltage fields are one drive at quantity 1.
 */
export function vfdsOf(machine: MappingMachine): MachineVfd[] {
  if (Array.isArray(machine.vfds)) {
    return machine.vfds
      .map(row)
      .filter((v) => v.make || v.model || v.hp || v.voltage)
      .sort((a, b) => a.sort_order - b.sort_order);
  }
  if (machine.vfd_make || machine.vfd_model || machine.vfd_hp || machine.vfd_voltage) {
    return [{
      id: `legacy-${machine.id}`,
      machine_id: machine.id,
      sort_order: 0,
      make: machine.vfd_make,
      model: machine.vfd_model,
      hp: machine.vfd_hp,
      voltage: machine.vfd_voltage,
      quantity: 1,
    }];
  }
  return [];
}

export function vfdUnitCount(machines: MappingMachine[]): number {
  return machines.reduce(
    (sum, m) => sum + vfdsOf(m).reduce((n, v) => n + v.quantity, 0),
    0,
  );
}

export function formatVfdLine(v: Pick<MachineVfd, "make" | "model" | "hp" | "voltage" | "quantity">): string {
  const name = [v.make, v.model, v.hp, v.voltage].filter(Boolean).join(" · ");
  const qty = normalizeQty(v.quantity);
  return name ? `${qty}× ${name}` : `${qty}×`;
}

/** Spec-table rows. One drive keeps the Make/Model fields and adds Qty. Several drives are one line each. */
export function vfdSpecRows(machine: MappingMachine): { label: string; value: string }[] {
  const list = vfdsOf(machine);
  if (list.length === 0) return [];
  if (list.length === 1) {
    const v = list[0];
    return [
      { label: "Qty", value: String(v.quantity) },
      { label: "Make", value: v.make ?? "" },
      { label: "Model", value: v.model ?? "" },
      { label: "HP", value: v.hp ?? "" },
      { label: "Voltage", value: v.voltage ?? "" },
    ].filter((s) => s.value);
  }
  return list.map((v, i) => ({
    label: `#${i + 1} ×${v.quantity}`,
    value: [v.make, v.model, v.hp, v.voltage].filter(Boolean).join(" · ") || "Unspecified",
  }));
}

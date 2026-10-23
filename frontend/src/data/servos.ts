import type { MachineServo, MappingMachine } from "../api/mappings";
import { normalizeQty } from "./vfds";

function row(v: MachineServo): MachineServo {
  return { ...v, quantity: normalizeQty(v.quantity) };
}

function filled(v: Pick<MachineServo, "drive_make" | "drive_model" | "motor_make" | "motor_model" | "motor_part_no">): boolean {
  return Boolean(v.drive_make || v.drive_model || v.motor_make || v.motor_model || v.motor_part_no);
}

/**
 * Servo axes on a machine.
 * An array (including empty) is the saved list. When the array is missing, the
 * legacy single drive/motor fields are one axis at quantity 1.
 */
export function servosOf(machine: MappingMachine): MachineServo[] {
  if (Array.isArray(machine.servos)) {
    return machine.servos
      .map(row)
      .filter(filled)
      .sort((a, b) => a.sort_order - b.sort_order);
  }
  if (
    machine.servo_drive_make || machine.servo_drive_model ||
    machine.servo_motor_make || machine.servo_motor_model || machine.servo_motor_part_no
  ) {
    return [{
      id: `legacy-${machine.id}`,
      machine_id: machine.id,
      sort_order: 0,
      drive_make: machine.servo_drive_make,
      drive_model: machine.servo_drive_model,
      motor_make: machine.servo_motor_make,
      motor_model: machine.servo_motor_model,
      motor_part_no: machine.servo_motor_part_no,
      quantity: 1,
    }];
  }
  return [];
}

export function servoUnitCount(machines: MappingMachine[]): number {
  return machines.reduce(
    (sum, m) => sum + servosOf(m).reduce((n, v) => n + v.quantity, 0),
    0,
  );
}

export function servoName(v: Pick<MachineServo, "drive_make" | "drive_model" | "motor_make" | "motor_model" | "motor_part_no">): string {
  const drive = [v.drive_make, v.drive_model].filter(Boolean).join(" ");
  const motor = [v.motor_make, v.motor_model, v.motor_part_no].filter(Boolean).join(" ");
  return [drive && `Drive ${drive}`, motor && `Motor ${motor}`].filter(Boolean).join(" · ");
}

export function formatServoLine(v: Pick<MachineServo, "drive_make" | "drive_model" | "motor_make" | "motor_model" | "motor_part_no" | "quantity">): string {
  const name = servoName(v);
  const qty = normalizeQty(v.quantity);
  return name ? `${qty}× ${name}` : `${qty}×`;
}

/** Spec-table rows. One axis keeps the drive/motor fields and adds Qty. Several axes are one line each. */
export function servoSpecRows(machine: MappingMachine): { label: string; value: string }[] {
  const list = servosOf(machine);
  if (list.length === 0) return [];
  if (list.length === 1) {
    const v = list[0];
    return [
      { label: "Qty", value: String(v.quantity) },
      { label: "Drive Make", value: v.drive_make ?? "" },
      { label: "Drive Model", value: v.drive_model ?? "" },
      { label: "Motor Make", value: v.motor_make ?? "" },
      { label: "Motor Model", value: v.motor_model ?? "" },
      { label: "Motor P/N", value: v.motor_part_no ?? "" },
    ].filter((s) => s.value);
  }
  return list.map((v, i) => ({
    label: `#${i + 1} ×${v.quantity}`,
    value: servoName(v) || "Unspecified",
  }));
}

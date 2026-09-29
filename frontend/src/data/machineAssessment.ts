import type { Mapping, MappingMachine } from "../api/mappings";
import {
  checkAsset,
  type EquipmentCategory,
  type LifecycleResult,
  type LifecycleStatus,
} from "./obsoleteEquipment";
import {
  FLAG_DEFS,
  parseObservations,
  type FlagKey,
  type MachineObservations,
} from "./observations";

export interface AssetFinding {
  category: EquipmentCategory;
  categoryLabel: string;
  make: string;
  model: string;
  life: LifecycleResult;
}

export interface ResolvedFlag {
  key: FlagKey;
  label: string;
  short: string;
  pitch: string;
  auto: boolean;
}

export interface MachineAssessment {
  machine: MappingMachine;
  observations: MachineObservations;
  assets: AssetFinding[];
  /** Most severe lifecycle result on the machine. */
  worst: LifecycleResult;
  hasEol: boolean;
  hasMature: boolean;
  flags: ResolvedFlag[];
  today: string[];
  risk: string[];
  opportunity: string[];
}

function asset(
  category: EquipmentCategory,
  categoryLabel: string,
  make: string | null | undefined,
  model: string | null | undefined,
  series: string | null | undefined,
  partNo: string | null | undefined,
  life: LifecycleResult,
): AssetFinding | null {
  if (life.status === "unknown") return null;
  const makeLabel = (make ?? "").trim();
  const modelLabel = [model, series].filter(Boolean).join(" ").trim() || (partNo ?? "").trim();
  return { category, categoryLabel, make: makeLabel, model: modelLabel, life };
}

function deriveAutoFlags(
  machine: MappingMachine,
  obs: MachineObservations,
  assets: AssetFinding[],
): Set<FlagKey> {
  const auto = new Set<FlagKey>();

  if (obs.operator_interface === "none" || obs.operator_interface === "pushbuttons") {
    auto.add("no_visibility");
  } else if (
    !machine.hmi_make &&
    !machine.hmi_model &&
    /no hmi/i.test(machine.notes ?? "")
  ) {
    auto.add("no_visibility");
  }
  if (obs.diagnostics === "none") auto.add("no_diagnostics");
  if (obs.network === "island" || obs.network === "dh_rio") auto.add("island");
  if (obs.recoverability === "laptop_required") auto.add("no_diagnostics");

  const plc = assets.find((a) => a.category === "plc");
  const plcDead = plc?.life.obsolete === true;
  const vfdPresent = Boolean(machine.vfd_make || machine.vfd_model);
  const servoPresent = Boolean(machine.servo_drive_make || machine.servo_drive_model);
  const vfdDead = assets.some((a) => a.categoryLabel === "VFD" && a.life.obsolete);
  const servoDead = assets.some((a) => a.categoryLabel === "Servo" && a.life.obsolete);

  if (plcDead && ((vfdPresent && !vfdDead) || (servoPresent && !servoDead))) {
    auto.add("trapped_modern");
  }

  return auto;
}

function opportunityLines(flags: ResolvedFlag[], assets: AssetFinding[]): string[] {
  const lines: string[] = [];
  const successor = assets.find((a) => a.life.obsolete && a.life.successor)?.life.successor;
  if (successor) lines.push(`Migrate to ${successor}`);

  const recs: Record<FlagKey, string> = {
    no_visibility: "Graphical HMI with fault text, counts, and recovery steps",
    no_diagnostics: "Panel diagnostics so the crew recovers without a laptop",
    island: "Ethernet into a line overview — see where product is and why it stopped",
    trapped_modern: "Unlock drive data already installed (current, speed, trip history)",
    single_source: "Current-platform spare strategy with published lead times",
    no_counts: "Station counts in/out so line balance is a number, not an opinion",
    hardwired_safety: "Safety status on the HMI — which gate, e-stop, or relay opened",
  };
  for (const f of flags) {
    const rec = recs[f.key];
    if (rec && !lines.includes(rec)) lines.push(rec);
  }
  return lines;
}

export function assessMachine(machine: MappingMachine): MachineAssessment {
  const observations = parseObservations(machine.observations);
  const candidates: AssetFinding[] = [
    asset("plc", "PLC", machine.plc_make, machine.plc_model, machine.plc_series, machine.plc_part_no,
      checkAsset("plc", { make: machine.plc_make, model: machine.plc_model, series: machine.plc_series, partNo: machine.plc_part_no })),
    asset("hmi", "HMI", machine.hmi_make, machine.hmi_model, null, machine.hmi_part_no,
      checkAsset("hmi", { make: machine.hmi_make, model: machine.hmi_model, partNo: machine.hmi_part_no })),
    asset("drive", "VFD", machine.vfd_make, machine.vfd_model, null, null,
      checkAsset("drive", { make: machine.vfd_make, model: machine.vfd_model })),
    asset("servo", "Servo", machine.servo_drive_make, machine.servo_drive_model, null, null,
      checkAsset("servo", { make: machine.servo_drive_make, model: machine.servo_drive_model })),
    asset("servo", "Servo motor", machine.servo_motor_make, machine.servo_motor_model, null, machine.servo_motor_part_no,
      checkAsset("servo", { make: machine.servo_motor_make, model: machine.servo_motor_model, partNo: machine.servo_motor_part_no })),
  ].filter((a): a is AssetFinding => a !== null);

  const rank: Record<LifecycleStatus | "unknown", number> = {
    unsupported: 3, discontinued: 2, mature: 1, unknown: 0,
  };
  const worst = candidates.reduce<LifecycleResult>(
    (acc, a) => (rank[a.life.status] > rank[acc.status] ? a.life : acc),
    { obsolete: false, status: "unknown" },
  );

  const auto = deriveAutoFlags(machine, observations, candidates);
  const flags: ResolvedFlag[] = [];
  for (const def of FLAG_DEFS) {
    const manual = Boolean(observations.flags[def.key]);
    const isAuto = auto.has(def.key);
    if (!manual && !isAuto) continue;
    flags.push({
      key: def.key,
      label: def.label,
      short: def.short,
      pitch: def.pitch,
      auto: isAuto && !manual,
    });
  }

  const today: string[] = [];
  const plc = [machine.plc_make, machine.plc_model, machine.plc_series].filter(Boolean).join(" ");
  const hmi = [machine.hmi_make, machine.hmi_model].filter(Boolean).join(" ");
  const vfd = [machine.vfd_make, machine.vfd_model].filter(Boolean).join(" ");
  const srv = [machine.servo_drive_make, machine.servo_drive_model].filter(Boolean).join(" ");
  if (plc) today.push(`PLC — ${plc}`);
  else today.push("PLC — not recorded");
  if (hmi) today.push(`HMI — ${hmi}`);
  else if (observations.operator_interface === "none") today.push("HMI — none");
  else if (observations.operator_interface === "pushbuttons") today.push("HMI — pushbuttons only");
  if (vfd) today.push(`VFD — ${vfd}`);
  if (srv) today.push(`Servo — ${srv}`);
  if (observations.network) {
    const netLabel: Record<string, string> = {
      island: "isolated island",
      dh_rio: "DH+ / RIO",
      devicenet: "DeviceNet",
      ethernet: "Ethernet",
      other: "other network",
    };
    today.push(`Network — ${netLabel[observations.network] ?? observations.network}`);
  }

  const risk: string[] = [];
  for (const a of candidates) {
    if (a.life.status === "unknown") continue;
    const bit = a.life.eolYear ? ` (${a.life.eolYear})` : "";
    risk.push(`${a.categoryLabel}: ${a.life.status}${bit} — ${a.life.note ?? ""}`);
  }
  if (observations.known_pain.trim()) risk.push(observations.known_pain.trim());

  return {
    machine,
    observations,
    assets: candidates,
    worst,
    hasEol: candidates.some((a) => a.life.obsolete),
    hasMature: candidates.some((a) => a.life.status === "mature"),
    flags,
    today,
    risk,
    opportunity: opportunityLines(flags, candidates),
  };
}

export function lifeFor(
  machine: MappingMachine,
  cat: "plc" | "hmi" | "vfd" | "servo",
): LifecycleResult {
  if (cat === "plc") {
    return checkAsset("plc", {
      make: machine.plc_make, model: machine.plc_model,
      series: machine.plc_series, partNo: machine.plc_part_no,
    });
  }
  if (cat === "hmi") {
    return checkAsset("hmi", { make: machine.hmi_make, model: machine.hmi_model, partNo: machine.hmi_part_no });
  }
  if (cat === "vfd") {
    return checkAsset("drive", { make: machine.vfd_make, model: machine.vfd_model });
  }
  const drive = checkAsset("servo", { make: machine.servo_drive_make, model: machine.servo_drive_model });
  if (drive.status !== "unknown") return drive;
  return checkAsset("servo", {
    make: machine.servo_motor_make, model: machine.servo_motor_model, partNo: machine.servo_motor_part_no,
  });
}

export interface PlantNarrative {
  story: string;
  bullets: string[];
  eolMachines: number;
  trapped: number;
  noHmi: number;
  islands: number;
  flagCount: number;
  machineCount: number;
}

export function buildPlantNarrative(mapping: Mapping): PlantNarrative {
  const machines = mapping.machines ?? [];
  const assessments = machines.map(assessMachine);
  const plant = mapping.plant_name ?? mapping.name;
  const location = [mapping.city, mapping.state].filter(Boolean).join(", ");

  const eolMachines = assessments.filter((a) => a.hasEol).length;
  const trapped = assessments.filter((a) => a.flags.some((f) => f.key === "trapped_modern")).length;
  const noHmi = assessments.filter((a) => a.flags.some((f) => f.key === "no_visibility")).length;
  const islands = assessments.filter((a) => a.flags.some((f) => f.key === "island")).length;
  const flagCount = assessments.reduce((s, a) => s + a.flags.length, 0);

  const worstNames = assessments
    .filter((a) => a.hasEol)
    .map((a) => {
      const asset = a.assets.find((x) => x.life.obsolete);
      return asset ? `${a.machine.name} (${asset.make} ${asset.model})`.trim() : a.machine.name;
    })
    .slice(0, 4);

  const lines = mapping.source_lines;
  const linePhrase =
    lines && lines.length > 1
      ? ` surveyed ${lines.length} lines (${lines.map((l) => l.name).join(", ")}) covering ${machines.length} machine${machines.length === 1 ? "" : "s"} at ${plant}`
      : ` surveyed ${machines.length} machine${machines.length === 1 ? "" : "s"} at ${plant}`;

  const story =
    `I&I Automation${linePhrase}` +
    `${location ? ` in ${location}` : ""}. ` +
    (eolMachines > 0
      ? `${eolMachines} station${eolMachines === 1 ? " runs" : "s run"} discontinued control hardware` +
        (worstNames.length ? ` — ${worstNames.join("; ")}` : "") + ". "
      : "Installed controllers in the surveyed scope are on current or mature platforms. ") +
    (trapped > 0
      ? `${trapped} station${trapped === 1 ? " has" : "s have"} a modern drive or servo trapped behind a legacy processor. `
      : "") +
    (noHmi > 0
      ? `${noHmi} station${noHmi === 1 ? " has" : "s have"} no useful operator interface. `
      : "") +
    (islands > 0
      ? `${islands} station${islands === 1 ? " is" : "s are"} isolated from the rest of the line. `
      : "") +
    "The findings below are what operations lives with, and what a controls program can change.";

  const bullets: string[] = [];
  if (lines && lines.length > 1) {
    bullets.push(`${lines.length} lines: ${lines.map((l) => l.name).join(" · ")}`);
  }
  if (eolMachines) bullets.push(`${eolMachines} of ${machines.length} machines on discontinued platforms`);
  if (trapped) bullets.push(`${trapped} modern drive/servo package${trapped === 1 ? "" : "s"} blocked by a legacy PLC`);
  if (noHmi) bullets.push(`${noHmi} station${noHmi === 1 ? "" : "s"} with no operator visibility`);
  if (islands) bullets.push(`${islands} control island${islands === 1 ? "" : "s"} — no station-to-station data`);
  const laptop = assessments.filter((a) => a.observations.recoverability === "laptop_required").length;
  if (laptop) bullets.push(`${laptop} station${laptop === 1 ? "" : "s"} where recovery requires a laptop`);
  if (bullets.length === 0) {
    bullets.push(`${machines.length} machine${machines.length === 1 ? "" : "s"} documented`);
    bullets.push("Opportunity flags and lifecycle status recorded per station");
  }

  return {
    story, bullets, eolMachines, trapped, noHmi, islands, flagCount,
    machineCount: machines.length,
  };
}

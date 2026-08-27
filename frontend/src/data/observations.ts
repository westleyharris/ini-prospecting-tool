/**
 * Per-machine survey observations — the operational half of a mapping.
 *
 * Lifecycle flags come from the equipment table. These fields are what the
 * technician saw and heard on the floor: how the operator runs it, whether a
 * mechanic can recover without a laptop, whether the station talks to anything.
 */

export type OperatorInterface = "none" | "pushbuttons" | "graphical";
export type DiagnosticsLevel = "none" | "faults" | "useful";
export type YesNoUnknown = "yes" | "no" | "unknown";
export type NetworkType = "island" | "dh_rio" | "devicenet" | "ethernet" | "other";
export type Recoverability = "laptop_required" | "panel_ok" | "unknown";
export type Bottleneck = "starving" | "blocked" | "balanced" | "unknown";
export type ChangeoverPain = "high" | "low" | "unknown";

export const FLAG_DEFS = [
  {
    key: "no_visibility",
    label: "No operator visibility",
    short: "NO HMI",
    pitch: "The operator cannot see why it stopped. A graphical HMI with fault text and recovery steps cuts diagnosis from tribal knowledge to the screen.",
  },
  {
    key: "no_diagnostics",
    label: "No mechanic diagnostics",
    short: "NO DIAG",
    pitch: "Recovery waits on a laptop and the person who knows the software. Panel diagnostics let the crew restore the machine without a specialist.",
  },
  {
    key: "island",
    label: "Isolated from the line",
    short: "ISLAND",
    pitch: "This station cannot tell the rest of the line what it is doing. Ethernet into a simple overview is the first step toward measuring balance.",
  },
  {
    key: "trapped_modern",
    label: "Modern device behind legacy controller",
    short: "TRAPPED",
    pitch: "A current drive or servo is already installed, but the legacy processor cannot expose its data. Replacing the controller unlocks hardware they have already paid for.",
  },
  {
    key: "single_source",
    label: "Single-sourced obsolete spare",
    short: "SPARES",
    pitch: "One discontinued unit, no published lead time. The next failure is a broker search against a running line.",
  },
  {
    key: "no_counts",
    label: "No production counts / reject data",
    short: "NO DATA",
    pitch: "Balance is opinion. Station counts in and out turn starve/block time into a number operations can act on.",
  },
  {
    key: "hardwired_safety",
    label: "Hardwired safety, no status",
    short: "SAFETY",
    pitch: "When the safety circuit drops there is no status on the HMI. Crews guess which gate, e-stop, or relay opened.",
  },
] as const;

export type FlagKey = (typeof FLAG_DEFS)[number]["key"];

export type FlagMap = Partial<Record<FlagKey, boolean>>;

export interface MachineObservations {
  operator_interface: OperatorInterface | "";
  diagnostics: DiagnosticsLevel | "";
  backup_on_file: YesNoUnknown | "";
  drawings_on_site: YesNoUnknown | "";
  network: NetworkType | "";
  known_pain: string;
  recoverability: Recoverability | "";
  bottleneck: Bottleneck | "";
  changeover: ChangeoverPain | "";
  flags: FlagMap;
}

export const EMPTY_OBSERVATIONS: MachineObservations = {
  operator_interface: "",
  diagnostics: "",
  backup_on_file: "",
  drawings_on_site: "",
  network: "",
  known_pain: "",
  recoverability: "",
  bottleneck: "",
  changeover: "",
  flags: {},
};

export function parseObservations(raw: string | null | undefined): MachineObservations {
  if (!raw) return { ...EMPTY_OBSERVATIONS, flags: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<MachineObservations>;
    return {
      operator_interface: parsed.operator_interface ?? "",
      diagnostics: parsed.diagnostics ?? "",
      backup_on_file: parsed.backup_on_file ?? "",
      drawings_on_site: parsed.drawings_on_site ?? "",
      network: parsed.network ?? "",
      known_pain: parsed.known_pain ?? "",
      recoverability: parsed.recoverability ?? "",
      bottleneck: parsed.bottleneck ?? "",
      changeover: parsed.changeover ?? "",
      flags: { ...(parsed.flags ?? {}) },
    };
  } catch {
    return { ...EMPTY_OBSERVATIONS, flags: {} };
  }
}

export function stringifyObservations(obs: MachineObservations): string {
  return JSON.stringify(obs);
}

export function observationsAreEmpty(obs: MachineObservations): boolean {
  return (
    !obs.operator_interface &&
    !obs.diagnostics &&
    !obs.backup_on_file &&
    !obs.drawings_on_site &&
    !obs.network &&
    !obs.known_pain.trim() &&
    !obs.recoverability &&
    !obs.bottleneck &&
    !obs.changeover &&
    !Object.values(obs.flags).some(Boolean)
  );
}

export const OBS_CHOICES = {
  operator_interface: [
    { value: "none", label: "None" },
    { value: "pushbuttons", label: "Pushbuttons only" },
    { value: "graphical", label: "Graphical HMI" },
  ],
  diagnostics: [
    { value: "none", label: "None" },
    { value: "faults", label: "Faults only" },
    { value: "useful", label: "Useful" },
  ],
  backup_on_file: [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
    { value: "unknown", label: "Unknown" },
  ],
  drawings_on_site: [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
    { value: "unknown", label: "Unknown" },
  ],
  network: [
    { value: "island", label: "Island" },
    { value: "dh_rio", label: "DH+ / RIO" },
    { value: "devicenet", label: "DeviceNet" },
    { value: "ethernet", label: "Ethernet" },
    { value: "other", label: "Other" },
  ],
  recoverability: [
    { value: "laptop_required", label: "Laptop required" },
    { value: "panel_ok", label: "From the panel" },
    { value: "unknown", label: "Unknown" },
  ],
  bottleneck: [
    { value: "starving", label: "Starving" },
    { value: "blocked", label: "Blocked" },
    { value: "balanced", label: "Balanced" },
    { value: "unknown", label: "Unknown" },
  ],
  changeover: [
    { value: "high", label: "High pain" },
    { value: "low", label: "Low pain" },
    { value: "unknown", label: "Unknown" },
  ],
} as const;

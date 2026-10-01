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
export type FlagGroup = "operations" | "safety" | "plant" | "reliability";

export const FLAG_GROUPS: { id: FlagGroup; label: string }[] = [
  { id: "operations", label: "Operations" },
  { id: "safety", label: "Safety" },
  { id: "plant", label: "SCADA & plant systems" },
  { id: "reliability", label: "Reliability" },
];

export const FLAG_DEFS = [
  {
    key: "no_visibility",
    group: "operations",
    label: "No operator visibility",
    short: "NO HMI",
    pitch: "The operator cannot see why it stopped. A graphical HMI with fault text and recovery steps cuts diagnosis from tribal knowledge to the screen.",
  },
  {
    key: "no_diagnostics",
    group: "operations",
    label: "No mechanic diagnostics",
    short: "NO DIAG",
    pitch: "Recovery waits on a laptop and the person who knows the software. Panel diagnostics let the crew restore the machine without a specialist.",
  },
  {
    key: "island",
    group: "operations",
    label: "Isolated from the line",
    short: "ISLAND",
    pitch: "This station cannot tell the rest of the line what it is doing. Ethernet into a simple overview is the first step toward measuring balance.",
  },
  {
    key: "trapped_modern",
    group: "operations",
    label: "Modern device behind legacy controller",
    short: "TRAPPED",
    pitch: "A current drive or servo is already installed, but the legacy processor cannot expose its data. Replacing the controller unlocks hardware they have already paid for.",
  },
  {
    key: "no_counts",
    group: "operations",
    label: "No production counts / reject data",
    short: "NO DATA",
    pitch: "Balance is opinion. Station counts in and out turn starve/block time into a number operations can act on.",
  },
  {
    key: "hardwired_safety",
    group: "safety",
    label: "Hardwired safety, no status",
    short: "SAFETY",
    pitch: "When the safety circuit drops there is no status on the HMI. Crews guess which gate, e-stop, or relay opened.",
  },
  {
    key: "estop_unlit",
    group: "safety",
    label: "E-stop not visible when latched",
    short: "E-STOP",
    pitch: "A dark mushroom does not tell you it is pressed. An illuminated e-stop lights when it is latched so the line is not hunting a stop for twenty minutes.",
  },
  {
    key: "no_scada",
    group: "plant",
    label: "No plant SCADA / line overview",
    short: "SCADA",
    pitch: "Nobody in a control room can see this station. A SCADA overview is one picture of the plant — running, starved, down, and why — instead of a radio call to the floor.",
  },
  {
    key: "no_utilities",
    group: "plant",
    label: "No gas / water / air / power visibility",
    short: "UTILS",
    pitch: "Gas, water, steam, compressed air, and kWh are paid for with no line-level meter. A leak, a stuck valve, or a CIP that never ends is a bill, not a trend.",
  },
  {
    key: "no_historian",
    group: "plant",
    label: "No historian / trending",
    short: "TREND",
    pitch: "Yesterday's downtime is a memory. A historian lets engineering pull speed, temperature, flow, and fault history instead of guessing from a shift report.",
  },
  {
    key: "no_andon",
    group: "plant",
    label: "No andon / downtime reason codes",
    short: "ANDON",
    pitch: "First-hour production is a guess. Andon and reason codes tell the supervisor what stopped, for how long, and whether it is mechanical, material, or quality.",
  },
  {
    key: "no_traceability",
    group: "plant",
    label: "No lot / batch / CIP record",
    short: "TRACE",
    pitch: "When quality asks which batch ran at 2 a.m., the answer is a clipboard. Lot, recipe, and CIP cycle records from the controller close the loop.",
  },
  {
    key: "no_recipe",
    group: "plant",
    label: "Recipes / changeover not in the system",
    short: "RECIPE",
    pitch: "Changeover lives in someone's head. Recipes on the HMI/SCADA cut setup time and the next off-spec run after a SKU swap.",
  },
  {
    key: "no_remote",
    group: "plant",
    label: "No remote support path",
    short: "REMOTE",
    pitch: "Every call is a truck roll. A managed remote path on a current platform means we can be on the machine without a plane ticket.",
  },
  {
    key: "single_source",
    group: "reliability",
    label: "Single-sourced obsolete spare",
    short: "SPARES",
    pitch: "One discontinued unit, no published lead time. The next failure is a broker search against a running line.",
  },
  {
    key: "panel_hvac",
    group: "reliability",
    label: "Panel climate / failed AC",
    short: "HVAC",
    pitch: "A dead cabinet air conditioner cooks drives and processors. Replacing panel HVAC is cheaper than the next overtemp trip on a hot afternoon.",
  },
  {
    key: "no_backup",
    group: "reliability",
    label: "No program backup on file",
    short: "BACKUP",
    pitch: "If this processor dies tonight, recovery is a rewrite. An image on file turns a disaster into a restore.",
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

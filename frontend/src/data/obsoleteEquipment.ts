/**
 * Vendor-declared end-of-life / discontinued equipment lookup.
 *
 * Matching is substring-based (case-insensitive) on make + model/series combined.
 * Only include products where the vendor has officially announced EOL / discontinuation.
 *
 * NOTE: lifecycle dates move. Verify against the vendor's own lifecycle page before
 * a register built from this table goes to a customer.
 */

export type EquipmentCategory = "plc" | "hmi" | "drive";

export interface ObsoleteEntry {
  category: EquipmentCategory;
  /** Substrings to match in the make field (any one is enough) */
  makeParts: string[];
  /** Substrings to match in model or series (any one is enough) */
  modelParts: string[];
  eolYear?: number;
  note: string;
  successor?: string;
}

export const OBSOLETE_EQUIPMENT: ObsoleteEntry[] = [
  // ─── PLC · Allen-Bradley / Rockwell Automation ──────────────────────────────
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["plc-5", "plc5"],
    eolYear: 2018,
    note: "Allen-Bradley PLC-5 discontinued by Rockwell Automation",
    successor: "ControlLogix 5580",
  },
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["slc 5/", "slc-5/", "slc500", "slc-500", "slc 500"],
    eolYear: 2012,
    note: "SLC 500 series discontinued by Rockwell Automation",
    successor: "CompactLogix 5380",
  },
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["micrologix 1000", "1761-l"],
    note: "MicroLogix 1000 discontinued by Rockwell Automation",
    successor: "Micro870",
  },
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["micrologix 1100", "1763-l"],
    note: "MicroLogix 1100 discontinued by Rockwell Automation",
    successor: "Micro820",
  },
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["micrologix 1200", "1762-l"],
    note: "MicroLogix 1200 discontinued by Rockwell Automation",
    successor: "CompactLogix 5380",
  },
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["micrologix 1500", "1764-l"],
    eolYear: 2022,
    note: "MicroLogix 1500 discontinued by Rockwell Automation (2022)",
    successor: "CompactLogix 5380",
  },
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["flexlogix", "1794-l"],
    note: "FlexLogix discontinued by Rockwell Automation",
    successor: "CompactLogix",
  },
  // ─── PLC · Siemens ──────────────────────────────────────────────────────────
  {
    category: "plc",
    makeParts: ["siemens"],
    modelParts: ["simatic s5", "s5-90", "s5-95", "s5-100", "s5-115", "s5-135", "s5-155"],
    note: "SIMATIC S5 series discontinued by Siemens",
    successor: "SIMATIC S7-1500",
  },
  {
    category: "plc",
    makeParts: ["siemens"],
    modelParts: ["s7-200", "simatic s7-200", "cpu 221", "cpu 222", "cpu 224", "cpu 226"],
    eolYear: 2017,
    note: "SIMATIC S7-200 discontinued by Siemens (2017)",
    successor: "SIMATIC S7-1200",
  },
  {
    category: "plc",
    makeParts: ["siemens"],
    modelParts: ["s7-300", "simatic s7-300"],
    eolYear: 2023,
    note: "SIMATIC S7-300 discontinued by Siemens (2023)",
    successor: "SIMATIC S7-1500",
  },
  {
    category: "plc",
    makeParts: ["siemens"],
    modelParts: ["s7-400", "simatic s7-400"],
    eolYear: 2023,
    note: "SIMATIC S7-400 discontinued by Siemens (2023)",
    successor: "SIMATIC S7-1500H",
  },
  // ─── PLC · Mitsubishi Electric ──────────────────────────────────────────────
  {
    category: "plc",
    makeParts: ["mitsubishi"],
    modelParts: ["melsec a", "a1s", "a2s", "a3n", "a0j2", "a2a", "a3a"],
    note: "MELSEC-A series discontinued by Mitsubishi Electric",
    successor: "MELSEC iQ-R",
  },
  {
    category: "plc",
    makeParts: ["mitsubishi"],
    modelParts: ["fx0n", "fx0s", "fx1s", "fx1n"],
    note: "MELSEC FX0/FX1 series discontinued by Mitsubishi Electric",
    successor: "MELSEC-FX5U",
  },
  {
    category: "plc",
    makeParts: ["mitsubishi"],
    modelParts: ["melsec q series", "q02cpu", "q06hcpu", "q12hcpu", "q25hcpu"],
    eolYear: 2026,
    note: "MELSEC-Q series being phased out by Mitsubishi Electric",
    successor: "MELSEC iQ-R",
  },
  // ─── PLC · Schneider Electric / Modicon ─────────────────────────────────────
  {
    category: "plc",
    makeParts: ["schneider", "modicon"],
    modelParts: ["tsx compact", "tsx micro", "tsx premium", "tsx37", "tsx57", "tsx107"],
    note: "TSX series discontinued by Schneider Electric",
    successor: "Modicon M340",
  },
  {
    category: "plc",
    makeParts: ["schneider", "modicon"],
    modelParts: ["modicon 984", "modicon 484", "modicon 884", "pc-e984"],
    note: "Modicon 84x series discontinued by Schneider Electric",
    successor: "Modicon M580",
  },
  {
    category: "plc",
    makeParts: ["schneider", "modicon"],
    modelParts: ["quantum 140cpu"],
    note: "Modicon Quantum discontinued by Schneider Electric",
    successor: "Modicon M580",
  },
  // ─── PLC · GE / Emerson (formerly GE Fanuc) ─────────────────────────────────
  {
    category: "plc",
    makeParts: ["ge ", "ge-", "emerson"],
    modelParts: ["series 90-30", "series 90-70", "ic693", "ic697"],
    note: "GE Series 90 discontinued (now Emerson/PACSystems)",
    successor: "PACSystems RX3i",
  },
  {
    category: "plc",
    makeParts: ["ge ", "ge-", "emerson"],
    modelParts: ["series six", "series one", "ic660"],
    note: "GE Series 1/6 discontinued",
    successor: "PACSystems RX3i",
  },
  // ─── PLC · Omron ────────────────────────────────────────────────────────────
  {
    category: "plc",
    makeParts: ["omron"],
    modelParts: ["c200h", "c200he", "c200hg", "c200hx"],
    note: "OMRON C200H series discontinued",
    successor: "CJ2M / NX1P2",
  },
  {
    category: "plc",
    makeParts: ["omron"],
    modelParts: ["cvm1", "c500", "c1000h", "c2000h", "c60h"],
    note: "OMRON C/CV series discontinued",
    successor: "CJ2H / NX102",
  },
  {
    category: "plc",
    makeParts: ["omron"],
    modelParts: ["sysmac cs1", "cs1g", "cs1h", "cs1d"],
    eolYear: 2022,
    note: "OMRON CS1 series discontinued (2022)",
    successor: "NX1P2 / NX102",
  },
  // ─── PLC · ABB ──────────────────────────────────────────────────────────────
  {
    category: "plc",
    makeParts: ["abb"],
    modelParts: ["ac31", "07 kt", "07 kr", "advant"],
    note: "ABB AC31 / Advant series discontinued",
    successor: "AC500",
  },
  // ─── PLC · Beckhoff ─────────────────────────────────────────────────────────
  {
    category: "plc",
    makeParts: ["beckhoff"],
    modelParts: ["bc9000", "bc9050", "bc9100", "bc9120"],
    note: "Beckhoff BC series Bus Controllers discontinued",
    successor: "CX series / EK series",
  },

  // ─── HMI · Allen-Bradley / Rockwell Automation ──────────────────────────────
  {
    category: "hmi",
    makeParts: ["allen", "rockwell"],
    modelParts: ["panelview standard", "panelview 550", "panelview 600", "panelview 900", "panelview 1000", "panelview 1400", "panelview e"],
    note: "PanelView Standard / PanelView e discontinued by Rockwell Automation",
    successor: "PanelView Plus 7",
  },
  {
    category: "hmi",
    makeParts: ["allen", "rockwell"],
    modelParts: ["panelview plus compact"],
    note: "PanelView Plus Compact discontinued by Rockwell Automation",
    successor: "PanelView Plus 7 Standard",
  },
  {
    category: "hmi",
    makeParts: ["allen", "rockwell"],
    modelParts: ["panelview plus 400", "panelview plus 600", "panelview plus 700", "panelview plus 1000", "panelview plus 1250", "panelview plus 1500"],
    note: "Original PanelView Plus (non-7) terminals discontinued by Rockwell Automation",
    successor: "PanelView Plus 7",
  },
  // ─── HMI · Siemens ──────────────────────────────────────────────────────────
  {
    category: "hmi",
    makeParts: ["siemens"],
    modelParts: ["op 170", "tp 170", "op170", "tp170", "mp 270", "mp 370", "mp270", "mp370", "op 270", "tp 270"],
    note: "SIMATIC OP/TP 170 and MP 270/370 panels discontinued by Siemens",
    successor: "SIMATIC Comfort Panel",
  },

  // ─── Drives · Allen-Bradley / Rockwell Automation ───────────────────────────
  {
    category: "drive",
    makeParts: ["allen", "rockwell"],
    modelParts: ["1336"],
    note: "Allen-Bradley 1336 drive family discontinued by Rockwell Automation",
    successor: "PowerFlex 753 / 755",
  },
  {
    category: "drive",
    makeParts: ["allen", "rockwell"],
    modelParts: ["powerflex 4", "powerflex 40", "powerflex 400", "powerflex 4m"],
    note: "PowerFlex 4-class drives discontinued by Rockwell Automation",
    successor: "PowerFlex 525",
  },
  {
    category: "drive",
    makeParts: ["allen", "rockwell"],
    modelParts: ["powerflex 70", "powerflex 700"],
    note: "PowerFlex 70 / 700 discontinued by Rockwell Automation",
    successor: "PowerFlex 753 / 755",
  },
  {
    category: "drive",
    makeParts: ["allen", "rockwell"],
    modelParts: ["sp600", "sp500", "1305", "1397"],
    note: "Legacy Allen-Bradley drive platform discontinued by Rockwell Automation",
    successor: "PowerFlex 753",
  },
  // ─── Drives · Siemens ───────────────────────────────────────────────────────
  {
    category: "drive",
    makeParts: ["siemens"],
    modelParts: ["micromaster", "mm420", "mm430", "mm440"],
    note: "SIMATIC MICROMASTER 4 series discontinued by Siemens",
    successor: "SINAMICS G120",
  },
  {
    category: "drive",
    makeParts: ["siemens"],
    modelParts: ["simovert", "masterdrive"],
    note: "SIMOVERT MasterDrives discontinued by Siemens",
    successor: "SINAMICS S120",
  },
  // ─── Drives · ABB ───────────────────────────────────────────────────────────
  {
    category: "drive",
    makeParts: ["abb"],
    modelParts: ["acs800"],
    note: "ABB ACS800 discontinued",
    successor: "ACS880",
  },
  {
    category: "drive",
    makeParts: ["abb"],
    modelParts: ["acs550", "acs400", "acs600"],
    note: "ABB ACS400/550/600 discontinued",
    successor: "ACS580",
  },
  // ─── Drives · Danfoss ───────────────────────────────────────────────────────
  {
    category: "drive",
    makeParts: ["danfoss"],
    modelParts: ["vlt 5000", "vlt 6000", "vlt5000", "vlt6000"],
    note: "Danfoss VLT 5000 / 6000 discontinued",
    successor: "VLT AutomationDrive FC 302",
  },
  // ─── Drives · Mitsubishi Electric ───────────────────────────────────────────
  {
    category: "drive",
    makeParts: ["mitsubishi"],
    modelParts: ["fr-a500", "fr-e500", "fr-a520", "fr-a540"],
    note: "Mitsubishi FR-A500 / FR-E500 series discontinued",
    successor: "FR-A800 / FR-E800",
  },
  // ─── Drives · Yaskawa ───────────────────────────────────────────────────────
  {
    category: "drive",
    makeParts: ["yaskawa"],
    modelParts: ["g7", "f7", "v7", "p7"],
    note: "Yaskawa G7 / F7 / V7 / P7 series discontinued",
    successor: "GA800 / GA500",
  },
];

export interface EOLResult {
  obsolete: boolean;
  note?: string;
  successor?: string;
  eolYear?: number;
}

/** Look up a single piece of equipment against the lifecycle table. */
export function checkObsolete(
  category: EquipmentCategory,
  make: string | null | undefined,
  model: string | null | undefined,
  series?: string | null | undefined,
): EOLResult {
  if (!make && !model) return { obsolete: false };

  const normMake = (make ?? "").toLowerCase();
  const normModel = ((model ?? "") + " " + (series ?? "")).toLowerCase().trim();

  for (const entry of OBSOLETE_EQUIPMENT) {
    if (entry.category !== category) continue;

    const makeMatch = entry.makeParts.some((p) => normMake.includes(p.toLowerCase()));
    if (!makeMatch) continue;

    const modelMatch = entry.modelParts.some((p) => normModel.includes(p.toLowerCase()));
    if (!modelMatch) continue;

    return { obsolete: true, note: entry.note, successor: entry.successor, eolYear: entry.eolYear };
  }

  return { obsolete: false };
}

/** Convenience wrapper — PLC lookups are by far the most common. */
export function checkPLCObsolete(
  make: string | null | undefined,
  model: string | null | undefined,
  series?: string | null | undefined,
): EOLResult {
  return checkObsolete("plc", make, model, series);
}

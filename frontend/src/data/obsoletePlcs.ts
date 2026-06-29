/**
 * Vendor-declared end-of-life / discontinued PLC lookup.
 * Matching is substring-based (case-insensitive) on make + model/series combined.
 * Only include products where the vendor has officially announced EOL/discontinuation.
 */

export interface ObsoletePLC {
  /** Substrings to match in the make field (any one is enough) */
  makeParts: string[];
  /** Substrings to match in model or series (any one is enough) */
  modelParts: string[];
  eolYear?: number;
  note: string;
  successor?: string;
}

export const OBSOLETE_PLCS: ObsoletePLC[] = [
  // ─── Allen-Bradley / Rockwell Automation ────────────────────────────────────
  {
    makeParts: ["allen", "rockwell"],
    modelParts: ["plc-5", "plc5"],
    eolYear: 2018,
    note: "Allen-Bradley PLC-5 discontinued by Rockwell Automation",
    successor: "ControlLogix 5580",
  },
  {
    makeParts: ["allen", "rockwell"],
    modelParts: ["slc 5/", "slc-5/", "slc500", "slc-500", "slc 500"],
    eolYear: 2012,
    note: "SLC 500 series discontinued by Rockwell Automation",
    successor: "CompactLogix 5380",
  },
  {
    makeParts: ["allen", "rockwell"],
    modelParts: ["micrologix 1000", "1761-l"],
    note: "MicroLogix 1000 discontinued by Rockwell Automation",
    successor: "Micro870",
  },
  {
    makeParts: ["allen", "rockwell"],
    modelParts: ["micrologix 1100", "1763-l"],
    note: "MicroLogix 1100 discontinued by Rockwell Automation",
    successor: "Micro820",
  },
  {
    makeParts: ["allen", "rockwell"],
    modelParts: ["micrologix 1200", "1762-l"],
    note: "MicroLogix 1200 discontinued by Rockwell Automation",
    successor: "CompactLogix 5380",
  },
  {
    makeParts: ["allen", "rockwell"],
    modelParts: ["micrologix 1500", "1764-l"],
    eolYear: 2022,
    note: "MicroLogix 1500 discontinued by Rockwell Automation (2022)",
    successor: "CompactLogix 5380",
  },
  {
    makeParts: ["allen", "rockwell"],
    modelParts: ["flexlogix", "1794-l"],
    note: "FlexLogix discontinued by Rockwell Automation",
    successor: "CompactLogix",
  },
  // ─── Siemens ────────────────────────────────────────────────────────────────
  {
    makeParts: ["siemens"],
    modelParts: ["simatic s5", "s5-90", "s5-95", "s5-100", "s5-115", "s5-135", "s5-155"],
    note: "SIMATIC S5 series discontinued by Siemens",
    successor: "SIMATIC S7-1500",
  },
  {
    makeParts: ["siemens"],
    modelParts: ["s7-200", "simatic s7-200", "cpu 221", "cpu 222", "cpu 224", "cpu 226"],
    eolYear: 2017,
    note: "SIMATIC S7-200 discontinued by Siemens (2017)",
    successor: "SIMATIC S7-1200",
  },
  {
    makeParts: ["siemens"],
    modelParts: ["s7-300", "simatic s7-300"],
    eolYear: 2023,
    note: "SIMATIC S7-300 discontinued by Siemens (2023)",
    successor: "SIMATIC S7-1500",
  },
  {
    makeParts: ["siemens"],
    modelParts: ["s7-400", "simatic s7-400"],
    eolYear: 2023,
    note: "SIMATIC S7-400 discontinued by Siemens (2023)",
    successor: "SIMATIC S7-1500H",
  },
  // ─── Mitsubishi Electric ────────────────────────────────────────────────────
  {
    makeParts: ["mitsubishi"],
    modelParts: ["melsec a", "a1s", "a2s", "a3n", "a0j2", "a2a", "a3a"],
    note: "MELSEC-A series discontinued by Mitsubishi Electric",
    successor: "MELSEC iQ-R",
  },
  {
    makeParts: ["mitsubishi"],
    modelParts: ["fx0n", "fx0s", "fx1s", "fx1n"],
    note: "MELSEC FX0/FX1 series discontinued by Mitsubishi Electric",
    successor: "MELSEC-FX5U",
  },
  {
    makeParts: ["mitsubishi"],
    modelParts: ["melsec q series", "q02cpu", "q06hcpu", "q12hcpu", "q25hcpu"],
    eolYear: 2026,
    note: "MELSEC-Q series being phased out by Mitsubishi Electric",
    successor: "MELSEC iQ-R",
  },
  // ─── Schneider Electric / Modicon ──────────────────────────────────────────
  {
    makeParts: ["schneider", "modicon"],
    modelParts: ["tsx compact", "tsx micro", "tsx premium", "tsx37", "tsx57", "tsx107"],
    note: "TSX series discontinued by Schneider Electric",
    successor: "Modicon M340",
  },
  {
    makeParts: ["schneider", "modicon"],
    modelParts: ["modicon 984", "modicon 484", "modicon 884", "pc-e984"],
    note: "Modicon 84x series discontinued by Schneider Electric",
    successor: "Modicon M580",
  },
  {
    makeParts: ["schneider", "modicon"],
    modelParts: ["quantum 140cpu"],
    note: "Modicon Quantum discontinued by Schneider Electric",
    successor: "Modicon M580",
  },
  // ─── GE / Emerson (formerly GE Fanuc) ───────────────────────────────────────
  {
    makeParts: ["ge ", "ge-", "emerson"],
    modelParts: ["series 90-30", "series 90-70", "ic693", "ic697"],
    note: "GE Series 90 discontinued (now Emerson/PACSystems)",
    successor: "PACSystems RX3i",
  },
  {
    makeParts: ["ge ", "ge-", "emerson"],
    modelParts: ["series six", "series one", "ic660"],
    note: "GE Series 1/6 discontinued",
    successor: "PACSystems RX3i",
  },
  // ─── Omron ──────────────────────────────────────────────────────────────────
  {
    makeParts: ["omron"],
    modelParts: ["c200h", "c200he", "c200hg", "c200hx"],
    note: "OMRON C200H series discontinued",
    successor: "CJ2M / NX1P2",
  },
  {
    makeParts: ["omron"],
    modelParts: ["cvm1", "c500", "c1000h", "c2000h", "c60h"],
    note: "OMRON C/CV series discontinued",
    successor: "CJ2H / NX102",
  },
  {
    makeParts: ["omron"],
    modelParts: ["sysmac cs1", "cs1g", "cs1h", "cs1d"],
    eolYear: 2022,
    note: "OMRON CS1 series discontinued (2022)",
    successor: "NX1P2 / NX102",
  },
  // ─── ABB ────────────────────────────────────────────────────────────────────
  {
    makeParts: ["abb"],
    modelParts: ["ac31", "07 kt", "07 kr", "advant"],
    note: "ABB AC31 / Advant series discontinued",
    successor: "AC500",
  },
  // ─── Beckhoff ───────────────────────────────────────────────────────────────
  {
    makeParts: ["beckhoff"],
    modelParts: ["bc9000", "bc9050", "bc9100", "bc9120"],
    note: "Beckhoff BC series Bus Controllers discontinued",
    successor: "CX series / EK series",
  },
];

export interface EOLResult {
  obsolete: boolean;
  note?: string;
  successor?: string;
  eolYear?: number;
}

export function checkPLCObsolete(
  make: string | null | undefined,
  model: string | null | undefined,
  series?: string | null | undefined,
): EOLResult {
  if (!make && !model) return { obsolete: false };

  const normMake  = (make  ?? "").toLowerCase();
  const normModel = ((model ?? "") + " " + (series ?? "")).toLowerCase().trim();

  for (const entry of OBSOLETE_PLCS) {
    const makeMatch = entry.makeParts.some((p) => normMake.includes(p.toLowerCase()));
    if (!makeMatch) continue;

    const modelMatch = entry.modelParts.some((p) => normModel.includes(p.toLowerCase()));
    if (!modelMatch) continue;

    return { obsolete: true, note: entry.note, successor: entry.successor, eolYear: entry.eolYear };
  }

  return { obsolete: false };
}

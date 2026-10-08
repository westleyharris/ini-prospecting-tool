/**
 * Vendor lifecycle lookup for control and drive equipment.
 *
 * Matching is token-aware (so "PowerFlex 4" does not flag a PowerFlex 525) and
 * aliases common field shorthand ("AB" → Allen-Bradley). Catalog prefixes such
 * as 1785 / 1771 identify a family even when the marketing name is missing.
 *
 * Status follows the vendor lifecycle language used in customer meetings:
 *   mature        — still shipping, successor exists, plan the change
 *   discontinued  — no new, limited repair, replacement is the conversation
 *   unsupported   — repair closed, broker-only
 *
 * eolYear is the vendor last-ship year (not announcement year). Age scoring
 * in the risk register uses that date, so PLC-5 (2017) outranks SLC 500 (2024)
 * at the same unit count.
 *
 * Dates move. Confirm against the vendor's current lifecycle page before a
 * register built from this table goes to a customer.
 */

export type EquipmentCategory = "plc" | "hmi" | "drive" | "servo";

export type LifecycleStatus = "mature" | "discontinued" | "unsupported";

export interface ObsoleteEntry {
  category: EquipmentCategory;
  /** Substrings to match in the (aliased) make field. Empty = catalog-only. */
  makeParts: string[];
  /** Token sequences or compact catalog strings to match in model/series/part. */
  modelParts: string[];
  /** Compact prefixes unique to this family (1785, 1771, 2098, …). */
  catalogPrefixes?: string[];
  status: LifecycleStatus;
  eolYear?: number;
  note: string;
  successor?: string;
}

export interface AssetRef {
  make?: string | null;
  model?: string | null;
  series?: string | null;
  partNo?: string | null;
  /** Free text (notes, OCR) — used so “PLC-5” typed in notes still matches. */
  extra?: string | null;
}

export interface LifecycleResult {
  /** True when the vendor has stopped the product (discontinued or unsupported). */
  obsolete: boolean;
  status: LifecycleStatus | "unknown";
  note?: string;
  successor?: string;
  eolYear?: number;
  /** Catalog brand, e.g. Allen-Bradley — used when the field entry is shorthand. */
  brand?: string;
  /** Catalog family, e.g. PLC-5 — groups “plc-5”, “PLC-5/20”, and 1785-* together. */
  family?: string;
}

export const LIFECYCLE_META: Record<
  LifecycleStatus,
  { label: string; short: string; ink: string; bg: string; border: string }
> = {
  unsupported:  { label: "Unsupported",  short: "UNSUP", ink: "#7f1d1d", bg: "#fee2e2", border: "#dc2626" },
  discontinued: { label: "Discontinued", short: "EOL",   ink: "#92400e", bg: "#fef3c7", border: "#d97706" },
  mature:       { label: "Mature",       short: "MAT",   ink: "#1e3a5f", bg: "#e8eef5", border: "#64748b" },
};

const STATUS_RANK: Record<LifecycleStatus, number> = {
  unsupported: 3,
  discontinued: 2,
  mature: 1,
};

/** Exact make-field aliases after punctuation is stripped. */
const MAKE_ALIASES: Record<string, string> = {
  ab: "allen bradley",
  "a b": "allen bradley",
  "allen bradley": "allen bradley",
  allenbradley: "allen bradley",
  rockwell: "allen bradley",
  "rockwell automation": "allen bradley",
  "allen bradley rockwell": "allen bradley",
  "a b rockwell": "allen bradley",
  "ge fanuc": "ge",
  "ge automation": "ge",
  "schneider electric": "schneider",
  modicon: "schneider",
  "mitsubishi electric": "mitsubishi",
  "omron corporation": "omron",
  "siemens ag": "siemens",
  "yaskawa electric": "yaskawa",
  "danfoss drives": "danfoss",
  "bosch rexroth": "bosch",
  rexroth: "bosch",
  indramat: "bosch",
  "bosch rexroth indramat": "bosch",
  "sew eurodrive": "sew",
  "fanuc robotics": "fanuc",
  adc: "automationdirect",
  "automation direct": "automationdirect",
  automationdirect: "automationdirect",
  magnetek: "magnetek",
  "magne tek": "magnetek",
};

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function aliasMake(make: string): string {
  const tokens = tokenize(make).join(" ");
  if (!tokens) return "";
  return MAKE_ALIASES[tokens] ?? tokens;
}

/** True when needle tokens appear as a consecutive sequence in haystack. */
function hasTokenSequence(hayTokens: string[], needle: string): boolean {
  const needleTokens = tokenize(needle);
  if (needleTokens.length === 0) return false;
  if (needleTokens.length === 1) {
    const n = needleTokens[0];
    return hayTokens.some((t) => t === n);
  }
  for (let i = 0; i <= hayTokens.length - needleTokens.length; i++) {
    if (needleTokens.every((nt, j) => hayTokens[i + j] === nt)) return true;
  }
  return false;
}

function catalogHit(hayTokens: string[], hayCompact: string, prefixes: string[]): boolean {
  for (const p of prefixes) {
    const pc = compact(p);
    if (!pc || pc.length < 4) continue;
    if (hayTokens.some((t) => t === pc || t.startsWith(pc))) return true;
    const idx = hayCompact.indexOf(pc);
    if (idx === -1) continue;
    const after = hayCompact[idx + pc.length];
    // "1769l32" may hit "1769l32e"; do not let "l33e" eat "l330er"
    if (!after || !/[0-9]/.test(after)) return true;
  }
  return false;
}

function makeHits(aliasedMake: string, makeParts: string[]): boolean {
  if (makeParts.length === 0) return true;
  if (!aliasedMake) return false;
  return makeParts.some((p) => aliasedMake.includes(p.toLowerCase()));
}

function modelHits(hayTokens: string[], modelParts: string[]): boolean {
  return modelParts.some((p) => hasTokenSequence(hayTokens, p));
}

export const OBSOLETE_EQUIPMENT: ObsoleteEntry[] = [
  // ─── PLC · Allen-Bradley / Rockwell ─────────────────────────────────────────
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["plc 2", "plc2", "plc-2"],
    catalogPrefixes: ["1772"],
    status: "unsupported",
    note: "Allen-Bradley PLC-2 is unsupported. Repair is broker-only.",
    successor: "CompactLogix 5380",
  },
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["plc 3", "plc3", "plc-3"],
    catalogPrefixes: ["1775"],
    status: "unsupported",
    note: "Allen-Bradley PLC-3 is unsupported. Repair is broker-only.",
    successor: "ControlLogix 5580",
  },
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["plc 5", "plc5", "plc-5"],
    catalogPrefixes: ["1785"],
    status: "discontinued",
    eolYear: 2017,
    note: "Allen-Bradley PLC-5 last ship June 2017 (Rockwell 1785). Companion software RSLogix 5 reached final lifecycle phase 31 Dec 2025 — no new activations. DH+ / RIO platform.",
    successor: "ControlLogix 5580",
  },
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["1771"],
    catalogPrefixes: ["1771"],
    status: "discontinued",
    eolYear: 2017,
    note: "1771 I/O is the PLC-5 chassis family, last ship with the PLC-5 platform in 2017.",
    successor: "1756 ControlLogix I/O",
  },
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["slc 5", "slc5", "slc-5", "slc 500", "slc500", "slc-500"],
    catalogPrefixes: ["1746", "1747"],
    status: "discontinued",
    eolYear: 2024,
    note: "Allen-Bradley SLC 500 last ship 31 Mar 2024 for remaining 5/03–5/05 processors and 1746 I/O (some 5/01, 5/02, and 5/03 8K SKUs ended earlier). Programmed with RSLogix 500, not RSLogix 5.",
    successor: "CompactLogix 5380",
  },
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["micrologix 1000"],
    catalogPrefixes: ["1761"],
    status: "discontinued",
    eolYear: 2017,
    note: "MicroLogix 1000 last ship May 2017.",
    successor: "Micro870",
  },
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["micrologix 1100"],
    catalogPrefixes: ["1763"],
    status: "discontinued",
    eolYear: 2022,
    note: "MicroLogix 1100 last ship 30 Apr 2022.",
    successor: "Micro820",
  },
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["micrologix 1200"],
    catalogPrefixes: ["1762"],
    status: "discontinued",
    eolYear: 2021,
    note: "MicroLogix 1200 last ship 31 Oct 2021.",
    successor: "CompactLogix 5380",
  },
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["micrologix 1400"],
    catalogPrefixes: ["1766"],
    status: "mature",
    note: "MicroLogix 1400 is Active Mature. Plan migration; successor platforms are shipping.",
    successor: "Micro870 / CompactLogix 5380",
  },
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["micrologix 1500"],
    catalogPrefixes: ["1764"],
    status: "discontinued",
    eolYear: 2017,
    note: "MicroLogix 1500 last ship 30 June 2017.",
    successor: "CompactLogix 5380",
  },
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["flexlogix"],
    catalogPrefixes: ["1794l"],
    status: "discontinued",
    note: "FlexLogix discontinued by Rockwell Automation.",
    successor: "CompactLogix",
  },
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: [
      "l55", "l61", "l62", "l63", "l64", "l65",
      "logix 5550", "logix 5555", "logix 5561", "logix 5563",
      "logix5550", "logix5555", "logix5561", "logix5563",
    ],
    catalogPrefixes: ["1756l55", "1756l61", "1756l62", "1756l63", "1756l64", "1756l65"],
    status: "discontinued",
    note: "ControlLogix L55 / L6x processors are discontinued. Successor is the 5580 (L8x) family.",
    successor: "ControlLogix 5580",
  },
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["l71", "l72", "l73", "l74", "l75"],
    catalogPrefixes: ["1756l71", "1756l72", "1756l73", "1756l74", "1756l75"],
    status: "mature",
    note: "ControlLogix L7x is Active Mature. 5580 is the current platform.",
    successor: "ControlLogix 5580",
  },
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["l23e", "l24e", "l31", "l32e", "l32c", "l35e", "l35k"],
    catalogPrefixes: ["1769l23", "1769l24", "1769l31", "1769l32", "1769l35", "1768"],
    status: "discontinued",
    note: "Early CompactLogix (1769-L3x / 1768) discontinued by Rockwell Automation.",
    successor: "CompactLogix 5380",
  },
  {
    category: "plc",
    makeParts: ["allen", "rockwell"],
    modelParts: ["5370", "l16er", "l18er", "l19er", "l27er", "l30er", "l33er", "l36er"],
    status: "mature",
    note: "CompactLogix 5370 is Active Mature. 5380 is the current platform.",
    successor: "CompactLogix 5380",
  },

  // ─── PLC · Siemens ──────────────────────────────────────────────────────────
  {
    category: "plc",
    makeParts: ["siemens"],
    modelParts: ["simatic s5", "s5 90", "s5 95", "s5 100", "s5 115", "s5 135", "s5 155"],
    status: "unsupported",
    note: "SIMATIC S5 series is unsupported. Successor is S7-1500.",
    successor: "SIMATIC S7-1500",
  },
  {
    category: "plc",
    makeParts: ["siemens"],
    modelParts: ["s7 200", "simatic s7 200", "cpu 221", "cpu 222", "cpu 224", "cpu 226"],
    status: "discontinued",
    eolYear: 2017,
    note: "SIMATIC S7-200 discontinued by Siemens (2017).",
    successor: "SIMATIC S7-1200",
  },
  {
    category: "plc",
    makeParts: ["siemens"],
    modelParts: ["s7 300", "simatic s7 300"],
    status: "discontinued",
    eolYear: 2023,
    note: "SIMATIC S7-300 discontinued by Siemens (2023).",
    successor: "SIMATIC S7-1500",
  },
  {
    category: "plc",
    makeParts: ["siemens"],
    modelParts: ["s7 400", "simatic s7 400"],
    status: "discontinued",
    eolYear: 2023,
    note: "SIMATIC S7-400 discontinued by Siemens (2023).",
    successor: "SIMATIC S7-1500H",
  },
  {
    category: "plc",
    makeParts: ["siemens", "texas", "ti "],
    modelParts: ["ti 505", "505 1101", "505 1102", "simatic 505"],
    status: "unsupported",
    note: "TI / SIMATIC 505 platform is unsupported.",
    successor: "SIMATIC S7-1500",
  },

  // ─── PLC · Mitsubishi ───────────────────────────────────────────────────────
  {
    category: "plc",
    makeParts: ["mitsubishi"],
    modelParts: ["melsec a", "a1s", "a2s", "a3n", "a0j2", "a2a", "a3a"],
    status: "discontinued",
    note: "MELSEC-A series discontinued by Mitsubishi Electric.",
    successor: "MELSEC iQ-R",
  },
  {
    category: "plc",
    makeParts: ["mitsubishi"],
    modelParts: ["fx0n", "fx0s", "fx1s", "fx1n"],
    status: "discontinued",
    note: "MELSEC FX0/FX1 series discontinued by Mitsubishi Electric.",
    successor: "MELSEC-FX5U",
  },
  {
    category: "plc",
    makeParts: ["mitsubishi"],
    modelParts: ["melsec q", "q02cpu", "q06hcpu", "q12hcpu", "q25hcpu", "q series"],
    status: "mature",
    eolYear: 2026,
    note: "MELSEC-Q series is being phased out by Mitsubishi Electric.",
    successor: "MELSEC iQ-R",
  },

  // ─── PLC · Schneider / Modicon ──────────────────────────────────────────────
  {
    category: "plc",
    makeParts: ["schneider", "modicon"],
    modelParts: ["tsx compact", "tsx micro", "tsx premium", "tsx37", "tsx57", "tsx107"],
    status: "discontinued",
    note: "TSX series discontinued by Schneider Electric.",
    successor: "Modicon M340",
  },
  {
    category: "plc",
    makeParts: ["schneider", "modicon"],
    modelParts: ["modicon 984", "modicon 484", "modicon 884", "modicon 584", "pc e984"],
    status: "unsupported",
    note: "Classic Modicon 584/884/984 series is unsupported.",
    successor: "Modicon M580",
  },
  {
    category: "plc",
    makeParts: ["schneider", "modicon"],
    modelParts: ["quantum", "140cpu"],
    status: "discontinued",
    note: "Modicon Quantum discontinued by Schneider Electric.",
    successor: "Modicon M580",
  },
  {
    category: "plc",
    makeParts: ["schneider", "modicon", "square"],
    modelParts: ["momentum", "sy max", "symax"],
    status: "discontinued",
    note: "Modicon Momentum / Square D Sy/Max discontinued.",
    successor: "Modicon M580",
  },

  // ─── PLC · GE / Emerson ─────────────────────────────────────────────────────
  {
    category: "plc",
    makeParts: ["ge", "emerson"],
    modelParts: ["series 90 30", "series 90 70", "90 30", "90 70", "ic693", "ic697"],
    status: "discontinued",
    note: "GE Series 90 discontinued (now Emerson / PACSystems).",
    successor: "PACSystems RX3i",
  },
  {
    category: "plc",
    makeParts: ["ge", "emerson"],
    modelParts: ["series six", "series one", "ic660"],
    status: "unsupported",
    note: "GE Series 1/6 is unsupported.",
    successor: "PACSystems RX3i",
  },

  // ─── PLC · Omron / ABB / Beckhoff / others ──────────────────────────────────
  {
    category: "plc",
    makeParts: ["omron"],
    modelParts: ["c200h", "c200he", "c200hg", "c200hx"],
    status: "discontinued",
    note: "OMRON C200H series discontinued.",
    successor: "CJ2M / NX1P2",
  },
  {
    category: "plc",
    makeParts: ["omron"],
    modelParts: ["cvm1", "c500", "c1000h", "c2000h", "c60h"],
    status: "unsupported",
    note: "OMRON C/CV series is unsupported.",
    successor: "CJ2H / NX102",
  },
  {
    category: "plc",
    makeParts: ["omron"],
    modelParts: ["sysmac cs1", "cs1g", "cs1h", "cs1d"],
    status: "discontinued",
    eolYear: 2022,
    note: "OMRON CS1 series discontinued (2022).",
    successor: "NX1P2 / NX102",
  },
  {
    category: "plc",
    makeParts: ["abb"],
    modelParts: ["ac31", "07 kt", "07 kr", "advant"],
    status: "discontinued",
    note: "ABB AC31 / Advant series discontinued.",
    successor: "AC500",
  },
  {
    category: "plc",
    makeParts: ["beckhoff"],
    modelParts: ["bc9000", "bc9050", "bc9100", "bc9120"],
    status: "discontinued",
    note: "Beckhoff BC series Bus Controllers discontinued.",
    successor: "CX series / EK series",
  },

  // ─── PLC · AutomationDirect ─────────────────────────────────────────────────
  // Productivity3000 as a family is still shipping (P3-622). Only retired CPUs.
  {
    category: "plc",
    makeParts: ["automationdirect"],
    modelParts: ["p3 550", "p3550"],
    status: "discontinued",
    eolYear: 2023,
    note: "AutomationDirect Productivity3000 P3-550 retired June 2023. P3-550E was the drop-in; P3-622 is the current CPU.",
    successor: "Productivity3000 P3-622",
  },
  {
    category: "plc",
    makeParts: ["automationdirect"],
    modelParts: ["p3 550e", "p3550e"],
    status: "mature",
    note: "AutomationDirect Productivity3000 P3-550E is last-time-buy (discontinued once stock is gone). P3-622 is the current CPU.",
    successor: "Productivity3000 P3-622",
  },
  {
    category: "plc",
    makeParts: ["automationdirect"],
    modelParts: ["p3 530", "p3530"],
    status: "mature",
    note: "AutomationDirect Productivity3000 P3-530 is last-time-buy (discontinued once stock is gone).",
    successor: "Productivity3000 P3-622",
  },

  // ─── HMI · Allen-Bradley ────────────────────────────────────────────────────
  {
    category: "hmi",
    makeParts: ["allen", "rockwell"],
    modelParts: [
      "panelview standard", "panelview 300", "panelview 550", "panelview 600",
      "panelview 900", "panelview 1000", "panelview 1400", "panelview e",
    ],
    catalogPrefixes: ["2711t", "2711b", "2711k", "2711o"],
    status: "discontinued",
    note: "PanelView Standard / PanelView e discontinued by Rockwell Automation.",
    successor: "PanelView Plus 7",
  },
  {
    category: "hmi",
    makeParts: ["allen", "rockwell"],
    modelParts: ["panelview component", "pv component", "c200", "c300", "c400", "c600", "c1000"],
    catalogPrefixes: ["2711c"],
    status: "discontinued",
    note: "PanelView Component discontinued by Rockwell Automation.",
    successor: "PanelView 800 / PanelView Plus 7 Standard",
  },
  {
    category: "hmi",
    makeParts: ["allen", "rockwell"],
    modelParts: ["panelview plus compact"],
    catalogPrefixes: ["2711pc"],
    status: "discontinued",
    eolYear: 2021,
    note: "PanelView Plus Compact last ship 30 Sep 2021 (2711PC).",
    successor: "PanelView Plus 7 Standard",
  },
  {
    category: "hmi",
    makeParts: ["allen", "rockwell"],
    modelParts: [
      "panelview plus 400", "panelview plus 600", "panelview plus 700",
      "panelview plus 1000", "panelview plus 1250", "panelview plus 1500",
    ],
    status: "discontinued",
    note: "Original PanelView Plus (non-6 / non-7) terminals discontinued by Rockwell Automation.",
    successor: "PanelView Plus 7",
  },
  {
    category: "hmi",
    makeParts: ["allen", "rockwell"],
    modelParts: ["panelview plus 6", "plus 6", "pv plus 6"],
    status: "discontinued",
    eolYear: 2021,
    note: "PanelView Plus 6 last ship 30 Sep 2021 for Compact and most 700–1500 terminals (some SKUs 2022). Successor is PanelView Plus 7.",
    successor: "PanelView Plus 7",
  },

  // ─── HMI · Siemens / Schneider / Pro-face / others ──────────────────────────
  {
    category: "hmi",
    makeParts: ["siemens"],
    modelParts: [
      "op 170", "tp 170", "op170", "tp170", "mp 270", "mp 370", "mp270", "mp370",
      "op 270", "tp 270", "op 177", "tp 177", "mp 277", "mp 377",
    ],
    status: "discontinued",
    note: "SIMATIC OP/TP 170–177 and MP 270–377 panels discontinued by Siemens.",
    successor: "SIMATIC Unified Comfort Panel",
  },
  {
    category: "hmi",
    makeParts: ["schneider", "modicon"],
    modelParts: ["magelis xbt", "xbtn", "xbtr", "xbt gt", "xbtgk"],
    status: "discontinued",
    note: "Magelis XBT series discontinued by Schneider Electric.",
    successor: "Harmony GTU / Harmony iPC",
  },
  {
    category: "hmi",
    makeParts: ["proface", "pro-face", "pro face", "schneider"],
    modelParts: ["gp2000", "gp 2000", "gp3000", "gp 3000", "gp4000", "gp 4000"],
    status: "discontinued",
    note: "Pro-face GP2000/3000/4000 series discontinued.",
    successor: "Pro-face SP5000 / Harmony",
  },
  {
    category: "hmi",
    makeParts: ["red lion"],
    modelParts: ["g3"],
    status: "discontinued",
    note: "Red Lion G3 HMI series discontinued.",
    successor: "Red Lion CR3000 / Graphite",
  },
  {
    category: "hmi",
    makeParts: ["ge", "emerson"],
    modelParts: ["quickpanel"],
    status: "discontinued",
    note: "GE QuickPanel discontinued.",
    successor: "Emerson QuickPanel+ / PAC Machine Edition",
  },

  // ─── Drives · Allen-Bradley ─────────────────────────────────────────────────
  {
    category: "drive",
    makeParts: ["allen", "rockwell"],
    modelParts: ["1336"],
    catalogPrefixes: ["1336"],
    status: "discontinued",
    note: "Allen-Bradley 1336 drive family discontinued by Rockwell Automation.",
    successor: "PowerFlex 753 / 755",
  },
  {
    category: "drive",
    makeParts: ["allen", "rockwell"],
    modelParts: ["1305", "1397", "160 ssc", "160ssc"],
    catalogPrefixes: ["1305", "1397"],
    status: "discontinued",
    note: "Legacy Allen-Bradley 1305 / 1397 / 160 SSC drive platform discontinued.",
    successor: "PowerFlex 525",
  },
  {
    category: "drive",
    makeParts: ["allen", "rockwell"],
    modelParts: ["powerflex 4", "powerflex 40", "powerflex 400", "powerflex 4m"],
    status: "discontinued",
    note: "PowerFlex 4-class drives discontinued by Rockwell Automation.",
    successor: "PowerFlex 525",
  },
  {
    category: "drive",
    makeParts: ["allen", "rockwell"],
    modelParts: ["powerflex 40p", "powerflex40p", "pf 40p", "40p", "22d"],
    status: "discontinued",
    eolYear: 2025,
    note: "Allen-Bradley PowerFlex 40P (catalog 22D) last ship 30 June 2025. Successor is PowerFlex 525.",
    successor: "PowerFlex 525",
  },
  {
    category: "drive",
    makeParts: ["allen", "rockwell"],
    modelParts: ["powerflex 70", "powerflex 700", "powerflex 700h", "powerflex 700s"],
    status: "discontinued",
    note: "PowerFlex 70 / 700 / 700H / 700S discontinued by Rockwell Automation.",
    successor: "PowerFlex 753 / 755",
  },
  {
    category: "drive",
    makeParts: ["allen", "rockwell"],
    modelParts: ["sp600", "sp500"],
    status: "discontinued",
    note: "Allen-Bradley SP500 / SP600 drive platform discontinued.",
    successor: "PowerFlex 753",
  },

  // ─── Drives · Siemens / ABB / Danfoss / others ──────────────────────────────
  {
    category: "drive",
    makeParts: ["siemens"],
    modelParts: ["micromaster", "mm420", "mm430", "mm440"],
    status: "discontinued",
    note: "MICROMASTER 4 series discontinued by Siemens.",
    successor: "SINAMICS G120",
  },
  {
    category: "drive",
    makeParts: ["siemens"],
    modelParts: ["simovert", "masterdrive"],
    status: "discontinued",
    note: "SIMOVERT MasterDrives discontinued by Siemens.",
    successor: "SINAMICS S120",
  },
  {
    category: "drive",
    makeParts: ["abb"],
    modelParts: ["acs800"],
    status: "discontinued",
    note: "ABB ACS800 discontinued.",
    successor: "ACS880",
  },
  {
    category: "drive",
    makeParts: ["abb"],
    modelParts: ["acs550", "acs400", "acs600", "acs310", "acs350"],
    status: "discontinued",
    note: "ABB ACS310/350/400/550/600 discontinued.",
    successor: "ACS580",
  },
  {
    category: "drive",
    makeParts: ["danfoss"],
    modelParts: ["vlt 5000", "vlt 6000", "vlt5000", "vlt6000", "vlt 2800", "vlt2800"],
    status: "discontinued",
    note: "Danfoss VLT 2800 / 5000 / 6000 discontinued.",
    successor: "VLT AutomationDrive FC 302",
  },
  {
    category: "drive",
    makeParts: ["mitsubishi"],
    modelParts: ["fr a500", "fr e500", "fr a520", "fr a540", "fr a700", "fr e700"],
    status: "discontinued",
    note: "Mitsubishi FR-A500/A700 / FR-E500/E700 series discontinued.",
    successor: "FR-A800 / FR-E800",
  },
  {
    category: "drive",
    makeParts: ["yaskawa"],
    modelParts: ["g7", "f7", "v7", "p7", "a1000"],
    status: "discontinued",
    note: "Yaskawa G7 / F7 / V7 / P7 / A1000 series discontinued or superseded.",
    successor: "GA800 / GA500",
  },
  {
    category: "drive",
    makeParts: ["magnetek", "yaskawa"],
    modelParts: ["gpd515", "gpd 515", "gpd515c"],
    catalogPrefixes: ["gpd515"],
    status: "discontinued",
    note: "Magnetek GPD515 is the Yaskawa G5 platform. Yaskawa lists it as legacy and no longer promoted in the Americas. Current replacement is GA800.",
    successor: "Yaskawa GA800",
  },
  {
    category: "drive",
    makeParts: ["schneider"],
    modelParts: ["altivar 28", "altivar 31", "altivar 58", "altivar 61", "altivar 71", "atv28", "atv31", "atv58", "atv61", "atv71"],
    status: "discontinued",
    note: "Schneider Altivar 28/31/58/61/71 discontinued.",
    successor: "Altivar Process / Altivar Machine",
  },
  {
    category: "drive",
    makeParts: ["schneider"],
    modelParts: ["altivar 312", "atv312", "atv 312"],
    catalogPrefixes: ["atv312"],
    status: "discontinued",
    eolYear: 2017,
    note: "Schneider Electric Altivar 312 (ATV312) was obsoleted in 2017. Replacement is Altivar Machine ATV320.",
    successor: "Altivar 320 (ATV320)",
  },
  {
    category: "drive",
    makeParts: ["schneider"],
    modelParts: ["altivar 32", "atv32", "atv 32"],
    catalogPrefixes: ["atv32h"],
    status: "discontinued",
    eolYear: 2017,
    note: "Schneider Electric Altivar 32 (ATV32) was obsoleted in 2017. Replacement is Altivar Machine ATV320.",
    successor: "Altivar 320 (ATV320)",
  },
  {
    category: "drive",
    makeParts: ["sew"],
    modelParts: ["movitrac", "movidrive b"],
    status: "mature",
    note: "SEW Movitrac / Movidrive B is mature. Current platform is MOVI-C.",
    successor: "MOVI-C / Movidrive modular",
  },
  {
    category: "drive",
    makeParts: ["lenze"],
    modelParts: ["8200", "9300"],
    status: "discontinued",
    note: "Lenze 8200 / 9300 drive series discontinued.",
    successor: "Lenze i500 / i700",
  },

  // ─── Drives · AutomationDirect ──────────────────────────────────────────────
  // GS4 / GS10 / GS20 / GS21 / GS23 are current. Token match is exact (gs2 ≠ gs20).
  {
    category: "drive",
    makeParts: ["automationdirect"],
    modelParts: ["gs2", "gs2 drive"],
    status: "discontinued",
    eolYear: 2021,
    note: "AutomationDirect GS2 AC micro drive is discontinued (ADC retired the series 2020–2021). Replacement is DURApulse GS20 / GS21.",
    successor: "DURApulse GS20 / GS21",
  },
  {
    category: "drive",
    makeParts: ["automationdirect"],
    modelParts: ["gs1", "gs1 drive"],
    status: "discontinued",
    eolYear: 2022,
    note: "AutomationDirect GS1 AC micro drive is discontinued (retired 2022). Replacement is DURApulse GS10 / GS11.",
    successor: "DURApulse GS10 / GS11",
  },
  {
    category: "drive",
    makeParts: ["automationdirect"],
    modelParts: ["gs3", "gs3 drive"],
    status: "discontinued",
    eolYear: 2023,
    note: "AutomationDirect DURApulse GS3 is discontinued (retired 2023). Replacement is GS20 / GS33 depending on rating.",
    successor: "DURApulse GS20 / GS33",
  },

  // ─── Servo · Allen-Bradley ──────────────────────────────────────────────────
  {
    category: "servo",
    makeParts: ["allen", "rockwell"],
    modelParts: ["ultra 100", "ultra 200", "ultra 3000", "ultra 5000", "ultra3000"],
    catalogPrefixes: ["2098"],
    status: "discontinued",
    note: "Allen-Bradley Ultra servo family discontinued by Rockwell Automation.",
    successor: "Kinetix 5300 / 5500",
  },
  {
    category: "servo",
    makeParts: ["allen", "rockwell"],
    modelParts: ["1394", "gmc"],
    catalogPrefixes: ["1394"],
    status: "unsupported",
    note: "1394 GMC multi-axis servo is unsupported.",
    successor: "Kinetix 5700",
  },
  {
    category: "servo",
    makeParts: ["allen", "rockwell"],
    modelParts: ["kinetix 6000", "kinetix 6200", "kinetix 6500"],
    catalogPrefixes: ["2094"],
    status: "discontinued",
    note: "Kinetix 6000 / 6200 / 6500 discontinued by Rockwell Automation.",
    successor: "Kinetix 5700",
  },
  {
    category: "servo",
    makeParts: ["allen", "rockwell"],
    modelParts: ["kinetix 2000"],
    status: "discontinued",
    note: "Kinetix 2000 discontinued by Rockwell Automation.",
    successor: "Kinetix 5300",
  },
  {
    category: "servo",
    makeParts: ["allen", "rockwell"],
    modelParts: ["kinetix 300", "kinetix 350"],
    catalogPrefixes: ["2093", "2097"],
    status: "discontinued",
    note: "Kinetix 300 / 350 discontinued by Rockwell Automation.",
    successor: "Kinetix 5100 / 5300",
  },
  {
    category: "servo",
    makeParts: ["allen", "rockwell"],
    modelParts: ["1326"],
    catalogPrefixes: ["1326"],
    status: "discontinued",
    note: "1326 servo motor family is discontinued. Mechanical fit must be confirmed.",
    successor: "VPL / VPF / MPL (application dependent)",
  },

  // ─── Servo · Yaskawa / Fanuc / Siemens / Mitsubishi / Bosch ─────────────────
  {
    category: "servo",
    makeParts: ["yaskawa"],
    modelParts: ["sgdh", "sgdm", "sgdv", "sigma 2", "sigma 3", "sigma 5", "sigma-5"],
    status: "mature",
    note: "Yaskawa Sigma-II / III / 5 are mature. Sigma-7 / Sigma-X is current.",
    successor: "Sigma-7 / Sigma-X",
  },
  {
    category: "servo",
    makeParts: ["fanuc"],
    modelParts: ["alpha", "a06b", "beta i", "ai s"],
    status: "mature",
    note: "Older Fanuc α / β i servo generations are mature. Confirm against Fanuc lifecycle.",
    successor: "Fanuc αi-B / βi-B current series",
  },
  {
    category: "servo",
    makeParts: ["siemens"],
    modelParts: ["simodrive", "masterdrive mc"],
    status: "discontinued",
    note: "SIMODRIVE / Masterdrive MC discontinued by Siemens.",
    successor: "SINAMICS S120",
  },
  {
    category: "servo",
    makeParts: ["mitsubishi"],
    modelParts: ["mr j2", "mr-j2", "mr j3", "mr-j3"],
    status: "discontinued",
    note: "Mitsubishi MR-J2 / MR-J3 servo discontinued.",
    successor: "MR-J5",
  },
  {
    category: "servo",
    makeParts: ["bosch", "rexroth", "indramat"],
    modelParts: [
      "ecodrive03", "ecodrive 03", "eco drive 03", "eco drive03",
      "dkc03", "dkc 03",
    ],
    catalogPrefixes: ["ecodrive03", "dkc03"],
    status: "discontinued",
    note: "Bosch Rexroth / Indramat EcoDrive 03 (DKC) is in sales phase-out. New units are last-time-buy / surplus; factory repair still exists. Current platform is IndraDrive Cs / ctrlX DRIVE.",
    successor: "IndraDrive Cs / ctrlX DRIVE",
  },
  {
    category: "servo",
    makeParts: ["bosch", "rexroth"],
    modelParts: ["indradrive c", "eco drive"],
    status: "mature",
    note: "Bosch Rexroth IndraDrive C / later EcoDrive is mature. Current compact platform is IndraDrive Cs.",
    successor: "IndraDrive Cs / Mi",
  },
];

function haystackOf(asset: AssetRef): { tokens: string[]; compact: string; aliasedMake: string } {
  const aliasedMake = aliasMake(asset.make ?? "");
  const raw = [aliasedMake, asset.model, asset.series, asset.partNo, asset.extra].filter(Boolean).join(" ");
  return { tokens: tokenize(raw), compact: compact(raw), aliasedMake };
}

function distinctiveModel(entry: ObsoleteEntry): boolean {
  return entry.modelParts.some((p) => compact(p).length >= 4 || tokenize(p).length >= 2);
}

function entryMatches(entry: ObsoleteEntry, hay: ReturnType<typeof haystackOf>): boolean {
  if (catalogHit(hay.tokens, hay.compact, entry.catalogPrefixes ?? [])) {
    // Catalog numbers are family-unique; still require make when one was entered
    // so an unrelated "1771" scribble on a Siemens panel does not false-hit.
    if (!hay.aliasedMake) return true;
    if (entry.makeParts.length === 0) return true;
    return makeHits(hay.aliasedMake, entry.makeParts);
  }

  const models = modelHits(hay.tokens, entry.modelParts);
  if (!models) return false;

  if (makeHits(hay.aliasedMake, entry.makeParts)) return true;

  // PLC-5, SLC 500, etc. are unique families. A junk OCR make (or "plc-5" typed
  // into Make) must not hide a match the drawing already flagged as EOL.
  if (distinctiveModel(entry)) return true;

  if (!hay.aliasedMake) {
    return entry.modelParts.some((p) => compact(p).length >= 4 || tokenize(p).length >= 2);
  }
  return false;
}

function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function entryBrand(entry: ObsoleteEntry): string {
  const parts = entry.makeParts.map((p) => p.toLowerCase());
  if (parts.some((p) => p === "allen" || p === "rockwell")) return "Allen-Bradley";
  if (parts.some((p) => p === "ge")) return "GE";
  if (parts.some((p) => p === "bosch" || p === "rexroth")) return "Bosch Rexroth";
  if (parts.some((p) => p === "automationdirect")) return "AutomationDirect";
  if (parts.some((p) => p === "magnetek")) return "Magnetek";
  if (parts[0]) return titleCase(parts[0]);
  return "";
}

function entryFamily(entry: ObsoleteEntry): string {
  const parts = [...entry.modelParts].sort((a, b) => b.length - a.length);
  const tokens = tokenize(parts[0] ?? "");
  if (tokens[0] === "plc" && tokens[1]) return `PLC-${tokens[1].toUpperCase()}`;
  if (tokens[0] === "slc") return ["SLC", ...tokens.slice(1).map((t) => t.toUpperCase())].join(" ");
  if (tokens[0] === "p3" && tokens[1]) return `P3-${tokens[1].toUpperCase()}`;
  if (tokens[0] === "gpd" && tokens[1]) return `GPD ${tokens[1].toUpperCase()}`;
  if (tokens[0] === "eco" && tokens[1] === "drive") {
    return ["EcoDrive", ...tokens.slice(2).map((t) => t.toUpperCase())].join(" ");
  }
  if (/^gs[123]$/.test(tokens[0] ?? "")) return tokens[0].toUpperCase();
  if (tokens.length === 0) return (entry.catalogPrefixes?.[0] ?? "").toUpperCase();
  return tokens.map((t) => (/\d/.test(t) ? t.toUpperCase() : titleCase(t))).join(" ");
}

function toResult(entry: ObsoleteEntry): LifecycleResult {
  return {
    obsolete: entry.status === "discontinued" || entry.status === "unsupported",
    status: entry.status,
    note: entry.note,
    successor: entry.successor,
    eolYear: entry.eolYear,
    brand: entryBrand(entry),
    family: entryFamily(entry),
  };
}

const UNKNOWN: LifecycleResult = { obsolete: false, status: "unknown" };

/** Look up a single asset against the lifecycle table. */
export function checkAsset(category: EquipmentCategory, asset: AssetRef): LifecycleResult {
  const hasAny = Boolean(asset.make || asset.model || asset.series || asset.partNo || asset.extra);
  if (!hasAny) return UNKNOWN;

  const hay = haystackOf(asset);
  let best: ObsoleteEntry | undefined;

  for (const entry of OBSOLETE_EQUIPMENT) {
    if (entry.category !== category) continue;
    if (!entryMatches(entry, hay)) continue;
    if (!best || STATUS_RANK[entry.status] > STATUS_RANK[best.status]) best = entry;
  }

  return best ? toResult(best) : UNKNOWN;
}

/** @deprecated use checkAsset — kept for call sites that pass positional args. */
export function checkObsolete(
  category: EquipmentCategory,
  make: string | null | undefined,
  model: string | null | undefined,
  series?: string | null | undefined,
  partNo?: string | null | undefined,
): LifecycleResult {
  return checkAsset(category, { make, model, series, partNo });
}

export function checkPLCObsolete(
  make: string | null | undefined,
  model: string | null | undefined,
  series?: string | null | undefined,
  partNo?: string | null | undefined,
): LifecycleResult {
  return checkAsset("plc", { make, model, series, partNo });
}

export type EOLResult = LifecycleResult;

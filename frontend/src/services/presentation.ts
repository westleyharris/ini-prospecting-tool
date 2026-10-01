import PptxGenJS from "pptxgenjs";
import type { Mapping, MappingMachine } from "../api/mappings";
import { photoUrl } from "../api/mappings";
import { buildRiskRegister, type RiskFinding } from "../data/riskRegister";
import { buildOpportunityRegister } from "../data/opportunityRegister";
import { assessMachine, buildPlantNarrative } from "../data/machineAssessment";
import { FLAG_DEFS } from "../data/observations";
import { machineTag } from "../data/consolidateMappings";
import {
  pickCriticalExamples, pickThemeExamples, FLOOR_OFFERS, ALSO_ON_THE_FLOOR, SCADA_PAYOFFS,
} from "../data/deckOffers";

/**
 * Automation Report deck generator.
 *
 * Design follows the I&I Automation company profile deck: navy/lime palette,
 * left lime stripe, eyebrow + title + short lime underline, logo top-right,
 * Content structure: title → what we found → executive summary → dual
 * justification → lifecycle risk → opportunity map → equipment detail
 * (today vs possible) → phased roadmap → contact.
 */

// ─── Brand ────────────────────────────────────────────────────────────────────
const NAVY = "050A3C";
const LIME = "7DFF00";
const WHITE = "FFFFFF";
const INK = "111111";
const GREY = "6B7280";
const PALE = "DDEAF5";
const CARD = "F3F4F6";

const FONT = "Aptos";
const FONT_FALLBACK = "Calibri";

// Canvas: 13.33 x 7.5
const H = 7.5;

// Shared geometry lifted from the profile deck
const STRIPE_W = 0.16;
const MARGIN_L = 0.65;
const BODY_L = 0.78;
const EYEBROW_T = 0.32;
const TITLE_T = 0.62;
const RULE_T = 1.24;
const CONTENT_T = 1.62;
const PAGENO_T = 7.02;

export interface DeckImages {
  /** White-on-navy logo, base64 data URI */
  logoWhite?: string;
  /** Dark logo for light slides, base64 data URI */
  logoDark?: string;
  /** Mapping photo id → base64 data URI */
  photos: Record<string, string>;
  /** Reference stock photos keyed by deck-refs filename stem (estop, scada, …) */
  refs?: Record<string, string>;
}

export interface DeckOptions {
  mapping: Mapping;
  images: DeckImages;
  /** Overrides the auto-generated executive summary if supplied */
  summary?: string;
  preparedFor?: string;
}

type Theme = "light" | "dark";

function fmtDate(d = new Date()): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/** Every content slide shares this chrome. */
function frame(
  pptx: PptxGenJS,
  opts: { eyebrow: string; title: string; theme: Theme; pageNo: number; images: DeckImages }
) {
  const { eyebrow, title, theme, pageNo, images } = opts;
  const dark = theme === "dark";
  const slide = pptx.addSlide();

  slide.background = { color: dark ? NAVY : WHITE };

  // Left brand stripe
  slide.addShape("rect", { x: 0, y: 0, w: STRIPE_W, h: H, fill: { color: LIME }, line: { width: 0 } });

  slide.addText(eyebrow.toUpperCase(), {
    x: MARGIN_L, y: EYEBROW_T, w: 6.0, h: 0.28,
    fontFace: FONT, fontSize: 8.5, bold: true, charSpacing: 1.2,
    color: dark ? PALE : GREY, margin: 0, valign: "middle",
  });

  slide.addText(title, {
    x: MARGIN_L, y: TITLE_T, w: 9.4, h: 0.58,
    fontFace: FONT, fontSize: 30, bold: true,
    color: dark ? WHITE : NAVY, margin: 0, valign: "middle",
  });

  // Short lime rule under the title
  slide.addShape("rect", {
    x: MARGIN_L, y: RULE_T, w: 1.15, h: 0.05,
    fill: { color: LIME }, line: { width: 0 },
  });

  const logo = dark ? images.logoWhite : images.logoDark;
  if (logo) {
    slide.addImage({ data: logo, x: 11.55, y: 0.26, w: 1.05, h: 1.0, sizing: { type: "contain", w: 1.05, h: 1.0 } });
  }

  slide.addText(String(pageNo).padStart(2, "0"), {
    x: 12.28, y: PAGENO_T, w: 0.5, h: 0.2,
    fontFace: FONT, fontSize: 8, color: dark ? PALE : GREY,
    align: "right", margin: 0,
  });

  return slide;
}

function statTile(
  slide: PptxGenJS.Slide,
  x: number, y: number, w: number,
  value: string, label: string,
  theme: Theme,
) {
  const dark = theme === "dark";
  slide.addText(value, {
    x, y, w, h: 0.72,
    fontFace: FONT, fontSize: 44, bold: true,
    color: dark ? LIME : NAVY, align: "center", margin: 0, valign: "middle",
  });
  slide.addText(label.toUpperCase(), {
    x, y: y + 0.74, w, h: 0.24,
    fontFace: FONT, fontSize: 9, bold: true, charSpacing: 1.1,
    color: dark ? PALE : GREY, align: "center", margin: 0,
  });
}

// ─── Deck ─────────────────────────────────────────────────────────────────────

// pptxgenjs resolves to the ESM build under Vite and the CJS build under Node,
// which nests the constructor on .default. Accept either.
const Pptx = ((PptxGenJS as unknown as { default?: typeof PptxGenJS }).default ??
  PptxGenJS) as typeof PptxGenJS;

export async function buildPresentation({ mapping, images, summary, preparedFor }: DeckOptions) {
  const pptx = new Pptx();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  pptx.author = "I&I Automation";
  // pptxgenjs escapes author/title but writes `company` straight into
  // docProps/app.xml, so a raw "&" there produces invalid XML. Pre-escape it.
  pptx.company = "I&amp;I Automation";
  pptx.title = `Automation Report — ${mapping.plant_name ?? mapping.name}`;

  const machines = mapping.machines ?? [];
  const register = buildRiskRegister(mapping);
  const opportunities = buildOpportunityRegister(mapping);
  const narrative = buildPlantNarrative(mapping);
  const assessments = machines.map(assessMachine);
  const plant = mapping.plant_name ?? "Plant";
  const location = [mapping.city, mapping.state].filter(Boolean).join(", ");
  const lines = mapping.source_lines;
  const lineCount = lines?.length ?? 0;
  const multiLine = lineCount > 1;
  const totalPhotos = machines.reduce((s, m) => s + (m.photos ?? []).length, 0);
  const plcCount = machines.filter((m) => m.plc_make || m.plc_model).length;
  const driveCount = machines.filter((m) => m.vfd_make || m.servo_drive_make).length;

  const photoOf = (m: MappingMachine): string | undefined => {
    for (const p of m.photos ?? []) {
      const d = images.photos[p.id];
      if (d) return d;
    }
    return undefined;
  };

  let page = 1;

  // ══ 1 · Title ══════════════════════════════════════════════════════════════
  {
    const s = pptx.addSlide();
    s.background = { color: NAVY };
    s.addShape("rect", { x: 0, y: 0, w: STRIPE_W, h: H, fill: { color: LIME }, line: { width: 0 } });

    if (images.logoWhite) {
      s.addImage({ data: images.logoWhite, x: 0.9, y: 0.8, w: 2.6, h: 2.3, sizing: { type: "contain", w: 2.6, h: 2.3 } });
    }

    s.addText("AUTOMATION REPORT", {
      x: 0.9, y: 3.6, w: 6.6, h: 0.85,
      fontFace: FONT, fontSize: 40, bold: true, color: WHITE, margin: 0, valign: "middle",
    });
    s.addText(plant + (location ? `  ·  ${location}` : ""), {
      x: 0.9, y: 4.5, w: 6.6, h: 0.4,
      fontFace: FONT, fontSize: 17, color: PALE, margin: 0,
    });
    s.addShape("rect", { x: 0.9, y: 5.15, w: 1.7, h: 0.06, fill: { color: LIME }, line: { width: 0 } });
    s.addText("PREPARED BY I&I AUTOMATION", {
      x: 0.9, y: 5.4, w: 6.0, h: 0.26,
      fontFace: FONT, fontSize: 10, bold: true, charSpacing: 1.4, color: WHITE, margin: 0,
    });
    s.addText(fmtDate(), {
      x: 0.9, y: 5.68, w: 6.0, h: 0.26,
      fontFace: FONT, fontSize: 10, color: GREY, margin: 0,
    });

    const hero = machines.map(photoOf).find(Boolean);
    if (hero) {
      s.addImage({ data: hero, x: 7.5, y: 1.35, w: 5.1, h: 3.4, sizing: { type: "cover", w: 5.1, h: 3.4 } });
      s.addShape("rect", { x: 7.5, y: 4.84, w: 5.1, h: 0.09, fill: { color: LIME }, line: { width: 0 } });
      s.addText(
        multiLine
          ? `Field survey · ${lineCount} lines · ${machines.length} machines`
          : `Field survey · ${machines.length} machines documented`,
        {
        x: 7.5, y: 5.05, w: 5.1, h: 0.3,
        fontFace: FONT, fontSize: 12, bold: true, color: PALE, margin: 0,
      });
    }
    s.addNotes(`Automation Report for ${plant}. Field mapping captured ${multiLine ? `${lineCount} lines, ` : ""}${machines.length} machines and ${totalPhotos} photos.`);
  }

  // ══ Lines surveyed (plant-consolidated decks only) ═════════════════════════
  if (multiLine && lines) {
    page++;
    const s = frame(pptx, { eyebrow: "The plant", title: "Lines Surveyed", theme: "light", pageNo: page, images });

    const head = ["Line", "Name", "Machines", "Photos"];
    const rows: PptxGenJS.TableRow[] = [
      head.map((h) => ({
        text: h.toUpperCase(),
        options: { bold: true, fontSize: 9, color: WHITE, fill: { color: NAVY }, margin: 6 },
      })),
    ];
    for (const [i, line] of lines.entries()) {
      rows.push([
        { text: `L${String(i + 1).padStart(2, "0")}`, options: { bold: true, fontSize: 12, color: NAVY } },
        { text: line.name, options: { fontSize: 13, bold: true, color: INK } },
        { text: String(line.machine_count), options: { fontSize: 13, color: INK, align: "center" } },
        { text: String(line.photo_count), options: { fontSize: 13, color: INK, align: "center" } },
      ]);
    }

    s.addTable(rows, {
      x: BODY_L, y: CONTENT_T, w: 11.8,
      colW: [1.4, 6.6, 1.9, 1.9],
      border: { type: "solid", color: "D9DEE7", pt: 1 },
      fontFace: FONT, valign: "middle", margin: 8, autoPage: false,
    });

    s.addText("Each line was mapped separately on the floor. This report rolls them into one plant picture.", {
      x: BODY_L, y: CONTENT_T + rows.length * 0.48 + 0.35, w: 11.8, h: 0.4,
      fontFace: FONT, fontSize: 13, color: GREY, margin: 0,
    });
    s.addNotes(lines.map((l, i) => `L${String(i + 1).padStart(2, "0")} ${l.name}: ${l.machine_count} machines`).join(". "));
  }

  // ══ 2 · What we found ══════════════════════════════════════════════════════
  {
    page++;
    const s = frame(pptx, { eyebrow: multiLine ? "The plant" : "The line", title: "What We Found", theme: "dark", pageNo: page, images });

    s.addText(narrative.story, {
      x: BODY_L, y: CONTENT_T, w: 11.7, h: 1.85,
      fontFace: FONT, fontSize: 15, color: WHITE, lineSpacing: 22, margin: 0, valign: "top",
    });

    s.addText(
      narrative.bullets.map((f, i) => ({
        text: f,
        options: { bullet: true, breakLine: i !== narrative.bullets.length - 1 },
      })),
      { x: BODY_L, y: 3.7, w: 11.7, h: 2.2, fontFace: FONT, fontSize: 15, color: PALE, paraSpaceAfter: 8, margin: 0 }
    );
    s.addNotes(narrative.story);
  }

  // ══ 3 · Executive summary ══════════════════════════════════════════════════
  {
    page++;
    const s = frame(pptx, { eyebrow: "Overview", title: "Executive Summary", theme: "light", pageNo: page, images });

    const eol = register.findings.filter((f) => f.status !== "mature").length;
    const auto = summary ??
      `I&I Automation completed an on-site controls survey at ${plant}${location ? ` in ${location}` : ""}. ` +
      (multiLine ? `${lineCount} lines and ` : "") +
      `${machines.length} machine${machines.length === 1 ? "" : "s"} ${machines.length === 1 ? "was" : "were"} surveyed and ` +
      `${totalPhotos} field photograph${totalPhotos === 1 ? "" : "s"} recorded. ` +
      (eol > 0
        ? `${eol} discontinued platform${eol === 1 ? "" : "s"} ${eol === 1 ? "was" : "were"} identified across ${register.totalUnits} installed unit${register.totalUnits === 1 ? "" : "s"}. `
        : `No discontinued control or drive equipment was identified in the surveyed scope. `) +
      (opportunities.findings.length > 0
        ? `${opportunities.findings.length} operational opportunit${opportunities.findings.length === 1 ? "y" : "ies"} ${opportunities.findings.length === 1 ? "is" : "are"} on the table — visibility, SCADA, utilities, diagnostics, and trapped modern hardware.`
        : `Floor observations are recorded per station so the next conversation is about the process, not only the parts list.`);

    s.addText(auto, {
      x: BODY_L, y: CONTENT_T, w: 5.9, h: 2.1,
      fontFace: FONT, fontSize: 15, color: INK, lineSpacing: 24, margin: 0, valign: "top",
    });

    const findings: string[] = [];
    if (eol > 0) findings.push(`${eol} discontinued platform${eol === 1 ? "" : "s"} across ${register.affectedMachines} of ${register.totalMachines} machines`);
    if (register.counts.critical) findings.push(`${register.counts.critical} finding${register.counts.critical === 1 ? "" : "s"} rated critical`);
    if (narrative.trapped) findings.push(`${narrative.trapped} modern drive/servo package${narrative.trapped === 1 ? "" : "s"} trapped behind a legacy PLC`);
    if (narrative.noHmi) findings.push(`${narrative.noHmi} station${narrative.noHmi === 1 ? "" : "s"} with no operator visibility`);
    findings.push(`${plcCount} PLC${plcCount === 1 ? "" : "s"} and ${driveCount} drive system${driveCount === 1 ? "" : "s"} documented`);

    s.addText(
      findings.map((f, i) => ({ text: f, options: { bullet: true, breakLine: i !== findings.length - 1 } })),
      { x: BODY_L, y: 4.0, w: 5.9, h: 1.9, fontFace: FONT, fontSize: 13, color: INK, paraSpaceAfter: 8, margin: 0 }
    );

    // Stat block, right
    s.addShape("rect", { x: 6.95, y: CONTENT_T, w: 5.65, h: 3.15, fill: { color: CARD }, line: { width: 0 } });
    statTile(s, 7.15, CONTENT_T + 0.35, 2.5, String(machines.length), "Machines", "light");
    statTile(s, 9.9, CONTENT_T + 0.35, 2.5, String(totalPhotos), "Photos", "light");
    statTile(s, 7.15, CONTENT_T + 1.65, 2.5, String(eol), "Discontinued", "light");
    statTile(s, 9.9, CONTENT_T + 1.65, 2.5, String(opportunities.findings.length), "Opportunities", "light");

    s.addText(`Assessment scope · ${plant}`, {
      x: 6.95, y: 5.0, w: 5.65, h: 0.3,
      fontFace: FONT, fontSize: 12, bold: true, color: NAVY, margin: 0,
    });
    if (preparedFor) {
      s.addText(`Prepared for ${preparedFor}`, {
        x: 6.95, y: 5.3, w: 5.65, h: 0.3, fontFace: FONT, fontSize: 11, color: GREY, margin: 0,
      });
    }
  }

  // ══ 3 · Obsolescence overview (dark) ═══════════════════════════════════════
  if (register.findings.length > 0) {
    page++;
    const s = frame(pptx, { eyebrow: "Obsolescence", title: "Equipment Lifecycle Risk", theme: "dark", pageNo: page, images });

    s.addText(
      "Hardware or software that is no longer manufactured or supported carries direct operational risk: " +
      "limited parts availability, reduced vendor support, and longer recovery time after a failure.",
      { x: BODY_L, y: CONTENT_T, w: 5.9, h: 1.0, fontFace: FONT, fontSize: 15, color: WHITE, lineSpacing: 23, margin: 0 }
    );

    const top = register.findings.slice(0, 5);
    s.addText(
      top.map((f, i) => ({
        text: `${f.make} ${f.model}  —  ${f.unitCount} unit${f.unitCount === 1 ? "" : "s"}`,
        options: { bullet: true, breakLine: i !== top.length - 1 },
      })),
      { x: BODY_L, y: 2.85, w: 5.9, h: 2.0, fontFace: FONT, fontSize: 14, color: PALE, paraSpaceAfter: 9, margin: 0 }
    );

    s.addText("Migration reduces inventory cost, improves availability and security, and simplifies troubleshooting.", {
      x: BODY_L, y: 5.15, w: 5.9, h: 0.6,
      fontFace: FONT, fontSize: 13, bold: true, color: LIME, margin: 0,
    });

    // Risk counts, right
    const counts: [string, number][] = [
      ["Critical", register.counts.critical],
      ["High", register.counts.high],
      ["Watch / mature", register.counts.watch],
    ];
    counts.forEach(([label, n], i) => {
      const y = CONTENT_T + i * 1.15;
      s.addShape("rect", { x: 7.1, y, w: 5.5, h: 0.95, fill: { color: "0C1550" }, line: { width: 0 } });
      s.addText(String(n), {
        x: 7.35, y: y + 0.12, w: 1.0, h: 0.7,
        fontFace: FONT, fontSize: 32, bold: true, color: LIME, margin: 0, valign: "middle",
      });
      s.addText(`${label} risk finding${n === 1 ? "" : "s"}`, {
        x: 8.4, y: y + 0.12, w: 4.0, h: 0.7,
        fontFace: FONT, fontSize: 15, bold: true, color: WHITE, margin: 0, valign: "middle",
      });
    });
    s.addNotes("Lifecycle status reflects published vendor declarations; confirm against the manufacturer's current lifecycle statement before procurement.");
  }

  // ══ 4 · Risk register table ════════════════════════════════════════════════
  if (register.findings.length > 0) {
    page++;
    const s = frame(pptx, { eyebrow: "Obsolescence", title: "Risk Register", theme: "light", pageNo: page, images });

    const head = ["Risk", "Type", "Installed equipment", "Location", "Qty", "Recommended replacement"];
    const rows: PptxGenJS.TableRow[] = [
      head.map((h) => ({
        text: h.toUpperCase(),
        options: { bold: true, fontSize: 9, color: WHITE, fill: { color: NAVY }, margin: 6 },
      })),
    ];
    for (const f of register.findings.slice(0, 8)) {
      rows.push([
        { text: f.level.toUpperCase(), options: { bold: true, fontSize: 9, color: riskColor(f) } },
        { text: f.categoryLabel, options: { fontSize: 9, color: GREY } },
        { text: `${f.make} ${f.model}`, options: { fontSize: 10, bold: true, color: NAVY } },
        { text: f.machines.map((m) => m.tag).join(", "), options: { fontSize: 9, color: INK } },
        { text: String(f.unitCount), options: { fontSize: 10, bold: true, color: INK } },
        { text: f.successor ?? "Consult vendor", options: { fontSize: 9.5, bold: true, color: "166534" } },
      ]);
    }

    const ROW_H = 0.34;
    s.addTable(rows, {
      x: BODY_L, y: CONTENT_T, w: 11.8,
      colW: [1.05, 0.85, 3.5, 1.85, 0.6, 3.95],
      rowH: ROW_H,
      border: { type: "solid", color: "D9DEE7", pt: 1 },
      fontFace: FONT, valign: "middle", margin: 6, autoPage: false,
    });

    // Footnote tracks the bottom of the table so a short register doesn't strand it
    const tableBottom = CONTENT_T + rows.length * ROW_H;
    s.addText(
      "Scoring: age + exposure + migration path. Critical ≥ 6 · High 4–5 · Moderate ≤ 3 · Watch = mature / still shipping.",
      { x: BODY_L, y: tableBottom + 0.28, w: 11.8, h: 0.5, fontFace: FONT, fontSize: 10, color: GREY, margin: 0 }
    );
  }

  // ══ Opportunity map ════════════════════════════════════════════════════════
  if (opportunities.findings.length > 0) {
    page++;
    const s = frame(pptx, { eyebrow: "Opportunity", title: "Where We Can Help", theme: "light", pageNo: page, images });

    if (machines.length > 12) {
      const head = ["Opportunity", "Stations", "Why it matters"];
      const rows: PptxGenJS.TableRow[] = [
        head.map((h) => ({
          text: h.toUpperCase(),
          options: { bold: true, fontSize: 9, color: WHITE, fill: { color: NAVY }, margin: 6 },
        })),
      ];
      for (const f of opportunities.findings.slice(0, 8)) {
        rows.push([
          { text: f.label, options: { fontSize: 12, bold: true, color: NAVY } },
          { text: String(f.unitCount), options: { fontSize: 14, bold: true, color: NAVY, align: "center" } },
          { text: f.pitch, options: { fontSize: 11, color: INK } },
        ]);
      }
      s.addTable(rows, {
        x: BODY_L, y: CONTENT_T, w: 11.8,
        colW: [3.2, 1.3, 7.3],
        border: { type: "solid", color: "D9DEE7", pt: 1 },
        fontFace: FONT, valign: "middle", margin: 7, autoPage: false,
      });
    } else {
      const flagCols = FLAG_DEFS.filter((d) => opportunities.findings.some((f) => f.key === d.key));
      const head = ["Station", "Lifecycle", ...flagCols.map((c) => c.short)];
      const rows: PptxGenJS.TableRow[] = [
        head.map((h) => ({
          text: h.toUpperCase(),
          options: { bold: true, fontSize: 8, color: WHITE, fill: { color: NAVY }, margin: 5 },
        })),
      ];
      machines.forEach((m, idx) => {
        const a = assessments[idx];
        const life = a.hasEol ? (a.worst.status === "unsupported" ? "UNSUP" : "EOL") : a.hasMature ? "MAT" : "—";
        const cells: PptxGenJS.TableCell[] = [
          { text: `${machineTag(m, idx)}  ${m.line_name ? `${m.line_name} · ` : ""}${m.name}`, options: { fontSize: 10, bold: true, color: NAVY } },
          { text: life, options: { fontSize: 9, bold: true, color: a.hasEol ? "B45309" : GREY } },
        ];
        for (const col of flagCols) {
          const hit = a.flags.some((f) => f.key === col.key);
          cells.push({ text: hit ? "●" : "—", options: { fontSize: 11, align: "center", color: hit ? "166534" : "D9DEE7" } });
        }
        rows.push(cells);
      });
      const colW = [4.2, 1.15, ...flagCols.map(() => Math.min(1.4, 6.45 / Math.max(flagCols.length, 1)))];
      s.addTable(rows, {
        x: BODY_L, y: CONTENT_T, w: 11.8,
        colW,
        border: { type: "solid", color: "D9DEE7", pt: 1 },
        fontFace: FONT, valign: "middle", margin: 5, autoPage: false,
      });
    }
  }

  // ══ Dual justification (dark) ══════════════════════════════════════════════
  {
    page++;
    const s = frame(pptx, { eyebrow: "Justification", title: "Why This Matters", theme: "dark", pageNo: page, images });

    s.addText("The same survey has to convince the plant and the people who sign the PO.", {
      x: BODY_L, y: CONTENT_T, w: 11.7, h: 0.4,
      fontFace: FONT, fontSize: 16, bold: true, color: WHITE, margin: 0,
    });

    const cols: [string, [string, string][]][] = [
      ["Corporate", [
        ["Parts", "Discontinued platforms depend on brokered or salvaged spares, with no guaranteed lead time."],
        ["Knowledge", "PLC-5 / DH+ skill is walking out the door. Recovery waits on one person."],
        ["Spend", "Modern drives are already on the floor. Unmetered gas, water, and air are the same story — spend with no return."],
      ]],
      ["Operations", [
        ["Visibility", "The operator and the control room should see why it stopped — not a blinking light and a radio call."],
        ["Recovery", "Mechanics restore from the panel. A laptop and a 1990s cable is not a maintenance plan."],
        ["Numbers", "Starve/block time, OEE, and utility use become numbers. Line balance and the gas bill stop being opinions."],
      ]],
    ];
    cols.forEach((col, ci) => {
      const x = BODY_L + ci * 5.95;
      s.addText(col[0].toUpperCase(), {
        x, y: 2.2, w: 5.5, h: 0.28,
        fontFace: FONT, fontSize: 11, bold: true, charSpacing: 1.4, color: LIME, margin: 0,
      });
      col[1].forEach(([t, body], i) => {
        const y = 2.55 + i * 1.15;
        s.addShape("rect", { x, y, w: 5.7, h: 1.05, fill: { color: "0C1550" }, line: { width: 0 } });
        s.addText(t, {
          x: x + 0.25, y: y + 0.12, w: 5.2, h: 0.28,
          fontFace: FONT, fontSize: 14, bold: true, color: WHITE, margin: 0,
        });
        s.addText(body, {
          x: x + 0.25, y: y + 0.42, w: 5.2, h: 0.5,
          fontFace: FONT, fontSize: 12, color: PALE, margin: 0,
        });
      });
    });
  }

  // ══ What SCADA actually shows ══════════════════════════════════════════════
  {
    page++;
    const s = frame(pptx, { eyebrow: "Plant systems", title: "What SCADA Puts on the Screen", theme: "light", pageNo: page, images });
    s.addText("This is the justification in one slide. Gas, water, air, power, production, and safety — the same system, not a science project.", {
      x: BODY_L, y: CONTENT_T, w: 11.7, h: 0.38,
      fontFace: FONT, fontSize: 14, color: GREY, margin: 0,
    });
    SCADA_PAYOFFS.forEach((item, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = BODY_L + col * 4.05;
      const y = 2.15 + row * 1.55;
      s.addShape("rect", { x, y, w: 3.85, h: 1.42, fill: { color: CARD }, line: { width: 0 } });
      s.addText(item.title, {
        x: x + 0.18, y: y + 0.14, w: 3.5, h: 0.32,
        fontFace: FONT, fontSize: 14, bold: true, color: NAVY, margin: 0,
      });
      s.addText(item.body, {
        x: x + 0.18, y: y + 0.48, w: 3.5, h: 0.8,
        fontFace: FONT, fontSize: 12, color: INK, margin: 0,
      });
    });
  }
  const critical = pickCriticalExamples(mapping, 3);
  if (critical.length > 0) {
    page++;
    const s = frame(pptx, { eyebrow: "Examples · by criticality", title: "Stations That Tell the Story", theme: "light", pageNo: page, images });

    s.addText("The full drawing and register cover every station. This deck does not. These are the ones that should start the conversation.", {
      x: BODY_L, y: CONTENT_T, w: 11.7, h: 0.4,
      fontFace: FONT, fontSize: 14, color: GREY, margin: 0,
    });

    critical.forEach((ex, i) => {
      const x = BODY_L + i * 4.0;
      s.addShape("rect", { x, y: 2.2, w: 3.75, h: 4.4, fill: { color: CARD }, line: { width: 0 } });
      const pic = photoOf(ex.machine);
      if (pic) {
        s.addImage({ data: pic, x: x + 0.18, y: 2.38, w: 3.4, h: 1.85, sizing: { type: "cover", w: 3.4, h: 1.85 } });
        s.addShape("rect", { x: x + 0.18, y: 4.32, w: 3.4, h: 0.06, fill: { color: LIME }, line: { width: 0 } });
      }
      const textY = pic ? 4.5 : 2.5;
      s.addText(ex.tag, {
        x: x + 0.22, y: textY, w: 3.3, h: 0.22,
        fontFace: FONT, fontSize: 10, bold: true, charSpacing: 1.1, color: GREY, margin: 0,
      });
      s.addText(ex.machine.name, {
        x: x + 0.22, y: textY + 0.22, w: 3.3, h: 0.4,
        fontFace: FONT, fontSize: 16, bold: true, color: NAVY, margin: 0,
      });
      s.addText(ex.why, {
        x: x + 0.22, y: textY + 0.64, w: 3.3, h: pic ? 0.8 : 1.6,
        fontFace: FONT, fontSize: 12, color: INK, margin: 0,
      });
    });
    s.addNotes(critical.map((ex) => `${ex.tag} ${ex.machine.name}: ${ex.why}`).join(". "));
  }

  // ══ Upgrade examples by type ═══════════════════════════════════════════════
  {
    const used = new Set(critical.map((c) => c.machine.id));
    const themes = pickThemeExamples(mapping, used, 4);
    if (themes.length > 0) {
      page++;
      const s = frame(pptx, { eyebrow: "Examples · by upgrade", title: "Different Problems, Same Walk", theme: "light", pageNo: page, images });

      themes.forEach((theme, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = BODY_L + col * 6.05;
        const y = CONTENT_T + row * 2.35;
        s.addShape("rect", { x, y, w: 5.8, h: 2.15, fill: { color: CARD }, line: { width: 0 } });
        s.addText(theme.title, {
          x: x + 0.28, y: y + 0.18, w: 5.25, h: 0.36,
          fontFace: FONT, fontSize: 16, bold: true, color: NAVY, margin: 0,
        });
        s.addText(theme.pitch, {
          x: x + 0.28, y: y + 0.58, w: 5.25, h: 0.85,
          fontFace: FONT, fontSize: 13, color: INK, margin: 0,
        });
        if (theme.station) {
          s.addText(`${theme.station.tag}  ${theme.station.machine.name}`, {
            x: x + 0.28, y: y + 1.55, w: 5.25, h: 0.32,
            fontFace: FONT, fontSize: 12, bold: true, color: GREY, margin: 0,
          });
        }
      });
    }
  }

  // ══ Floor work beyond obsolescence ═════════════════════════════════════════
  for (const offer of FLOOR_OFFERS) {
    page++;
    const s = frame(pptx, { eyebrow: offer.eyebrow, title: offer.title, theme: "dark", pageNo: page, images });
    const pic = offer.photo ? images.refs?.[offer.photo] : undefined;
    const textW = pic ? 6.55 : 11.7;
    s.addText(offer.pitch, {
      x: BODY_L, y: CONTENT_T, w: textW, h: pic ? 1.55 : 1.35,
      fontFace: FONT, fontSize: pic ? 15 : 18, color: WHITE, lineSpacing: 22, margin: 0,
    });
    offer.bullets.forEach((b, i) => {
      const y = (pic ? 3.35 : 3.2) + i * (pic ? 1.0 : 1.05);
      s.addShape("rect", { x: BODY_L, y, w: textW, h: pic ? 0.88 : 0.9, fill: { color: "0C1550" }, line: { width: 0 } });
      s.addText(String(i + 1).padStart(2, "0"), {
        x: BODY_L + 0.22, y: y + 0.16, w: 0.65, h: 0.56,
        fontFace: FONT, fontSize: 18, bold: true, color: LIME, margin: 0, valign: "middle",
      });
      s.addText(b, {
        x: BODY_L + 0.95, y: y + 0.14, w: textW - 1.2, h: 0.6,
        fontFace: FONT, fontSize: pic ? 13 : 16, color: WHITE, margin: 0, valign: "middle",
      });
    });
    if (pic) {
      s.addImage({
        data: pic,
        x: 7.7, y: CONTENT_T, w: 4.85, h: 4.55,
        sizing: { type: "cover", w: 4.85, h: 4.55 },
      });
      s.addShape("rect", { x: 7.7, y: 6.17, w: 4.85, h: 0.08, fill: { color: LIME }, line: { width: 0 } });
      s.addText("Reference — typical installation, not this plant", {
        x: 7.7, y: 6.28, w: 4.85, h: 0.28,
        fontFace: FONT, fontSize: 10, color: PALE, margin: 0,
      });
    }
  }

  {
    page++;
    const s = frame(pptx, { eyebrow: "On the floor", title: "What Else This Walk Covers", theme: "light", pageNo: page, images });
    ALSO_ON_THE_FLOOR.forEach((item, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = BODY_L + col * 4.05;
      const y = CONTENT_T + row * 2.4;
      s.addShape("rect", { x, y, w: 3.85, h: 2.15, fill: { color: CARD }, line: { width: 0 } });
      s.addText(item.title, {
        x: x + 0.22, y: y + 0.22, w: 3.4, h: 0.5,
        fontFace: FONT, fontSize: 16, bold: true, color: NAVY, margin: 0,
      });
      s.addText(item.body, {
        x: x + 0.22, y: y + 0.8, w: 3.4, h: 1.1,
        fontFace: FONT, fontSize: 13, color: INK, margin: 0,
      });
    });
  }

  // ══ n+1 · Roadmap ══════════════════════════════════════════════════════════
  {
    page++;
    const s = frame(pptx, { eyebrow: "Next Steps", title: "Proposed Roadmap", theme: "light", pageNo: page, images });

    const steps: [string, string][] = [];
    if (register.counts.critical > 0) {
      steps.push(["Immediate", `Address ${register.counts.critical} critical discontinued asset${register.counts.critical === 1 ? "" : "s"} — confirm spares and a replacement budget before the next unplanned stop.`]);
    }
    if (narrative.trapped || narrative.noHmi) {
      steps.push(["Near term", "HMI and Ethernet on stations with no visibility, starting where a modern drive is already trapped behind a legacy PLC."]);
    }
    if (register.findings.some((f) => f.status !== "mature")) {
      steps.push(["Near term", "Legacy PLC / HMI migration plan with vendor-recommended successors and a common spare strategy."]);
    }
    if (narrative.islands || opportunities.findings.some((f) => f.key === "no_counts" || f.key === "no_scada")) {
      steps.push(["Line project", "Station counts and a SCADA overview so operations can see starve/block time — line balance as a number."]);
    }
    steps.push(["Plant systems", "SCADA plus gas, water, steam, compressed air, and kWh at the line — visibility operations and finance can share."]);
    steps.push(["Floor work", "Illuminated e-stops, panel air conditioners, and program backups — the walk is not only about processors."]);
    steps.push(["Program", "Standard platform for the next machine that fails. One programming environment, one spare strategy, remote support possible."]);
    steps.push(["Ongoing", "Backup every programmable device. Panel access, key-switch position, and network segmentation as a standing practice."]);

    steps.slice(0, 6).forEach(([when, what], i) => {
      const y = CONTENT_T + i * 0.84;
      s.addShape("rect", { x: BODY_L, y, w: 11.8, h: 0.82, fill: { color: CARD }, line: { width: 0 } });
      s.addText(String(i + 1).padStart(2, "0"), {
        x: BODY_L + 0.25, y: y + 0.1, w: 0.6, h: 0.62,
        fontFace: FONT, fontSize: 22, bold: true, color: NAVY, margin: 0, valign: "middle",
      });
      s.addText(when.toUpperCase(), {
        x: BODY_L + 0.95, y: y + 0.14, w: 1.5, h: 0.24,
        fontFace: FONT, fontSize: 8.5, bold: true, charSpacing: 1.1, color: GREY, margin: 0,
      });
      s.addText(what, {
        x: BODY_L + 0.95, y: y + 0.38, w: 10.5, h: 0.36,
        fontFace: FONT, fontSize: 13, color: INK, margin: 0,
      });
    });
  }

  // ══ n+2 · Contact (dark) ═══════════════════════════════════════════════════
  {
    page++;
    const s = pptx.addSlide();
    s.background = { color: NAVY };
    s.addShape("rect", { x: 0, y: 0, w: STRIPE_W, h: H, fill: { color: LIME }, line: { width: 0 } });

    if (images.logoWhite) {
      s.addImage({ data: images.logoWhite, x: 0.9, y: 1.0, w: 2.2, h: 1.9, sizing: { type: "contain", w: 2.2, h: 1.9 } });
    }
    s.addText("Ready to put a\nprogram in place?", {
      x: 0.9, y: 3.3, w: 6.0, h: 1.2,
      fontFace: FONT, fontSize: 30, bold: true, color: WHITE, lineSpacing: 38, margin: 0,
    });
    s.addText(
      `Contact I&I Automation to walk ${plant} through these findings, scope the first station, or stand up a plant-wide controls program.`,
      { x: 0.9, y: 4.7, w: 6.0, h: 0.9, fontFace: FONT, fontSize: 13.5, color: PALE, lineSpacing: 21, margin: 0 }
    );
    s.addShape("rect", { x: 0.9, y: 5.75, w: 1.7, h: 0.06, fill: { color: LIME }, line: { width: 0 } });

    s.addText("CONTACT", {
      x: 7.4, y: 2.0, w: 5.0, h: 0.26,
      fontFace: FONT, fontSize: 9, bold: true, charSpacing: 1.4, color: LIME, margin: 0,
    });
    s.addText("Main Offices", {
      x: 7.4, y: 2.35, w: 5.0, h: 0.35,
      fontFace: FONT, fontSize: 16, bold: true, color: WHITE, margin: 0,
    });
    s.addText(
      [
        "Barrio Las Flores 19-20 Calle 4a. Avenida N.E.",
        "San Pedro Sula, Honduras, Central America",
        "Telephone   ( 504 ) 2550-2778",
        "Fax             ( 504 ) 2557-8248",
        "customer.service@integratec.hn",
      ].map((t, i, a) => ({ text: t, options: { breakLine: i !== a.length - 1 } })),
      { x: 7.4, y: 2.85, w: 5.2, h: 1.9, fontFace: FONT, fontSize: 12.5, color: PALE, lineSpacing: 21, margin: 0 }
    );
  }

  return pptx;
}

function riskColor(f: RiskFinding): string {
  if (f.level === "critical") return "B91C1C";
  if (f.level === "high") return "C2410C";
  if (f.level === "watch") return "475569";
  return "B45309";
}

/** Suggested download filename for a mapping's deck. */
export function deckFileName(mapping: Mapping): string {
  const base = (mapping.plant_name ?? mapping.name ?? "Automation Report")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  const plantWide = (mapping.source_lines?.length ?? 0) > 1 ? "-Plant" : "";
  return `${base}${plantWide}-Automation-Report.pptx`;
}

export const DECK_FONT_FALLBACK = FONT_FALLBACK;

// ─── Browser download ─────────────────────────────────────────────────────────

/** Fetch a URL and return it as the `mime;base64,...` form pptxgenjs expects. */
async function toDataUri(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(fr.error);
      fr.onload = () => resolve(String(fr.result).replace(/^data:/, ""));
      fr.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

/**
 * Re-encode a fetched image to JPEG at presentation resolution.
 *
 * Two reasons not to embed the served bytes directly: the thumbnail endpoint
 * returns WebP, which older PowerPoint builds will not render, and full-size
 * field photos would push the deck past what anyone wants to email.
 */
async function blobToJpegData(blob: Blob): Promise<string | undefined> {
  const dataUri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  if (!dataUri) return undefined;
  return dataUri.replace(/^data:/, "");
}

async function fetchImageAsJpeg(
  url: string,
  maxPx = 1400,
  quality = 0.82,
  forceResize = false,
): Promise<string | undefined> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    const type = blob.type || "";
    if (!forceResize && (type === "image/jpeg" || url.includes("s=deck"))) {
      return blobToJpegData(blob);
    }
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();

    return canvas.toDataURL("image/jpeg", quality).replace(/^data:/, "");
  } catch {
    return undefined;
  }
}

function photosNeededForDeck(mapping: Mapping) {
  const seen = new Set<string>();
  const out: { id: string; machine_id: string; filename: string }[] = [];
  const addFirst = (machine?: MappingMachine) => {
    const photo = machine?.photos?.[0];
    if (!photo || seen.has(photo.id)) return;
    seen.add(photo.id);
    out.push(photo);
  };
  for (const machine of mapping.machines ?? []) {
    if ((machine.photos ?? []).length > 0) {
      addFirst(machine);
      break;
    }
  }
  for (const example of pickCriticalExamples(mapping, 3)) {
    addFirst(example.machine);
  }
  return out;
}

/**
 * Build the Automation Report for a mapping and hand it to the browser as a
 * .pptx download.
 */
export async function downloadPresentation(mapping: Mapping): Promise<void> {
  const photos: Record<string, string> = {};

  await Promise.all(
    photosNeededForDeck(mapping).map(async (p) => {
      const data = await fetchImageAsJpeg(photoUrl(p.machine_id, p.filename, "deck"));
      if (data) photos[p.id] = data;
    })
  );

  const [logoWhite, logoDark] = await Promise.all([
    toDataUri("/brand/deck-logo-white.png"),
    toDataUri("/brand/deck-logo-dark.png"),
  ]);

  const refs: Record<string, string> = {};
  await Promise.all(
    FLOOR_OFFERS.filter((o) => o.photo).map(async (o) => {
      const data = await fetchImageAsJpeg(`/deck-refs/${o.photo}.jpg`, 1100, 0.78, true);
      if (data && o.photo) refs[o.photo] = data;
    })
  );

  const pptx = await buildPresentation({ mapping, images: { logoWhite, logoDark, photos, refs } });
  await pptx.writeFile({ fileName: deckFileName(mapping) });
}

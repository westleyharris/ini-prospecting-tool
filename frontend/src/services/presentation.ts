import PptxGenJS from "pptxgenjs";
import type { Mapping, MappingMachine } from "../api/mappings";
import { photoUrl } from "../api/mappings";
import { buildRiskRegister, type RiskFinding } from "../data/riskRegister";
import { buildOpportunityRegister } from "../data/opportunityRegister";
import { assessMachine, buildPlantNarrative } from "../data/machineAssessment";
import { type FlagKey } from "../data/observations";
import { pickCriticalExamples, pickThemeExamples } from "../data/deckOffers";
import {
  STORY_AGENDA,
  WHY_PILLARS,
  WHY_FOOTNOTE,
  ISA_CARDS,
  METHOD_STEPS,
  METHOD_NOTE,
  DELIVERABLES,
} from "../data/deckStory";

/**
 * Plant systems assessment deck.
 *
 * Beginning — why obsolescence is a safety, cost, production, and cyber problem,
 * and what ISA already requires. Middle — this plant: inventory, register, evidence.
 * End — ranked program and the ask. Design follows the I&I navy/lime chrome.
 */

const NAVY = "050A3C";
const LIME = "7DFF00";
const WHITE = "FFFFFF";
const INK = "111111";
const GREY = "6B7280";
const PALE = "DDEAF5";
const CARD = "F3F4F6";

const FONT = "Aptos";
const FONT_FALLBACK = "Calibri";

const H = 7.5;
const STRIPE_W = 0.16;
const MARGIN_L = 0.65;
const BODY_L = 0.78;
const EYEBROW_T = 0.32;
const TITLE_T = 0.62;
const RULE_T = 1.24;
const CONTENT_T = 1.52;
const PAGENO_T = 7.02;
const BODY_W = 11.9;

export interface DeckImages {
  logoWhite?: string;
  logoDark?: string;
  photos: Record<string, string>;
  refs?: Record<string, string>;
}

export interface DeckOptions {
  mapping: Mapping;
  images: DeckImages;
  summary?: string;
  preparedFor?: string;
}

type Theme = "light" | "dark";

function fmtDate(d = new Date()): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function frame(
  pptx: PptxGenJS,
  opts: { eyebrow: string; title: string; theme: Theme; pageNo: number; images: DeckImages },
) {
  const { eyebrow, title, theme, pageNo, images } = opts;
  const dark = theme === "dark";
  const slide = pptx.addSlide();

  slide.background = { color: dark ? NAVY : WHITE };
  slide.addShape("rect", { x: 0, y: 0, w: STRIPE_W, h: H, fill: { color: LIME }, line: { width: 0 } });

  slide.addText(eyebrow.toUpperCase(), {
    x: MARGIN_L, y: EYEBROW_T, w: 10.4, h: 0.28,
    fontFace: FONT, fontSize: 8.5, bold: true, charSpacing: 1.2,
    color: dark ? PALE : GREY, margin: 0, valign: "middle",
  });

  slide.addText(title, {
    x: MARGIN_L, y: TITLE_T, w: 10.6, h: 0.58,
    fontFace: FONT, fontSize: 26, bold: true,
    color: dark ? WHITE : NAVY, margin: 0, valign: "middle",
  });

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

function panel(
  slide: PptxGenJS.Slide,
  x: number, y: number, w: number, h: number,
  fill: string,
) {
  slide.addShape("roundRect", {
    x, y, w, h, fill: { color: fill }, line: { width: 0 }, rectRadius: 0.06,
  });
}

function machinesWithFlags(mapping: Mapping, keys: FlagKey[]): MappingMachine[] {
  const want = new Set(keys);
  return (mapping.machines ?? []).filter((m) =>
    assessMachine(m).flags.some((f) => want.has(f.key)),
  );
}

function autoSummary(
  mapping: Mapping,
  narrative: ReturnType<typeof buildPlantNarrative>,
  risk: ReturnType<typeof buildRiskRegister>,
): string {
  const n = narrative.machineCount;
  const plant = mapping.plant_name ?? mapping.name;
  if (narrative.eolMachines > 0) {
    return (
      `${narrative.eolMachines} of ${n} stations at ${plant} run discontinued control hardware. ` +
      `That is not a spare-parts list. It is the set of assets that can no longer be supported the way ` +
      `ANSI/ISA-61511 and ISA/IEC 62443 expect a live plant to be supported. ` +
      (risk.findings.length
        ? `The register ranks ${risk.findings.length} platform${risk.findings.length === 1 ? "" : "s"} ` +
          `so capital can be approved in order — not after a failure forces the spend.`
        : `The findings below are what operations lives with, and what a controls program can still change.`)
    );
  }
  return (
    `Installed controllers in the surveyed scope at ${plant} are on current or mature platforms. ` +
    `The walk still recorded operational, safety, and visibility gaps the same standards require you to close ` +
    `before they become a failure. A ranked program is cheaper than an unplanned one.`
  );
}

const Pptx = ((PptxGenJS as unknown as { default?: typeof PptxGenJS }).default ??
  PptxGenJS) as typeof PptxGenJS;

export async function buildPresentation({ mapping, images, summary, preparedFor }: DeckOptions) {
  const pptx = new Pptx();
  pptx.defineLayout({ name: "IANDI", width: 13.33, height: 7.5 });
  pptx.layout = "IANDI";
  pptx.author = "I&I Automation";
  pptx.title = `${mapping.plant_name ?? mapping.name} — Plant Systems Assessment`;
  pptx.subject = "Obsolescence, safety, and operating-cost baseline";

  const machines = mapping.machines ?? [];
  const assessments = machines.map(assessMachine);
  const risk = buildRiskRegister(mapping);
  const opps = buildOpportunityRegister(mapping);
  const narrative = buildPlantNarrative(mapping);
  const critical = pickCriticalExamples(mapping, 3);
  const themes = pickThemeExamples(
    mapping,
    new Set(critical.map((c) => c.machine.id)),
    2,
  );
  const lines = mapping.source_lines ?? [];
  const plant = mapping.plant_name ?? mapping.name;
  const location = [mapping.city, mapping.state].filter(Boolean).join(", ");
  const date = fmtDate();
  const execSummary = (summary ?? "").trim() || autoSummary(mapping, narrative, risk);

  const safetyMachines = machinesWithFlags(mapping, ["hardwired_safety", "estop_unlit", "no_backup"]);
  const costMachines = machinesWithFlags(mapping, [
    "no_utilities", "no_scada", "trapped_modern", "no_visibility", "island", "no_diagnostics",
  ]);
  const laptopCount = assessments.filter((a) => a.observations.recoverability === "laptop_required").length;
  const noBackup = machinesWithFlags(mapping, ["no_backup"]).length;
  const estop = machinesWithFlags(mapping, ["estop_unlit"]).length;
  const hardwired = machinesWithFlags(mapping, ["hardwired_safety"]).length;

  let page = 1;

  // ── Title ─────────────────────────────────────────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: NAVY };
    s.addShape("rect", { x: 0, y: 0, w: STRIPE_W, h: H, fill: { color: LIME }, line: { width: 0 } });
    if (images.logoWhite) {
      s.addImage({
        data: images.logoWhite, x: 11.45, y: 0.32, w: 1.15, h: 1.1,
        sizing: { type: "contain", w: 1.15, h: 1.1 },
      });
    }
    s.addText("PLANT SYSTEMS ASSESSMENT", {
      x: MARGIN_L, y: 1.55, w: 11.4, h: 0.32,
      fontFace: FONT, fontSize: 12, bold: true, charSpacing: 2.4,
      color: LIME, margin: 0,
    });
    s.addText(plant, {
      x: MARGIN_L, y: 1.95, w: 11.4, h: 0.7,
      fontFace: FONT, fontSize: 34, bold: true, color: WHITE, margin: 0, valign: "middle",
    });
    s.addText(
      [location, date].filter(Boolean).join("   ·   ") + (preparedFor ? `   ·   For ${preparedFor}` : ""),
      {
        x: MARGIN_L, y: 2.68, w: 11.4, h: 0.28,
        fontFace: FONT, fontSize: 13, color: PALE, margin: 0,
      },
    );
    s.addShape("rect", {
      x: MARGIN_L, y: 3.15, w: 1.4, h: 0.06, fill: { color: LIME }, line: { width: 0 },
    });
    s.addText("Obsolescence  ·  Safety  ·  Operating cost", {
      x: MARGIN_L, y: 3.4, w: 11.4, h: 0.32,
      fontFace: FONT, fontSize: 16, bold: true, color: WHITE, margin: 0,
    });
    s.addText(
      "What is installed. How close each system is to losing support. Which of them would stop production — or leave you unable to prove a safe state — if it failed tomorrow.",
      {
        x: MARGIN_L, y: 3.85, w: 10.6, h: 1.15,
        fontFace: FONT, fontSize: 16, color: PALE, margin: 0,
      },
    );
    s.addText("PREPARED BY I&I AUTOMATION", {
      x: MARGIN_L, y: 6.85, w: 8, h: 0.24,
      fontFace: FONT, fontSize: 10, bold: true, charSpacing: 1.4, color: LIME, margin: 0,
    });
  }

  // ── Agenda ────────────────────────────────────────────────────────────────
  {
    const s = frame(pptx, {
      eyebrow: "01  ·  02  ·  03",
      title: "This report, in three parts",
      theme: "light", pageNo: page++, images,
    });
    STORY_AGENDA.forEach((item, i) => {
      const y = CONTENT_T + i * 1.55;
      s.addText(item.n, {
        x: BODY_L, y, w: 0.9, h: 1.35,
        fontFace: FONT, fontSize: 28, bold: true, color: NAVY, margin: 0, valign: "middle",
      });
      s.addText(item.kicker.toUpperCase(), {
        x: BODY_L + 1.1, y: y + 0.12, w: 10.4, h: 0.22,
        fontFace: FONT, fontSize: 10, bold: true, charSpacing: 1.4, color: GREY, margin: 0,
      });
      s.addText(item.title, {
        x: BODY_L + 1.1, y: y + 0.36, w: 10.4, h: 0.36,
        fontFace: FONT, fontSize: 18, bold: true, color: NAVY, margin: 0,
      });
      s.addText(item.body, {
        x: BODY_L + 1.1, y: y + 0.74, w: 10.4, h: 0.5,
        fontFace: FONT, fontSize: 13, color: INK, margin: 0,
      });
    });
  }

  // ── Why obsolescence is bad ───────────────────────────────────────────────
  {
    const s = frame(pptx, {
      eyebrow: "01  The problem",
      title: "Why obsolescence is a problem",
      theme: "dark", pageNo: page++, images,
    });
    s.addText(
      "A line can run reliably while the next crisis is already in the cabinet. The controller is still blinking. The vendor is not.",
      {
        x: BODY_L, y: CONTENT_T, w: BODY_W, h: 0.42,
        fontFace: FONT, fontSize: 14, color: PALE, margin: 0,
      },
    );
    WHY_PILLARS.forEach((p, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = BODY_L + col * 6.05;
      const y = CONTENT_T + 0.52 + row * 2.22;
      panel(s, x, y, 5.85, 2.08, "0B1466");
      s.addText(p.kicker.toUpperCase(), {
        x: x + 0.18, y: y + 0.12, w: 5.5, h: 0.22,
        fontFace: FONT, fontSize: 9, bold: true, charSpacing: 0.8, color: LIME, margin: 0,
      });
      s.addText(p.title, {
        x: x + 0.18, y: y + 0.36, w: 5.5, h: 0.42,
        fontFace: FONT, fontSize: 14, bold: true, color: WHITE, margin: 0,
      });
      s.addText(p.body, {
        x: x + 0.18, y: y + 0.82, w: 5.5, h: 1.14,
        fontFace: FONT, fontSize: 11, color: PALE, margin: 0,
      });
    });
    s.addText(WHY_FOOTNOTE, {
      x: BODY_L, y: 6.78, w: 11.4, h: 0.22,
      fontFace: FONT, fontSize: 8, color: GREY, margin: 0,
    });
  }

  // ── ISA ───────────────────────────────────────────────────────────────────
  {
    const s = frame(pptx, {
      eyebrow: "01  The problem",
      title: "What the standards already require",
      theme: "light", pageNo: page++, images,
    });
    s.addText(
      "This is not an opinion that old equipment is inconvenient. These are the rules a live plant is already expected to run against.",
      {
        x: BODY_L, y: CONTENT_T, w: BODY_W, h: 0.36,
        fontFace: FONT, fontSize: 13, color: INK, margin: 0,
      },
    );
    ISA_CARDS.forEach((c, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = BODY_L + col * 4.05;
      const y = CONTENT_T + 0.48 + row * 2.2;
      panel(s, x, y, 3.9, 2.05, CARD);
      s.addText(c.std, {
        x: x + 0.16, y: y + 0.14, w: 3.58, h: 0.22,
        fontFace: FONT, fontSize: 10, bold: true, charSpacing: 0.6, color: GREY, margin: 0,
      });
      s.addText(c.title, {
        x: x + 0.16, y: y + 0.38, w: 3.58, h: 0.36,
        fontFace: FONT, fontSize: 15, bold: true, color: NAVY, margin: 0,
      });
      s.addText(c.body, {
        x: x + 0.16, y: y + 0.8, w: 3.58, h: 1.08,
        fontFace: FONT, fontSize: 12, color: INK, margin: 0,
      });
    });
  }

  // ── Method ────────────────────────────────────────────────────────────────
  {
    const s = frame(pptx, {
      eyebrow: "01  The problem",
      title: "How this assessment was run",
      theme: "light", pageNo: page++, images,
    });
    s.addText(
      "Fixed scope. Floor walk. Nameplates and programs. The people who keep it running. Nothing is graded. Nothing is reported to a third party.",
      {
        x: BODY_L, y: CONTENT_T, w: BODY_W, h: 0.36,
        fontFace: FONT, fontSize: 13, color: INK, margin: 0,
      },
    );
    METHOD_STEPS.forEach((step, i) => {
      const x = BODY_L + i * 3.05;
      panel(s, x, CONTENT_T + 0.5, 2.9, 3.55, CARD);
      s.addText(step.n, {
        x: x + 0.16, y: CONTENT_T + 0.66, w: 2.58, h: 0.4,
        fontFace: FONT, fontSize: 22, bold: true, color: NAVY, margin: 0,
      });
      s.addText(step.title, {
        x: x + 0.16, y: CONTENT_T + 1.14, w: 2.58, h: 0.7,
        fontFace: FONT, fontSize: 15, bold: true, color: NAVY, margin: 0,
      });
      s.addText(step.body, {
        x: x + 0.16, y: CONTENT_T + 1.9, w: 2.58, h: 1.9,
        fontFace: FONT, fontSize: 12, color: INK, margin: 0,
      });
    });
    s.addText(METHOD_NOTE, {
      x: BODY_L, y: 6.55, w: BODY_W, h: 0.4,
      fontFace: FONT, fontSize: 12, italic: true, color: GREY, margin: 0,
    });
  }

  // ── Lines surveyed ────────────────────────────────────────────────────────
  if (lines.length > 1) {
    const s = frame(pptx, {
      eyebrow: "02  This plant",
      title: "Lines in this assessment",
      theme: "light", pageNo: page++, images,
    });
    const shown = lines.slice(0, 9);
    const compact = shown.length > 6;
    const cardH = compact ? 1.45 : 2.15;
    const rowH = compact ? 1.6 : 2.35;
    shown.forEach((line, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = BODY_L + col * 4.05;
      const y = CONTENT_T + row * rowH;
      panel(s, x, y, 3.9, cardH, CARD);
      s.addText(line.name, {
        x: x + 0.18, y: y + 0.14, w: 3.54, h: compact ? 0.55 : 0.7,
        fontFace: FONT, fontSize: compact ? 14 : 16, bold: true, color: NAVY, margin: 0,
      });
      const n = line.machine_count ?? 0;
      s.addText(`${n} station${n === 1 ? "" : "s"} documented on this walk`, {
        x: x + 0.18, y: y + (compact ? 0.72 : 0.95), w: 3.54, h: 0.5,
        fontFace: FONT, fontSize: 13, color: INK, margin: 0,
      });
    });
    if (lines.length > shown.length) {
      s.addText(`${lines.length - shown.length} additional line${lines.length - shown.length === 1 ? "" : "s"} in this assessment.`, {
        x: BODY_L, y: 6.7, w: BODY_W, h: 0.22,
        fontFace: FONT, fontSize: 11, color: GREY, margin: 0,
      });
    }
  }

  // ── What we found ─────────────────────────────────────────────────────────
  {
    const s = frame(pptx, {
      eyebrow: "02  This plant",
      title: "What the walk found",
      theme: "light", pageNo: page++, images,
    });
    s.addText(narrative.story, {
      x: BODY_L, y: CONTENT_T, w: BODY_W, h: 1.55,
      fontFace: FONT, fontSize: 15, color: INK, margin: 0,
    });
    const bullets = narrative.bullets.slice(0, 6);
    bullets.forEach((b, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = BODY_L + col * 6.05;
      const y = CONTENT_T + 1.75 + row * 0.95;
      panel(s, x, y, 5.85, 0.82, CARD);
      s.addShape("rect", {
        x, y, w: 0.08, h: 0.82, fill: { color: LIME }, line: { width: 0 },
      });
      s.addText(b, {
        x: x + 0.28, y: y + 0.12, w: 5.4, h: 0.58,
        fontFace: FONT, fontSize: 14, color: NAVY, margin: 0, valign: "middle",
      });
    });
  }

  // ── Executive snapshot ────────────────────────────────────────────────────
  {
    const s = frame(pptx, {
      eyebrow: "02  This plant",
      title: "Executive snapshot",
      theme: "dark", pageNo: page++, images,
    });
    const tiles: [string, string][] = [
      [String(narrative.machineCount), "Stations surveyed"],
      [String(narrative.eolMachines), "On discontinued hardware"],
      [String(risk.findings.length), "Platforms on the register"],
      [String(narrative.flagCount), "Operational flags"],
    ];
    tiles.forEach(([value, label], i) => {
      statTile(s, BODY_L + i * 3.05, CONTENT_T, 2.85, value, label, "dark");
    });
    panel(s, BODY_L, CONTENT_T + 1.35, BODY_W, 3.55, "0B1466");
    s.addText("WHAT THIS MEANS", {
      x: BODY_L + 0.28, y: CONTENT_T + 1.52, w: 11.3, h: 0.24,
      fontFace: FONT, fontSize: 10, bold: true, charSpacing: 1.4, color: LIME, margin: 0,
    });
    s.addText(execSummary, {
      x: BODY_L + 0.28, y: CONTENT_T + 1.85, w: 11.3, h: 2.8,
      fontFace: FONT, fontSize: 16, color: WHITE, margin: 0,
    });
  }

  // ── Lifecycle risk ────────────────────────────────────────────────────────
  if (risk.findings.length > 0) {
    const s = frame(pptx, {
      eyebrow: "02  This plant",
      title: "Equipment lifecycle risk",
      theme: "dark", pageNo: page++, images,
    });
    s.addText(
      "Hardware or software that is no longer manufactured or supported carries direct operational risk: limited parts, thinner vendor support, and a longer recovery after a failure. A controller family can move from Active to End of Life while the line still looks fine. The status change is the warning.",
      {
        x: BODY_L, y: CONTENT_T, w: BODY_W, h: 0.85,
        fontFace: FONT, fontSize: 14, color: PALE, margin: 0,
      },
    );
    const counts: [string, string, string][] = [
      [String(risk.counts.critical), "Critical", "B91C1C"],
      [String(risk.counts.high), "High", "C2410C"],
      [String(risk.counts.moderate), "Moderate", "B45309"],
      [String(risk.counts.watch), "Watch", "94A3B8"],
    ];
    counts.forEach(([value, label, color], i) => {
      const x = BODY_L + i * 3.05;
      panel(s, x, CONTENT_T + 1.05, 2.9, 1.55, "0B1466");
      s.addShape("rect", { x, y: CONTENT_T + 1.05, w: 0.1, h: 1.55, fill: { color }, line: { width: 0 } });
      s.addText(value, {
        x: x + 0.28, y: CONTENT_T + 1.18, w: 2.4, h: 0.7,
        fontFace: FONT, fontSize: 36, bold: true, color: WHITE, margin: 0,
      });
      s.addText(label.toUpperCase(), {
        x: x + 0.28, y: CONTENT_T + 1.9, w: 2.4, h: 0.28,
        fontFace: FONT, fontSize: 11, bold: true, charSpacing: 1.1, color: PALE, margin: 0,
      });
    });
    s.addText(
      `${risk.totalUnits} unit${risk.totalUnits === 1 ? "" : "s"} across ${risk.affectedMachines} of ${risk.totalMachines} stations. ` +
      "Score = years past last-ship (mature = 1, unsupported = 3) + how many units depend on it + whether a successor is published. It ranks this plant’s installed base. It is not a SIL calculation.",
      {
        x: BODY_L, y: CONTENT_T + 2.85, w: BODY_W, h: 0.7,
        fontFace: FONT, fontSize: 13, color: PALE, margin: 0,
      },
    );
    s.addText(
      "A list of old equipment does not get funded. A ranked register that ties each item to the production it puts at risk does.",
      {
        x: BODY_L, y: 6.35, w: BODY_W, h: 0.4,
        fontFace: FONT, fontSize: 14, italic: true, color: LIME, margin: 0,
      },
    );
  }

  // ── Risk register ─────────────────────────────────────────────────────────
  if (risk.findings.length > 0) {
    const rows = risk.findings.slice(0, 8);
    const s = frame(pptx, {
      eyebrow: "02  This plant",
      title: "Risk register — ranked for capital",
      theme: "light", pageNo: page++, images,
    });
    const headers = ["Platform", "Level", "Units", "Stations", "Why it matters"];
    const colX = [BODY_L, 4.55, 5.7, 6.85, 8.15];
    const colW = [3.65, 1.05, 1.05, 1.2, 4.5];
    headers.forEach((h, i) => {
      s.addText(h.toUpperCase(), {
        x: colX[i], y: CONTENT_T, w: colW[i], h: 0.28,
        fontFace: FONT, fontSize: 9, bold: true, charSpacing: 0.8, color: GREY, margin: 0,
      });
    });
    rows.forEach((f, i) => {
      const y = CONTENT_T + 0.38 + i * 0.58;
      if (i % 2 === 0) {
        s.addShape("rect", {
          x: BODY_L - 0.08, y: y - 0.06, w: BODY_W + 0.16, h: 0.56,
          fill: { color: CARD }, line: { width: 0 },
        });
      }
      const label = `${f.make} ${f.model}`.trim();
      s.addText(label, {
        x: colX[0], y, w: colW[0], h: 0.44,
        fontFace: FONT, fontSize: 12, bold: true, color: NAVY, margin: 0, valign: "middle",
      });
      s.addText(f.level, {
        x: colX[1], y, w: colW[1], h: 0.44,
        fontFace: FONT, fontSize: 11, bold: true, color: riskColor(f), margin: 0, valign: "middle",
      });
      s.addText(String(f.unitCount), {
        x: colX[2], y, w: colW[2], h: 0.44,
        fontFace: FONT, fontSize: 12, color: INK, margin: 0, valign: "middle",
      });
      s.addText(String(f.machines.length), {
        x: colX[3], y, w: colW[3], h: 0.44,
        fontFace: FONT, fontSize: 12, color: INK, margin: 0, valign: "middle",
      });
      s.addText(f.note, {
        x: colX[4], y, w: colW[4], h: 0.44,
        fontFace: FONT, fontSize: 11, color: INK, margin: 0, valign: "middle",
      });
    });
    if (risk.findings.length > rows.length) {
      s.addText(`${risk.findings.length - rows.length} additional platform${risk.findings.length - rows.length === 1 ? "" : "s"} on the full register.`, {
        x: BODY_L, y: 6.7, w: BODY_W, h: 0.22,
        fontFace: FONT, fontSize: 11, color: GREY, margin: 0,
      });
    }
  }

  // ── Stations that prove it ────────────────────────────────────────────────
  if (critical.length > 0) {
    const s = frame(pptx, {
      eyebrow: "02  This plant",
      title: "Stations that prove the score",
      theme: "light", pageNo: page++, images,
    });
    critical.slice(0, 3).forEach((ex, i) => {
      const x = BODY_L + i * 4.05;
      panel(s, x, CONTENT_T, 3.9, 5.05, CARD);
      const photo = ex.machine.photos?.[0];
      const data = photo ? images.photos[photo.id] : undefined;
      if (data) {
        s.addImage({
          data, x: x + 0.12, y: CONTENT_T + 0.12, w: 3.66, h: 1.85,
          sizing: { type: "cover", w: 3.66, h: 1.85 },
        });
      } else {
        s.addShape("rect", {
          x: x + 0.12, y: CONTENT_T + 0.12, w: 3.66, h: 1.85,
          fill: { color: NAVY }, line: { width: 0 },
        });
      }
      s.addText(ex.tag, {
        x: x + 0.18, y: CONTENT_T + 2.08, w: 3.54, h: 0.22,
        fontFace: FONT, fontSize: 10, bold: true, charSpacing: 0.8, color: GREY, margin: 0,
      });
      s.addText(ex.machine.name, {
        x: x + 0.18, y: CONTENT_T + 2.3, w: 3.54, h: 0.5,
        fontFace: FONT, fontSize: 15, bold: true, color: NAVY, margin: 0,
      });
      s.addText(ex.why, {
        x: x + 0.18, y: CONTENT_T + 2.85, w: 3.54, h: 0.7,
        fontFace: FONT, fontSize: 12, color: INK, margin: 0,
      });
      const detail =
        ex.assessment.risk[0] ??
        ex.assessment.flags[0]?.pitch ??
        "Documented on this walk as a priority station.";
      s.addText(detail, {
        x: x + 0.18, y: CONTENT_T + 3.6, w: 3.54, h: 1.25,
        fontFace: FONT, fontSize: 11, color: GREY, margin: 0,
      });
    });
  }

  // ── Safety on this floor ──────────────────────────────────────────────────
  if (safetyMachines.length > 0) {
    const s = frame(pptx, {
      eyebrow: "02  This plant",
      title: "Safety on this floor",
      theme: "dark", pageNo: page++, images,
    });
    s.addText(
      "ANSI/ISA-61511 requires the safety function to remain maintainable and testable for its life. ISA-84.91.01 requires process safety controls, alarms, and interlocks to be identified and kept mechanically integral. The walk found stations that fail that test today.",
      {
        x: BODY_L, y: CONTENT_T, w: BODY_W, h: 0.7,
        fontFace: FONT, fontSize: 14, color: PALE, margin: 0,
      },
    );
    const tiles: [string, string, string][] = [
      [String(estop), "Unlit e-stops", "A dark mushroom does not tell you it is pressed. The line hunts a latched stop instead of recovering."],
      [String(hardwired), "Hardwired safety, no status", "When the circuit drops, there is no HMI indication of which gate, e-stop, or relay opened."],
      [String(noBackup), "No current backup", "A failed processor is a rewrite, not a restore. That is lost production and a lost safety configuration."],
    ];
    tiles.forEach(([value, title, body], i) => {
      const x = BODY_L + i * 4.05;
      panel(s, x, CONTENT_T + 0.9, 3.9, 3.35, "0B1466");
      s.addText(value, {
        x: x + 0.2, y: CONTENT_T + 1.05, w: 3.5, h: 0.7,
        fontFace: FONT, fontSize: 36, bold: true, color: LIME, margin: 0,
      });
      s.addText(title, {
        x: x + 0.2, y: CONTENT_T + 1.8, w: 3.5, h: 0.55,
        fontFace: FONT, fontSize: 16, bold: true, color: WHITE, margin: 0,
      });
      s.addText(body, {
        x: x + 0.2, y: CONTENT_T + 2.45, w: 3.5, h: 1.5,
        fontFace: FONT, fontSize: 13, color: PALE, margin: 0,
      });
    });
  }

  // ── Cost and visibility ───────────────────────────────────────────────────
  if (costMachines.length > 0 || narrative.eolMachines > 0) {
    const s = frame(pptx, {
      eyebrow: "02  This plant",
      title: "Cost and visibility on this floor",
      theme: "light", pageNo: page++, images,
    });
    s.addText(
      "Obsolescence is unplanned capital. Missing visibility is unplanned labor. Both show up as lost shift long before they show up as a purchase order.",
      {
        x: BODY_L, y: CONTENT_T, w: BODY_W, h: 0.45,
        fontFace: FONT, fontSize: 14, color: INK, margin: 0,
      },
    );
    const items: [string, string][] = [];
    if (narrative.eolMachines) {
      items.push([
        `${narrative.eolMachines} station${narrative.eolMachines === 1 ? "" : "s"} on discontinued hardware`,
        "Brokered spares, no firmware path, and a recovery that depends on whoever still knows the platform.",
      ]);
    }
    if (narrative.trapped) {
      items.push([
        `${narrative.trapped} modern drive/servo package${narrative.trapped === 1 ? "" : "s"} trapped`,
        "Hardware already paid for, blocked by a legacy processor that cannot expose its data.",
      ]);
    }
    if (narrative.noHmi) {
      items.push([
        `${narrative.noHmi} station${narrative.noHmi === 1 ? "" : "s"} with no useful operator interface`,
        "ISA-101 expects situational awareness. Diagnosis here is tribal knowledge, not the screen.",
      ]);
    }
    if (narrative.islands) {
      items.push([
        `${narrative.islands} control island${narrative.islands === 1 ? "" : "s"}`,
        "ISA-95 cannot integrate what cannot talk. Balance stays an opinion.",
      ]);
    }
    const noScada = machinesWithFlags(mapping, ["no_scada"]).length;
    const noUtils = machinesWithFlags(mapping, ["no_utilities"]).length;
    if (noScada) {
      items.push([
        `${noScada} station${noScada === 1 ? "" : "s"} with no plant SCADA overview`,
        "Nobody in a control room can see running, starved, or down — and why.",
      ]);
    }
    if (noUtils) {
      items.push([
        `${noUtils} station${noUtils === 1 ? "" : "s"} with no utility visibility`,
        "Gas, water, air, and power are spent without a number attached to the line.",
      ]);
    }
    if (laptopCount) {
      items.push([
        `${laptopCount} station${laptopCount === 1 ? "" : "s"} where recovery requires a laptop`,
        "Mean time to repair is mean time to find the person with the software.",
      ]);
    }
    items.slice(0, 6).forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = BODY_L + col * 6.05;
      const y = CONTENT_T + 0.6 + row * 1.45;
      panel(s, x, y, 5.85, 1.32, CARD);
      s.addShape("rect", { x, y, w: 0.08, h: 1.32, fill: { color: LIME }, line: { width: 0 } });
      s.addText(item[0], {
        x: x + 0.28, y: y + 0.14, w: 5.4, h: 0.45,
        fontFace: FONT, fontSize: 14, bold: true, color: NAVY, margin: 0,
      });
      s.addText(item[1], {
        x: x + 0.28, y: y + 0.62, w: 5.4, h: 0.55,
        fontFace: FONT, fontSize: 12, color: INK, margin: 0,
      });
    });
  }

  // ── What we can change ────────────────────────────────────────────────────
  if (opps.findings.length > 0) {
    const s = frame(pptx, {
      eyebrow: "03  The program",
      title: "What we can change from this walk",
      theme: "light", pageNo: page++, images,
    });
    s.addText(
      "Each item below is already on the floor. It is not a catalogue of services. It is the work the findings justify.",
      {
        x: BODY_L, y: CONTENT_T, w: BODY_W, h: 0.36,
        fontFace: FONT, fontSize: 13, color: INK, margin: 0,
      },
    );
    opps.findings.slice(0, 6).forEach((f, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = BODY_L + col * 6.05;
      const y = CONTENT_T + 0.5 + row * 1.5;
      panel(s, x, y, 5.85, 1.38, CARD);
      s.addText(`${f.label}  ·  ${f.unitCount} station${f.unitCount === 1 ? "" : "s"}`, {
        x: x + 0.2, y: y + 0.14, w: 5.45, h: 0.35,
        fontFace: FONT, fontSize: 14, bold: true, color: NAVY, margin: 0,
      });
      s.addText(f.pitch, {
        x: x + 0.2, y: y + 0.52, w: 5.45, h: 0.7,
        fontFace: FONT, fontSize: 12, color: INK, margin: 0,
      });
    });
  }

  // ── Theme evidence (plant-specific only) ──────────────────────────────────
  if (themes.length > 0) {
    const shown = themes.slice(0, 2);
    const s = frame(pptx, {
      eyebrow: "03  The program",
      title: "Evidence, then the fix",
      theme: "light", pageNo: page++, images,
    });
    shown.forEach((theme, i) => {
      const x = BODY_L + i * 6.05;
      panel(s, x, CONTENT_T, 5.85, 5.05, CARD);
      const photo = theme.station?.machine.photos?.[0];
      const data = photo ? images.photos[photo.id] : undefined;
      if (data) {
        s.addImage({
          data, x: x + 0.14, y: CONTENT_T + 0.14, w: 5.57, h: 2.15,
          sizing: { type: "cover", w: 5.57, h: 2.15 },
        });
      }
      s.addText(theme.title, {
        x: x + 0.22, y: CONTENT_T + 2.42, w: 5.4, h: 0.4,
        fontFace: FONT, fontSize: 16, bold: true, color: NAVY, margin: 0,
      });
      s.addText(theme.pitch, {
        x: x + 0.22, y: CONTENT_T + 2.88, w: 5.4, h: 1.0,
        fontFace: FONT, fontSize: 13, color: INK, margin: 0,
      });
      const names = theme.station
        ? `${theme.station.tag}  ·  ${theme.station.machine.name}`
        : "";
      s.addText(names, {
        x: x + 0.22, y: CONTENT_T + 4.05, w: 5.4, h: 0.7,
        fontFace: FONT, fontSize: 12, color: GREY, margin: 0,
      });
    });
  }

  // ── Roadmap ───────────────────────────────────────────────────────────────
  {
    const s = frame(pptx, {
      eyebrow: "03  The program",
      title: "Recommended sequence",
      theme: "light", pageNo: page++, images,
    });
    s.addText(
      "Fund in this order so the first dollar goes to the asset that would stop the plant — or leave a safety function unprovable.",
      {
        x: BODY_L, y: CONTENT_T, w: BODY_W, h: 0.4,
        fontFace: FONT, fontSize: 14, color: INK, margin: 0,
      },
    );

    const immediate: string[] = [];
    if (noBackup) immediate.push("Image every processor that still has no current backup.");
    if (estop) immediate.push("Illuminate latched e-stops so a stop is obvious from the aisle.");
    if (hardwired) immediate.push("Put safety-circuit status on the HMI — which device opened.");
    if (risk.counts.critical > 0) {
      immediate.push(`Quote migration for the ${risk.counts.critical} critical platform${risk.counts.critical === 1 ? "" : "s"} on the register.`);
    }
    if (laptopCount) immediate.push("Panel diagnostics so recovery does not wait on a laptop.");
    if (immediate.length === 0) immediate.push("Confirm backups, spare strategy, and ownership of this register.");

    const shutdown: string[] = [];
    if (narrative.eolMachines) {
      shutdown.push("First controller migrations on discontinued platforms, aligned to the outage calendar.");
    }
    if (narrative.noHmi) shutdown.push("Graphical HMI with fault text and recovery on stations that have none.");
    if (narrative.trapped) shutdown.push("Unlock modern drives and servos already installed behind legacy processors.");
    if (shutdown.length === 0) shutdown.push("Use the next outage to close the highest remaining items on the register.");

    const program: string[] = [];
    const noScada = machinesWithFlags(mapping, ["no_scada"]).length;
    const noUtils = machinesWithFlags(mapping, ["no_utilities"]).length;
    if (noScada) program.push("Plant SCADA overview — one picture of running, starved, down, and why.");
    if (noUtils) program.push("Meter gas, water, air, and power at the line so cost has a number.");
    if (narrative.islands) program.push("Connect islands so the line can be balanced on data, not opinion.");
    program.push("Remaining platform migrations on a published successor path.");
    program.push("Keep the register current as vendor lifecycle states change.");

    const cols: { title: string; kicker: string; items: string[] }[] = [
      { kicker: "Now", title: "Immediate", items: immediate.slice(0, 4) },
      { kicker: "Next outage", title: "Shutdown window", items: shutdown.slice(0, 4) },
      { kicker: "Capital plan", title: "The program", items: program.slice(0, 4) },
    ];
    cols.forEach((col, i) => {
      const x = BODY_L + i * 4.05;
      panel(s, x, CONTENT_T + 0.55, 3.9, 4.5, CARD);
      s.addText(col.kicker.toUpperCase(), {
        x: x + 0.2, y: CONTENT_T + 0.72, w: 3.5, h: 0.22,
        fontFace: FONT, fontSize: 10, bold: true, charSpacing: 1.2, color: GREY, margin: 0,
      });
      s.addText(col.title, {
        x: x + 0.2, y: CONTENT_T + 0.96, w: 3.5, h: 0.4,
        fontFace: FONT, fontSize: 20, bold: true, color: NAVY, margin: 0,
      });
      col.items.forEach((item, j) => {
        s.addText(`${j + 1}.  ${item}`, {
          x: x + 0.2, y: CONTENT_T + 1.5 + j * 0.8, w: 3.5, h: 0.72,
          fontFace: FONT, fontSize: 13, color: INK, margin: 0,
        });
      });
    });
  }

  // ── Deliverables ──────────────────────────────────────────────────────────
  {
    const s = frame(pptx, {
      eyebrow: "03  The program",
      title: "What you now hold",
      theme: "light", pageNo: page++, images,
    });
    DELIVERABLES.forEach((d, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = BODY_L + col * 4.05;
      const y = CONTENT_T + row * 2.35;
      panel(s, x, y, 3.9, 2.15, CARD);
      s.addText(String(i + 1).padStart(2, "0"), {
        x: x + 0.18, y: y + 0.16, w: 3.54, h: 0.28,
        fontFace: FONT, fontSize: 12, bold: true, color: GREY, margin: 0,
      });
      s.addText(d.title, {
        x: x + 0.18, y: y + 0.48, w: 3.54, h: 0.4,
        fontFace: FONT, fontSize: 16, bold: true, color: NAVY, margin: 0,
      });
      s.addText(d.body, {
        x: x + 0.18, y: y + 0.95, w: 3.54, h: 0.95,
        fontFace: FONT, fontSize: 13, color: INK, margin: 0,
      });
    });
  }

  // ── Close ─────────────────────────────────────────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: NAVY };
    s.addShape("rect", { x: 0, y: 0, w: STRIPE_W, h: H, fill: { color: LIME }, line: { width: 0 } });
    if (images.logoWhite) {
      s.addImage({
        data: images.logoWhite, x: 11.45, y: 0.32, w: 1.15, h: 1.1,
        sizing: { type: "contain", w: 1.15, h: 1.1 },
      });
    }
    s.addText("THE NEXT CONVERSATION", {
      x: MARGIN_L, y: 1.7, w: 11.4, h: 0.28,
      fontFace: FONT, fontSize: 12, bold: true, charSpacing: 2.2, color: LIME, margin: 0,
    });
    s.addText("Act on the register before the failure writes the schedule.", {
      x: MARGIN_L, y: 2.15, w: 11.2, h: 1.15,
      fontFace: FONT, fontSize: 28, bold: true, color: WHITE, margin: 0,
    });
    s.addText(
      "A ranked list of discontinued platforms, undocumented safety, and missing visibility is only useful if the first item gets a date. I&I Automation will walk the critical migrations, the safety-status work, and the plant-systems scope against your shutdown calendar.",
      {
        x: MARGIN_L, y: 3.45, w: 10.6, h: 1.2,
        fontFace: FONT, fontSize: 16, color: PALE, margin: 0,
      },
    );
    s.addShape("rect", {
      x: MARGIN_L, y: 4.85, w: 1.4, h: 0.06, fill: { color: LIME }, line: { width: 0 },
    });
    s.addText("I&I Automation", {
      x: MARGIN_L, y: 5.15, w: 10, h: 0.36,
      fontFace: FONT, fontSize: 18, bold: true, color: WHITE, margin: 0,
    });
    s.addText(plant + (location ? `  ·  ${location}` : ""), {
      x: MARGIN_L, y: 5.55, w: 10, h: 0.28,
      fontFace: FONT, fontSize: 14, color: PALE, margin: 0,
    });
    s.addText(date, {
      x: MARGIN_L, y: 6.85, w: 8, h: 0.24,
      fontFace: FONT, fontSize: 12, color: GREY, margin: 0,
    });
  }

  return pptx;
}

function riskColor(f: RiskFinding): string {
  if (f.level === "critical") return "B91C1C";
  if (f.level === "high") return "C2410C";
  if (f.level === "watch") return "475569";
  return "B45309";
}

export function deckFileName(mapping: Mapping): string {
  const base = (mapping.plant_name ?? mapping.name ?? "Plant-Systems-Assessment")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  const plantWide = (mapping.source_lines?.length ?? 0) > 1 ? "-Plant" : "";
  return `${base}${plantWide}-Plant-Systems-Assessment.pptx`;
}

export const DECK_FONT_FALLBACK = FONT_FALLBACK;

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
  for (const theme of pickThemeExamples(mapping, new Set(), 2)) {
    addFirst(theme.station?.machine);
  }
  return out;
}

export async function downloadPresentation(mapping: Mapping): Promise<void> {
  const photos: Record<string, string> = {};

  await Promise.all(
    photosNeededForDeck(mapping).map(async (p) => {
      const data = await fetchImageAsJpeg(photoUrl(p.machine_id, p.filename, "deck"));
      if (data) photos[p.id] = data;
    }),
  );

  const [logoWhite, logoDark] = await Promise.all([
    toDataUri("/brand/deck-logo-white.png"),
    toDataUri("/brand/deck-logo-dark.png"),
  ]);

  const pptx = await buildPresentation({ mapping, images: { logoWhite, logoDark, photos } });
  await pptx.writeFile({ fileName: deckFileName(mapping) });
}

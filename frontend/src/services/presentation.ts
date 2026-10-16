import PptxGenJS from "pptxgenjs";
import type { Mapping, MappingMachine } from "../api/mappings";
import { photoUrl } from "../api/mappings";
import { buildRiskRegister, type RiskFinding } from "../data/riskRegister";
import { assessMachine, buildPlantNarrative } from "../data/machineAssessment";
import { type FlagKey } from "../data/observations";
import { machineTag } from "../data/consolidateMappings";
import {
  pickCriticalExamples, FLOOR_OFFERS, ALSO_ON_THE_FLOOR, SCADA_PAYOFFS,
} from "../data/deckOffers";
import { WHY_PILLARS, WHY_FOOTNOTE, ISA_CARDS } from "../data/deckStory";
import {
  NOTES_PREFIX, buildDeckTranscript, surveyCounts, type TranscriptSlide,
} from "../data/deckTranscript";

/**
 * Customer deck: survey → what they have → why obsolescence is a problem →
 * plant-systems slides they can delete → sequence → questions.
 * Speaker notes are optional (internal export only).
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
  /** PowerPoint speaker notes. Internal downloads only — omit on share links. */
  includeNotes?: boolean;
}

type Theme = "light" | "dark";

function fmtDate(d = new Date()): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function frame(
  pptx: PptxGenJS,
  opts: { eyebrow: string; title: string; theme: Theme; pageNo: number; images: DeckImages; notes?: string },
) {
  const { eyebrow, title, theme, pageNo, images, notes } = opts;
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

  if (notes) slide.addNotes(notes);

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

function photoIds(mapping: Mapping, limit = 8): string[] {
  const ids: string[] = [];
  for (const m of mapping.machines ?? []) {
    const p = m.photos?.[0];
    if (p && !ids.includes(p.id)) ids.push(p.id);
    if (ids.length >= limit) break;
  }
  return ids;
}

function placePhotos(
  slide: PptxGenJS.Slide,
  images: DeckImages,
  ids: string[],
  x: number, y: number, w: number, h: number,
) {
  const n = ids.filter((id) => images.photos[id]).length;
  if (n === 0) return;
  const shown = ids.filter((id) => images.photos[id]).slice(0, 4);
  const gap = 0.08;
  const cw = (w - gap * (shown.length - 1)) / shown.length;
  shown.forEach((id, i) => {
    slide.addImage({
      data: images.photos[id],
      x: x + i * (cw + gap), y, w: cw, h,
      sizing: { type: "cover", w: cw, h },
    });
  });
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
      `That is what we recorded on the floor — not a spare-parts wish list. ` +
      (risk.findings.length
        ? `The register names ${risk.findings.length} platform${risk.findings.length === 1 ? "" : "s"} so the next spend can happen in order.`
        : `The rest of this deck is what we saw, and the plant-systems work that usually follows.`)
    );
  }
  return (
    `Installed controllers in the surveyed scope at ${plant} are on current or mature platforms. ` +
    `The walk still recorded how the line is run, recovered, and seen. The slides after this are typical plant items — keep or delete what does not apply.`
  );
}

const Pptx = ((PptxGenJS as unknown as { default?: typeof PptxGenJS }).default ??
  PptxGenJS) as typeof PptxGenJS;

export async function buildPresentation({
  mapping, images, summary, preparedFor, includeNotes,
}: DeckOptions) {
  const pptx = new Pptx();
  pptx.defineLayout({ name: "IANDI", width: 13.33, height: 7.5 });
  pptx.layout = "IANDI";
  pptx.author = "I&I Automation";
  pptx.title = `${mapping.plant_name ?? mapping.name} — Automation Report`;
  pptx.subject = "Floor survey, lifecycle, and plant systems";

  const machines = mapping.machines ?? [];
  const assessments = machines.map(assessMachine);
  const risk = buildRiskRegister(mapping);
  const narrative = buildPlantNarrative(mapping);
  const critical = pickCriticalExamples(mapping, 3);
  const lines = mapping.source_lines ?? [];
  const plant = mapping.plant_name ?? mapping.name;
  const location = [mapping.city, mapping.state].filter(Boolean).join(", ");
  const date = fmtDate();
  const execSummary = (summary ?? "").trim() || autoSummary(mapping, narrative, risk);
  const counts = surveyCounts(mapping);
  const script = includeNotes ? buildDeckTranscript(mapping) : [];
  const notesFor = (id: string) => {
    if (!includeNotes) return undefined;
    const row = script.find((s: TranscriptSlide) => s.id === id);
    return row ? NOTES_PREFIX + row.talk : undefined;
  };

  const laptopCount = assessments.filter((a) => a.observations.recoverability === "laptop_required").length;
  const noBackup = machinesWithFlags(mapping, ["no_backup"]).length;
  const estop = machinesWithFlags(mapping, ["estop_unlit"]).length;
  const hardwired = machinesWithFlags(mapping, ["hardwired_safety"]).length;
  const collage = photoIds(mapping, 8);

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
    s.addText("AUTOMATION REPORT", {
      x: MARGIN_L, y: 1.35, w: 11.4, h: 0.32,
      fontFace: FONT, fontSize: 12, bold: true, charSpacing: 2.4,
      color: LIME, margin: 0,
    });
    s.addText(plant, {
      x: MARGIN_L, y: 1.75, w: 11.4, h: 0.7,
      fontFace: FONT, fontSize: 34, bold: true, color: WHITE, margin: 0, valign: "middle",
    });
    s.addText(
      [location, date].filter(Boolean).join("   ·   ") + (preparedFor ? `   ·   For ${preparedFor}` : ""),
      {
        x: MARGIN_L, y: 2.48, w: 11.4, h: 0.28,
        fontFace: FONT, fontSize: 13, color: PALE, margin: 0,
      },
    );
    s.addShape("rect", {
      x: MARGIN_L, y: 2.95, w: 1.4, h: 0.06, fill: { color: LIME }, line: { width: 0 },
    });
    s.addText("What we walked. What is installed. What to do next.", {
      x: MARGIN_L, y: 3.2, w: 11.4, h: 0.36,
      fontFace: FONT, fontSize: 16, bold: true, color: WHITE, margin: 0,
    });
    s.addText(
      `${counts.stations} station${counts.stations === 1 ? "" : "s"} documented` +
      (counts.lines > 1 ? ` across ${counts.lines} lines` : "") +
      " — controllers, HMIs, drives, and the plant systems that sit around them.",
      {
        x: MARGIN_L, y: 3.65, w: 10.6, h: 0.7,
        fontFace: FONT, fontSize: 16, color: PALE, margin: 0,
      },
    );
    placePhotos(s, images, collage, BODY_L, 4.55, BODY_W, 1.85);
    s.addText("PREPARED BY I&I AUTOMATION", {
      x: MARGIN_L, y: 6.85, w: 8, h: 0.24,
      fontFace: FONT, fontSize: 10, bold: true, charSpacing: 1.4, color: LIME, margin: 0,
    });
    const n = notesFor("title");
    if (n) s.addNotes(n);
  }

  // ── What we surveyed ──────────────────────────────────────────────────────
  {
    const s = frame(pptx, {
      eyebrow: "The visit",
      title: "What we surveyed",
      theme: "light", pageNo: page++, images, notes: notesFor("survey"),
    });
    const tiles: [string, string][] = [
      [String(counts.stations), "Stations"],
      [String(counts.lines > 1 ? counts.lines : 1), "Lines"],
      [String(counts.plc), "Controllers"],
      [String(counts.hmi), "HMIs"],
      [String(counts.vfd + counts.servo), "Drives / servo"],
      [String(counts.photos), "Photos"],
    ];
    tiles.forEach(([value, label], i) => {
      const col = i % 6;
      const x = BODY_L + col * 2.02;
      panel(s, x, CONTENT_T, 1.9, 1.55, CARD);
      s.addText(value, {
        x, y: CONTENT_T + 0.18, w: 1.9, h: 0.7,
        fontFace: FONT, fontSize: 28, bold: true, color: NAVY, align: "center", margin: 0,
      });
      s.addText(label.toUpperCase(), {
        x: x + 0.08, y: CONTENT_T + 0.95, w: 1.74, h: 0.4,
        fontFace: FONT, fontSize: 10, bold: true, color: GREY, align: "center", margin: 0,
      });
    });
    s.addText(
      "We walked the floor, read nameplates, and recorded how each station is run and recovered. This is the inventory the rest of the conversation uses.",
      {
        x: BODY_L, y: CONTENT_T + 1.75, w: BODY_W, h: 0.5,
        fontFace: FONT, fontSize: 14, color: INK, margin: 0,
      },
    );
    placePhotos(s, images, collage, BODY_L, CONTENT_T + 2.4, BODY_W, 2.55);
  }

  // ── Lines ─────────────────────────────────────────────────────────────────
  if (lines.length > 1) {
    const s = frame(pptx, {
      eyebrow: "The visit",
      title: "Lines we walked",
      theme: "light", pageNo: page++, images, notes: notesFor("lines"),
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
      s.addText(`${n} station${n === 1 ? "" : "s"} documented`, {
        x: x + 0.18, y: y + (compact ? 0.72 : 0.95), w: 3.54, h: 0.5,
        fontFace: FONT, fontSize: 13, color: INK, margin: 0,
      });
    });
  }

  // ── What we found ─────────────────────────────────────────────────────────
  {
    const s = frame(pptx, {
      eyebrow: "This plant",
      title: "What we found",
      theme: "light", pageNo: page++, images, notes: notesFor("found"),
    });
    s.addText(narrative.story, {
      x: BODY_L, y: CONTENT_T, w: BODY_W, h: 1.45,
      fontFace: FONT, fontSize: 15, color: INK, margin: 0,
    });
    const bullets = narrative.bullets.slice(0, 6);
    bullets.forEach((b, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = BODY_L + col * 6.05;
      const y = CONTENT_T + 1.6 + row * 0.95;
      panel(s, x, y, 5.85, 0.82, CARD);
      s.addShape("rect", { x, y, w: 0.08, h: 0.82, fill: { color: LIME }, line: { width: 0 } });
      s.addText(b, {
        x: x + 0.28, y: y + 0.12, w: 5.4, h: 0.58,
        fontFace: FONT, fontSize: 14, color: NAVY, margin: 0, valign: "middle",
      });
    });
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────
  {
    const s = frame(pptx, {
      eyebrow: "This plant",
      title: "The numbers",
      theme: "dark", pageNo: page++, images, notes: notesFor("snapshot"),
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
    s.addText("IN PLAIN LANGUAGE", {
      x: BODY_L + 0.28, y: CONTENT_T + 1.52, w: 11.3, h: 0.24,
      fontFace: FONT, fontSize: 10, bold: true, charSpacing: 1.4, color: LIME, margin: 0,
    });
    s.addText(execSummary, {
      x: BODY_L + 0.28, y: CONTENT_T + 1.85, w: 11.3, h: 2.8,
      fontFace: FONT, fontSize: 16, color: WHITE, margin: 0,
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  {
    const s = frame(pptx, {
      eyebrow: "This plant",
      title: "Equipment lifecycle",
      theme: "dark", pageNo: page++, images, notes: notesFor("lifecycle"),
    });
    s.addText(
      "The hardware can still be blinking. That is not the same as being supported. When a family goes end of life, parts, software, and the people who know it all get scarce — and a failure takes longer to recover.",
      {
        x: BODY_L, y: CONTENT_T, w: BODY_W, h: 0.7,
        fontFace: FONT, fontSize: 14, color: PALE, margin: 0,
      },
    );
    const bands: [string, string, string][] = [
      [String(risk.counts.critical), "Critical", "B91C1C"],
      [String(risk.counts.high), "High", "C2410C"],
      [String(risk.counts.moderate), "Moderate", "B45309"],
      [String(risk.counts.watch), "Watch", "94A3B8"],
    ];
    bands.forEach(([value, label, color], i) => {
      const x = BODY_L + i * 3.05;
      panel(s, x, CONTENT_T + 0.9, 2.9, 1.55, "0B1466");
      s.addShape("rect", { x, y: CONTENT_T + 0.9, w: 0.1, h: 1.55, fill: { color }, line: { width: 0 } });
      s.addText(value, {
        x: x + 0.28, y: CONTENT_T + 1.02, w: 2.4, h: 0.7,
        fontFace: FONT, fontSize: 36, bold: true, color: WHITE, margin: 0,
      });
      s.addText(label.toUpperCase(), {
        x: x + 0.28, y: CONTENT_T + 1.74, w: 2.4, h: 0.28,
        fontFace: FONT, fontSize: 11, bold: true, charSpacing: 1.1, color: PALE, margin: 0,
      });
    });
    s.addText(
      `${risk.totalUnits} unit${risk.totalUnits === 1 ? "" : "s"} across ${risk.affectedMachines} of ${risk.totalMachines} stations. ` +
      "The score ranks this plant’s installed base. It is not a SIL calculation.",
      {
        x: BODY_L, y: CONTENT_T + 2.7, w: BODY_W, h: 0.55,
        fontFace: FONT, fontSize: 13, color: PALE, margin: 0,
      },
    );
    const estopPic = images.refs?.estop;
    if (estopPic) {
      s.addImage({
        data: estopPic, x: BODY_L, y: 5.35, w: 2.4, h: 1.35,
        sizing: { type: "cover", w: 2.4, h: 1.35 },
      });
      s.addText("Support ending quietly is how a Saturday failure becomes a week.", {
        x: BODY_L + 2.6, y: 5.55, w: 9.2, h: 0.9,
        fontFace: FONT, fontSize: 14, italic: true, color: LIME, margin: 0, valign: "middle",
      });
    }
  }

  // ── Register ──────────────────────────────────────────────────────────────
  if (risk.findings.length > 0) {
    const rows = risk.findings.slice(0, 8);
    const s = frame(pptx, {
      eyebrow: "This plant",
      title: "Risk register",
      theme: "light", pageNo: page++, images, notes: notesFor("register"),
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
      s.addText(`${f.make} ${f.model}`.trim(), {
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
  }

  // ── Stations ──────────────────────────────────────────────────────────────
  {
    const examples = critical.length
      ? critical.slice(0, 3)
      : machines.slice(0, 3).map((machine, index) => ({
          machine, index, tag: machineTag(machine, index),
          assessment: assessMachine(machine), score: 0, why: machine.name,
        }));
    if (examples.length > 0) {
      const s = frame(pptx, {
        eyebrow: "This plant",
        title: "Stations that tell the story",
        theme: "light", pageNo: page++, images, notes: notesFor("stations"),
      });
      examples.forEach((ex, i) => {
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
          "Documented on this walk.";
        s.addText(detail, {
          x: x + 0.18, y: CONTENT_T + 3.6, w: 3.54, h: 1.25,
          fontFace: FONT, fontSize: 11, color: GREY, margin: 0,
        });
      });
    }
  }

  // ── Why obsolescence is bad ───────────────────────────────────────────────
  {
    const s = frame(pptx, {
      eyebrow: "Why this matters",
      title: "Why obsolescence is a problem",
      theme: "dark", pageNo: page++, images, notes: notesFor("why"),
    });
    s.addText(
      "The line can run reliably while the next crisis is already in the cabinet. The controller is still blinking. The vendor is not.",
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
        x: x + 0.18, y: y + 0.14, w: 5.5, h: 0.22,
        fontFace: FONT, fontSize: 10, bold: true, charSpacing: 0.8, color: LIME, margin: 0,
      });
      s.addText(p.title, {
        x: x + 0.18, y: y + 0.4, w: 5.5, h: 0.4,
        fontFace: FONT, fontSize: 16, bold: true, color: WHITE, margin: 0,
      });
      s.addText(p.body, {
        x: x + 0.18, y: y + 0.88, w: 5.5, h: 1.02,
        fontFace: FONT, fontSize: 13, color: PALE, margin: 0,
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
      eyebrow: "Why this matters",
      title: "What the standards already say",
      theme: "light", pageNo: page++, images, notes: notesFor("isa"),
    });
    s.addText(
      "This is not our opinion that old equipment is inconvenient. These are the rules a live plant is already expected to run against.",
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
        fontFace: FONT, fontSize: 13, color: INK, margin: 0,
      });
    });
  }

  // ── Always-on floor offers ────────────────────────────────────────────────
  for (const offer of FLOOR_OFFERS) {
    const s = frame(pptx, {
      eyebrow: offer.eyebrow,
      title: offer.title,
      theme: "light", pageNo: page++, images, notes: notesFor(`offer:${offer.key}`),
    });
    const pic = offer.photo ? images.refs?.[offer.photo] : undefined;
    if (pic) {
      s.addImage({
        data: pic, x: BODY_L, y: CONTENT_T, w: 5.55, h: 4.55,
        sizing: { type: "cover", w: 5.55, h: 4.55 },
      });
    } else {
      panel(s, BODY_L, CONTENT_T, 5.55, 4.55, NAVY);
    }
    s.addText(offer.pitch, {
      x: 6.55, y: CONTENT_T, w: 6.1, h: 1.55,
      fontFace: FONT, fontSize: 14, color: INK, margin: 0,
    });
    offer.bullets.forEach((b, i) => {
      const y = CONTENT_T + 1.7 + i * 0.7;
      panel(s, 6.55, y, 6.1, 0.62, CARD);
      s.addShape("rect", { x: 6.55, y, w: 0.08, h: 0.62, fill: { color: LIME }, line: { width: 0 } });
      s.addText(b, {
        x: 6.8, y, w: 5.7, h: 0.62,
        fontFace: FONT, fontSize: 13, color: NAVY, margin: 0, valign: "middle",
      });
    });
    const tagged = offer.flags ? machinesWithFlags(mapping, offer.flags).length : 0;
    s.addText(
      tagged
        ? `On this walk: ${tagged} station${tagged === 1 ? "" : "s"} tagged.`
        : "Not tagged on this visit — delete this slide if it does not apply.",
      {
        x: 6.55, y: 6.45, w: 6.1, h: 0.35,
        fontFace: FONT, fontSize: 11, italic: true, color: GREY, margin: 0,
      },
    );
  }

  // ── SCADA payoffs ─────────────────────────────────────────────────────────
  {
    const s = frame(pptx, {
      eyebrow: "Plant systems",
      title: "What SCADA puts on the screen",
      theme: "light", pageNo: page++, images, notes: notesFor("scada-payoffs"),
    });
    SCADA_PAYOFFS.forEach((p, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = BODY_L + col * 4.05;
      const y = CONTENT_T + row * 1.7;
      panel(s, x, y, 3.9, 1.55, CARD);
      s.addText(p.title, {
        x: x + 0.16, y: y + 0.12, w: 3.58, h: 0.32,
        fontFace: FONT, fontSize: 14, bold: true, color: NAVY, margin: 0,
      });
      s.addText(p.body, {
        x: x + 0.16, y: y + 0.48, w: 3.58, h: 0.92,
        fontFace: FONT, fontSize: 12, color: INK, margin: 0,
      });
    });
  }

  // ── Also on the floor ─────────────────────────────────────────────────────
  {
    const s = frame(pptx, {
      eyebrow: "Plant systems",
      title: "What else this walk covers",
      theme: "light", pageNo: page++, images, notes: notesFor("also"),
    });
    ALSO_ON_THE_FLOOR.forEach((p, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = BODY_L + col * 4.05;
      const y = CONTENT_T + row * 2.35;
      panel(s, x, y, 3.9, 2.15, CARD);
      s.addText(p.title, {
        x: x + 0.18, y: y + 0.2, w: 3.54, h: 0.5,
        fontFace: FONT, fontSize: 16, bold: true, color: NAVY, margin: 0,
      });
      s.addText(p.body, {
        x: x + 0.18, y: y + 0.75, w: 3.54, h: 1.15,
        fontFace: FONT, fontSize: 13, color: INK, margin: 0,
      });
    });
  }

  // ── Roadmap ───────────────────────────────────────────────────────────────
  {
    const s = frame(pptx, {
      eyebrow: "Next",
      title: "Recommended sequence",
      theme: "light", pageNo: page++, images, notes: notesFor("roadmap"),
    });
    s.addText("A starting order. Move items to match your shutdown calendar.", {
      x: BODY_L, y: CONTENT_T, w: BODY_W, h: 0.32,
      fontFace: FONT, fontSize: 14, color: INK, margin: 0,
    });

    const immediate: string[] = [
      "Image processors that still have no current backup.",
      "Illuminate latched e-stops so a stop is obvious from the aisle.",
      "Put safety-circuit status on the HMI — which device opened.",
    ];
    if (risk.counts.critical > 0) {
      immediate.splice(0, 0, `Quote migration for the ${risk.counts.critical} critical platform${risk.counts.critical === 1 ? "" : "s"} on the register.`);
    }
    if (laptopCount) immediate.push("Panel diagnostics so recovery does not wait on a laptop.");
    if (noBackup === 0 && estop === 0 && hardwired === 0 && risk.counts.critical === 0) {
      /* keep the generic three */
    }

    const shutdown: string[] = [
      "First controller migrations on discontinued platforms, aligned to the outage.",
      "Graphical HMI with fault text on stations that have none.",
      "Unlock modern drives and servos sitting behind a legacy processor.",
    ];
    const program: string[] = [
      "Plant SCADA overview — running, starved, down, and why.",
      "Meter gas, water, air, and power at the line.",
      "Connect islands so the line can be balanced on data.",
      "Keep the register current as vendor lifecycle states change.",
    ];

    const cols: { title: string; kicker: string; items: string[] }[] = [
      { kicker: "Now", title: "Immediate", items: immediate.slice(0, 4) },
      { kicker: "Next outage", title: "Shutdown window", items: shutdown.slice(0, 4) },
      { kicker: "Capital plan", title: "The program", items: program.slice(0, 4) },
    ];
    cols.forEach((col, i) => {
      const x = BODY_L + i * 4.05;
      panel(s, x, CONTENT_T + 0.45, 3.9, 4.6, CARD);
      s.addText(col.kicker.toUpperCase(), {
        x: x + 0.2, y: CONTENT_T + 0.62, w: 3.5, h: 0.22,
        fontFace: FONT, fontSize: 10, bold: true, charSpacing: 1.2, color: GREY, margin: 0,
      });
      s.addText(col.title, {
        x: x + 0.2, y: CONTENT_T + 0.86, w: 3.5, h: 0.4,
        fontFace: FONT, fontSize: 20, bold: true, color: NAVY, margin: 0,
      });
      col.items.forEach((item, j) => {
        s.addText(`${j + 1}.  ${item}`, {
          x: x + 0.2, y: CONTENT_T + 1.4 + j * 0.8, w: 3.5, h: 0.72,
          fontFace: FONT, fontSize: 13, color: INK, margin: 0,
        });
      });
    });
  }

  // ── Any questions? ────────────────────────────────────────────────────────
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
    s.addText("I&I AUTOMATION", {
      x: MARGIN_L, y: 2.35, w: 11.4, h: 0.28,
      fontFace: FONT, fontSize: 12, bold: true, charSpacing: 2.2, color: LIME, margin: 0,
    });
    s.addText("Any questions?", {
      x: MARGIN_L, y: 2.8, w: 11.2, h: 1.1,
      fontFace: FONT, fontSize: 48, bold: true, color: WHITE, margin: 0,
    });
    s.addShape("rect", {
      x: MARGIN_L, y: 4.1, w: 1.4, h: 0.06, fill: { color: LIME }, line: { width: 0 },
    });
    s.addText(plant + (location ? `  ·  ${location}` : ""), {
      x: MARGIN_L, y: 4.4, w: 10, h: 0.32,
      fontFace: FONT, fontSize: 16, color: PALE, margin: 0,
    });
    s.addText(date, {
      x: MARGIN_L, y: 6.85, w: 8, h: 0.24,
      fontFace: FONT, fontSize: 12, color: GREY, margin: 0,
    });
    const n = notesFor("questions");
    if (n) s.addNotes(n);
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
  const base = (mapping.plant_name ?? mapping.name ?? "Automation-Report")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  const plantWide = (mapping.source_lines?.length ?? 0) > 1 ? "-Plant" : "";
  return `${base}${plantWide}-Automation-Report.pptx`;
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
    addFirst(machine);
    if (out.length >= 8) break;
  }
  for (const example of pickCriticalExamples(mapping, 3)) {
    addFirst(example.machine);
  }
  return out;
}

export async function downloadPresentation(
  mapping: Mapping,
  opts: { includeNotes?: boolean } = {},
): Promise<void> {
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

  const refs: Record<string, string> = {};
  const refKeys = [...new Set(FLOOR_OFFERS.map((o) => o.photo).filter(Boolean))] as string[];
  await Promise.all(
    refKeys.map(async (key) => {
      const data = await fetchImageAsJpeg(`/deck-refs/${key}.jpg`, 1100, 0.78, true);
      if (data) refs[key] = data;
    }),
  );

  const pptx = await buildPresentation({
    mapping,
    images: { logoWhite, logoDark, photos, refs },
    includeNotes: opts.includeNotes ?? false,
  });
  await pptx.writeFile({ fileName: deckFileName(mapping) });
}

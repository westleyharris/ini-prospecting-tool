import PptxGenJS from "pptxgenjs";
import type { Mapping, MappingMachine } from "../api/mappings";
import { photoUrl } from "../api/mappings";
import { buildRiskRegister, type RiskFinding } from "../data/riskRegister";
import { assessMachine, buildPlantNarrative } from "../data/machineAssessment";
import { type FlagKey } from "../data/observations";
import {
  pickCriticalExamples, pickDiscontinuedStations, pickTrappedStations,
  FLOOR_OFFERS, type ProblemStation,
} from "../data/deckOffers";
import { WHY_PILLARS, WHY_FOOTNOTE } from "../data/deckStory";

/**
 * Customer deck: what we found → why obsolescence is a problem →
 * plant-systems slides they can delete → sequence → questions.
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

function surveyCounts(mapping: Mapping) {
  const machines = mapping.machines ?? [];
  return {
    stations: machines.length,
    lines: mapping.source_lines?.length ?? 0,
    plc: machines.filter((m) => m.plc_make || m.plc_model).length,
    hmi: machines.filter((m) => m.hmi_make || m.hmi_model).length,
    vfd: machines.filter((m) => m.vfd_make || m.vfd_model).length,
    servo: machines.filter((m) =>
      m.servo_drive_make || m.servo_drive_model || m.servo_motor_make || m.servo_motor_model
    ).length,
    photos: machines.reduce((n, m) => n + (m.photos?.length ?? 0), 0),
  };
}

function photoIds(mapping: Mapping, limit = 8): string[] {
  const ids: string[] = [];
  const add = (machine?: MappingMachine) => {
    const p = machine?.photos?.[0];
    if (p && !ids.includes(p.id) && ids.length < limit) ids.push(p.id);
  };
  for (const s of pickDiscontinuedStations(mapping, limit)) add(s.machine);
  for (const s of pickTrappedStations(mapping, limit)) add(s.machine);
  for (const m of mapping.machines ?? []) add(m);
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

function addEvidenceSlide(opts: {
  pptx: PptxGenJS;
  images: DeckImages;
  page: number;
  eyebrow: string;
  title: string;
  pitch: string;
  stations: ProblemStation[];
  names: string[];
  total: number;
}) {
  const { pptx, images, page, eyebrow, title, pitch, stations, names, total } = opts;
  const s = frame(pptx, { eyebrow, title, theme: "light", pageNo: page, images });
  s.addText(pitch, {
    x: BODY_L, y: CONTENT_T, w: BODY_W, h: 0.7,
    fontFace: FONT, fontSize: 14, color: INK, margin: 0,
  });

  const pictured = stations.filter((st) => st.machine.photos?.[0] && images.photos[st.machine.photos[0].id]).slice(0, 3);
  pictured.forEach((st, i) => {
    const x = BODY_L + i * 4.05;
    const photo = st.machine.photos![0];
    s.addImage({
      data: images.photos[photo.id],
      x, y: CONTENT_T + 0.78, w: 3.9, h: 1.95,
      sizing: { type: "cover", w: 3.9, h: 1.95 },
    });
    s.addShape("rect", {
      x, y: CONTENT_T + 2.73, w: 3.9, h: 0.05, fill: { color: LIME }, line: { width: 0 },
    });
    s.addText(st.label, {
      x, y: CONTENT_T + 2.82, w: 3.9, h: 0.26,
      fontFace: FONT, fontSize: 12, bold: true, color: NAVY, margin: 0,
    });
    const hw = [st.plc, st.drive].filter(Boolean).join("  +  ");
    if (hw) {
      s.addText(hw, {
        x, y: CONTENT_T + 3.06, w: 3.9, h: 0.22,
        fontFace: FONT, fontSize: 10, color: GREY, margin: 0,
      });
    }
  });
  if (pictured.length === 0) {
    panel(s, BODY_L, CONTENT_T + 0.78, BODY_W, 1.95, CARD);
    s.addText("Photos from this walk attach here when they are on file.", {
      x: BODY_L + 0.3, y: CONTENT_T + 1.5, w: BODY_W - 0.6, h: 0.5,
      fontFace: FONT, fontSize: 13, color: GREY, margin: 0,
    });
  }

  const listY = CONTENT_T + 3.34;
  const shown = names.slice(0, 12);
  const rest = Math.max(0, total - shown.length);
  s.addText("Stations", {
    x: BODY_L, y: listY, w: BODY_W, h: 0.22,
    fontFace: FONT, fontSize: 10, bold: true, charSpacing: 1.1, color: GREY, margin: 0,
  });
  s.addText(
    shown.join("   ·   ") + (rest > 0 ? `   ·   +${rest} more` : ""),
    {
      x: BODY_L, y: listY + 0.24, w: BODY_W, h: 1.35,
      fontFace: FONT, fontSize: 13, color: INK, margin: 0,
    },
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
  mapping, images, summary, preparedFor,
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
  const eolExamples = pickDiscontinuedStations(mapping, 8);
  const trappedExamples = pickTrappedStations(mapping, 8);
  const lines = mapping.source_lines ?? [];
  const plant = mapping.plant_name ?? mapping.name;
  const location = [mapping.city, mapping.state].filter(Boolean).join(", ");
  const date = fmtDate();
  const execSummary = (summary ?? "").trim() || autoSummary(mapping, narrative, risk);
  const counts = surveyCounts(mapping);

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
  }

  // ── What we found (survey + pie) ──────────────────────────────────────────
  {
    const s = frame(pptx, {
      eyebrow: "This plant",
      title: "What we found",
      theme: "light", pageNo: page++, images,
    });
    const lineBit = lines.length > 1 ? `${lines.length} lines · ` : "";
    s.addText(
      `${lineBit}${counts.stations} stations · ${counts.plc} controllers · ${counts.hmi} HMIs. ${execSummary}`,
      {
        x: BODY_L, y: CONTENT_T, w: BODY_W, h: 0.85,
        fontFace: FONT, fontSize: 14, color: INK, margin: 0,
      },
    );

    const eol = narrative.eolMachines;
    const current = Math.max(0, narrative.machineCount - eol);
    if (narrative.machineCount > 0) {
      s.addChart("pie", [
        { name: "Stations", labels: ["Discontinued", "Current / mature"], values: [eol, current] },
      ], {
        x: BODY_L - 0.1, y: CONTENT_T + 0.88, w: 4.8, h: 4.0,
        showPercent: true,
        showLegend: true,
        legendPos: "b",
        chartColors: ["B91C1C", "050A3C"],
        showTitle: false,
        showValue: false,
      });
    }
    const facts: [string, string][] = [
      [String(eol), "Stations on discontinued hardware"],
      [String(risk.counts.critical), "Critical platforms (PLC-5 and similar)"],
      [String(narrative.trapped), "Modern drives behind a legacy PLC"],
    ];
    facts.forEach((item, i) => {
      const y = CONTENT_T + 1.05 + i * 1.2;
      panel(s, 5.7, y, 6.95, 1.08, CARD);
      s.addText(item[0], {
        x: 5.9, y: y + 0.12, w: 1.4, h: 0.84,
        fontFace: FONT, fontSize: 28, bold: true, color: NAVY, margin: 0, valign: "middle",
      });
      s.addText(item[1], {
        x: 7.4, y: y + 0.18, w: 5.0, h: 0.72,
        fontFace: FONT, fontSize: 15, color: INK, margin: 0, valign: "middle",
      });
    });
  }

  // ── Why obsolescence is a problem (before examples) ───────────────────────
  {
    const s = frame(pptx, {
      eyebrow: "Why this matters",
      title: "Why obsolescence is a problem",
      theme: "dark", pageNo: page++, images,
    });
    s.addText(
      "The hardware can still be running. That is not the same as being supported. This is what “end of life” actually does on a floor.",
      {
        x: BODY_L, y: CONTENT_T, w: BODY_W, h: 0.48,
        fontFace: FONT, fontSize: 14, color: PALE, margin: 0,
      },
    );
    WHY_PILLARS.forEach((p, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = BODY_L + col * 6.05;
      const y = CONTENT_T + 0.58 + row * 2.18;
      panel(s, x, y, 5.85, 2.04, "0B1466");
      s.addShape("ellipse", {
        x: x + 0.18, y: y + 0.16, w: 0.34, h: 0.34,
        fill: { color: LIME }, line: { width: 0 },
      });
      s.addText(String(i + 1), {
        x: x + 0.18, y: y + 0.16, w: 0.34, h: 0.34,
        fontFace: FONT, fontSize: 13, bold: true, color: NAVY,
        align: "center", valign: "middle", margin: 0,
      });
      s.addText(p.kicker.toUpperCase(), {
        x: x + 0.62, y: y + 0.2, w: 5.0, h: 0.26,
        fontFace: FONT, fontSize: 10, bold: true, charSpacing: 0.8, color: LIME, margin: 0, valign: "middle",
      });
      s.addText(p.title, {
        x: x + 0.18, y: y + 0.56, w: 5.5, h: 0.38,
        fontFace: FONT, fontSize: 15, bold: true, color: WHITE, margin: 0,
      });
      s.addText(p.body, {
        x: x + 0.18, y: y + 0.96, w: 5.5, h: 0.94,
        fontFace: FONT, fontSize: 12, color: PALE, margin: 0,
      });
    });
    s.addText(WHY_FOOTNOTE, {
      x: BODY_L, y: 6.78, w: 11.4, h: 0.22,
      fontFace: FONT, fontSize: 8, color: GREY, margin: 0,
    });
  }

  // ── Discontinued platforms — real stations ────────────────────────────────
  {
    const plcHits = risk.findings.filter((f) => f.category === "plc" && f.status !== "mature");
    const seen = new Set<string>();
    const names: string[] = [];
    for (const f of plcHits) {
      for (const m of f.machines) {
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        names.push(m.name);
      }
    }
    for (const s of eolExamples) {
      if (seen.has(s.machine.id)) continue;
      seen.add(s.machine.id);
      names.push(s.label);
    }
    if (eolExamples.length > 0 || names.length > 0) {
      const families = plcHits.map((f) => `${f.make} ${f.model}`.trim() + ` · ${f.unitCount}`);
      const title = plcHits.length === 1
        ? `${plcHits[0].make} ${plcHits[0].model}`.trim()
        : "Discontinued platforms";
      const total = names.length || eolExamples.length;
      addEvidenceSlide({
        pptx, images, page: page++,
        eyebrow: "On this floor",
        title,
        pitch:
          (families.length ? `${families.join("   |   ")}. ` : "") +
          `Last-ship is over. A spare is a broker search. The software to get online is a skill that is leaving the building.`,
        stations: eolExamples,
        names,
        total,
      });
    }
  }

  // ── Trapped modern ────────────────────────────────────────────────────────
  if (trappedExamples.length > 0 || narrative.trapped > 0) {
    addEvidenceSlide({
      pptx, images, page: page++,
      eyebrow: "On this floor",
      title: "Modern drive, legacy PLC",
      pitch:
        `${narrative.trapped || trappedExamples.length} station${(narrative.trapped || trappedExamples.length) === 1 ? "" : "s"} already paid for a current drive or servo. ` +
        `The processor in front of it cannot show speed, current, or why it tripped. Replace the PLC and the hardware they bought starts talking.`,
      stations: trappedExamples,
      names: trappedExamples.map((s) =>
        [s.label, [s.plc, s.drive].filter(Boolean).join(" + ")].filter(Boolean).join(" — "),
      ),
      total: narrative.trapped || trappedExamples.length,
    });
  }

  // ── Register ──────────────────────────────────────────────────────────────
  if (risk.findings.length > 0) {
    const rows = risk.findings.slice(0, 8);
    const s = frame(pptx, {
      eyebrow: "This plant",
      title: "Risk register",
      theme: "light", pageNo: page++, images,
    });
    const headers = ["Platform", "Level", "Units", "Where it sits"];
    const colX = [BODY_L, 4.55, 5.7, 6.7];
    const colW = [3.65, 1.05, 0.9, 5.95];
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
      const where = f.machines.slice(0, 2).map((m) => m.name).join("   ·   ")
        + (f.machines.length > 2 ? `   +${f.machines.length - 2}` : "");
      s.addText(where, {
        x: colX[3], y, w: colW[3], h: 0.44,
        fontFace: FONT, fontSize: 11, color: INK, margin: 0, valign: "middle",
      });
    });
  }

  // ── Always-on floor offers ────────────────────────────────────────────────
  for (const offer of FLOOR_OFFERS) {
    if (offer.key === "trapped" && (trappedExamples.length > 0 || narrative.trapped > 0)) continue;
    const s = frame(pptx, {
      eyebrow: offer.eyebrow,
      title: offer.title,
      theme: "light", pageNo: page++, images,
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

  // ── Roadmap ───────────────────────────────────────────────────────────────
  {
    const s = frame(pptx, {
      eyebrow: "Next",
      title: "Recommended sequence",
      theme: "light", pageNo: page++, images,
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
  for (const example of pickDiscontinuedStations(mapping, 8)) {
    addFirst(example.machine);
  }
  for (const example of pickTrappedStations(mapping, 8)) {
    addFirst(example.machine);
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
  });
  await pptx.writeFile({ fileName: deckFileName(mapping) });
}

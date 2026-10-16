import type { Mapping } from "../api/mappings";
import { buildRiskRegister } from "./riskRegister";
import { buildPlantNarrative } from "./machineAssessment";
import { FLOOR_OFFERS, pickDiscontinuedStations, pickTrappedStations } from "./deckOffers";
import { assessMachine } from "./machineAssessment";
import type { FlagKey } from "./observations";

export interface TranscriptSlide {
  id: string;
  title: string;
  talk: string;
}

export const NOTES_PREFIX = "INTERNAL SPEAKER NOTES — do not project.\n\n";

export function surveyCounts(mapping: Mapping) {
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

function flagCount(mapping: Mapping, keys: FlagKey[]): number {
  const want = new Set(keys);
  return (mapping.machines ?? []).filter((m) =>
    assessMachine(m).flags.some((f) => want.has(f.key)),
  ).length;
}

/**
 * Talk track for the deck, in slide order.
 * Internal only — PowerPoint notes (when exported from the app) and the Talk track tab.
 */
export function buildDeckTranscript(mapping: Mapping): TranscriptSlide[] {
  const plant = mapping.plant_name ?? mapping.name;
  const location = [mapping.city, mapping.state].filter(Boolean).join(", ");
  const c = surveyCounts(mapping);
  const narrative = buildPlantNarrative(mapping);
  const risk = buildRiskRegister(mapping);
  const eol = pickDiscontinuedStations(mapping, 6);
  const trapped = pickTrappedStations(mapping, 6);
  const plcHits = risk.findings.filter((f) => f.category === "plc" && f.status !== "mature");
  const plcHit = plcHits[0];
  const slides: TranscriptSlide[] = [];

  slides.push({
    id: "title",
    title: "Title",
    talk:
      `This is the walk at ${plant}${location ? ` in ${location}` : ""}. ` +
      `${c.stations} stations` + (c.lines > 1 ? ` across ${c.lines} lines` : "") + `. ` +
      `Then: what is aging out, why that is a problem in real terms, the actual stations, the register, then plant-systems slides they can delete.`,
  });

  slides.push({
    id: "found",
    title: "What we found",
    talk:
      `Pie first: ${narrative.eolMachines} discontinued vs ${Math.max(0, narrative.machineCount - narrative.eolMachines)} current. ` +
      `Then the three numbers — discontinued stations, critical platforms, modern drives behind a legacy PLC. Do not linger. Go to why.`,
  });

  slides.push({
    id: "why",
    title: "Why obsolescence is a problem",
    talk:
      `Stay on the floor. Do not read ISA. ` +
      `1) The person who still knows the old software is one vacation away from a long outage. ` +
      `2) The OEM does not ship the card. Someone is on eBay or a broker. ` +
      `3) Troubleshooting is a laptop, a vintage cable, and a license that may not activate. ` +
      `4) One dead processor is not a $2,000 part — it is the line. ` +
      `Then go to their stations so it is not theoretical.`,
  });

  if (eol.length > 0 || plcHits.length > 0) {
    const names = plcHits.flatMap((f) => f.machines.map((m) => m.name)).slice(0, 6).join("; ");
    const families = plcHits.map((f) => `${f.make} ${f.model} (${f.unitCount})`.trim()).join("; ");
    slides.push({
      id: "eol-examples",
      title: plcHits.length === 1 && plcHit
        ? `${plcHit.make} ${plcHit.model}`.trim()
        : "Discontinued platforms",
      talk:
        `Point at the photos. Families: ${families || "discontinued controllers"}. ` +
        `Read the stations: ${names || eol.map((s) => s.label).slice(0, 3).join("; ")}. ` +
        `A spare is a broker. The software to get online is a dying skill. Then the trapped-drive slide if you have one.`,
    });
  }

  if (trapped.length > 0 || narrative.trapped > 0) {
    slides.push({
      id: "trapped-examples",
      title: "Modern drive, legacy PLC",
      talk:
        `They already bought the drive. The old PLC cannot show speed, current, or the trip. ` +
        `Read two cabinets: ${trapped.slice(0, 2).map((s) => `${s.label}${s.drive ? ` — ${s.drive}` : ""}`).join("; ")}. ` +
        `The fix is the processor, not another drive.`,
    });
  }

  if (risk.findings.length > 0) {
    const top = risk.findings.slice(0, 3).map((f) => `${f.make} ${f.model} (${f.level})`.trim()).join("; ");
    slides.push({
      id: "register",
      title: "Risk register",
      talk:
        `PLC-5 and other discontinued controllers are Critical on purpose. Lead with ${top}. ` +
        `This is the list they can fund. Then the plant-systems slides — skip any they already have.`,
    });
  }

  for (const offer of FLOOR_OFFERS) {
    if (offer.key === "trapped" && (trapped.length > 0 || narrative.trapped > 0)) continue;
    const n = offer.flags ? flagCount(mapping, offer.flags) : 0;
    const tagged = n
      ? `On this walk we tagged ${n} station${n === 1 ? "" : "s"}.`
      : `Not tagged here — they can delete the slide.`;
    slides.push({
      id: `offer:${offer.key}`,
      title: offer.title,
      talk: `${offer.pitch} ${tagged}`,
    });
  }

  slides.push({
    id: "roadmap",
    title: "Recommended sequence",
    talk:
      `Now / next outage / program. Immediate is backups, e-stops, and quoting the critical PLC family. Ask for a date on item one.`,
  });

  slides.push({
    id: "questions",
    title: "Any questions?",
    talk: `Stop talking. If it is quiet: “What would you do in the next 90 days?” is the left column.`,
  });

  return slides;
}

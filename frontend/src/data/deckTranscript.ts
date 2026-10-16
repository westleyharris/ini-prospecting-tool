import type { Mapping } from "../api/mappings";
import { buildRiskRegister } from "./riskRegister";
import { buildPlantNarrative } from "./machineAssessment";
import { FLOOR_OFFERS } from "./deckOffers";
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
  const lines = mapping.source_lines ?? [];
  const slides: TranscriptSlide[] = [];

  slides.push({
    id: "title",
    title: "Title",
    talk:
      `This is the walk we did at ${plant}${location ? ` in ${location}` : ""}. ` +
      `We are not pitching a catalogue. We are showing what is installed, what is aging out, and a handful of plant-systems items we see on almost every floor. ` +
      `Invite them to stop you. The last slide is questions.`,
  });

  slides.push({
    id: "survey",
    title: "What we surveyed",
    talk:
      `Start here so they know the visit was real. ${c.stations} station${c.stations === 1 ? "" : "s"}` +
      (c.lines > 1 ? ` across ${c.lines} lines` : "") +
      `. Controllers on ${c.plc}, HMIs on ${c.hmi}, drives on ${c.vfd}, servo packages on ${c.servo}. ` +
      (c.photos ? `${c.photos} field photo${c.photos === 1 ? "" : "s"} came back with us. ` : "Nameplates and programs — photos where we could get them. ") +
      `This slide is the scope. Everything after it is either what we found in that scope, or a typical plant item they can keep or delete.`,
  });

  if (lines.length > 1) {
    slides.push({
      id: "lines",
      title: "Lines we walked",
      talk:
        `${lines.length} lines: ${lines.map((l) => `${l.name} (${l.machine_count} stations)`).join("; ")}. ` +
        `Read the ones that matter to the people in the room. Skip the rest.`,
    });
  }

  slides.push({
    id: "found",
    title: "What we found",
    talk:
      narrative.story +
      " Pause. Let them react to their own plant before you explain why it matters.",
  });

  slides.push({
    id: "snapshot",
    title: "The numbers",
    talk:
      `${narrative.machineCount} stations. ${narrative.eolMachines} on discontinued hardware. ` +
      `${risk.findings.length} platform${risk.findings.length === 1 ? "" : "s"} on the register. ` +
      `Say it in one breath, then go to the register so they can see names, not just counts.`,
  });

  slides.push({
    id: "lifecycle",
    title: "Equipment lifecycle",
    talk:
      `A controller can look fine while the vendor has already moved it to end of life. ` +
      `That is the whole point of this slide. Spares get scarce, software ages out, recovery gets longer. ` +
      `The score on the next slide is a ranking of this plant — not a SIL number. ` +
      (risk.findings.length
        ? `${risk.counts.critical} critical, ${risk.counts.high} high, ${risk.counts.moderate} moderate, ${risk.counts.watch} watch.`
        : `Nothing on this walk landed as a named lifecycle hit. Keep the slide so they understand the idea, or delete it.`),
  });

  if (risk.findings.length > 0) {
    const top = risk.findings.slice(0, 3).map((f) => `${f.make} ${f.model}`.trim()).join("; ");
    slides.push({
      id: "register",
      title: "Risk register",
      talk:
        `This is the list they can fund. Lead with ${top}. ` +
        `A list of old equipment does not get approved. A ranked list that names the production it puts at risk does.`,
    });
  }

  slides.push({
    id: "stations",
    title: "Stations that tell the story",
    talk:
      `Three examples, not a tour of every cabinet. Point at the photo, name the platform, say what happens if it dies on a Saturday. Then move.`,
  });

  slides.push({
    id: "why",
    title: "Why obsolescence is a problem",
    talk:
      `Keep this human. The hardware still runs. That is not the same as being supported. ` +
      `Parts, cost, safety, security — pick the two that will land with this room. ` +
      `PMMI: 52% saw events rise; 44% have no process. Do not pretend the £75k distillery number is this plant. It is “this is what waiting looks like.”`,
  });

  slides.push({
    id: "isa",
    title: "What the standards already say",
    talk:
      `Do not lecture. One sentence each: ISA-84 is safety lifecycle, 62443 is patching, 18.2 is alarms, 101 is the HMI, 95 is talking to the business. ` +
      `Then: we are not auditing you. These are the rules the floor is already expected to run against.`,
  });

  for (const offer of FLOOR_OFFERS) {
    const n = offer.flags ? flagCount(mapping, offer.flags) : 0;
    const tagged = n
      ? `On this walk we tagged ${n} station${n === 1 ? "" : "s"}. Talk to those.`
      : `We did not tag this on this walk. Say it is a typical plant item, and they can delete the slide if it does not apply.`;
    slides.push({
      id: `offer:${offer.key}`,
      title: offer.title,
      talk: `${offer.pitch} ${tagged} ${offer.bullets.map((b, i) => `${i + 1}) ${b}`).join(" ")}`,
    });
  }

  slides.push({
    id: "scada-payoffs",
    title: "What SCADA actually puts on the screen",
    talk:
      `This is the “why SCADA” grid. Gas, water, air, kWh, production, alarms, safety, lot/CIP. ` +
      `Pick the two utilities this plant cares about. Do not read all nine.`,
  });

  slides.push({
    id: "also",
    title: "What else this walk covers",
    talk:
      `Historian, andon, recipes, remote, backups — the rest of the plant-systems conversation. ` +
      `Skip anything they already have. Linger on whatever made them nod on the floor.`,
  });

  slides.push({
    id: "roadmap",
    title: "Recommended sequence",
    talk:
      `Now / next outage / program. Immediate is backups, e-stops, the critical platform quote. ` +
      `Shutdown is the first migrations and HMIs. Program is SCADA, utilities, the rest of the register. ` +
      `Ask for a date on item one before you leave the room.`,
  });

  slides.push({
    id: "questions",
    title: "Any questions?",
    talk:
      `Stop talking. Let them ask. If the room is quiet, offer: “The usual first question is what we would do in the next 90 days — that is the left column of the sequence slide.” ` +
      `Thank them for the time on the floor.`,
  });

  return slides;
}

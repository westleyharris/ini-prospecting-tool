/**
 * Static narrative for the plant-systems assessment deck.
 *
 * Plant-specific numbers come from the mapping. This file is the argument:
 * why obsolescence is a safety, cost, production, and cyber problem, what
 * ISA already requires, and how the walk is structured. Sources are cited
 * on the slides that use them.
 */

export const STORY_AGENDA = [
  {
    n: "01",
    kicker: "The problem",
    title: "Why unsupported automation is not a spare-parts issue",
    body: "It is a safety, cost, production, and cyber issue — and the standards plants already run against already say so.",
  },
  {
    n: "02",
    kicker: "This plant",
    title: "What is installed, what is at end of support, and what stops production",
    body: "The walk answers three questions from one register: what you run, how exposed it is, and which assets would take the line with them.",
  },
  {
    n: "03",
    kicker: "The program",
    title: "A ranked list leadership can fund, in shutdown order",
    body: "Not a wish list. Immediate work, the next outage, and the multi-year path so the spend happens before the failure does.",
  },
] as const;

export const WHY_PILLARS = [
  {
    kicker: "Safety  ·  ANSI/ISA-61511 (ISA-84)",
    title: "You cannot prove a safe state on a platform nobody supports",
    body:
      "ISA-84 / IEC 61511 requires the safety function to be designed, tested, and kept current through decommissioning. An undocumented circuit, an unlit e-stop, or a discontinued safety-related controller is an unvalidated layer. When it fails, the question is not “where is the spare?” It is “can we still prove this does what we claimed?”",
  },
  {
    kicker: "Cost  ·  PMMI 2026  ·  NIRAS",
    title: "Keeping it running is often the expensive option",
    body:
      "PMMI 2026: 52% of end users saw obsolescence events rise over five years; 44% have no formal process; 58% have no dedicated owner. NIRAS recorded a distillery with two automation failures a month — six hours down, about £75,000 in lost production — while the plant “kept things running.” That is not a PLC line item. It is lost shift.",
  },
  {
    kicker: "Production  ·  PMMI",
    title: "One discontinued part does not fail as a part. It fails as a line.",
    body:
      "Spares go to brokers. Firmware disappears. The technician who still knows the old platform retires. PMMI is explicit: replacing one obsolete component often cascades into a controls upgrade, programming, and extra downtime. Mean time to repair becomes mean time to find someone who can still get online.",
  },
  {
    kicker: "Security  ·  ISA/IEC 62443",
    title: "If you cannot patch it, you cannot secure it",
    body:
      "ISA/IEC 62443 requires the automation system to stay defendable for its whole life. Unsupported operating systems, unpatchable controllers, and flat networks are the same inventory as the old PLC. ISA-TR84.00.09 ties cyber to the safety lifecycle: an unpatched logic solver is not an IT footnote. It is a hole in the safety case.",
  },
] as const;

export const WHY_FOOTNOTE =
  "Industry figures: PMMI, Managing Obsolescence Across Manufacturing Operations (2026); NIRAS, Automation obsolescence (2025). The NIRAS loss figure is an industry illustration, not this plant’s P&L.";

export const ISA_CARDS = [
  {
    std: "ISA-84 / IEC 61511",
    title: "Functional safety lifecycle",
    body: "Keep the process in a safe state — and keep the proof current. You cannot claim integrity on a logic solver nobody supports or a circuit nobody mapped.",
  },
  {
    std: "ISA/IEC 62443",
    title: "Industrial cybersecurity",
    body: "Secure the automation system for its full life. Unpatchable controllers and unsupported Windows boxes fail this on day one of “end of support.”",
  },
  {
    std: "ISA-18.2",
    title: "Alarm management",
    body: "A horn everyone has learned to ignore is not a protection layer. Rationalize, prioritize, and own every alarm — or it is noise.",
  },
  {
    std: "ISA-101",
    title: "HMI design",
    body: "The operator must see why it stopped and how to recover. Pushbuttons and tribal knowledge are not situational awareness.",
  },
  {
    std: "ISA-95",
    title: "Enterprise–control integration",
    body: "Isolated stations cannot feed quality, energy, or MES. Islands of automation stay invisible to the business that pays for them.",
  },
  {
    std: "ISA-84.91.01",
    title: "Safety controls integrity",
    body: "Inspect, test, and document process safety controls, alarms, and interlocks. You cannot inspect what you have not inventoried.",
  },
] as const;

export const METHOD_STEPS = [
  {
    n: "01",
    title: "Inventory the installed base",
    body: "Controllers, HMIs, drives, networks, SCADA and MES where present. Catalogue number against vendor lifecycle. What is on the floor, not what the drawing says.",
  },
  {
    n: "02",
    title: "Map what depends on what",
    body: "Which systems talk. Which links are undocumented. Which recovery requires a laptop. Which knowledge lives in one person.",
  },
  {
    n: "03",
    title: "Score likelihood against impact",
    body: "Failure or loss of support versus the production — and the people — it takes with it. Safety and cyber sit on the same register. Not a second study.",
  },
  {
    n: "04",
    title: "Prioritize against the calendar",
    body: "Immediate / next shutdown / program. Written so a capital committee can approve in order, before a failure writes the schedule.",
  },
] as const;

export const METHOD_NOTE =
  "Most plants have no one whose job this is. PMMI found 58% of end users have no dedicated obsolescence owner. This report is that job, done once, so you can own it.";

export const DELIVERABLES = [
  {
    title: "Installed-base register",
    body: "What you run: versions, firmware where recorded, and vendor lifecycle status per catalogue family.",
  },
  {
    title: "Risk register",
    body: "Ranked by likelihood and production impact, with safety and cyber noted on the same page leadership will actually read.",
  },
  {
    title: "Floor evidence",
    body: "Stations that prove the score: discontinued hardware, trapped modern devices, missing visibility, undocumented safety.",
  },
  {
    title: "Prioritized action list",
    body: "Immediate, next shutdown, and program — sequenced so the first dollar goes to the asset that would stop the plant.",
  },
  {
    title: "Executive briefing",
    body: "This deck: written for capital planning, not as an engineer-only appendix.",
  },
  {
    title: "Handoff into a program",
    body: "Structured so the next conversation is a migration, a SCADA scope, or a safety circuit — without starting the analysis again.",
  },
] as const;

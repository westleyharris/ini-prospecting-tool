/**
 * Static copy for the customer deck.
 * Plant-specific numbers come from the mapping. Keep this conversational.
 */

export const WHY_PILLARS = [
  {
    kicker: "Parts & time",
    title: "The spare is not on the shelf",
    body:
      "When a controller is discontinued, parts go to brokers, firmware disappears, and the technician who still knows the platform retires. A failure that used to be an afternoon becomes a week of hunting.",
  },
  {
    kicker: "Cost",
    title: "Keeping it running is often the expensive option",
    body:
      "PMMI found 52% of plants saw obsolescence events rise over five years — and 44% still have no process. Unplanned capital shows up as lost shift, not as a PLC line item. A ranked list is cheaper than a scramble.",
  },
  {
    kicker: "Safety",
    title: "You cannot maintain what you cannot support",
    body:
      "ISA-84 / IEC 61511 expects a safety function to stay testable for its life. An unlit e-stop or an undocumented hardwired circuit is not a maintenance note. It is a safety layer you cannot prove.",
  },
  {
    kicker: "Security",
    title: "If you cannot patch it, you cannot secure it",
    body:
      "ISA/IEC 62443 treats the control system as something that has to stay defendable. Unsupported Windows boxes and unpatchable controllers are the same inventory as the old PLC — a cyber finding and a production finding.",
  },
] as const;

export const WHY_FOOTNOTE =
  "Industry figures: PMMI, Managing Obsolescence (2026). The walk records this plant; the industry numbers explain why the walk matters.";

export const ISA_CARDS = [
  {
    std: "ISA-84 / IEC 61511",
    title: "Functional safety",
    body: "Keep the process in a safe state — and keep the proof current. You cannot claim that on a processor nobody supports.",
  },
  {
    std: "ISA/IEC 62443",
    title: "Industrial cybersecurity",
    body: "Secure the automation system for its full life. End of support is the day you stop being able to patch.",
  },
  {
    std: "ISA-18.2",
    title: "Alarm management",
    body: "A horn everyone has learned to ignore is not a protection layer. Own the alarm, or it is noise.",
  },
  {
    std: "ISA-101",
    title: "HMI design",
    body: "The operator must see why it stopped and how to recover. Pushbuttons are not situational awareness.",
  },
  {
    std: "ISA-95",
    title: "Plant integration",
    body: "Isolated stations cannot feed quality, energy, or MES. Islands stay invisible to the business.",
  },
  {
    std: "ISA-84.91.01",
    title: "Safety controls integrity",
    body: "Inspect, test, and document safety controls, alarms, and interlocks. You cannot inspect what you have not listed.",
  },
] as const;

/**
 * Why obsolescence is a problem — floor language, not standard numbers.
 * ISA lives as a one-line footnote, not the argument.
 */

export const WHY_PILLARS = [
  {
    kicker: "People",
    title: "The person who can get online is retiring",
    body:
      "The software for that processor is a skill, not a setting. A serial cable in a drawer, a license that may not activate, and one electrician who still remembers the package. When that person is on vacation — or gone — a twenty-minute fault becomes a long outage.",
  },
  {
    kicker: "Parts",
    title: "The OEM does not ship it. eBay does.",
    body:
      "Once last-ship has passed, a processor or I/O card comes from a broker or a surplus listing. No warranty, unknown hours, unknown firmware. You are bidding against every other plant still running the same family.",
  },
  {
    kicker: "Recovery",
    title: "Troubleshooting turns into archaeology",
    body:
      "No plain-language fault. No current backup. A laptop, a vintage cable, and a license that will not activate. Mean time to repair becomes mean time to find the software, then the person, then the spare.",
  },
  {
    kicker: "The line",
    title: "One dead card takes the whole line with it",
    body:
      "A discontinued controller is not a $2,000 part. It is every station downstream waiting. There is no overnight factory order. The modern drive in the same cabinet cannot even tell you it tripped, because the old PLC cannot talk to it.",
  },
] as const;

export const WHY_FOOTNOTE =
  "ISA-84 and ISA/IEC 62443 say the same thing in standard language: you cannot maintain or patch what the vendor no longer supports.";

import type { Mapping } from "../api/mappings";
import { buildDeckTranscript } from "../data/deckTranscript";

/** Internal talk track — not shown on shared reports. */
export function SpeakerNotesView({ mapping }: { mapping: Mapping }) {
  const slides = buildDeckTranscript(mapping);
  const plant = mapping.plant_name ?? mapping.name;

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-8">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
          Internal — speaker notes
        </p>
        <p className="text-[14px] text-amber-950 mt-1">
          Talk track for the {plant} deck. This tab is not on share links. Print from Export
          when you are on this tab. Notes are also embedded in the PowerPoint when you
          download the deck from here (Presenter View) — not when a customer downloads a shared report.
        </p>
      </div>

      <ol className="space-y-3">
        {slides.map((slide, i) => (
          <li
            key={slide.id}
            className="bg-white border border-slate-200/80 rounded-xl shadow-sm px-4 py-3 print-avoid-break"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Slide {String(i + 1).padStart(2, "0")}
            </p>
            <h2 className="text-[16px] font-semibold text-brand-navy mt-0.5">{slide.title}</h2>
            <p className="text-[14px] text-slate-700 mt-2 leading-relaxed whitespace-pre-wrap">
              {slide.talk}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SpeakerNotesPrint({ mapping, active }: { mapping: Mapping; active: boolean }) {
  if (!active) return null;
  const slides = buildDeckTranscript(mapping);
  const plant = mapping.plant_name ?? mapping.name;

  return (
    <>
      <style>{`
        @media screen {
          .speaker-notes-print { display: none !important; }
        }
        @media print {
          .speaker-notes-print { display: block !important; }
          .mapping-screen-only { display: none !important; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          @page { margin: 0.6in; size: letter portrait; }
        }
      `}</style>
      <div className="speaker-notes-print mapping-print-root" style={{ fontFamily: "Aptos, Calibri, sans-serif", color: "#111" }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#92400e", margin: 0 }}>
          Internal — speaker notes · do not hand to the customer
        </p>
        <h1 style={{ fontSize: 22, margin: "6px 0 4px" }}>{plant}</h1>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 16px" }}>
          Talk track for the automation report. One page per few slides.
        </p>
        {slides.map((slide, i) => (
          <div key={slide.id} className="print-avoid-break" style={{ marginBottom: 16, breakInside: "avoid" }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7280", margin: 0 }}>
              Slide {String(i + 1).padStart(2, "0")}
            </p>
            <h2 style={{ fontSize: 15, margin: "2px 0 6px" }}>{slide.title}</h2>
            <p style={{ fontSize: 12, lineHeight: 1.45, margin: 0 }}>{slide.talk}</p>
          </div>
        ))}
      </div>
    </>
  );
}

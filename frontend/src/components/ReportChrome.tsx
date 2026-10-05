import { useEffect, useRef, useState } from "react";
import {
  HiArrowLeft, HiChevronDown, HiPrinter, HiPresentationChartBar,
} from "react-icons/hi2";
import { ShareLinkButton } from "./ShareLinkButton";

export interface ReportModeTab {
  id: string;
  label: string;
}

export function ReportChrome({
  eyebrow,
  title,
  subtitle,
  onBack,
  onRename,
  modes,
  mode,
  onMode,
  status,
  share,
  onDeck,
  deckBusy,
  onPrint,
  printBusy,
  contained = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onRename?: (name: string) => void;
  modes: ReportModeTab[];
  mode: string;
  onMode: (id: string) => void;
  status?: { label: string; tone: "ok" | "warn"; onClick: () => void };
  share?: { kind: "mapping" | "plant"; id: string };
  onDeck?: () => void;
  deckBusy?: boolean;
  onPrint?: () => void;
  printBusy?: boolean;
  contained?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setDraft(title); }, [title]);

  useEffect(() => {
    if (!exportOpen) return;
    function close(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    }
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [exportOpen]);

  function commitTitle() {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== title) onRename?.(next);
    else setDraft(title);
  }

  return (
    <div className={
      contained
        ? "sticky top-0 z-30 py-2 bg-[#f0f2ef]/95 backdrop-blur-sm"
        : "sticky top-14 lg:top-0 z-30 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 py-2 bg-[#f0f2ef]/95 backdrop-blur-sm"
    }>
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            title="Back"
            className="p-2 rounded-lg text-slate-400 hover:text-brand-navy hover:bg-slate-100 transition-colors shrink-0"
          >
            <HiArrowLeft className="w-4 h-4" />
          </button>
        )}

        <div className="flex-1 min-w-[10rem]">
          {eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{eyebrow}</p>
          )}
          {editing && onRename ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") { setDraft(title); setEditing(false); }
              }}
              className="w-full text-[15px] font-semibold text-brand-navy bg-transparent border-b border-brand-navy/30 focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => onRename && setEditing(true)}
              className={`text-left min-w-0 block ${onRename ? "group" : "cursor-default"}`}
            >
              <h1 className="text-[15px] font-semibold text-brand-navy truncate leading-tight">
                {title}
                {onRename && (
                  <span className="ml-1.5 text-slate-300 group-hover:text-slate-500 text-[11px] font-medium">Rename</span>
                )}
              </h1>
            </button>
          )}
          {subtitle && (
            <p className="text-[12px] text-slate-400 truncate mt-0.5">{subtitle}</p>
          )}
        </div>

        {modes.length > 0 && (
          <div className="flex p-0.5 bg-slate-100 rounded-lg shrink-0">
            {modes.map((tab) => {
              const on = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onMode(tab.id)}
                  className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                    on
                      ? "bg-white text-brand-navy shadow-sm"
                      : "text-slate-500 hover:text-brand-navy"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-0.5 shrink-0 ml-auto sm:ml-0">
          {status && (
            <button
              type="button"
              onClick={status.onClick}
              className={`px-2.5 py-1.5 rounded-md text-[12px] font-medium ${
                status.tone === "ok"
                  ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                  : "text-amber-800 bg-amber-50 hover:bg-amber-100"
              }`}
            >
              {status.label}
            </button>
          )}
          {share && <ShareLinkButton kind={share.kind} id={share.id} quiet />}
          {(onDeck || onPrint) && (
            <div className="relative" ref={exportRef}>
              <button
                type="button"
                onClick={() => setExportOpen((v) => !v)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-slate-600 hover:text-brand-navy hover:bg-slate-100"
              >
                Export
                <HiChevronDown className={`w-3.5 h-3.5 transition-transform ${exportOpen ? "rotate-180" : ""}`} />
              </button>
              {exportOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-40">
                  {onDeck && (
                    <button
                      type="button"
                      disabled={deckBusy}
                      onClick={() => { setExportOpen(false); onDeck(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <HiPresentationChartBar className="w-4 h-4 text-slate-400" />
                      {deckBusy ? "Building deck…" : "PowerPoint deck"}
                    </button>
                  )}
                  {onPrint && (
                    <button
                      type="button"
                      disabled={printBusy}
                      onClick={() => { setExportOpen(false); onPrint(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <HiPrinter className="w-4 h-4 text-slate-400" />
                      {printBusy ? "Preparing…" : "Print / PDF"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

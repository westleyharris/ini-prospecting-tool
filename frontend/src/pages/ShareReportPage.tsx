import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { HiPrinter, HiPresentationChartBar, HiClipboardDocumentList, HiEye, HiExclamationTriangle } from "react-icons/hi2";
import { getSharedReport, type Mapping } from "../api/mappings";
import { consolidateMappings } from "../data/consolidateMappings";
import { downloadPresentation } from "../services/presentation";
import { MappingView, PrintView, RiskRegisterView } from "./MappingEditorPage";
import { ExecutiveView } from "../components/ExecutiveView";
import { usePrintReport } from "../hooks/usePrintReport";
import { BackToTop } from "../components/BackToTop";

export default function ShareReportPage() {
  const { token } = useParams<{ token: string }>();
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [kind, setKind] = useState<"mapping" | "plant">("mapping");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"exec" | "view" | "risk">("view");
  const [buildingDeck, setBuildingDeck] = useState(false);
  const { printReady, printBusy, startPrint } = usePrintReport();

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    getSharedReport(token)
      .then((data) => {
        if (cancelled) return;
        if (data.kind === "plant") {
          const list = data.mappings ?? [];
          if (list.length === 0) {
            setError("No mappings are available for this plant.");
            return;
          }
          setKind("plant");
          setBrief(data.executive_brief ?? null);
          setMode("exec");
          setMapping(consolidateMappings(list));
          return;
        }
        if (!data.mapping) {
          setError("This mapping is no longer available.");
          return;
        }
        setKind("mapping");
        setMode("view");
        setMapping(data.mapping);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "This share link is not valid.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f2ef] flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-brand-navy" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    );
  }

  if (!mapping) {
    return (
      <div className="min-h-screen bg-[#f0f2ef] flex items-center justify-center px-6">
        <p className="font-mono text-sm text-brand-navy/60 text-center">
          {error ?? "This share link is not valid."}
        </p>
      </div>
    );
  }

  const lines = mapping.source_lines ?? [];

  return (
    <div className="min-h-screen bg-[#f0f2ef]">
      <PrintView mapping={mapping} mode={mode === "risk" ? "risk" : "sheet"} active={printReady && mode !== "exec"} />

      <div className="mapping-screen-only max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-3 pb-24">
        <div className="sticky top-0 z-30 -mx-3 sm:-mx-6 px-3 sm:px-6 py-2 bg-[#f0f2ef]">
        <div className="flex flex-wrap items-stretch gap-0 border-2 border-brand-navy bg-white">
          <div className="flex-1 min-w-0 px-3 py-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-brand-navy/40">
              I&amp;I Automation · Shared report
            </p>
            <h1 className="font-mono text-base font-bold text-brand-navy uppercase tracking-wide truncate">
              {mapping.name}
            </h1>
            <p className="font-mono text-[10px] text-brand-navy/40 mt-0.5 truncate uppercase tracking-wider">
              {mapping.plant_name}
              {mapping.city && mapping.state ? ` · ${mapping.city}, ${mapping.state}` : ""}
              {lines.length > 1 ? ` · ${lines.length} lines consolidated` : ""}
            </p>
          </div>

          <div className="flex items-stretch shrink-0 w-full sm:w-auto border-t-2 sm:border-t-0 sm:border-l-2 border-brand-navy">
            {kind === "plant" && (
              <button onClick={() => setMode("exec")}
                className={`flex items-center gap-1 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider border-r border-brand-navy/20 transition-colors ${
                  mode === "exec" ? "bg-brand-navy text-white" : "text-brand-navy/50 hover:bg-brand-navy/5"
                }`}>
                <HiClipboardDocumentList className="w-3.5 h-3.5" />
                Summary
              </button>
            )}
            <button onClick={() => setMode("view")}
              className={`flex items-center gap-1 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider border-r border-brand-navy/20 transition-colors ${
                mode === "view" ? "bg-brand-navy text-white" : "text-brand-navy/50 hover:bg-brand-navy/5"
              }`}>
              <HiEye className="w-3.5 h-3.5" />
              {kind === "plant" ? "Drawing" : "View"}
            </button>
            <button onClick={() => setMode("risk")}
              className={`flex items-center gap-1 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider border-r border-brand-navy/20 transition-colors ${
                mode === "risk" ? "bg-brand-navy text-white" : "text-brand-navy/50 hover:bg-brand-navy/5"
              }`}>
              <HiExclamationTriangle className="w-3.5 h-3.5" />
              Risk
            </button>
            <button
              onClick={async () => {
                setBuildingDeck(true);
                try {
                  await downloadPresentation(mapping);
                } catch (err) {
                  console.error(err);
                  alert("Could not build the presentation.");
                } finally {
                  setBuildingDeck(false);
                }
              }}
              disabled={buildingDeck}
              className="px-3 flex items-center justify-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider border-r border-brand-navy/20 text-brand-navy/50 hover:bg-brand-lime hover:text-brand-navy transition-colors disabled:opacity-50"
              title="Download Automation Report (PowerPoint)">
              <HiPresentationChartBar className="w-4 h-4" />
              <span className="hidden sm:inline">{buildingDeck ? "Building…" : "Deck"}</span>
            </button>
            <button onClick={startPrint}
              disabled={printBusy}
              className="px-3 flex items-center justify-center text-brand-navy/40 hover:bg-brand-lime hover:text-brand-navy transition-colors disabled:opacity-50"
              title={printBusy ? "Preparing photos…" : "Print / Export PDF"}>
              <HiPrinter className="w-4 h-4" />
            </button>
          </div>
        </div>
        </div>

        {mode === "view" && <MappingView mapping={mapping} chrome="share" />}
        {mode === "risk" && <RiskRegisterView mapping={mapping} />}
      </div>

      {mode === "exec" && (
        <div className="exec-print-root max-w-6xl mx-auto px-3 sm:px-6 pb-24">
          <ExecutiveView mapping={mapping} initialBrief={brief} />
        </div>
      )}
      <BackToTop />
    </div>
  );
}

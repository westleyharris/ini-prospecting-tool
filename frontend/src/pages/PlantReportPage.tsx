import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  HiArrowLeft, HiPrinter, HiEye, HiExclamationTriangle, HiPresentationChartBar,
  HiClipboardDocumentList,
} from "react-icons/hi2";
import { getPlantMappings, type Mapping } from "../api/mappings";
import { fetchPlant } from "../api/plants";
import { consolidateMappings } from "../data/consolidateMappings";
import { downloadPresentation } from "../services/presentation";
import { MappingView, PrintView, RiskRegisterView } from "./MappingEditorPage";
import { ExecutiveView } from "../components/ExecutiveView";
import { usePrintReport } from "../hooks/usePrintReport";
import { ShareLinkButton } from "../components/ShareLinkButton";
import { BackToTop } from "../components/BackToTop";

export default function PlantReportPage() {
  const { plantId } = useParams<{ plantId: string }>();
  const navigate = useNavigate();
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"exec" | "view" | "risk">("exec");
  const [buildingDeck, setBuildingDeck] = useState(false);
  const { printReady, printBusy, startPrint } = usePrintReport();

  useEffect(() => {
    if (!plantId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getPlantMappings(plantId), fetchPlant(plantId).catch(() => null)])
      .then(([list, plant]) => {
        if (cancelled) return;
        if (list.length === 0) {
          setError("No mappings at this plant yet.");
          setMapping(null);
          return;
        }
        setMapping(consolidateMappings(list));
        setBrief(plant?.executive_brief ?? null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load plant mappings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [plantId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <svg className="animate-spin h-8 w-8 text-brand-navy" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    );
  }

  if (!mapping) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-gray-500">{error ?? "Plant report not found."}</p>
        <button
          onClick={() => navigate("/mappings")}
          className="font-mono text-[11px] font-bold uppercase tracking-wider text-brand-navy hover:underline"
        >
          Back to mappings
        </button>
      </div>
    );
  }

  const lines = mapping.source_lines ?? [];

  return (
    <>
      <PrintView mapping={mapping} mode={mode === "risk" ? "risk" : "sheet"} active={printReady && mode !== "exec"} />

      <div className="mapping-screen-only space-y-3 pb-24">
        <div className="lg:sticky lg:top-0 z-30 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 py-2 bg-[#f0f2ef]">
        <div className="flex flex-wrap items-stretch gap-0 border-2 border-brand-navy bg-white">
          <button onClick={() => navigate("/mappings")}
            className="px-2.5 flex items-center justify-center border-r-2 border-brand-navy text-brand-navy/50 hover:bg-brand-lime hover:text-brand-navy transition-colors shrink-0"
            title="Back to mappings">
            <HiArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0 px-3 py-2">
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
            <button onClick={() => setMode("exec")}
              className={`flex items-center gap-1 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider border-r border-brand-navy/20 transition-colors ${
                mode === "exec" ? "bg-brand-navy text-white" : "text-brand-navy/50 hover:bg-brand-navy/5"
              }`}>
              <HiClipboardDocumentList className="w-3.5 h-3.5" />
              Summary
            </button>
            <button onClick={() => setMode("view")}
              className={`flex items-center gap-1 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider border-r border-brand-navy/20 transition-colors ${
                mode === "view" ? "bg-brand-navy text-white" : "text-brand-navy/50 hover:bg-brand-navy/5"
              }`}>
              <HiEye className="w-3.5 h-3.5" />
              Drawing
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
              title="Download plant Automation Report (PowerPoint)">
              <HiPresentationChartBar className="w-4 h-4" />
              <span className="hidden sm:inline">{buildingDeck ? "Building…" : "Deck"}</span>
            </button>
            <ShareLinkButton kind="plant" id={mapping.plant_id} />
            <button onClick={startPrint}
              disabled={printBusy}
              className="px-3 flex items-center justify-center text-brand-navy/40 hover:bg-brand-lime hover:text-brand-navy transition-colors disabled:opacity-50"
              title={printBusy ? "Preparing photos…" : "Print / Export PDF"}>
              <HiPrinter className="w-4 h-4" />
            </button>
          </div>
        </div>
        </div>

        {lines.length > 1 && mode !== "exec" && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-white border-2 border-brand-navy">
            <span className="font-mono text-[10px] font-bold text-brand-navy/50 uppercase tracking-wider">
              Open a line to edit
            </span>
            {lines.map((line, i) => (
              <button
                key={line.id}
                onClick={() => navigate(`/mappings/${line.id}`)}
                className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-1 border border-brand-navy/30 text-brand-navy hover:bg-brand-lime hover:border-brand-navy"
              >
                {`L${String(i + 1).padStart(2, "0")}`} {line.name}
              </button>
            ))}
          </div>
        )}

        {mode === "view" && <MappingView mapping={mapping} />}
        {mode === "risk" && <RiskRegisterView mapping={mapping} />}
      </div>

      {mode === "exec" && (
        <div className="exec-print-root mt-3 pb-24">
          <ExecutiveView mapping={mapping} initialBrief={brief} plantId={plantId} editable />
        </div>
      )}
      <BackToTop />
    </>
  );
}

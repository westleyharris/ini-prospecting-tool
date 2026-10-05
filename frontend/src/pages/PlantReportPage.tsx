import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getPlantMappings, type Mapping } from "../api/mappings";
import { fetchPlant } from "../api/plants";
import { consolidateMappings } from "../data/consolidateMappings";
import { downloadPresentation } from "../services/presentation";
import { MappingView, PrintView, RiskRegisterView } from "./MappingEditorPage";
import { ExecutiveView } from "../components/ExecutiveView";
import { ReportChrome } from "../components/ReportChrome";
import { usePrintReport } from "../hooks/usePrintReport";
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
        <ReportChrome
          onBack={() => navigate("/mappings")}
          title={mapping.plant_name ?? mapping.name}
          subtitle={[
            mapping.city && mapping.state ? `${mapping.city}, ${mapping.state}` : mapping.name,
            lines.length > 1 ? `${lines.length} lines` : null,
          ].filter(Boolean).join(" · ")}
          modes={[
            { id: "exec", label: "Summary" },
            { id: "view", label: "Drawing" },
            { id: "risk", label: "Risk" },
          ]}
          mode={mode}
          onMode={(id) => setMode(id as "exec" | "view" | "risk")}
          share={{ kind: "plant", id: mapping.plant_id }}
          onDeck={async () => {
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
          deckBusy={buildingDeck}
          onPrint={startPrint}
          printBusy={printBusy}
        />

        {lines.length > 1 && mode !== "exec" && (
          <div className="flex flex-wrap items-center gap-2 px-1">
            <span className="text-[12px] text-slate-400">Open a line</span>
            {lines.map((line, i) => (
              <button
                key={line.id}
                onClick={() => navigate(`/mappings/${line.id}`)}
                className="text-[12px] font-medium px-2.5 py-1 rounded-md bg-white border border-slate-200 text-brand-navy hover:border-brand-navy"
              >
                {`L${String(i + 1).padStart(2, "0")}`} {line.name.replace(/ - mapping$/i, "")}
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

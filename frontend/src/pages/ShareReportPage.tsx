import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getSharedReport, type Mapping } from "../api/mappings";
import { consolidateMappings } from "../data/consolidateMappings";
import { downloadPresentation } from "../services/presentation";
import { MappingView, PrintView } from "./MappingEditorPage";
import { ExecutiveView } from "../components/ExecutiveView";
import { RiskRegisterView } from "../components/RiskRegisterView";
import { ReportChrome } from "../components/ReportChrome";
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
        <ReportChrome
          contained
          eyebrow="I&I Automation · Shared report"
          title={kind === "plant" ? (mapping.plant_name ?? mapping.name) : mapping.name}
          subtitle={[
            kind === "plant" ? mapping.name : mapping.plant_name,
            mapping.city && mapping.state ? `${mapping.city}, ${mapping.state}` : null,
            lines.length > 1 ? `${lines.length} lines` : null,
          ].filter(Boolean).join(" · ")}
          modes={
            kind === "plant"
              ? [
                  { id: "exec", label: "Summary" },
                  { id: "view", label: "Drawing" },
                  { id: "risk", label: "Risk" },
                ]
              : [
                  { id: "view", label: "Drawing" },
                  { id: "risk", label: "Risk" },
                ]
          }
          mode={mode}
          onMode={(id) => setMode(id as "exec" | "view" | "risk")}
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

        {mode === "view" && <MappingView mapping={mapping} chrome="share" />}
        {mode === "risk" && <RiskRegisterView mapping={mapping} />}
      </div>

      {mode === "exec" && (
        <div className="exec-print-root max-w-6xl mx-auto px-3 sm:px-6 pb-24 print:max-w-none print:px-0 print:pb-0">
          <ExecutiveView mapping={mapping} initialBrief={brief} />
        </div>
      )}
      <BackToTop />
    </div>
  );
}

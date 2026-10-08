import { useMemo, useState } from "react";
import { HiChevronDown, HiShieldCheck } from "react-icons/hi2";
import type { Mapping } from "../api/mappings";
import { buildOpportunityRegister, type OpportunityFinding } from "../data/opportunityRegister";
import { FLAG_DEFS, FLAG_GROUPS } from "../data/observations";
import { buildRiskRegister, type RiskFinding, type RiskLevel } from "../data/riskRegister";

const LEVELS: { id: RiskLevel; label: string; blurb: string; mark: string }[] = [
  { id: "critical", label: "Critical", blurb: "Replace first", mark: "#b42318" },
  { id: "high",     label: "High",     blurb: "Plan the swap", mark: "#b45309" },
  { id: "moderate", label: "Moderate", blurb: "On the radar",  mark: "#57534e" },
  { id: "watch",    label: "Watch",    blurb: "Still shipping", mark: "#64748b" },
];

export function RiskRegisterView({ mapping }: { mapping: Mapping }) {
  const register = useMemo(() => buildRiskRegister(mapping), [mapping]);
  const opportunities = useMemo(() => buildOpportunityRegister(mapping), [mapping]);
  const [filter, setFilter] = useState<RiskLevel | "all">("all");
  const [watchOpen, setWatchOpen] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const { findings, counts, affectedMachines, totalMachines, totalUnits } = register;

  function toggle(key: string) {
    setOpenKey((cur) => (cur === key ? null : key));
  }

  const grouped = LEVELS.map((level) => ({
    ...level,
    rows: findings.filter((f) => f.level === level.id),
  })).filter((g) => {
    if (g.rows.length === 0) return false;
    if (filter !== "all" && g.id !== filter) return false;
    return true;
  });

  return (
    <div className="space-y-5 pb-8">
      <header className="bg-white border border-brand-navy/15 shadow-sm px-5 py-5 sm:px-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-navy/45">
          Risk register
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-brand-navy tracking-tight mt-1">
          What is aging out
        </h1>
        <p className="text-sm text-brand-navy/55 mt-1">
          {findings.length === 0
            ? "No recorded control or drive matches a vendor end-of-life declaration."
            : `${findings.length} finding${findings.length === 1 ? "" : "s"} · ${totalUnits} unit${totalUnits === 1 ? "" : "s"} on ${affectedMachines} of ${totalMachines} stations`}
        </p>

        {findings.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <FilterChip
              label="All"
              count={findings.length}
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            {LEVELS.map((level) => (
              <FilterChip
                key={level.id}
                label={level.label}
                count={counts[level.id]}
                mark={level.mark}
                active={filter === level.id}
                disabled={counts[level.id] === 0}
                onClick={() => setFilter(level.id)}
              />
            ))}
          </div>
        )}
      </header>

      {findings.length === 0 ? (
        <div className="bg-white border border-brand-navy/15 shadow-sm px-5 py-10 text-center">
          <HiShieldCheck className="w-8 h-8 mx-auto text-brand-navy/25 mb-2" />
          <p className="text-sm font-semibold text-brand-navy">No lifecycle findings</p>
          <p className="text-sm text-brand-navy/50 mt-1 max-w-md mx-auto">
            Add make and model in Edit mode to widen the check.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-brand-navy/15 shadow-sm overflow-hidden">
          {grouped.map((group) => {
            const collapsedWatch = group.id === "watch" && filter === "all" && !watchOpen;
            return (
              <section key={group.id} className="border-t border-brand-navy/10 first:border-t-0">
                <div
                  className="flex items-center gap-3 px-4 sm:px-5 py-2.5 bg-slate-50/80"
                  style={{ borderLeft: `3px solid ${group.mark}` }}
                >
                  <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-navy">
                    {group.label}
                  </h2>
                  <span className="text-xs text-brand-navy/40">{group.blurb}</span>
                  <span className="ml-auto text-xs tabular-nums text-brand-navy/45">
                    {group.rows.length}
                  </span>
                </div>

                {collapsedWatch ? (
                  <button
                    type="button"
                    onClick={() => setWatchOpen(true)}
                    className="w-full text-left px-4 sm:px-5 py-3 text-sm text-brand-navy/60 hover:bg-slate-50 hover:text-brand-navy"
                  >
                    Show {group.rows.length} platform{group.rows.length === 1 ? "" : "s"} still shipping
                  </button>
                ) : (
                  <div>
                    <div className="hidden sm:grid grid-cols-[minmax(0,1.5fr)_4.5rem_3.5rem_5.5rem_minmax(0,1.2fr)_1.75rem] gap-x-4 px-4 sm:px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-navy/35 border-b border-brand-navy/10">
                      <span>Equipment</span>
                      <span>Type</span>
                      <span className="text-right">Qty</span>
                      <span>Last ship</span>
                      <span>Replace with</span>
                      <span />
                    </div>
                    {group.rows.map((f) => (
                      <FindingRow
                        key={f.key}
                        finding={f}
                        open={openKey === f.key}
                        onToggle={() => toggle(f.key)}
                      />
                    ))}
                    {group.id === "watch" && filter === "all" && (
                      <button
                        type="button"
                        onClick={() => setWatchOpen(false)}
                        className="w-full text-left px-4 sm:px-5 py-2.5 text-xs text-brand-navy/45 hover:text-brand-navy border-t border-brand-navy/10"
                      >
                        Hide watch list
                      </button>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {opportunities.findings.length > 0 && (
        <OpportunitySection findings={opportunities.findings} />
      )}

      <details className="px-1">
        <summary className="text-xs font-semibold text-brand-navy/40 cursor-pointer hover:text-brand-navy/70">
          How this is scored
        </summary>
        <p className="mt-2 text-xs leading-relaxed text-brand-navy/55 max-w-3xl">
          Each finding scores 2–7 from age (years since last-ship; mature platforms score 1),
          exposure (units in this plant), and whether a published successor exists.
          Critical ≥ 6 · High 4–5 · Moderate ≤ 3 · Watch = still shipping. Confirm with the
          manufacturer before procurement.
        </p>
      </details>
    </div>
  );
}

function stationList(finding: RiskFinding) {
  const tags = finding.machines.map((m) => m.tag);
  const shown = tags.length > 10 ? tags.slice(0, 8) : tags;
  const rest = tags.length - shown.length;
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1 text-brand-navy">
      {shown.map((tag) => (
        <span key={tag} className="whitespace-nowrap">{tag}</span>
      ))}
      {rest > 0 && <span className="text-brand-navy/45">+{rest} more</span>}
    </div>
  );
}

function FilterChip({
  label, count, mark, active, disabled, onClick,
}: {
  label: string;
  count: number;
  mark?: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm border transition-colors ${
        active
          ? "bg-brand-navy text-white border-brand-navy"
          : disabled
            ? "bg-white text-brand-navy/30 border-brand-navy/10 cursor-default"
            : "bg-white text-brand-navy border-brand-navy/15 hover:border-brand-navy"
      }`}
    >
      {mark && (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: active ? "currentColor" : mark }}
        />
      )}
      <span className="font-medium">{label}</span>
      <span className={`tabular-nums ${active ? "text-white/70" : "text-brand-navy/45"}`}>{count}</span>
    </button>
  );
}

function FindingRow({
  finding, open, onToggle,
}: {
  finding: RiskFinding;
  open: boolean;
  onToggle: () => void;
}) {
  const replace = finding.successor ?? "Consult vendor";
  const lastShip = finding.status === "mature" ? "Mature" : (finding.eolYear?.toString() ?? "—");

  return (
    <div className="border-t border-brand-navy/10 first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 sm:px-5 py-3 hover:bg-slate-50/80"
        aria-expanded={open}
      >
        <div className="sm:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-brand-navy leading-snug">
                {finding.make} {finding.model}
              </p>
              <p className="text-xs text-brand-navy/45 mt-0.5">
                {finding.categoryLabel} · {finding.unitCount} unit{finding.unitCount === 1 ? "" : "s"} · {lastShip}
              </p>
            </div>
            <HiChevronDown className={`w-4 h-4 mt-0.5 shrink-0 text-brand-navy/30 ${open ? "rotate-180" : ""}`} />
          </div>
        </div>
        <div className="hidden sm:grid grid-cols-[minmax(0,1.5fr)_4.5rem_3.5rem_5.5rem_minmax(0,1.2fr)_1.75rem] gap-x-4 items-center">
          <p className="font-semibold text-brand-navy truncate" title={`${finding.make} ${finding.model}`}>
            {finding.make} {finding.model}
          </p>
          <p className="text-sm text-brand-navy/50">{finding.categoryLabel}</p>
          <p className="text-sm tabular-nums text-brand-navy text-right">{finding.unitCount}</p>
          <p className="text-sm text-brand-navy/70">{lastShip}</p>
          <p className="text-sm text-brand-navy/70 truncate">{replace}</p>
          <HiChevronDown className={`w-4 h-4 justify-self-end text-brand-navy/30 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-4 text-sm">
          <p className="text-brand-navy/65 leading-relaxed">{finding.note}</p>
          <dl className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2">
            <div className="sm:hidden">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-navy/35">Replace with</dt>
              <dd className="text-brand-navy mt-0.5">{replace}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-navy/35">Stations</dt>
              <dd className="mt-0.5">{stationList(finding)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-navy/35">Score</dt>
              <dd className="text-brand-navy/55 mt-0.5">
                {finding.score}/7 · age {finding.breakdown.age} · exposure {finding.breakdown.exposure} · migration {finding.breakdown.migration}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

function OpportunitySection({ findings }: { findings: OpportunityFinding[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const groups = FLAG_GROUPS.map((g) => ({
    ...g,
    rows: findings.filter((f) => FLAG_DEFS.find((d) => d.key === f.key)?.group === g.id),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="bg-white border border-brand-navy/15 shadow-sm overflow-hidden">
      <div className="px-5 py-4 sm:px-7 border-b border-brand-navy/10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-navy/45">
          Floor flags
        </p>
        <h2 className="text-lg font-semibold text-brand-navy tracking-tight mt-1">
          What the survey also caught
        </h2>
        <p className="text-sm text-brand-navy/55 mt-1">
          {findings.length === 0
            ? "No operator, network, or plant-system flags recorded yet."
            : `${findings.length} theme${findings.length === 1 ? "" : "s"} from floor observations — not vendor lifecycle.`}
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="px-5 sm:px-7 py-6 text-sm text-brand-navy/45">
          Record network, HMI, and utility flags in Edit mode and they land here.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.id} className="border-t border-brand-navy/10 first:border-t-0">
            <div className="px-4 sm:px-5 py-2.5 bg-slate-50/80">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-navy">
                {group.label}
              </h3>
            </div>
            {group.rows.map((f) => {
              const open = openKey === f.key;
              return (
                <div key={f.key} className="border-t border-brand-navy/10">
                  <button
                    type="button"
                    onClick={() => setOpenKey(open ? null : f.key)}
                    className="w-full text-left px-4 sm:px-5 py-3 hover:bg-slate-50/80"
                    aria-expanded={open}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-brand-navy">{f.label}</p>
                        <p className="text-xs text-brand-navy/45 mt-0.5 truncate">
                          {f.machines.map((m) => m.tag).join(" · ")}
                        </p>
                      </div>
                      <span className="text-sm tabular-nums text-brand-navy/60 shrink-0">
                        {f.unitCount}
                      </span>
                      <HiChevronDown className={`w-4 h-4 mt-0.5 shrink-0 text-brand-navy/30 ${open ? "rotate-180" : ""}`} />
                    </div>
                  </button>
                  {open && (
                    <p className="px-4 sm:px-5 pb-4 text-sm text-brand-navy/65 leading-relaxed">
                      {f.pitch}
                    </p>
                  )}
                </div>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}

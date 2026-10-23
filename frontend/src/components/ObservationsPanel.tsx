import { useState } from "react";
import { HiChevronDown, HiEye } from "react-icons/hi2";
import type { MappingMachine } from "../api/mappings";
import { updateMachine } from "../api/mappings";
import { assessMachine } from "../data/machineAssessment";
import {
  FLAG_DEFS,
  FLAG_GROUPS,
  OBS_CHOICES,
  parseObservations,
  stringifyObservations,
  type FlagKey,
  type MachineObservations,
} from "../data/observations";

function ChipRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | "";
  options: readonly { value: T; label: string }[];
  onChange: (v: T | "") => void;
}) {
  return (
    <div>
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-brand-navy/45 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(on ? "" : o.value)}
              className={`px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide border transition-colors ${
                on
                  ? "bg-brand-navy text-brand-lime border-brand-navy"
                  : "bg-white text-brand-navy/55 border-brand-navy/20 hover:border-brand-navy/50"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function choiceLabel<T extends string>(
  options: readonly { value: T; label: string }[],
  value: T | "",
): string {
  return options.find((o) => o.value === value)?.label ?? "";
}

export function ObservationsPanel({
  machine,
  onUpdate,
}: {
  machine: MappingMachine;
  onUpdate: (m: MappingMachine) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const obs = parseObservations(machine.observations);
  const assessment = assessMachine(machine);
  const autoKeys = new Set(assessment.flags.filter((f) => f.auto).map((f) => f.key));
  const flagged = FLAG_DEFS.filter((d) => obs.flags[d.key] || autoKeys.has(d.key));

  async function patch(next: MachineObservations) {
    setSaving(true);
    try {
      const updated = await updateMachine(machine.id, { observations: stringifyObservations(next) });
      onUpdate({ ...machine, ...updated, photos: updated.photos ?? machine.photos, vfds: updated.vfds ?? machine.vfds, servos: updated.servos ?? machine.servos });
    } finally {
      setSaving(false);
    }
  }

  function setField<K extends keyof MachineObservations>(key: K, value: MachineObservations[K]) {
    patch({ ...obs, [key]: value });
  }

  function toggleFlag(key: FlagKey) {
    if (autoKeys.has(key) && !obs.flags[key]) return;
    patch({ ...obs, flags: { ...obs.flags, [key]: !obs.flags[key] } });
  }

  const summary = [
    choiceLabel(OBS_CHOICES.operator_interface, obs.operator_interface),
    choiceLabel(OBS_CHOICES.diagnostics, obs.diagnostics),
    choiceLabel(OBS_CHOICES.network, obs.network),
    choiceLabel(OBS_CHOICES.recoverability, obs.recoverability),
    obs.backup_on_file === "no" ? "No backup" : obs.backup_on_file === "yes" ? "Backup on file" : "",
    obs.known_pain.trim() ? "Pain noted" : "",
    flagged.length ? `${flagged.length} flag${flagged.length === 1 ? "" : "s"}` : "",
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-2 p-3 text-left"
      >
        <HiEye className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="font-semibold text-sm text-gray-700">Floor observations</span>
            {saving && <span className="font-mono text-[9px] text-brand-navy/40 uppercase">Saving</span>}
          </span>
          <span className="block text-xs text-gray-500 truncate mt-0.5">
            {summary.length ? summary.join(" · ") : "Interface, network, and a few flags — open when you need them"}
          </span>
        </span>
        <HiChevronDown className={`w-4 h-4 text-gray-300 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-3">
          <div className="space-y-2.5">
            <ChipRow label="Operator interface" value={obs.operator_interface} options={OBS_CHOICES.operator_interface} onChange={(v) => setField("operator_interface", v)} />
            <ChipRow label="Diagnostics" value={obs.diagnostics} options={OBS_CHOICES.diagnostics} onChange={(v) => setField("diagnostics", v)} />
            <ChipRow label="Network" value={obs.network} options={OBS_CHOICES.network} onChange={(v) => setField("network", v)} />
            <ChipRow label="Recoverability" value={obs.recoverability} options={OBS_CHOICES.recoverability} onChange={(v) => setField("recoverability", v)} />
            <div className="grid grid-cols-2 gap-3">
              <ChipRow label="Program backup" value={obs.backup_on_file} options={OBS_CHOICES.backup_on_file} onChange={(v) => setField("backup_on_file", v)} />
              <ChipRow label="Drawings on site" value={obs.drawings_on_site} options={OBS_CHOICES.drawings_on_site} onChange={(v) => setField("drawings_on_site", v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ChipRow label="Bottleneck" value={obs.bottleneck} options={OBS_CHOICES.bottleneck} onChange={(v) => setField("bottleneck", v)} />
              <ChipRow label="Changeover" value={obs.changeover} options={OBS_CHOICES.changeover} onChange={(v) => setField("changeover", v)} />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-brand-navy/45 mb-1">Known pain</label>
            <textarea
              defaultValue={obs.known_pain}
              rows={2}
              placeholder="What they said stops the line…"
              onBlur={(e) => {
                const v = e.target.value;
                if (v !== obs.known_pain) setField("known_pain", v);
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="space-y-2">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-brand-navy/45">Flags</p>
            {FLAG_GROUPS.map((group) => (
              <div key={group.id}>
                <p className="text-[10px] text-gray-400 mb-1">{group.label}</p>
                <div className="flex flex-wrap gap-1">
                  {FLAG_DEFS.filter((d) => d.group === group.id).map((def) => {
                    const on = Boolean(obs.flags[def.key]) || autoKeys.has(def.key);
                    const auto = autoKeys.has(def.key) && !obs.flags[def.key];
                    return (
                      <button
                        key={def.key}
                        type="button"
                        title={def.pitch}
                        onClick={() => toggleFlag(def.key)}
                        className={`px-2 py-1 text-[11px] font-medium border text-left leading-tight ${
                          on
                            ? "bg-brand-navy text-white border-brand-navy"
                            : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                        }`}
                      >
                        {def.label}{auto ? " · auto" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

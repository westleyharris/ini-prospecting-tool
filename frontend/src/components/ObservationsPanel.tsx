import { useState } from "react";
import { HiEye, HiFlag } from "react-icons/hi2";
import type { MappingMachine } from "../api/mappings";
import { updateMachine } from "../api/mappings";
import { assessMachine } from "../data/machineAssessment";
import {
  FLAG_DEFS,
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
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-brand-navy/45 mb-1.5">{label}</p>
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

export function ObservationsPanel({
  machine,
  onUpdate,
}: {
  machine: MappingMachine;
  onUpdate: (m: MappingMachine) => void;
}) {
  const [saving, setSaving] = useState(false);
  const obs = parseObservations(machine.observations);
  const assessment = assessMachine(machine);
  const autoKeys = new Set(assessment.flags.filter((f) => f.auto).map((f) => f.key));

  async function patch(next: MachineObservations) {
    setSaving(true);
    try {
      const updated = await updateMachine(machine.id, { observations: stringifyObservations(next) });
      onUpdate(updated);
    } finally {
      setSaving(false);
    }
  }

  function setField<K extends keyof MachineObservations>(key: K, value: MachineObservations[K]) {
    patch({ ...obs, [key]: value });
  }

  function toggleFlag(key: FlagKey) {
    patch({ ...obs, flags: { ...obs.flags, [key]: !obs.flags[key] } });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
      <div className="flex items-center gap-2">
        <HiEye className="w-4 h-4 text-gray-500" />
        <span className="font-semibold text-sm text-gray-700">Floor observations</span>
        {saving && <span className="ml-auto font-mono text-[9px] text-brand-navy/40 uppercase">Saving</span>}
      </div>
      <p className="text-[11px] text-gray-500 leading-snug">
        What the operator and mechanic actually live with. These flags show up on the drawing and in the deck.
      </p>

      <div className="space-y-3">
        <ChipRow label="Operator interface" value={obs.operator_interface} options={OBS_CHOICES.operator_interface} onChange={(v) => setField("operator_interface", v)} />
        <ChipRow label="Diagnostics on the panel" value={obs.diagnostics} options={OBS_CHOICES.diagnostics} onChange={(v) => setField("diagnostics", v)} />
        <ChipRow label="Network" value={obs.network} options={OBS_CHOICES.network} onChange={(v) => setField("network", v)} />
        <ChipRow label="Recoverability" value={obs.recoverability} options={OBS_CHOICES.recoverability} onChange={(v) => setField("recoverability", v)} />
        <div className="grid grid-cols-2 gap-3">
          <ChipRow label="Program backup" value={obs.backup_on_file} options={OBS_CHOICES.backup_on_file} onChange={(v) => setField("backup_on_file", v)} />
          <ChipRow label="Drawings on site" value={obs.drawings_on_site} options={OBS_CHOICES.drawings_on_site} onChange={(v) => setField("drawings_on_site", v)} />
        </div>
        <ChipRow label="Bottleneck" value={obs.bottleneck} options={OBS_CHOICES.bottleneck} onChange={(v) => setField("bottleneck", v)} />
        <ChipRow label="Changeover" value={obs.changeover} options={OBS_CHOICES.changeover} onChange={(v) => setField("changeover", v)} />
      </div>

      <div>
        <label className="block font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-brand-navy/45 mb-1">Known pain</label>
        <textarea
          defaultValue={obs.known_pain}
          rows={2}
          placeholder="What the operator or supervisor said — this is the one that stops the line, recovery takes 40 minutes, …"
          onBlur={(e) => {
            const v = e.target.value;
            if (v !== obs.known_pain) setField("known_pain", v);
          }}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <HiFlag className="w-4 h-4 text-gray-500" />
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-brand-navy/45">Opportunity flags</span>
        </div>
        <div className="space-y-1">
          {FLAG_DEFS.map((def) => {
            const checked = Boolean(obs.flags[def.key]) || autoKeys.has(def.key);
            const auto = autoKeys.has(def.key) && !obs.flags[def.key];
            return (
              <label
                key={def.key}
                className={`flex items-start gap-2 px-2 py-1.5 border cursor-pointer ${
                  checked ? "bg-brand-navy/5 border-brand-navy/20" : "bg-white border-transparent hover:bg-gray-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={auto}
                  onChange={() => toggleFlag(def.key)}
                  className="mt-0.5 accent-[#00182e]"
                />
                <span className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-gray-800">{def.label}</span>
                  {auto && (
                    <span className="ml-1.5 font-mono text-[8px] font-bold uppercase tracking-wider text-brand-navy/45">
                      auto
                    </span>
                  )}
                  <span className="block text-[10px] text-gray-500 leading-snug">{def.pitch}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import {
  HiArrowLeft, HiPrinter, HiPlus, HiTrash, HiPencil,
  HiChevronDown, HiCheckCircle, HiClock, HiCamera,
  HiCpuChip, HiComputerDesktop, HiBolt, HiPhoto,
  HiBuildingOffice2, HiDocumentText, HiXMark, HiCog8Tooth,
  HiEye, HiPencilSquare, HiExclamationTriangle, HiShieldCheck, HiPresentationChartBar,
  HiArrowUp,
} from "react-icons/hi2";
import {
  getMapping, updateMapping, createMachine, updateMachine,
  deleteMachine, uploadPhoto, deletePhoto, rerunOcr,
  photoUrl,
  type Mapping, type MappingMachine, type MappingPhoto,
} from "../api/mappings";
import { LIFECYCLE_META, type LifecycleResult } from "../data/obsoleteEquipment";
import { assessMachine, lifeFor } from "../data/machineAssessment";
import { buildRiskRegister, RISK_META, type RiskFinding } from "../data/riskRegister";
import { buildOpportunityRegister } from "../data/opportunityRegister";
import { downloadPresentation } from "../services/presentation";
import { usePrintReport } from "../hooks/usePrintReport";
import { ShareLinkButton } from "../components/ShareLinkButton";
import { BackToTop } from "../components/BackToTop";
import { ObservationsPanel } from "../components/ObservationsPanel";
import { machineTag, tagParts, groupMachinesByLine, drawingNumber } from "../data/consolidateMappings";

// ─── Lifecycle badge ──────────────────────────────────────────────────────────
function LifecycleBadge({ result }: { result?: LifecycleResult }) {
  if (!result || result.status === "unknown") return null;
  const meta = LIFECYCLE_META[result.status];
  return (
    <div className="relative group/eol inline-flex shrink-0">
      <span
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded border cursor-help"
        style={{ background: meta.bg, color: meta.ink, borderColor: meta.border }}
      >
        {result.status === "mature" ? meta.short : `⚠ ${meta.short}`}
      </span>
      <div className="absolute bottom-full left-0 mb-2 z-20 w-60 bg-gray-950 text-white rounded-xl p-3 text-xs shadow-xl opacity-0 pointer-events-none group-hover/eol:opacity-100 transition-opacity duration-150"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
        <p className="font-semibold mb-1 leading-snug" style={{ color: meta.border }}>{result.note}</p>
        {result.eolYear && <p className="text-gray-400 text-[10px]">Last ship: {result.eolYear}</p>}
        {result.successor && (
          <div className="mt-1.5 pt-1.5 border-t border-white/10">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Recommended replacement</p>
            <p className="text-brand-lime font-bold mt-0.5">{result.successor}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FlagPills({ machine, max = 3 }: { machine: MappingMachine; max?: number }) {
  const a = assessMachine(machine);
  const pills: { text: string; ink: string; bg: string; border: string }[] = [];
  if (a.hasEol) {
    const st = a.worst.status === "unsupported" ? "UNSUP" : "EOL";
    pills.push({ text: st, ink: "#92400e", bg: "#fef3c7", border: "#d97706" });
  } else if (a.hasMature) {
    pills.push({ text: "MAT", ink: "#1e3a5f", bg: "#e8eef5", border: "#64748b" });
  }
  for (const f of a.flags) {
    if (pills.length >= max) break;
    if (pills.some((p) => p.text === f.short)) continue;
    pills.push({ text: f.short, ink: "#00182e", bg: "#f4f6f2", border: "rgba(0,24,46,0.35)" });
  }
  if (pills.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-0.5 justify-end">
      {pills.map((p) => (
        <span key={p.text} className="font-mono text-[8px] font-bold px-1 leading-4"
          style={{ color: p.ink, background: p.bg, border: `1px solid ${p.border}` }}>
          {p.text}
        </span>
      ))}
    </span>
  );
}

const TAG_INK = "#00182e";
const TAG_LIME = "#acec00";

function TagBadge({
  machine, index, large = false, print = false,
}: {
  machine: MappingMachine;
  index: number;
  large?: boolean;
  print?: boolean;
}) {
  const { prefix, seq } = tagParts(machine, index);
  if (print) {
    return (
      <div style={{ display: "flex", alignItems: "stretch", flexShrink: 0, border: `${large ? 2 : 1.5}px solid ${TAG_INK}` }}>
        <div style={{
          background: TAG_LIME, color: TAG_INK, padding: large ? "0 8px" : "0 6px",
          fontFamily: "'IBM Plex Mono', monospace", fontSize: large ? 10 : 9, fontWeight: 900,
          display: "flex", alignItems: "center",
        }}>{prefix}</div>
        <div style={{
          background: "#fff", color: TAG_INK, padding: large ? "0 14px" : "0 8px",
          fontFamily: "'IBM Plex Mono', monospace", fontSize: large ? 18 : 11, fontWeight: 700,
          display: "flex", alignItems: "center", borderLeft: `1.5px solid ${TAG_INK}`,
        }}>{seq}</div>
      </div>
    );
  }
  return (
    <div className="flex items-stretch shrink-0 border border-brand-navy">
      <div className="flex items-center justify-center px-1.5 bg-brand-lime font-mono text-[10px] font-bold text-brand-navy">
        {prefix}
      </div>
      <div className="flex items-center justify-center px-2 bg-white font-mono text-[11px] font-bold text-brand-navy border-l border-brand-navy">
        {seq}
      </div>
    </div>
  );
}

function LineIndexStrip({ mapping, print = false }: { mapping: Mapping; print?: boolean }) {
  const lines = mapping.source_lines;
  if (!lines || lines.length < 2) return null;
  if (print) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", borderTop: "1px solid rgba(0,24,46,0.22)" }}>
        {lines.map((l, i) => (
          <div key={l.id} style={{ padding: "6px 12px", borderRight: "1px solid rgba(0,24,46,0.22)", minWidth: 120 }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.16em", color: TAG_INK, opacity: 0.4,
            }}>{`L${String(i + 1).padStart(2, "0")}`}</div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700,
              textTransform: "uppercase", color: TAG_INK, marginTop: 2,
            }}>{l.name}</div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: TAG_INK, opacity: 0.45, marginTop: 2,
            }}>{l.machine_count} mach · {l.photo_count} phot</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-stretch" style={{ borderTop: "1px solid rgba(0,24,46,0.22)" }}>
      {lines.map((l, i) => (
        <div key={l.id} className="px-3 py-1.5 min-w-[7rem]" style={{ borderRight: "1px solid rgba(0,24,46,0.22)" }}>
          <p className="font-mono text-[7px] font-bold uppercase tracking-[0.16em]" style={{ color: TAG_INK, opacity: 0.4 }}>
            {`L${String(i + 1).padStart(2, "0")}`}
          </p>
          <p className="font-mono text-[11px] font-bold uppercase" style={{ color: TAG_INK }}>{l.name}</p>
          <p className="font-mono text-[8px]" style={{ color: TAG_INK, opacity: 0.45 }}>
            {l.machine_count} mach · {l.photo_count} phot
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Photo category config ────────────────────────────────────────────────────
const PHOTO_CATEGORIES = [
  { key: "machine" as const, label: "Overview",  Icon: HiBuildingOffice2, color: "bg-gray-100 text-gray-600",    printLabel: "Machine" },
  { key: "plc"     as const, label: "PLC",        Icon: HiCpuChip,         color: "bg-blue-100 text-blue-700",    printLabel: "PLC" },
  { key: "hmi"     as const, label: "HMI",        Icon: HiComputerDesktop, color: "bg-purple-100 text-purple-700",printLabel: "HMI" },
  { key: "vfd"     as const, label: "VFD",        Icon: HiBolt,            color: "bg-amber-100 text-amber-700",  printLabel: "VFD" },
  { key: "servo"   as const, label: "Servo",      Icon: HiCog8Tooth,       color: "bg-green-100 text-green-700",  printLabel: "Servo" },
  { key: "other"   as const, label: "Other",      Icon: HiCamera,          color: "bg-gray-100 text-gray-500",    printLabel: "Other" },
];
type PhotoCategory = (typeof PHOTO_CATEGORIES)[number]["key"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseOcr(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

// ─── Field group ──────────────────────────────────────────────────────────────
function FieldGroup({
  title, Icon, fields, machine, onSave, eolResult,
}: {
  title: string;
  Icon: React.ElementType;
  fields: { key: keyof MappingMachine; label: string; placeholder: string }[];
  machine: MappingMachine;
  onSave: (data: Partial<MappingMachine>) => Promise<void>;
  eolResult?: LifecycleResult;
}) {
  const [editing, setEditing] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const hasAny = fields.some((f) => machine[f.key]);

  function startEdit() {
    const init: Record<string, string> = {};
    for (const f of fields) init[f.key as string] = (machine[f.key] as string) ?? "";
    setVals(init);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      const patch: Partial<MappingMachine> = {};
      for (const f of fields) {
        (patch as Record<string, string | null>)[f.key as string] = vals[f.key as string]?.trim() || null;
      }
      await onSave(patch);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-gray-200 p-3 space-y-2 bg-white">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-gray-500" />
          <span className="font-semibold text-sm text-gray-700">{title}</span>
        </div>
        {fields.map((f) => (
          <div key={f.key as string}>
            <label className="block text-xs text-gray-400 mb-0.5">{f.label}</label>
            <input
              type="text"
              value={vals[f.key as string] ?? ""}
              onChange={(e) => setVals((v) => ({ ...v, [f.key as string]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={saving}
            className="flex-1 py-2 bg-brand-navy text-white rounded-lg text-sm font-medium hover:bg-brand-navy-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={startEdit}
      className={`w-full text-left rounded-xl border-2 border-dashed p-3 transition-colors ${
        hasAny ? "border-transparent bg-gray-50 hover:bg-gray-100" : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/30"
      }`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 shrink-0 ${hasAny ? "text-gray-500" : "text-gray-300"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">{title}</span>
            <LifecycleBadge result={eolResult} />
          </div>
          {hasAny ? (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {fields.filter((f) => machine[f.key]).map((f) => machine[f.key]).join(" · ")}
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">Tap to fill in</p>
          )}
        </div>
        <HiPencil className="w-4 h-4 text-gray-300 shrink-0" />
      </div>
    </button>
  );
}

// ─── Notes field ──────────────────────────────────────────────────────────────
function NotesField({ value, onSave }: { value: string; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setVal(value); }, [value]);

  async function save() {
    setSaving(true);
    try { await onSave(val); setEditing(false); } finally { setSaving(false); }
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea autoFocus value={val} onChange={(e) => setVal(e.target.value)} rows={3}
          placeholder="Machine notes, observations, issues…"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <div className="flex gap-2">
          <button onClick={save} disabled={saving}
            className="px-4 py-1.5 bg-brand-navy text-white rounded-lg text-sm hover:bg-brand-navy-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="px-4 py-1.5 text-gray-500 text-sm">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)}
      className="w-full text-left flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 py-1">
      <HiDocumentText className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{value ? value : "Add machine notes"}</span>
    </button>
  );
}

// ─── Photo section ────────────────────────────────────────────────────────────
function PhotoSection({
  machine, onPhotoAdded, onPhotoDeleted,
}: {
  machine: MappingMachine;
  onPhotoAdded: (photo: MappingPhoto) => void;
  onPhotoDeleted: (photoId: string) => void;
}) {
  const [uploading, setUploading] = useState<PhotoCategory | null>(null);
  const [lightbox, setLightbox] = useState<MappingPhoto | null>(null);
  const [ocrRunning, setOcrRunning] = useState<string | null>(null);
  // "Other" label flow
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherLabel, setOtherLabel] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingCategory = useRef<PhotoCategory>("other");
  const pendingLabel = useRef<string | undefined>(undefined);
  const photos = machine.photos ?? [];

  function triggerUpload(category: PhotoCategory, label?: string) {
    pendingCategory.current = category;
    pendingLabel.current = label;
    if (fileInputRef.current) { fileInputRef.current.value = ""; fileInputRef.current.click(); }
  }

  function handleOtherClick() {
    setShowOtherInput(true);
    setOtherLabel("");
  }

  function handleOtherCapture() {
    const label = otherLabel.trim() || "Other";
    setShowOtherInput(false);
    triggerUpload("other", label);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const category = pendingCategory.current;
    const label = pendingLabel.current;
    setUploading(category);
    try {
      for (const file of Array.from(files)) {
        const photo = await uploadPhoto(machine.id, file, category, photos.length, label);
        onPhotoAdded(photo);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  async function handleDelete(photo: MappingPhoto) {
    if (!confirm("Remove this photo?")) return;
    await deletePhoto(photo.id);
    onPhotoDeleted(photo.id);
    if (lightbox?.id === photo.id) setLightbox(null);
  }

  async function handleRerunOcr(photo: MappingPhoto) {
    setOcrRunning(photo.id);
    try {
      const updated = await rerunOcr(photo.id);
      const data = parseOcr(updated.ocr_raw);
      const entries = Object.entries(data).filter(([k, v]) => k !== "raw" && v);
      alert(entries.length ? "OCR result:\n" + entries.map(([k, v]) => `${k}: ${v}`).join("\n") : "OCR ran but nothing was detected.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "OCR failed");
    } finally {
      setOcrRunning(null);
    }
  }

  // Count non-other photos by category; count "other" photos overall for the button badge
  const photosByCategory: Record<string, MappingPhoto[]> = {};
  for (const p of photos) {
    const key = p.category === "other" ? "other" : p.category;
    if (!photosByCategory[key]) photosByCategory[key] = [];
    photosByCategory[key].push(p);
  }

  // Unique "other" labels for thumbnail grouping display
  const otherPhotos = photos.filter((p) => p.category === "other");

  return (
    <div className="space-y-3">
      <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment"
        className="hidden" onChange={handleFileChange} />

      {/* Category buttons — 5 standard + Other */}
      <div className="grid grid-cols-6 gap-1.5">
        {PHOTO_CATEGORIES.filter((c) => c.key !== "other").map((cat) => {
          const count = (photosByCategory[cat.key] ?? []).length;
          const isUploading = uploading === cat.key;
          const CatIcon = cat.Icon;
          return (
            <button key={cat.key} onClick={() => triggerUpload(cat.key)} disabled={!!uploading || showOtherInput}
              className={`relative flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 border text-xs font-medium transition-all disabled:opacity-60 ${
                count > 0
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
              }`}>
              {isUploading
                ? <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                : <CatIcon className="w-5 h-5" />
              }
              <span className="leading-tight text-center text-[11px]">{cat.label}</span>
              {count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-brand-navy text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                  {count}
                </span>
              )}
            </button>
          );
        })}
        {/* Other button */}
        {(() => {
          const count = otherPhotos.length;
          const isUploading = uploading === "other";
          return (
            <button onClick={handleOtherClick} disabled={!!uploading || showOtherInput}
              className={`relative flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 border text-xs font-medium transition-all disabled:opacity-60 ${
                showOtherInput
                  ? "border-blue-400 bg-blue-50 text-blue-700"
                  : count > 0
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
              }`}>
              {isUploading
                ? <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                : <HiCamera className="w-5 h-5" />
              }
              <span className="leading-tight text-center text-[11px]">Other</span>
              {count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-brand-navy text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                  {count}
                </span>
              )}
            </button>
          );
        })()}
      </div>

      {/* Existing "other" label groups — tap to add more photos to that group */}
      {(() => {
        const labels = [...new Set(
          photos.filter((p) => p.category === "other").map((p) => p.label?.trim() || "Other")
        )];
        if (labels.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-2">
            {labels.map((lbl) => {
              const count = photos.filter((p) => p.category === "other" && (p.label?.trim() || "Other") === lbl).length;
              const isUploading = uploading === "other" && pendingLabel.current === lbl;
              return (
                <button
                  key={lbl}
                  onClick={() => triggerUpload("other", lbl)}
                  disabled={!!uploading || showOtherInput}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 disabled:opacity-50 transition-colors"
                >
                  {isUploading
                    ? <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    : <HiCamera className="w-3.5 h-3.5 text-gray-500" />
                  }
                  {lbl}
                  <span className="ml-0.5 text-gray-400">({count})</span>
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* New "other" label input — appears when Other button is tapped */}
      {showOtherInput && (
        <div className="flex gap-2 items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
          <HiCamera className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Label (e.g. Servo Motors, Nameplate, Panel…)"
            value={otherLabel}
            onChange={(e) => setOtherLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleOtherCapture(); if (e.key === "Escape") setShowOtherInput(false); }}
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-400"
          />
          <button onClick={handleOtherCapture}
            className="px-3 py-1.5 bg-brand-navy text-white rounded-lg text-xs font-medium hover:bg-brand-navy-700 shrink-0">
            Capture
          </button>
          <button onClick={() => setShowOtherInput(false)} className="p-1 text-gray-400 hover:text-gray-600">
            <HiXMark className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Thumbnails */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((photo) => {
            const cat = PHOTO_CATEGORIES.find((c) => c.key === photo.category);
            const displayLabel = photo.category === "other" && photo.label ? photo.label : cat?.label ?? photo.category;
            const ocrData = parseOcr(photo.ocr_raw);
            const hasOcr = Object.entries(ocrData).some(([k, v]) => k !== "raw" && v);
            const ocrError = !!ocrData.error;
            return (
              <div key={photo.id} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                <img src={photoUrl(photo.machine_id, photo.filename, "thumb")} alt={photo.original_name}
                  loading="lazy" decoding="async"
                  className="w-full h-full object-cover cursor-pointer" onClick={() => setLightbox(photo)} />
                <div className={`absolute bottom-0 left-0 right-0 flex items-center gap-1 px-1.5 py-1 ${cat?.color ?? "bg-gray-100 text-gray-500"} bg-opacity-90`}>
                  {cat && <cat.Icon className="w-3 h-3 shrink-0" />}
                  <span className="text-[9px] font-medium truncate">{displayLabel}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(photo); }}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <HiXMark className="w-3.5 h-3.5" />
                </button>
                {photo.ocr_raw && (
                  <div className={`absolute top-1 left-1 w-2.5 h-2.5 rounded-full ${ocrError ? "bg-red-500" : hasOcr ? "bg-emerald-500" : "bg-gray-400"}`}
                    title={ocrError ? "OCR failed" : hasOcr ? "OCR extracted data" : "No data found"} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setLightbox(null)}>
          <div className="flex items-center justify-between px-4 py-3 text-white shrink-0" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="font-medium text-sm">{lightbox.original_name}</p>
              {(() => {
                const data = parseOcr(lightbox.ocr_raw);
                const entries = Object.entries(data).filter(([k, v]) => k !== "raw" && v);
                if (!lightbox.ocr_raw) return <span className="text-xs text-gray-400">No OCR yet</span>;
                if (data.error) return <span className="text-xs text-red-400">OCR failed</span>;
                if (entries.length === 0) return <span className="text-xs text-gray-400">Nothing detected</span>;
                return <span className="text-xs text-emerald-400 font-medium">{entries.map(([, v]) => v).join(" · ")}</span>;
              })()}
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleRerunOcr(lightbox)} disabled={ocrRunning === lightbox.id}
                className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs hover:bg-amber-700 disabled:opacity-50">
                {ocrRunning === lightbox.id ? "Running…" : "Re-run OCR"}
              </button>
              <button onClick={() => handleDelete(lightbox)}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700">
                Delete
              </button>
              <button onClick={() => setLightbox(null)} className="p-1.5 hover:bg-white/10 rounded-lg">
                <HiXMark className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            <img src={photoUrl(lightbox.machine_id, lightbox.filename, "view")} alt={lightbox.original_name}
              className="max-w-full max-h-full object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Machine card ─────────────────────────────────────────────────────────────
function MachineCard({
  machine: initialMachine, index, onUpdate, onDelete,
}: {
  machine: MappingMachine;
  index: number;
  onUpdate: (m: MappingMachine) => void;
  onDelete: () => void;
}) {
  const [machine, setMachine] = useState(initialMachine);
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(machine.name);

  useEffect(() => { setMachine(initialMachine); setNameVal(initialMachine.name); }, [initialMachine]);

  async function saveName() {
    if (!nameVal.trim()) { setEditingName(false); return; }
    const updated = await updateMachine(machine.id, { name: nameVal.trim() });
    setMachine(updated);
    onUpdate(updated);
    setEditingName(false);
  }

  async function saveFields(data: Partial<MappingMachine>) {
    const updated = await updateMachine(machine.id, data);
    setMachine(updated);
    onUpdate(updated);
  }

  function handlePhotoAdded(photo: MappingPhoto) {
    setMachine((m) => ({ ...m, photos: [...(m.photos ?? []), photo] }));
  }

  function handlePhotoDeleted(photoId: string) {
    setMachine((m) => ({ ...m, photos: (m.photos ?? []).filter((p) => p.id !== photoId) }));
  }

  const photoCount = (machine.photos ?? []).length;

  return (
    <div className="bg-white border-2 border-brand-navy overflow-hidden">
      {/* Header — equipment tag strip */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-[#f4f6f2] border-b-2 border-brand-navy">
        <TagBadge machine={machine} index={index} />

        {editingName ? (
          <input autoFocus value={nameVal} onChange={(e) => setNameVal(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
            className="flex-1 bg-white border border-brand-navy px-2 py-1 font-mono text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-brand-lime" />
        ) : (
          <button onClick={() => { setNameVal(machine.name); setEditingName(true); }}
            className="flex-1 text-left font-mono font-bold text-brand-navy text-sm uppercase tracking-wide hover:text-brand-navy-600 flex items-center gap-1.5">
            {machine.name}
            <HiPencil className="w-3.5 h-3.5 text-brand-navy/25" />
          </button>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {photoCount > 0 && (
            <span className="flex items-center gap-1 font-mono text-[10px] font-bold text-brand-navy/40">
              <HiPhoto className="w-3.5 h-3.5" />{photoCount}
            </span>
          )}
          <button onClick={() => setExpanded((v) => !v)}
            className="p-1.5 hover:bg-brand-navy/5 text-brand-navy/40" title={expanded ? "Collapse" : "Expand"}>
            <HiChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
          <button onClick={() => { if (confirm(`Remove machine "${machine.name}"?`)) onDelete(); }}
            className="p-1.5 hover:bg-red-50 text-brand-navy/25 hover:text-red-500" title="Delete machine">
            <HiTrash className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="p-4 space-y-3">
          <PhotoSection machine={machine} onPhotoAdded={handlePhotoAdded} onPhotoDeleted={handlePhotoDeleted} />
          <FieldGroup title="PLC" Icon={HiCpuChip}
            fields={[
              { key: "plc_make",    label: "Make",        placeholder: "e.g. Allen-Bradley" },
              { key: "plc_model",   label: "Model",       placeholder: "e.g. CompactLogix L33ER" },
              { key: "plc_series",  label: "Series",      placeholder: "e.g. 1769" },
              { key: "plc_part_no", label: "Part number", placeholder: "e.g. 1769-L33ER/B" },
            ]}
            machine={machine} onSave={saveFields}
            eolResult={lifeFor(machine, "plc")} />
          <FieldGroup title="HMI" Icon={HiComputerDesktop}
            fields={[
              { key: "hmi_make",    label: "Make",        placeholder: "e.g. Allen-Bradley" },
              { key: "hmi_model",   label: "Model",       placeholder: "e.g. PanelView Plus 7" },
              { key: "hmi_part_no", label: "Part number", placeholder: "e.g. 2711P-T7C22D9P" },
            ]}
            machine={machine} onSave={saveFields}
            eolResult={lifeFor(machine, "hmi")} />
          <FieldGroup title="VFD" Icon={HiBolt}
            fields={[
              { key: "vfd_make",    label: "Make",    placeholder: "e.g. Allen-Bradley" },
              { key: "vfd_model",   label: "Model",   placeholder: "e.g. PowerFlex 525" },
              { key: "vfd_hp",      label: "HP",      placeholder: "e.g. 5 HP" },
              { key: "vfd_voltage", label: "Voltage", placeholder: "e.g. 480V" },
            ]}
            machine={machine} onSave={saveFields}
            eolResult={lifeFor(machine, "vfd")} />
          <FieldGroup title="Servo Drive" Icon={HiCog8Tooth}
            fields={[
              { key: "servo_drive_make",  label: "Drive Make",  placeholder: "e.g. Allen-Bradley, Yaskawa" },
              { key: "servo_drive_model", label: "Drive Model", placeholder: "e.g. Kinetix 5500, SGDV" },
            ]}
            machine={machine} onSave={saveFields}
            eolResult={lifeFor(machine, "servo")} />
          <FieldGroup title="Servo Motor" Icon={HiCog8Tooth}
            fields={[
              { key: "servo_motor_make",    label: "Motor Make",    placeholder: "e.g. Allen-Bradley, Fanuc" },
              { key: "servo_motor_model",   label: "Motor Model",   placeholder: "e.g. MP-Series, αiS" },
              { key: "servo_motor_part_no", label: "Motor Part No", placeholder: "e.g. MPL-B430P-MJ72AA" },
            ]}
            machine={machine} onSave={saveFields} />
          <ObservationsPanel machine={machine} onUpdate={(updated) => { setMachine(updated); onUpdate(updated); }} />
          <NotesField
            value={machine.notes ?? ""}
            onSave={async (notes) => {
              const updated = await updateMachine(machine.id, { notes: notes || null });
              setMachine(updated); onUpdate(updated);
            }} />
        </div>
      )}
    </div>
  );
}

// ─── Print view ───────────────────────────────────────────────────────────────
// ─── Obsolescence risk register ───────────────────────────────────────────────

const REG_INK  = "#00182e";
const REG_LIME = "#acec00";
const REG_HAIR = "rgba(0,24,46,0.22)";
const MONO     = "'IBM Plex Mono', 'Courier New', monospace";

/** Printable register sheet — ranked findings + the scoring method, so the customer can audit it. */
function RiskPrintSheet({
  register, mapping, dwgNo, reportDate,
}: {
  register: ReturnType<typeof buildRiskRegister>;
  mapping: Mapping;
  dwgNo: string;
  reportDate: string;
}) {
  const { findings, counts, affectedMachines, totalMachines, totalUnits } = register;

  const th: React.CSSProperties = {
    textAlign: "left", padding: "5px 8px", fontFamily: MONO, fontSize: 7,
    fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em",
    color: REG_INK, opacity: 0.5, borderBottom: `1px solid ${REG_HAIR}`,
  };
  const td: React.CSSProperties = {
    padding: "7px 8px", fontSize: 9, verticalAlign: "top",
    borderBottom: `1px solid ${REG_HAIR}`, color: REG_INK,
  };

  return (
    <div style={{ marginBottom: 14, border: `1.5px solid ${REG_INK}` }} className="print-avoid-break">
      {/* Sheet header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "5px 10px", background: REG_INK,
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 700,
          letterSpacing: "0.18em", color: REG_LIME, textTransform: "uppercase",
        }}>Lifecycle Risk Register</span>
        <span style={{ fontFamily: MONO, fontSize: 8, color: "rgba(255,255,255,0.4)" }}>
          {dwgNo} · {reportDate}
        </span>
      </div>

      {/* Summary band */}
      <div style={{ display: "flex", borderBottom: `1.5px solid ${REG_INK}` }}>
        {[
          { n: findings.length, l: "Findings" },
          { n: totalUnits, l: "Units affected" },
          { n: `${affectedMachines}/${totalMachines}`, l: "Machines" },
          { n: counts.critical, l: "Critical" },
          { n: counts.high, l: "High" },
          { n: counts.watch, l: "Watch" },
        ].map((s) => (
          <div key={s.l} style={{ flex: 1, padding: "8px 10px", borderRight: `1px solid ${REG_HAIR}`, textAlign: "center" }}>
            <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: REG_INK }}>{s.n}</div>
            <div style={{
              fontFamily: MONO, fontSize: 7, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.14em", color: REG_INK, opacity: 0.45, marginTop: 2,
            }}>{s.l}</div>
          </div>
        ))}
      </div>

      {findings.length === 0 ? (
        <div style={{ padding: "22px 12px", textAlign: "center" }}>
          <div style={{
            fontFamily: MONO, fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.1em", color: REG_INK,
          }}>No obsolete equipment identified</div>
          <div style={{ fontSize: 9, marginTop: 5, color: REG_INK, opacity: 0.55 }}>
            No control or drive asset recorded in this mapping matches a vendor end-of-life declaration.
          </div>
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(0,24,46,0.04)" }}>
              <th style={{ ...th, width: 26 }}>#</th>
              <th style={{ ...th, width: 62 }}>Risk</th>
              <th style={{ ...th, width: 42 }}>Type</th>
              <th style={th}>Installed equipment</th>
              <th style={{ ...th, width: 96 }}>Location</th>
              <th style={{ ...th, width: 40 }}>Qty</th>
              <th style={{ ...th, width: 40 }}>Last ship</th>
              <th style={{ ...th, width: 120 }}>Recommended replacement</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((f, i) => {
              const meta = RISK_META[f.level];
              return (
                <tr key={f.key} className="print-avoid-break">
                  <td style={{ ...td, fontFamily: MONO, fontWeight: 700, opacity: 0.45 }}>
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td style={td}>
                    <span style={{
                      display: "inline-block", padding: "2px 5px",
                      background: meta.bg, border: `1px solid ${meta.border}`, color: meta.ink,
                      fontFamily: MONO, fontSize: 7, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.1em",
                    }}>{meta.label}</span>
                  </td>
                  <td style={{ ...td, fontFamily: MONO, fontSize: 8, fontWeight: 700, opacity: 0.7 }}>
                    {f.categoryLabel}
                  </td>
                  <td style={td}>
                    <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>
                      {f.make} {f.model}
                    </div>
                    <div style={{ fontSize: 8, opacity: 0.6, marginTop: 2 }}>{f.note}</div>
                  </td>
                  <td style={{ ...td, fontFamily: MONO, fontSize: 8 }}>
                    {f.machines.map((m) => m.tag).join(", ")}
                  </td>
                  <td style={{ ...td, fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>{f.unitCount}</td>
                  <td style={{ ...td, fontFamily: MONO, fontSize: 9 }}>{f.eolYear ?? "—"}</td>
                  <td style={{ ...td, fontFamily: MONO, fontSize: 9, fontWeight: 600, color: "#166534" }}>
                    {f.successor ?? "Consult vendor"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Method + disclaimer */}
      <div style={{ borderTop: `1.5px solid ${REG_INK}`, padding: "8px 10px", background: "rgba(0,24,46,0.03)" }}>
        <div style={{
          fontFamily: MONO, fontSize: 7, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.16em", color: REG_INK, opacity: 0.5, marginBottom: 4,
        }}>Scoring method</div>
        <div style={{ fontSize: 8, lineHeight: 1.5, color: REG_INK, opacity: 0.75 }}>
          Each finding scores 2–7 across three factors: <strong>age</strong> (years since the vendor
          last-ship / discontinued date; mature platforms score 1), <strong>exposure</strong> (units of that asset installed at this
          facility), and <strong>migration path</strong> (whether the vendor names a direct successor).
          Older last-ship dates rank above newer ones when scores tie.
          Critical ≥ 6 · High 4–5 · Moderate ≤ 3 · Watch = mature / still shipping. Lifecycle data reflects published vendor
          declarations and should be confirmed against the manufacturer's current lifecycle
          statement before procurement.
        </div>
        <div style={{
          marginTop: 6, fontFamily: MONO, fontSize: 7, textTransform: "uppercase",
          letterSpacing: "0.1em", color: REG_INK, opacity: 0.4,
        }}>
          Prepared by I&amp;I Automation · {mapping.plant_name ?? "Plant"} · {reportDate}
        </div>
      </div>
    </div>
  );
}

/** On-screen register — same content, styled to match the drafting-sheet view. */
export function RiskRegisterView({ mapping }: { mapping: Mapping }) {
  const register = buildRiskRegister(mapping);
  const { findings, counts, affectedMachines, totalMachines, totalUnits } = register;

  return (
    <div className="space-y-3">
      {/* Header band */}
      <div className="border-2 border-brand-navy bg-white">
        <div className="flex items-center justify-between px-3 py-2 bg-brand-navy">
          <div className="flex items-center gap-2">
            <HiExclamationTriangle className="w-4 h-4 text-brand-lime" />
            <span className="font-mono text-[11px] font-bold text-brand-lime uppercase tracking-[0.16em]">
              Lifecycle Risk Register
            </span>
          </div>
          <span className="font-mono text-[10px] text-white/40 uppercase tracking-wider">
            {mapping.plant_name}
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-brand-navy/15">
          {[
            { n: findings.length, l: "Findings" },
            { n: totalUnits, l: "Units" },
            { n: `${affectedMachines}/${totalMachines}`, l: "Machines" },
            { n: counts.critical, l: "Critical" },
            { n: counts.high, l: "High" },
            { n: counts.watch, l: "Watch" },
          ].map((s) => (
            <div key={s.l} className="px-2 py-3 text-center">
              <div className="font-mono text-xl font-bold text-brand-navy tabular-nums">{s.n}</div>
              <div className="font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-brand-navy/45 mt-0.5">
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </div>

      {findings.length === 0 ? (
        <div className="border-2 border-brand-navy bg-white px-6 py-12 text-center">
          <HiShieldCheck className="w-10 h-10 mx-auto text-emerald-500 mb-3" />
          <p className="font-mono text-sm font-bold text-brand-navy uppercase tracking-wider">
            No lifecycle findings identified
          </p>
          <p className="text-xs text-brand-navy/50 mt-1.5 max-w-md mx-auto">
            No control or drive asset recorded in this mapping matches a vendor end-of-life
            declaration. Add equipment details in Edit mode to widen the check.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {findings.map((f, i) => (
            <RiskFindingCard key={f.key} finding={f} index={i} />
          ))}
        </div>
      )}

      {/* Method note */}
      <div className="border-2 border-brand-navy/20 bg-white px-3 py-3">
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-navy/45 mb-1.5">
          Scoring method
        </p>
        <p className="text-[11px] leading-relaxed text-brand-navy/65">
          Each finding scores 2–7 across three factors: <strong>age</strong> (years since the vendor
          last-ship / discontinued date; mature platforms score 1), <strong>exposure</strong> (units installed at this facility), and{" "}
          <strong>migration path</strong> (whether a direct successor is published).
          Older last-ship dates rank above newer ones when scores tie.
          Critical ≥ 6 · High 4–5 · Moderate ≤ 3 · Watch = mature / still shipping. Confirm lifecycle
          status with the manufacturer before procurement.
        </p>
      </div>

      <OpportunityRegisterView mapping={mapping} />
    </div>
  );
}

function OpportunityRegisterView({ mapping }: { mapping: Mapping }) {
  const register = buildOpportunityRegister(mapping);
  const { findings, affectedMachines, totalMachines, totalFlags } = register;

  return (
    <div className="space-y-3 pt-4">
      <div className="border-2 border-brand-navy bg-white">
        <div className="flex items-center justify-between px-3 py-2 bg-brand-navy">
          <div className="flex items-center gap-2">
            <HiShieldCheck className="w-4 h-4 text-brand-lime" />
            <span className="font-mono text-[11px] font-bold text-brand-lime uppercase tracking-[0.16em]">
              Opportunity Register
            </span>
          </div>
          <span className="font-mono text-[10px] text-white/40 uppercase tracking-wider">
            {affectedMachines}/{totalMachines} machines · {totalFlags} flags
          </span>
        </div>
      </div>

      {findings.length === 0 ? (
        <div className="border-2 border-brand-navy/20 bg-white px-6 py-8 text-center">
          <p className="font-mono text-xs font-bold text-brand-navy/50 uppercase tracking-wider">
            No opportunity flags yet
          </p>
          <p className="text-xs text-brand-navy/45 mt-1.5 max-w-md mx-auto">
            In Edit mode, record operator interface, diagnostics, and network on each machine.
            Flags such as no HMI, trapped modern hardware, and control islands appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {findings.map((f) => (
            <div key={f.key} className="border-2 bg-white" style={{ borderColor: REG_INK }}>
              <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: "#f4f6f2", borderBottom: `1px solid ${REG_HAIR}` }}>
                <span className="font-mono text-[9px] font-black uppercase tracking-[0.12em] px-1.5 py-0.5 border border-brand-navy/30 text-brand-navy">
                  {f.short}
                </span>
                <span className="font-mono text-xs font-bold text-brand-navy uppercase tracking-wide">{f.label}</span>
                <span className="ml-auto font-mono text-[10px] font-bold text-brand-navy">{f.unitCount} station{f.unitCount === 1 ? "" : "s"}</span>
              </div>
              <div className="px-3 py-3">
                <p className="text-xs text-brand-navy/70 leading-relaxed">{f.pitch}</p>
                <p className="font-mono text-[10px] font-bold text-brand-navy mt-2">
                  {f.machines.map((m) => `${m.tag} ${m.name}`).join(" · ")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RiskFindingCard({ finding, index }: { finding: RiskFinding; index: number }) {
  const meta = RISK_META[finding.level];
  return (
    <div className="border-2 bg-white" style={{ borderColor: REG_INK }}>
      <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: meta.bg, borderBottom: `1px solid ${REG_HAIR}` }}>
        <span className="font-mono text-[10px] font-bold tabular-nums" style={{ color: meta.ink, opacity: 0.6 }}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.12em] border"
          style={{ color: meta.ink, borderColor: meta.border, background: "rgba(255,255,255,0.6)" }}>
          {meta.label} risk
        </span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: meta.ink, opacity: 0.75 }}>
          {finding.categoryLabel}
        </span>
        <span className="ml-auto font-mono text-[10px] font-bold" style={{ color: meta.ink }}>
          Score {finding.score}/7
        </span>
      </div>

      <div className="px-3 py-3">
        <p className="font-mono text-base font-bold text-brand-navy">
          {finding.make} {finding.model}
        </p>
        <p className="text-xs text-brand-navy/55 mt-0.5">{finding.note}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 mt-3 pt-3 border-t border-brand-navy/10">
          <div>
            <p className="font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-brand-navy/40">Units</p>
            <p className="font-mono text-sm font-bold text-brand-navy">{finding.unitCount}</p>
          </div>
          <div>
            <p className="font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-brand-navy/40">
              {finding.status === "mature" ? "Status" : "Last ship"}
            </p>
            <p className="font-mono text-sm font-bold text-brand-navy">
              {finding.status === "mature" ? "Mature" : (finding.eolYear ?? "—")}
            </p>
          </div>
          <div className="col-span-2">
            <p className="font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-brand-navy/40">Location</p>
            <p className="font-mono text-xs font-bold text-brand-navy truncate">
              {finding.machines.map((m) => `${m.tag} ${m.name}`).join(" · ")}
            </p>
          </div>
        </div>

        <div className="mt-3 px-2.5 py-2 border" style={{ borderColor: "#16653433", background: "#f0fdf4" }}>
          <p className="font-mono text-[8px] font-bold uppercase tracking-[0.14em]" style={{ color: "#166534", opacity: 0.7 }}>
            Recommended replacement
          </p>
          <p className="font-mono text-sm font-bold mt-0.5" style={{ color: "#166534" }}>
            {finding.successor ?? "Consult vendor for migration path"}
          </p>
        </div>
      </div>
    </div>
  );
}

// Full-bleed engineering drawing sheet. Hidden on screen; revealed by @media print.
export function PrintView({ mapping, mode = "sheet", active = false }: { mapping: Mapping; mode?: "sheet" | "risk"; active?: boolean }) {
  if (!active) return null;
  const register = buildRiskRegister(mapping);
  const opportunities = buildOpportunityRegister(mapping);
  const machines = mapping.machines ?? [];
  const lineGroups = groupMachinesByLine(machines);
  const lineCount = mapping.source_lines?.length ?? 0;
  const totalPhotos = machines.reduce((s, m) => s + (m.photos ?? []).length, 0);
  const assessments = machines.map(assessMachine);
  const eolCount    = assessments.filter((a) => a.hasEol).length;
  const flagCount   = assessments.reduce((s, a) => s + a.flags.length, 0);
  const plcCount    = machines.filter((m) => m.plc_make || m.plc_model).length;
  const driveCount  = machines.filter((m) => m.vfd_make || m.vfd_model || m.servo_drive_make).length;
  const reportDate  = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const dwgNo       = drawingNumber(mapping);

  const INK  = "#00182e";
  const LIME = "#acec00";
  const HAIR = "rgba(0,24,46,0.22)";

  const CAT_PRINT = {
    machine: { label: "Machine Overview", accent: "#374151" },
    plc:     { label: "PLC",              accent: "#1d4ed8" },
    hmi:     { label: "HMI",              accent: "#6d28d9" },
    vfd:     { label: "VFD",              accent: "#b45309" },
    servo:   { label: "Servo",            accent: "#15803d" },
    other:   { label: "Other",            accent: "#6b7280" },
  } as const;
  type CatKey = keyof typeof CAT_PRINT;

  function getCatSpecs(machine: MappingMachine, cat: CatKey): { label: string; value: string }[] {
    if (cat === "plc") return [
      { label: "Make",   value: machine.plc_make   ?? "" },
      { label: "Model",  value: machine.plc_model  ?? "" },
      { label: "Series", value: machine.plc_series ?? "" },
      { label: "P/N",    value: machine.plc_part_no ?? "" },
    ].filter((s) => s.value);
    if (cat === "hmi") return [
      { label: "Make",  value: machine.hmi_make   ?? "" },
      { label: "Model", value: machine.hmi_model  ?? "" },
      { label: "P/N",   value: machine.hmi_part_no ?? "" },
    ].filter((s) => s.value);
    if (cat === "vfd") return [
      { label: "Make",    value: machine.vfd_make    ?? "" },
      { label: "Model",   value: machine.vfd_model   ?? "" },
      { label: "HP",      value: machine.vfd_hp      ?? "" },
      { label: "Voltage", value: machine.vfd_voltage ?? "" },
    ].filter((s) => s.value);
    if (cat === "servo") return [
      { label: "Drive Make",  value: machine.servo_drive_make  ?? "" },
      { label: "Drive Model", value: machine.servo_drive_model ?? "" },
      { label: "Motor Make",  value: machine.servo_motor_make  ?? "" },
      { label: "Motor Model", value: machine.servo_motor_model ?? "" },
      { label: "Motor P/N",   value: machine.servo_motor_part_no ?? "" },
    ].filter((s) => s.value);
    return [];
  }

  function SpecDataTable({ specs, eolResult }: {
    specs: { label: string; value: string }[];
    eolResult?: LifecycleResult;
  }) {
    return (
      <div>
        <table style={{ width: "100%", borderCollapse: "collapse", border: `1.5px solid ${INK}` }}>
          <tbody>
            {specs.map((spec) => (
              <tr key={spec.label}>
                <td style={{
                  width: 88, padding: "6px 10px", background: "rgba(0,24,46,0.04)",
                  borderRight: `1px solid ${HAIR}`, borderTop: `1px solid ${HAIR}`,
                  fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
                  fontSize: 8, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.12em", color: INK, opacity: 0.5,
                }}>{spec.label}</td>
                <td style={{
                  padding: "6px 10px", borderTop: `1px solid ${HAIR}`,
                  fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
                  fontSize: 13, fontWeight: 700, color: INK,
                }}>{spec.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {eolResult && eolResult.status !== "unknown" && (
          <div style={{
            marginTop: 8,
            background: LIFECYCLE_META[eolResult.status].bg,
            border: `1.5px solid ${LIFECYCLE_META[eolResult.status].border}`,
            padding: "8px 10px",
          }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 900,
              color: LIFECYCLE_META[eolResult.status].ink, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3,
            }}>
              {eolResult.status === "mature" ? "Mature platform — plan replacement" : "⚠ End of Life — Replacement Recommended"}
            </div>
            <div style={{ fontSize: 10, color: LIFECYCLE_META[eolResult.status].ink, lineHeight: 1.45 }}>{eolResult.note}</div>
            {eolResult.successor && (
              <div style={{ marginTop: 4, fontSize: 10, color: "#065f46", fontWeight: 700 }}>
                Successor: {eolResult.successor}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  /** Large print photos — 1-up when alone, 2-up otherwise. Tall enough to read details. */
  function PhotoGrid({ photos, size = "lg" }: { photos: MappingPhoto[]; size?: "lg" | "xl" }) {
    const n = photos.length;
    const cols = n === 1 ? 1 : 2;
    const minH = size === "xl" ? (n === 1 ? "4.2in" : "3.1in") : (n === 1 ? "3.4in" : "2.6in");
    return (
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 8,
        padding: 8,
      }}>
        {photos.map((photo) => (
          <div key={photo.id} style={{ breakInside: "avoid" }}>
            <img
              src={photoUrl(photo.machine_id, photo.filename, "print")}
              alt={photo.original_name}
              style={{
                width: "100%", display: "block",
                minHeight: minH, maxHeight: n === 1 ? "5.5in" : "3.8in",
                objectFit: "contain", objectPosition: "center",
                background: "#f0f2ef",
                border: `1.5px solid ${INK}`,
              }}
            />
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 8, color: INK, opacity: 0.45, marginTop: 3,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {photo.original_name}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function SectionBar({ label, accent, right }: { label: string; accent: string; right?: string }) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "5px 10px",
        background: "rgba(0,24,46,0.04)",
        borderTop: `1px solid ${HAIR}`,
        borderBottom: `1px solid ${HAIR}`,
      }}>
        <span style={{ width: 8, height: 8, background: accent, flexShrink: 0 }} />
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.16em", color: INK,
        }}>{label}</span>
        <div style={{ flex: 1, height: 1, background: HAIR }} />
        {right && (
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fontWeight: 700,
            color: INK, opacity: 0.4,
          }}>{right}</span>
        )}
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media screen {
          .mapping-print-root { display: none !important; }
        }
        @media print {
          .mapping-print-root { display: block !important; }
          .mapping-screen-only { display: none !important; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          /* Near-zero margins — content fills the letter page. User should also set Margins: None/Minimum in the dialog. */
          @page { margin: 0.2in; size: letter portrait; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-page-break { break-before: page; page-break-before: always; }
          .print-avoid-break { break-inside: avoid; page-break-inside: avoid; }
          img { max-width: 100% !important; }
        }
      `}</style>

      <div className="mapping-print-root" style={{
        fontFamily: "'IBM Plex Sans', Arial, sans-serif",
        fontSize: 11, color: INK, lineHeight: 1.35,
        width: "100%", boxSizing: "border-box",
      }}>

        {/* ══════════ COVER / TITLE SHEET ══════════ */}
        <div style={{ border: `2.5px solid ${INK}`, marginBottom: 14 }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "7px 12px", background: INK,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, background: LIME }} />
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700,
                letterSpacing: "0.18em", color: LIME, textTransform: "uppercase",
              }}>I&amp;I Automation · Equipment Mapping Drawing</span>
            </div>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 600,
              letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase",
            }}>DWG {dwgNo}</span>
          </div>

          <div style={{ display: "flex", alignItems: "stretch" }}>
            <div style={{ flex: 1, padding: "14px 14px 12px", borderRight: `1px solid ${HAIR}` }}>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.18em", color: INK, opacity: 0.4, marginBottom: 4,
              }}>Sheet Title</div>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 700,
                textTransform: "uppercase", lineHeight: 1.1, color: INK,
              }}>{mapping.name}</div>
              {(mapping.plant_name || mapping.city) && (
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 500,
                  marginTop: 6, textTransform: "uppercase", letterSpacing: "0.06em",
                  color: INK, opacity: 0.55,
                }}>
                  {mapping.plant_name}{mapping.city ? `  ·  ${mapping.city}, ${mapping.state}` : ""}
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexShrink: 0 }}>
              {(lineCount > 1
                ? [
                    { n: lineCount, l: "LINE" },
                    { n: machines.length, l: "MACH" },
                    { n: totalPhotos, l: "PHOT" },
                    { n: plcCount, l: "PLC" },
                  ]
                : [
                    { n: machines.length, l: "MACH" },
                    { n: totalPhotos, l: "PHOT" },
                    { n: plcCount, l: "PLC" },
                    { n: driveCount, l: "DRV" },
                  ]
              ).map(({ n, l }, i) => (
                <div key={l} style={{
                  minWidth: 58, padding: "10px 12px", textAlign: "center",
                  borderLeft: i > 0 ? `1px solid ${HAIR}` : "none",
                  display: "flex", flexDirection: "column", justifyContent: "center",
                }}>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 700,
                    lineHeight: 1, color: INK, fontVariantNumeric: "tabular-nums",
                  }}>{String(n).padStart(2, "0")}</div>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.18em",
                    color: INK, opacity: 0.45, marginTop: 4,
                  }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", borderTop: `1px solid ${HAIR}` }}>
            {[
              { l: "Prepared by", v: "I&I Automation" },
              { l: "Date", v: reportDate },
              { l: "Rev", v: "A" },
              { l: "Scale", v: "NTS" },
            ].map((c) => (
              <div key={c.l} style={{ padding: "6px 12px", borderRight: `1px solid ${HAIR}`, minWidth: 90 }}>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.16em", color: INK, opacity: 0.4,
                }}>{c.l}</div>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700,
                  color: INK, marginTop: 2,
                }}>{c.v}</div>
              </div>
            ))}
            <div style={{ flex: 1, padding: "6px 12px", display: "flex", alignItems: "center" }}>
              {eolCount > 0 ? (
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  color: "#92400e", background: "#fef3c7", border: "1.5px solid #d97706",
                  padding: "3px 8px",
                }}>
                  ⚠ {eolCount} discontinued · {flagCount} opportunity flag{flagCount !== 1 ? "s" : ""}
                </span>
              ) : flagCount > 0 ? (
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  color: "#00182e", background: "#f4f6f2", border: "1.5px solid rgba(0,24,46,0.3)",
                  padding: "3px 8px",
                }}>
                  {flagCount} opportunity flag{flagCount !== 1 ? "s" : ""}
                </span>
              ) : (
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: "0.08em", color: INK, opacity: 0.4,
                }}>No discontinued equipment</span>
              )}
            </div>
          </div>
          <LineIndexStrip mapping={mapping} print />
        </div>

        {mode === "risk" ? (
          <>
            <RiskPrintSheet register={register} mapping={mapping} dwgNo={dwgNo} reportDate={reportDate} />
            <div style={{ marginBottom: 14, border: `1.5px solid ${INK}` }} className="print-avoid-break">
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "5px 10px", background: INK,
              }}>
                <span style={{
                  fontFamily: MONO, fontSize: 9, fontWeight: 700,
                  letterSpacing: "0.18em", color: LIME, textTransform: "uppercase",
                }}>Opportunity Register</span>
                <span style={{ fontFamily: MONO, fontSize: 8, color: "rgba(255,255,255,0.4)" }}>
                  {opportunities.affectedMachines}/{opportunities.totalMachines} machines · {opportunities.totalFlags} flags
                </span>
              </div>
              {opportunities.findings.length === 0 ? (
                <div style={{ padding: "16px 12px", fontSize: 10, color: INK, opacity: 0.55 }}>
                  No opportunity flags recorded. Fill floor observations in Edit mode.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {opportunities.findings.map((f) => (
                      <tr key={f.key} className="print-avoid-break">
                        <td style={{ padding: "8px 10px", borderBottom: `1px solid ${HAIR}`, width: 72, verticalAlign: "top" }}>
                          <span style={{
                            fontFamily: MONO, fontSize: 8, fontWeight: 700, padding: "2px 5px",
                            border: `1px solid ${INK}`, color: INK,
                          }}>{f.short}</span>
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: `1px solid ${HAIR}`, verticalAlign: "top" }}>
                          <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: INK }}>{f.label}</div>
                          <div style={{ fontSize: 9, color: INK, opacity: 0.7, marginTop: 3, lineHeight: 1.4 }}>{f.pitch}</div>
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: `1px solid ${HAIR}`, fontFamily: MONO, fontSize: 9, color: INK, width: 160, verticalAlign: "top" }}>
                          {f.machines.map((m) => m.tag).join(", ")}
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: `1px solid ${HAIR}`, fontFamily: MONO, fontSize: 11, fontWeight: 700, color: INK, width: 36 }}>
                          {f.unitCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : (
          <>
        {/* ══════════ BOM / EQUIPMENT INDEX ══════════ */}
        <div style={{ marginBottom: 14, border: `1.5px solid ${INK}` }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "5px 10px", background: INK,
          }}>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 700,
              letterSpacing: "0.18em", color: LIME, textTransform: "uppercase",
            }}>BOM / Equipment Index</span>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 8,
              color: "rgba(255,255,255,0.4)",
            }}>{machines.length} machines · {totalPhotos} photos</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(0,24,46,0.04)" }}>
                {["Item", "Description", "Plant Tag", "Photos", "Flag"].map((h) => (
                  <th key={h} style={{
                    textAlign: "left", padding: "4px 10px",
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.14em",
                    color: INK, opacity: 0.4, borderBottom: `1px solid ${HAIR}`,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineGroups.flatMap((group) => [
                ...(group.lineName ? [(
                  <tr key={`line-${group.lineName}`}>
                    <td colSpan={5} style={{
                      padding: "4px 10px", borderBottom: `1px solid ${HAIR}`,
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.14em",
                      color: LIME, background: INK,
                    }}>{group.lineName}</td>
                  </tr>
                )] : []),
                ...group.machines.map(({ machine: m, index: i }) => (
                  <tr key={m.id}>
                    <td style={{
                      padding: "5px 10px", borderBottom: `1px solid ${HAIR}`,
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, color: INK,
                      width: 48,
                    }}>{tagParts(m, i).seq}</td>
                    <td style={{
                      padding: "5px 10px", borderBottom: `1px solid ${HAIR}`,
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700,
                      textTransform: "uppercase", color: INK,
                    }}>{m.name}</td>
                    <td style={{
                      padding: "5px 10px", borderBottom: `1px solid ${HAIR}`,
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: INK, opacity: 0.5,
                    }}>{machineTag(m, i)}</td>
                    <td style={{
                      padding: "5px 10px", borderBottom: `1px solid ${HAIR}`,
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: INK, opacity: 0.5,
                      width: 56,
                    }}>{(m.photos ?? []).length}</td>
                    <td style={{ padding: "5px 10px", borderBottom: `1px solid ${HAIR}`, width: 110 }}>
                      <FlagPills machine={m} max={3} />
                    </td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>

        {/* ══════════ MACHINE SHEETS ══════════ */}
        {machines.map((machine, idx) => {
          const photos = machine.photos ?? [];
          const photosByCat: Partial<Record<CatKey, MappingPhoto[]>> = {};
          for (const p of photos) {
            const k = p.category as CatKey;
            if (!photosByCat[k]) photosByCat[k] = [];
            photosByCat[k]!.push(p);
          }
          const orderedCats = (["machine", "plc", "hmi", "vfd", "servo"] as CatKey[])
            .filter((k) => (photosByCat[k] ?? []).length > 0);

          const otherPhotos = photos.filter((p) => p.category === "other");
          const otherGroups: { label: string; photos: MappingPhoto[] }[] = [];
          for (const p of otherPhotos) {
            const lbl = p.label?.trim() || "Other";
            const existing = otherGroups.find((g) => g.label === lbl);
            if (existing) existing.photos.push(p);
            else otherGroups.push({ label: lbl, photos: [p] });
          }

          const hasSpecs = !!(machine.plc_make || machine.plc_model || machine.hmi_make || machine.hmi_model || machine.vfd_make || machine.vfd_model || machine.servo_drive_make);
          const specOnlyCats = (["plc", "hmi", "vfd", "servo"] as CatKey[]).filter((k) => {
            return getCatSpecs(machine, k).length > 0 && !(photosByCat[k] ?? []).length;
          });
          const assessment = assessMachine(machine);

          return (
            <div key={machine.id} className={idx > 0 ? "print-page-break" : ""} style={{ marginBottom: 10 }}>

              {/* Machine title bar */}
              <div style={{
                display: "flex", alignItems: "stretch",
                border: `2px solid ${INK}`, background: "rgba(0,24,46,0.03)",
              }}>
                <div style={{ display: "flex", alignItems: "stretch", flexShrink: 0, borderRight: `2px solid ${INK}` }}>
                  <TagBadge machine={machine} index={idx} large print />
                </div>
                <div style={{ flex: 1, padding: "8px 12px" }}>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.1em", color: INK, lineHeight: 1.15,
                  }}>{machine.name}</div>
                  {machine.line_name && (
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.08em",
                      color: INK, opacity: 0.5, marginTop: 2,
                    }}>{machine.line_name}</div>
                  )}
                  {machine.notes && (
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                      color: INK, opacity: 0.45, marginTop: 2, fontStyle: "italic",
                    }}>{machine.notes}</div>
                  )}
                </div>
                <div style={{
                  padding: "8px 12px", display: "flex", flexDirection: "column",
                  alignItems: "flex-end", justifyContent: "center", gap: 3,
                }}>
                  {photos.length > 0 && (
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 700,
                      color: INK, opacity: 0.5,
                    }}>{photos.length} PHOTO{photos.length !== 1 ? "S" : ""}</div>
                  )}
                  {assessment.hasEol && (
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fontWeight: 900,
                      color: "#92400e", background: "#fef3c7", border: "1.5px solid #d97706",
                      padding: "2px 6px", textTransform: "uppercase",
                    }}>{assessment.worst.status === "unsupported" ? "Unsupported" : "Discontinued"}</div>
                  )}
                  {assessment.flags.slice(0, 2).map((f) => (
                    <div key={f.key} style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fontWeight: 700,
                      color: "#00182e", background: "#f4f6f2", border: "1px solid rgba(0,24,46,0.3)",
                      padding: "2px 6px", textTransform: "uppercase",
                    }}>{f.short}</div>
                  ))}
                </div>
              </div>

              <div style={{ border: `1.5px solid ${INK}`, borderTop: "none" }}>
                {orderedCats.map((catKey) => {
                  const meta = CAT_PRINT[catKey];
                  const catPhotos = photosByCat[catKey] ?? [];
                  const specs = getCatSpecs(machine, catKey);
                  const isSpecCat = catKey === "plc" || catKey === "hmi" || catKey === "vfd" || catKey === "servo";
                  const isOverview = catKey === "machine";

                  return (
                    <div key={catKey} className="print-avoid-break" style={{ borderBottom: `1px solid ${HAIR}` }}>
                      <SectionBar
                        label={meta.label}
                        accent={meta.accent}
                        right={`${catPhotos.length} PHOTO${catPhotos.length !== 1 ? "S" : ""}${isSpecCat && specs.length ? ` · ${specs.length} FIELDS` : ""}`}
                      />
                      {/* Photos first & large — then specs full-width underneath */}
                      <PhotoGrid photos={catPhotos} size={isOverview ? "xl" : "lg"} />
                      {isSpecCat && specs.length > 0 && (
                        <div style={{ padding: "0 8px 10px" }}>
                          <SpecDataTable
                            specs={specs}
                            eolResult={lifeFor(machine, catKey as "plc" | "hmi" | "vfd" | "servo")}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {specOnlyCats.map((catKey) => {
                  const meta = CAT_PRINT[catKey];
                  const specs = getCatSpecs(machine, catKey);
                  return (
                    <div key={`spec-${catKey}`} className="print-avoid-break" style={{ borderBottom: `1px solid ${HAIR}` }}>
                      <SectionBar label={meta.label} accent={meta.accent} />
                      <div style={{ padding: 10 }}>
                        <SpecDataTable
                          specs={specs}
                          eolResult={lifeFor(machine, catKey as "plc" | "hmi" | "vfd" | "servo")}
                        />
                      </div>
                    </div>
                  );
                })}

                {otherGroups.map((group) => (
                  <div key={group.label} className="print-avoid-break" style={{ borderBottom: `1px solid ${HAIR}` }}>
                    <SectionBar
                      label={group.label}
                      accent="#6b7280"
                      right={`${group.photos.length} PHOTO${group.photos.length !== 1 ? "S" : ""}`}
                    />
                    <PhotoGrid photos={group.photos} size="lg" />
                  </div>
                ))}

                {(assessment.flags.length > 0 || assessment.opportunity.length > 0) && (
                  <div className="print-avoid-break" style={{ borderBottom: `1px solid ${HAIR}` }}>
                    <SectionBar label="Current vs. possible" accent="#00182e" />
                    <div style={{ padding: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <div style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: INK, opacity: 0.45, marginBottom: 4 }}>Today</div>
                        {assessment.today.map((t) => (
                          <div key={t} style={{ fontFamily: MONO, fontSize: 10, color: INK, marginBottom: 3 }}>{t}</div>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#166534", marginBottom: 4 }}>Opportunity</div>
                        {assessment.opportunity.map((t) => (
                          <div key={t} style={{ fontSize: 10, color: INK, marginBottom: 3 }}>{t}</div>
                        ))}
                        {assessment.flags.map((f) => (
                          <div key={f.key} style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: INK, opacity: 0.55, marginTop: 2 }}>{f.short}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {orderedCats.length === 0 && otherGroups.length === 0 && !hasSpecs && (
                  <div style={{
                    padding: "16px", fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 10, color: INK, opacity: 0.35, textTransform: "uppercase",
                  }}>
                    No photos or specs recorded for this machine.
                  </div>
                )}
              </div>

              {/* Per-sheet footer */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "4px 10px", background: INK, marginTop: 0,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 7,
                letterSpacing: "0.12em", textTransform: "uppercase",
                color: "rgba(255,255,255,0.4)",
              }}>
                <span>I&amp;I Automation · Control Engineering</span>
                <span style={{ color: "rgba(172,236,0,0.7)" }}>Do not scale · NTS</span>
                <span>{machineTag(machine, idx)} · {dwgNo} · Rev A</span>
              </div>
            </div>
          );
        })}
          </>
        )}
      </div>
    </>
  );
}

// ─── In-app view mode ─────────────────────────────────────────────────────────

function PhotoTile({ photo, onClick }: { photo: MappingPhoto; onClick: () => void }) {
  const [err, setErr] = useState(false);
  return (
    <button type="button" onClick={onClick}
      className="relative aspect-square overflow-hidden bg-gray-100 hover:outline hover:outline-2 hover:outline-brand-lime group"
      style={{ border: "1px solid rgba(0,24,46,0.35)" }}>
      {err ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-gray-50 gap-1">
          <HiCamera className="w-5 h-5" />
          <span className="font-mono text-[8px]">NO IMG</span>
        </div>
      ) : (
        <img src={photoUrl(photo.machine_id, photo.filename, "thumb")} alt={photo.original_name}
          loading="lazy" decoding="async"
          onError={() => setErr(true)}
          className="w-full h-full object-cover" />
      )}
    </button>
  );
}

type SpecCatKey = "plc" | "hmi" | "vfd" | "servo";

const SPEC_META: Record<SpecCatKey, { label: string; Icon: React.ElementType; accent: string; bg: string; text: string }> = {
  plc:   { label: "PLC",   Icon: HiCpuChip,         accent: "#1d4ed8", bg: "#eff6ff", text: "#1e40af" },
  hmi:   { label: "HMI",   Icon: HiComputerDesktop, accent: "#7c3aed", bg: "#faf5ff", text: "#6d28d9" },
  vfd:   { label: "VFD",   Icon: HiBolt,            accent: "#b45309", bg: "#fffbeb", text: "#92400e" },
  servo: { label: "Servo", Icon: HiCog8Tooth,       accent: "#15803d", bg: "#f0fdf4", text: "#166534" },
};

function specRows(m: MappingMachine, cat: SpecCatKey): { label: string; value: string }[] {
  if (cat === "plc") return [
    { label: "Make",   value: m.plc_make ?? "" },
    { label: "Model",  value: m.plc_model ?? "" },
    { label: "Series", value: m.plc_series ?? "" },
    { label: "P/N",    value: m.plc_part_no ?? "" },
  ].filter((f) => f.value);
  if (cat === "hmi") return [
    { label: "Make",  value: m.hmi_make ?? "" },
    { label: "Model", value: m.hmi_model ?? "" },
    { label: "P/N",   value: m.hmi_part_no ?? "" },
  ].filter((f) => f.value);
  if (cat === "vfd") return [
    { label: "Make",    value: m.vfd_make ?? "" },
    { label: "Model",   value: m.vfd_model ?? "" },
    { label: "HP",      value: m.vfd_hp ?? "" },
    { label: "Voltage", value: m.vfd_voltage ?? "" },
  ].filter((f) => f.value);
  return [
    { label: "Drive Make",  value: m.servo_drive_make ?? "" },
    { label: "Drive Model", value: m.servo_drive_model ?? "" },
    { label: "Motor Make",  value: m.servo_motor_make ?? "" },
    { label: "Motor Model", value: m.servo_motor_model ?? "" },
    { label: "Motor P/N",   value: m.servo_motor_part_no ?? "" },
  ].filter((f) => f.value);
}

// Engineering-drawing palette — navy ink on drafting paper
const INK   = "#00182e";
const HAIR  = "rgba(0,24,46,0.28)";
const FAINT = "rgba(0,24,46,0.04)";
const LIME  = "#acec00";

function TBCell({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="px-3 py-1.5 min-w-[7rem]" style={{ borderLeft: `1px solid ${HAIR}` }}>
      <p className="font-mono text-[8px] font-bold uppercase tracking-[0.18em]" style={{ color: INK, opacity: 0.45 }}>
        {label}
      </p>
      <p className={`text-[12px] font-bold mt-0.5 truncate leading-tight ${mono ? "font-mono" : ""}`} style={{ color: INK }}>
        {value}
      </p>
    </div>
  );
}

/** Corner registration mark — like a CAD sheet crop mark */
function CropMark({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const h = pos.includes("l") ? "left-0" : "right-0";
  const v = pos.includes("t") ? "top-0" : "bottom-0";
  const barH = pos.includes("l") ? "border-l-2" : "border-r-2";
  const barV = pos.includes("t") ? "border-t-2" : "border-b-2";
  return (
    <div className={`absolute ${h} ${v} w-3 h-3 ${barH} ${barV}`} style={{ borderColor: INK }} aria-hidden />
  );
}

export function MappingView({ mapping, chrome = "app" }: { mapping: Mapping; chrome?: "app" | "share" }) {
  const machines = mapping.machines ?? [];
  const lineGroups = groupMachinesByLine(machines);
  const lineCount = mapping.source_lines?.length ?? 0;
  const [lightbox, setLightbox] = useState<{ photo: MappingPhoto; list: MappingPhoto[]; idx: number } | null>(null);
  const [activeTab, setActiveTab] = useState(machines[0]?.id ?? "");
  const bomNavRef = useRef<HTMLElement>(null);

  function jumpToMachine(id: string) {
    setActiveTab(id);
    document.getElementById(`mv-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function jumpToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openLightbox(list: MappingPhoto[], idx: number) {
    setLightbox({ photo: list[idx], list, idx });
  }
  function lbNav(dir: 1 | -1) {
    if (!lightbox) return;
    const next = lightbox.idx + dir;
    if (next >= 0 && next < lightbox.list.length)
      setLightbox({ ...lightbox, photo: lightbox.list[next], idx: next });
  }
  useEffect(() => {
    if (!lightbox) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [lightbox]);

  // Track which machine is visible as user scrolls → highlight sidebar
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    for (const m of machines) {
      const el = document.getElementById(`mv-${m.id}`);
      if (!el) continue;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveTab(m.id); },
        { threshold: 0, rootMargin: "-18% 0px -55% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, [machines]);

  useEffect(() => {
    const nav = bomNavRef.current;
    if (!nav || !activeTab) return;
    const row = nav.querySelector<HTMLElement>(`[data-bom="${activeTab}"]`);
    if (!row) return;
    const rowRect = row.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    if (rowRect.top < navRect.top + 8) nav.scrollTop -= navRect.top - rowRect.top + 8;
    else if (rowRect.bottom > navRect.bottom - 8) nav.scrollTop += rowRect.bottom - navRect.bottom + 8;
  }, [activeTab]);

  const totalPhotos = machines.reduce((s, m) => s + (m.photos ?? []).length, 0);
  const assessments = machines.map(assessMachine);
  const eolCount    = assessments.filter((a) => a.hasEol).length;
  const flagCount   = assessments.reduce((s, a) => s + a.flags.length, 0);
  const reportDate  = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  // Spec table — drafting-style ruled data cells
  function SpecTable({ rows, catKey, life }: {
    rows: { label: string; value: string }[];
    catKey: SpecCatKey;
    life?: LifecycleResult;
  }) {
    const meta = SPEC_META[catKey];
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="w-2 h-2 shrink-0" style={{ background: meta.accent }} />
          <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: INK }}>{meta.label}</span>
          <LifecycleBadge result={life} />
        </div>
        <div style={{ border: `1px solid ${HAIR}` }}>
          {rows.map((r, i) => (
            <div key={r.label} className="flex items-stretch"
              style={{ borderTop: i > 0 ? `1px solid ${HAIR}` : undefined }}>
              <div className="flex items-center px-2 shrink-0"
                style={{ width: 84, background: FAINT, borderRight: `1px solid ${HAIR}`, minHeight: 26 }}>
                <span className="text-[9px] font-black uppercase tracking-widest leading-tight" style={{ color: INK, opacity: 0.55 }}>{r.label}</span>
              </div>
              <div className="flex items-center px-2.5 py-1 flex-1 bg-white">
                <span className="text-[13px] font-bold font-mono leading-snug" style={{ color: INK }}>{r.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function SectionRule({ no, title, right }: { no: string; title: string; right?: string }) {
    return (
      <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1"
        style={{ background: FAINT, borderTop: `1px solid ${HAIR}`, borderBottom: `1px solid ${HAIR}` }}>
        <span className="font-mono text-[10px] font-bold tabular-nums" style={{ color: INK }}>{no}</span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: INK, opacity: 0.6 }}>{title}</span>
        <div className="flex-1 h-px" style={{ background: HAIR }} />
        {right && <span className="font-mono text-[9px] font-bold" style={{ color: INK, opacity: 0.4 }}>{right}</span>}
      </div>
    );
  }

  function buildGroups(machine: MappingMachine) {
    const byKey: Record<string, MappingPhoto[]> = {};
    for (const p of machine.photos ?? []) {
      const key = p.category === "other" ? `other§${p.label?.trim() || "Other"}` : p.category;
      if (!byKey[key]) byKey[key] = [];
      byKey[key].push(p);
    }
    const groups: { key: string; label: string; catKey: string; photos: MappingPhoto[] }[] = [];
    for (const ck of ["machine", "plc", "hmi", "vfd", "servo"]) {
      if (byKey[ck]?.length) {
        const cat = PHOTO_CATEGORIES.find((c) => c.key === ck);
        groups.push({ key: ck, label: cat?.label ?? ck, catKey: ck, photos: byKey[ck] });
      }
    }
    for (const [k, photos] of Object.entries(byKey)) {
      if (k.startsWith("other§")) groups.push({ key: k, label: k.replace("other§", ""), catKey: "other", photos });
    }
    return groups;
  }

  const bomOffset = chrome === "share" ? "5.75rem" : "4.5rem";
  const dwgNo = drawingNumber(mapping);
  const plcCount = machines.filter((m) => m.plc_make || m.plc_model).length;
  const driveCount = machines.filter((m) => m.vfd_make || m.servo_drive_make).length;

  return (
    <>
      {/* Full-bleed engineering sheet */}
      <div className="-mx-3 sm:-mx-6 lg:-mx-8 -mt-2 relative eng-grid min-h-[70vh]">
        {/* Outer drawing border */}
        <div className="relative m-2 sm:m-3" style={{ border: `2px solid ${INK}`, background: "rgba(255,255,255,0.82)" }}>
          <CropMark pos="tl" />
          <CropMark pos="tr" />
          <CropMark pos="bl" />
          <CropMark pos="br" />

          {/* ── Title block ── */}
          <div style={{ borderBottom: `2px solid ${INK}` }}>
            <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-1" style={{ background: INK }}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 shrink-0" style={{ background: LIME }} />
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] truncate text-brand-lime">
                  I&amp;I Automation · Equipment Mapping Drawing
                </span>
              </div>
              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] shrink-0 text-white/50">
                DWG {dwgNo}
              </span>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-stretch">
              <div className="flex-1 min-w-0 px-3 sm:px-4 py-3 flex flex-col justify-center" style={{ borderRight: `1px solid ${HAIR}` }}>
                <p className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: INK, opacity: 0.4 }}>
                  Sheet Title
                </p>
                <h1 className="font-mono font-bold text-xl sm:text-2xl uppercase leading-none" style={{ color: INK }}>
                  {mapping.name}
                </h1>
                {(mapping.plant_name || mapping.city) && (
                  <p className="font-mono text-[11px] font-medium mt-1.5 uppercase tracking-[0.08em]" style={{ color: INK, opacity: 0.55 }}>
                    {mapping.plant_name}{mapping.city ? `  ·  ${mapping.city}, ${mapping.state}` : ""}
                  </p>
                )}
              </div>

              {/* Quantity block — like a parts count table */}
              <div className="grid grid-cols-4 shrink-0" style={{ borderTop: `1px solid ${HAIR}` }}>
                {(lineCount > 1
                  ? [
                      { n: lineCount, l: "LINE" },
                      { n: machines.length, l: "MACH" },
                      { n: totalPhotos, l: "PHOT" },
                      { n: plcCount, l: "PLC" },
                    ]
                  : [
                      { n: machines.length, l: "MACH" },
                      { n: totalPhotos, l: "PHOT" },
                      { n: plcCount, l: "PLC" },
                      { n: driveCount, l: "DRV" },
                    ]
                ).map(({ n, l }, i) => (
                  <div key={l} className="flex flex-col items-center justify-center px-3 py-2.5 min-w-[4.5rem]"
                    style={{ borderLeft: i > 0 ? `1px solid ${HAIR}` : undefined }}>
                    <div className="font-mono text-2xl font-bold tabular-nums leading-none" style={{ color: INK }}>
                      {String(n).padStart(2, "0")}
                    </div>
                    <div className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] mt-1" style={{ color: INK, opacity: 0.45 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-stretch" style={{ borderTop: `1px solid ${HAIR}` }}>
              <TBCell label="Prepared by" value="I&I Automation" />
              <TBCell label="Date" value={reportDate} mono />
              <TBCell label="Rev" value="A" mono />
              <TBCell label="Scale" value="NTS" mono />
              <div className="flex-1 flex items-center px-3 py-1.5 min-w-0" style={{ borderLeft: `1px solid ${HAIR}` }}>
                {eolCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-amber-900 bg-amber-100"
                    style={{ border: `1.5px solid #d97706` }}>
                    ⚠ {eolCount} discontinued · {flagCount} opportunit{flagCount === 1 ? "y" : "ies"}
                  </span>
                ) : flagCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]"
                    style={{ color: INK, background: "#f4f6f2", border: `1.5px solid ${HAIR}` }}>
                    {flagCount} opportunity flag{flagCount === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: INK, opacity: 0.45 }}>
                    No discontinued equipment
                  </span>
                )}
              </div>
            </div>

            <LineIndexStrip mapping={mapping} />
          </div>

          {/* Mobile machine tabs — sibling of the tall drawing so sticky can persist */}
          <div
            className={`lg:hidden sticky z-20 overflow-x-auto bg-white ${chrome === "app" ? "top-14" : "top-[5.75rem]"}`}
            style={{ scrollbarWidth: "none", borderBottom: `1px solid ${HAIR}` }}
          >
            <div className="flex min-w-max">
              <button
                type="button"
                onClick={jumpToTop}
                className="flex items-center gap-1 px-3 py-2 text-[11px] font-bold border-b-2 whitespace-nowrap font-mono"
                style={{ borderColor: "transparent", color: INK, opacity: 0.45 }}
              >
                <HiArrowUp className="w-3.5 h-3.5" />
                Top
              </button>
              {machines.map((m, i) => {
                const isActive = activeTab === m.id;
                return (
                  <button key={m.id}
                    onClick={() => jumpToMachine(m.id)}
                    className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold border-b-2 whitespace-nowrap font-mono"
                    style={{
                      borderColor: isActive ? LIME : "transparent",
                      color: INK,
                      background: isActive ? FAINT : "transparent",
                      opacity: isActive ? 1 : 0.45,
                    }}>
                    <span>{machineTag(m, i)}</span>
                    <span className="uppercase">{m.name}</span>
                    {assessMachine(m).hasEol && <span className="text-amber-600 text-[9px]">EOL</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── BOM index + sheets ── */}
          <div className="flex items-start">
            {/* Parts-list / BOM column — sticks in the viewport so it does not scroll away */}
            <div
              className="hidden lg:flex flex-col shrink-0 w-56 self-start sticky z-20"
              style={{
                top: bomOffset,
                borderRight: `2px solid ${INK}`,
                background: FAINT,
                maxHeight: `calc(100dvh - ${bomOffset})`,
              }}
            >
              <div className="px-2.5 py-2 flex items-center justify-between shrink-0" style={{ borderBottom: `1px solid ${HAIR}`, background: INK }}>
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-brand-lime">BOM / Index</p>
                <p className="font-mono text-[9px] text-white/40">{machines.length}</p>
              </div>
              <nav ref={bomNavRef} className="flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: "thin" }}>
                <button
                  type="button"
                  onClick={jumpToTop}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-left transition-colors"
                  style={{ borderBottom: `1px solid ${HAIR}`, color: INK }}
                >
                  <HiArrowUp className="w-3 h-3 shrink-0 opacity-50" />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ opacity: 0.55 }}>
                    Drawing title
                  </span>
                </button>
                {/* Column headers like a real BOM */}
                <div className="grid grid-cols-[2.5rem_1fr_auto] gap-1 px-2.5 py-1 font-mono text-[8px] font-bold uppercase tracking-wider"
                  style={{ color: INK, opacity: 0.4, borderBottom: `1px solid ${HAIR}` }}>
                  <span>Item</span><span>Description</span><span>Flag</span>
                </div>
                {lineGroups.map((group) => (
                  <div key={group.lineName ?? "line"}>
                    {group.lineName && (
                      <div className="px-2.5 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.14em]"
                        style={{ color: LIME, background: INK, borderBottom: `1px solid ${HAIR}` }}>
                        {group.lineName}
                      </div>
                    )}
                    {group.machines.map(({ machine: m, index: i }) => {
                      const isActive = activeTab === m.id;
                      return (
                        <button key={m.id}
                          data-bom={m.id}
                          onClick={() => jumpToMachine(m.id)}
                          className="w-full grid grid-cols-[2.5rem_1fr_auto] gap-1 items-center px-2.5 py-2 text-left transition-colors"
                          style={{
                            borderBottom: `1px solid ${HAIR}`,
                            background: isActive ? "#fff" : "transparent",
                            boxShadow: isActive ? `inset 3px 0 0 ${LIME}` : undefined,
                          }}>
                          <span className="font-mono text-[10px] font-bold tabular-nums" style={{ color: INK, opacity: isActive ? 1 : 0.4 }}>
                            {tagParts(m, i).seq}
                          </span>
                          <span className="font-mono text-[10px] font-bold uppercase truncate leading-tight"
                            style={{ color: INK, opacity: isActive ? 1 : 0.55 }}>
                            {m.name}
                          </span>
                          <FlagPills machine={m} max={2} />
                        </button>
                      );
                    })}
                  </div>
                ))}
              </nav>
              <div className="px-2.5 py-2.5 shrink-0" style={{ borderTop: `2px solid ${INK}`, background: "#fff" }}>
                <p className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: INK, opacity: 0.4 }}>Legend</p>
                {[
                  { dot: "#1d4ed8", label: "PLC" },
                  { dot: "#7c3aed", label: "HMI" },
                  { dot: "#b45309", label: "VFD" },
                  { dot: "#15803d", label: "Servo" },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-1.5 mb-1">
                    <div className="w-1.5 h-1.5 shrink-0" style={{ background: l.dot }} />
                    <span className="font-mono text-[9px]" style={{ color: INK, opacity: 0.55 }}>{l.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 mt-1.5 pt-1.5" style={{ borderTop: `1px solid ${HAIR}` }}>
                  <div className="w-1.5 h-1.5 shrink-0 bg-amber-500" />
                  <span className="font-mono text-[9px] font-bold text-amber-700">EOL = discontinued</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-1.5 h-1.5 shrink-0" style={{ background: INK, opacity: 0.35 }} />
                  <span className="font-mono text-[9px]" style={{ color: INK, opacity: 0.55 }}>Flags = opportunities</span>
                </div>
              </div>
            </div>

            {/* Machine detail sheets */}
            <div className="flex-1 min-w-0 p-2 sm:p-3 space-y-3 eng-grid">
              {machines.length === 0 && (
                <div className="flex items-center justify-center py-16 font-mono text-xs uppercase tracking-wider"
                  style={{ color: INK, opacity: 0.35, border: `1px dashed ${HAIR}`, background: "#fff" }}>
                  No machines on this drawing
                </div>
              )}
              {machines.map((machine, idx) => {
                const groups    = buildGroups(machine);
                const allPhotos = groups.flatMap((g) => g.photos);
                const ctrlCats  = (["plc", "hmi"] as SpecCatKey[]).filter((k) => specRows(machine, k).length > 0);
                const driveCats = (["vfd", "servo"] as SpecCatKey[]).filter((k) => specRows(machine, k).length > 0);
                const hasSpecs  = ctrlCats.length > 0 || driveCats.length > 0;
                const assessment = assessMachine(machine);
                const plcLife    = lifeFor(machine, "plc");
                const hmiLife    = lifeFor(machine, "hmi");
                const vfdLife    = lifeFor(machine, "vfd");
                const servoLife  = lifeFor(machine, "servo");

                return (
                  <div id={`mv-${machine.id}`} key={machine.id} className="bg-white scroll-mt-24 lg:scroll-mt-20 relative"
                    style={{ border: `1.5px solid ${INK}` }}
                    onClick={() => setActiveTab(machine.id)}>

                    {/* Machine title bar — L01 / 01 when this is a plant report */}
                    <div className="flex items-center gap-2.5 px-2.5 sm:px-3 py-1.5"
                      style={{ borderBottom: `1.5px solid ${INK}`, background: FAINT }}>
                      <TagBadge machine={machine} index={idx} />
                      <div className="flex-1 min-w-0">
                        <h2 className="font-mono font-bold text-sm uppercase tracking-[0.12em] truncate" style={{ color: INK }}>
                          {machine.name}
                        </h2>
                        {machine.line_name && (
                          <p className="font-mono text-[9px] font-bold uppercase tracking-wider truncate" style={{ color: INK, opacity: 0.45 }}>
                            {machine.line_name}
                          </p>
                        )}
                      </div>
                      {machine.notes && (
                        <span className="hidden md:block font-mono text-[10px] italic shrink-0 max-w-[200px] truncate" style={{ color: INK, opacity: 0.45 }}>
                          {machine.notes}
                        </span>
                      )}
                      {assessment.hasEol && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 shrink-0 font-mono text-[9px] font-bold text-amber-900 bg-amber-100"
                          style={{ border: "1.5px solid #d97706" }}>
                          {assessment.worst.status === "unsupported" ? "UNSUP" : "EOL"}
                        </span>
                      )}
                      {assessment.flags.slice(0, 2).map((f) => (
                        <span key={f.key} className="hidden sm:inline-flex px-1.5 py-0.5 shrink-0 font-mono text-[8px] font-bold"
                          style={{ color: INK, background: "#f4f6f2", border: `1px solid ${HAIR}` }}>
                          {f.short}
                        </span>
                      ))}
                      {allPhotos.length > 0 && (
                        <span className="flex items-center gap-1 font-mono text-[10px] font-bold shrink-0" style={{ color: INK, opacity: 0.45 }}>
                          <HiPhoto className="w-3 h-3" />{allPhotos.length}
                        </span>
                      )}
                    </div>

                    {hasSpecs && (
                      <div>
                        {ctrlCats.length > 0 && (
                          <>
                            <SectionRule no="1.0" title="Control Systems"
                              right={`${ctrlCats.length} UNIT${ctrlCats.length !== 1 ? "S" : ""}`} />
                            <div className={ctrlCats.length === 2 ? "grid grid-cols-1 sm:grid-cols-2" : ""}>
                              {ctrlCats.map((catKey, ci) => (
                                <div key={catKey} className="px-3 sm:px-4 py-2.5"
                                  style={ci > 0 ? { borderLeft: `1px solid ${HAIR}` } : undefined}>
                                  <SpecTable rows={specRows(machine, catKey)} catKey={catKey}
                                    life={catKey === "plc" ? plcLife : hmiLife} />
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        {driveCats.length > 0 && (
                          <>
                            <SectionRule no="2.0" title="Drive Systems"
                              right={`${driveCats.length} UNIT${driveCats.length !== 1 ? "S" : ""}`} />
                            <div className={driveCats.length === 2 ? "grid grid-cols-1 sm:grid-cols-2" : ""}>
                              {driveCats.map((catKey, ci) => (
                                <div key={catKey} className="px-3 sm:px-4 py-2.5"
                                  style={ci > 0 ? { borderLeft: `1px solid ${HAIR}` } : undefined}>
                                  <SpecTable rows={specRows(machine, catKey)} catKey={catKey}
                                    life={catKey === "vfd" ? vfdLife : servoLife} />
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {(assessment.flags.length > 0 || assessment.opportunity.length > 0) && (
                      <>
                        <SectionRule no={hasSpecs ? "3.0" : "1.0"} title="Current vs. possible"
                          right={`${assessment.flags.length} FLAG${assessment.flags.length !== 1 ? "S" : ""}`} />
                        <div className="grid grid-cols-1 sm:grid-cols-2">
                          <div className="px-3 sm:px-4 py-2.5" style={{ borderRight: `1px solid ${HAIR}` }}>
                            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] mb-1.5" style={{ color: INK, opacity: 0.4 }}>Today</p>
                            {assessment.today.map((t) => (
                              <p key={t} className="font-mono text-[11px] font-bold" style={{ color: INK }}>{t}</p>
                            ))}
                          </div>
                          <div className="px-3 sm:px-4 py-2.5">
                            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] mb-1.5" style={{ color: "#166534" }}>Possible</p>
                            {assessment.opportunity.map((t) => (
                              <p key={t} className="text-[11px] leading-snug" style={{ color: INK }}>{t}</p>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {allPhotos.length > 0 && (
                      <>
                        <SectionRule no={hasSpecs ? ((assessment.flags.length || assessment.opportunity.length) ? "4.0" : "3.0") : "1.0"} title="Field Documentation"
                          right={`${allPhotos.length} PHOTO${allPhotos.length !== 1 ? "S" : ""}`} />
                        <div className="px-3 sm:px-4 py-3 space-y-3">
                          {groups.map((group) => {
                            const gMeta = SPEC_META[group.catKey as SpecCatKey];
                            return (
                              <div key={group.key}>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="w-1.5 h-1.5 shrink-0" style={{ background: gMeta?.accent ?? "#6b7280" }} />
                                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: INK, opacity: 0.65 }}>
                                    {group.label}
                                  </span>
                                  <span className="font-mono text-[9px]" style={{ color: INK, opacity: 0.35 }}>({group.photos.length})</span>
                                  <div className="flex-1 h-px" style={{ background: HAIR }} />
                                </div>
                                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1">
                                  {group.photos.map((photo) => (
                                    <PhotoTile key={photo.id} photo={photo}
                                      onClick={() => openLightbox(allPhotos, allPhotos.indexOf(photo))} />
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {!hasSpecs && allPhotos.length === 0 && (
                      <div className="flex items-center gap-2 px-4 py-4" style={{ color: INK, opacity: 0.3 }}>
                        <HiCamera className="w-4 h-4" />
                        <span className="font-mono text-xs uppercase tracking-wider">No data recorded</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sheet footer */}
          <div className="flex items-center justify-between gap-3 px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em]"
            style={{ borderTop: `2px solid ${INK}`, background: INK, color: "rgba(255,255,255,0.45)" }}>
            <span>I&amp;I Automation · Control Engineering</span>
            <span className="text-brand-lime/70">Do not scale · NTS</span>
            <span>{dwgNo} · Rev A</span>
          </div>
        </div>
      </div>

      {/* ── Lightbox — rendered via portal so it's always on top ── */}
      {lightbox && createPortal(
        <div className="fixed inset-0 flex flex-col" style={{ background: "rgba(0,0,0,0.97)", zIndex: 99999 }}
          onClick={() => setLightbox(null)}>
          {/* Top bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
            style={{ borderColor: "rgba(255,255,255,0.08)" }} onClick={(e) => e.stopPropagation()}>
            <span className="font-mono text-xs text-gray-600 tabular-nums">
              {String(lightbox.idx + 1).padStart(2, "0")} / {String(lightbox.list.length).padStart(2, "0")}
            </span>
            <p className="flex-1 text-sm text-gray-300 font-medium truncate">{lightbox.photo.original_name}</p>
            <button onClick={() => setLightbox(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-300 hover:text-white hover:bg-white/10 transition-colors border border-white/10">
              <HiXMark className="w-4 h-4" /> ESC
            </button>
          </div>
          {/* Image area */}
          <div className="flex-1 flex items-center justify-center p-4 sm:p-10 min-h-0"
            onClick={(e) => e.stopPropagation()}>
            <img src={photoUrl(lightbox.photo.machine_id, lightbox.photo.filename, "view")}
              alt={lightbox.photo.original_name}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
          </div>
          {/* Prev */}
          {lightbox.idx > 0 && (
            <button onClick={(e) => { e.stopPropagation(); lbNav(-1); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-full text-white hover:bg-white/15 transition-colors"
              style={{ background: "rgba(255,255,255,0.08)" }}>
              <HiChevronDown className="w-6 h-6 rotate-90" />
            </button>
          )}
          {/* Next */}
          {lightbox.idx < lightbox.list.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); lbNav(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full text-white hover:bg-white/15 transition-colors"
              style={{ background: "rgba(255,255,255,0.08)" }}>
              <HiChevronDown className="w-6 h-6 -rotate-90" />
            </button>
          )}
          {/* Thumbnail strip */}
          <div className="flex gap-1.5 px-4 py-3 overflow-x-auto shrink-0 border-t"
            style={{ borderColor: "rgba(255,255,255,0.08)" }} onClick={(e) => e.stopPropagation()}>
            {lightbox.list.map((p, i) => (
              <button key={p.id}
                onClick={() => setLightbox({ photo: p, list: lightbox.list, idx: i })}
                className={`w-12 h-12 shrink-0 overflow-hidden rounded transition-all ${
                  i === lightbox.idx
                    ? "ring-2 ring-brand-lime ring-offset-1 ring-offset-black opacity-100"
                    : "opacity-35 hover:opacity-60"
                }`}>
                <img src={photoUrl(p.machine_id, p.filename, "thumb")} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────
export default function MappingEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingMachine, setAddingMachine] = useState(false);
  const [newMachineName, setNewMachineName] = useState("");
  const [showAddMachine, setShowAddMachine] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState("");
  // Open on the read-only report; editing is opt-in via the Edit toggle
  const [mode, setMode] = useState<"edit" | "view" | "risk">("view");
  const [buildingDeck, setBuildingDeck] = useState(false);
  const { printReady, printBusy, startPrint } = usePrintReport();
  const viewMode = mode !== "edit";
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const data = await getMapping(id);
      setMapping(data);
      setTitleVal(data.name);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => load(true), 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  async function handleAddMachine(e: React.FormEvent) {
    e.preventDefault();
    if (!mapping) return;
    setAddingMachine(true);
    try {
      const machine = await createMachine(mapping.id, {
        name: newMachineName.trim() || "New Machine",
        sort_order: (mapping.machines ?? []).length,
      });
      setMapping((m) => m ? { ...m, machines: [...(m.machines ?? []), { ...machine, photos: [] }] } : m);
      setNewMachineName("");
      setShowAddMachine(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add machine");
    } finally {
      setAddingMachine(false);
    }
  }

  async function handleDeleteMachine(machineId: string) {
    await deleteMachine(machineId);
    setMapping((m) => m ? { ...m, machines: (m.machines ?? []).filter((x) => x.id !== machineId) } : m);
  }

  function handleMachineUpdate(updated: MappingMachine) {
    setMapping((m) =>
      m ? { ...m, machines: (m.machines ?? []).map((x) => x.id === updated.id ? { ...updated, photos: x.photos } : x) } : m
    );
  }

  async function saveTitle() {
    if (!mapping || !titleVal.trim()) { setEditingTitle(false); return; }
    const updated = await updateMapping(mapping.id, { name: titleVal.trim() });
    setMapping((m) => m ? { ...m, name: updated.name } : m);
    setEditingTitle(false);
  }

  async function toggleStatus() {
    if (!mapping) return;
    const newStatus = mapping.status === "complete" ? "in_progress" : "complete";
    const updated = await updateMapping(mapping.id, { status: newStatus });
    setMapping((m) => m ? { ...m, status: updated.status } : m);
  }

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
    return <div className="text-center py-12 text-gray-500">Mapping not found.</div>;
  }

  const machines = mapping.machines ?? [];
  const isComplete = mapping.status === "complete";

  return (
    <>
      {/* Print view — lives outside the screen wrapper so display:none doesn't block it */}
      <PrintView mapping={mapping} mode={mode === "risk" ? "risk" : "sheet"} active={printReady} />

      {/* Screen UI — view mode full-bleed; edit mode narrow for field entry */}
      <div className={`mapping-screen-only space-y-3 pb-24 ${viewMode ? "" : "max-w-2xl mx-auto"}`}>

        {/* Technical toolbar */}
        <div className="lg:sticky lg:top-0 z-30 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 py-2 bg-[#f0f2ef]">
        <div className="flex flex-wrap items-stretch gap-0 border-2 border-brand-navy bg-white">
          <button onClick={() => navigate("/mappings")}
            className="px-2.5 flex items-center justify-center border-r-2 border-brand-navy text-brand-navy/50 hover:bg-brand-lime hover:text-brand-navy transition-colors shrink-0"
            title="Back to mappings">
            <HiArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0 px-3 py-2">
            {editingTitle ? (
              <input autoFocus value={titleVal} onChange={(e) => setTitleVal(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                className="w-full font-mono text-base font-bold bg-transparent border-b-2 border-brand-lime focus:outline-none uppercase" />
            ) : (
              <button onClick={() => { setTitleVal(mapping.name); setEditingTitle(true); }} className="text-left w-full group">
                <h1 className="font-mono text-base font-bold text-brand-navy uppercase tracking-wide flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{mapping.name}</span>
                  <HiPencil className="w-3.5 h-3.5 text-brand-navy/25 group-hover:text-brand-navy/60 shrink-0" />
                </h1>
              </button>
            )}
            <p className="font-mono text-[10px] text-brand-navy/40 mt-0.5 truncate uppercase tracking-wider">
              {mapping.plant_name}{mapping.city && mapping.state ? ` · ${mapping.city}, ${mapping.state}` : ""}
            </p>
          </div>

          <div className="flex items-stretch shrink-0 w-full sm:w-auto border-t-2 sm:border-t-0 sm:border-l-2 border-brand-navy">
            <button onClick={() => setMode("edit")}
              className={`flex items-center gap-1 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider border-r border-brand-navy/20 transition-colors ${
                mode === "edit" ? "bg-brand-navy text-white" : "text-brand-navy/50 hover:bg-brand-navy/5"
              }`}>
              <HiPencilSquare className="w-3.5 h-3.5" />
              Edit
            </button>
            <button onClick={() => setMode("view")}
              className={`flex items-center gap-1 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider border-r border-brand-navy/20 transition-colors ${
                mode === "view" ? "bg-brand-navy text-white" : "text-brand-navy/50 hover:bg-brand-navy/5"
              }`}>
              <HiEye className="w-3.5 h-3.5" />
              View
            </button>
            <button onClick={() => setMode("risk")}
              className={`flex items-center gap-1 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider border-r border-brand-navy/20 transition-colors ${
                mode === "risk" ? "bg-brand-navy text-white" : "text-brand-navy/50 hover:bg-brand-navy/5"
              }`}>
              <HiExclamationTriangle className="w-3.5 h-3.5" />
              Risk
            </button>
            <button onClick={toggleStatus}
              className={`flex items-center gap-1.5 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider border-r border-brand-navy/20 transition-colors ${
                isComplete
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-50 text-amber-800"
              }`}>
              {isComplete ? <HiCheckCircle className="w-3.5 h-3.5" /> : <HiClock className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isComplete ? "Complete" : "In progress"}</span>
            </button>
            <button
              onClick={async () => {
                if (!mapping) return;
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
            {mapping && <ShareLinkButton kind="mapping" id={mapping.id} />}
            <button onClick={startPrint}
              disabled={printBusy}
              className="px-3 flex items-center justify-center text-brand-navy/40 hover:bg-brand-lime hover:text-brand-navy transition-colors disabled:opacity-50"
              title={printBusy ? "Preparing photos…" : "Print / Export PDF"}>
              <HiPrinter className="w-4 h-4" />
            </button>
          </div>
        </div>
        </div>

        {/* View mode */}
        {mode === "view" && <MappingView mapping={mapping} />}
        {mode === "risk" && <RiskRegisterView mapping={mapping} />}

        {/* Edit mode — machines */}
        {!viewMode && machines.length === 0 ? (
          <div className="text-center py-12 text-brand-navy/35 border-2 border-dashed border-brand-navy/25 bg-white">
            <HiBuildingOffice2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="font-mono text-sm font-bold uppercase tracking-wider">No machines yet</p>
            <p className="font-mono text-[10px] mt-1 uppercase tracking-wider opacity-70">Add your first machine to start mapping</p>
          </div>
        ) : !viewMode && (
          <div className="space-y-4">
            {machines.map((machine, idx) => (
              <MachineCard key={machine.id} machine={machine} index={idx}
                onUpdate={handleMachineUpdate} onDelete={() => handleDeleteMachine(machine.id)} />
            ))}
          </div>
        )}

        {/* Add machine — only in edit mode */}
        {!viewMode && showAddMachine ? (
          <form onSubmit={handleAddMachine} className="bg-white border-2 border-dashed border-brand-navy p-4 space-y-3">
            <label className="block font-mono text-[10px] font-bold text-brand-navy/50 uppercase tracking-wider">Machine name</label>
            <input autoFocus type="text"
              placeholder="e.g. Conveyor Line 1, Compressor, Cooling Tower…"
              value={newMachineName} onChange={(e) => setNewMachineName(e.target.value)}
              className="w-full border-2 border-brand-navy/20 px-3 py-2.5 font-mono text-sm focus:outline-none focus:border-brand-navy" />
            <div className="flex gap-2">
              <button type="submit" disabled={addingMachine}
                className="flex-1 py-2.5 bg-brand-navy text-brand-lime font-mono text-[11px] font-bold uppercase tracking-wider hover:bg-brand-navy-700 disabled:opacity-50">
                {addingMachine ? "Adding…" : "Add machine"}
              </button>
              <button type="button" onClick={() => setShowAddMachine(false)}
                className="px-4 py-2.5 border-2 border-brand-navy/20 font-mono text-[11px] font-bold uppercase tracking-wider text-brand-navy/50 hover:bg-brand-navy/5">
                Cancel
              </button>
            </div>
          </form>
        ) : !viewMode && (
          <button onClick={() => setShowAddMachine(true)}
            className="w-full py-3.5 bg-white border-2 border-dashed border-brand-navy/25 text-brand-navy/45 hover:border-brand-navy hover:text-brand-navy transition-colors font-mono text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2">
            <HiPlus className="w-4 h-4" />
            Add machine
          </button>
        )}

        {/* Summary — only in edit mode */}
        {!viewMode && machines.length > 0 && (
          <div className="bg-white border-2 border-brand-navy">
            <div className="px-3 py-1.5 bg-brand-navy">
              <h2 className="font-mono text-[9px] font-bold text-brand-lime uppercase tracking-[0.2em]">Summary</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4">
              {[
                { label: "MACH", value: machines.length },
                { label: "PHOT", value: machines.reduce((s, m) => s + (m.photos ?? []).length, 0) },
                { label: "PLC",  value: machines.filter((m) => m.plc_make || m.plc_model).length },
                { label: "VFD",  value: machines.filter((m) => m.vfd_make || m.vfd_model).length },
              ].map((stat, i) => (
                <div key={stat.label} className="p-3 text-center" style={{ borderLeft: i > 0 ? "1px solid rgba(0,24,46,0.15)" : undefined }}>
                  <div className="font-mono text-2xl font-bold text-brand-navy tabular-nums">{String(stat.value).padStart(2, "0")}</div>
                  <div className="font-mono text-[8px] font-bold text-brand-navy/40 mt-1 uppercase tracking-[0.2em]">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {viewMode && <BackToTop />}
    </>
  );
}

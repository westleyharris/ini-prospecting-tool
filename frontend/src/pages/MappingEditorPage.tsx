import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import {
  HiArrowLeft, HiPrinter, HiPlus, HiTrash, HiPencil,
  HiChevronDown, HiCheckCircle, HiClock, HiCamera,
  HiCpuChip, HiComputerDesktop, HiBolt, HiPhoto,
  HiBuildingOffice2, HiDocumentText, HiXMark, HiCog8Tooth,
  HiEye, HiPencilSquare,
} from "react-icons/hi2";
import {
  getMapping, updateMapping, createMachine, updateMachine,
  deleteMachine, uploadPhoto, deletePhoto, rerunOcr,
  photoUrl,
  type Mapping, type MappingMachine, type MappingPhoto,
} from "../api/mappings";
import { checkPLCObsolete } from "../data/obsoletePlcs";

// ─── EOL badge ────────────────────────────────────────────────────────────────
function EOLBadge({ note, successor, eolYear }: { note: string; successor?: string; eolYear?: number }) {
  return (
    <div className="relative group/eol inline-flex shrink-0">
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-widest rounded border border-amber-300 cursor-help">
        ⚠ EOL
      </span>
      {/* Tooltip */}
      <div className="absolute bottom-full left-0 mb-2 z-20 w-60 bg-gray-950 text-white rounded-xl p-3 text-xs shadow-xl opacity-0 pointer-events-none group-hover/eol:opacity-100 transition-opacity duration-150"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
        <p className="font-semibold text-amber-400 mb-1 leading-snug">{note}</p>
        {eolYear && <p className="text-gray-400 text-[10px]">Discontinued: {eolYear}</p>}
        {successor && (
          <div className="mt-1.5 pt-1.5 border-t border-white/10">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Recommended replacement</p>
            <p className="text-green-400 font-bold mt-0.5">{successor}</p>
          </div>
        )}
      </div>
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
  eolResult?: ReturnType<typeof checkPLCObsolete>;
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
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
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
            {eolResult?.obsolete && (
              <EOLBadge note={eolResult.note!} successor={eolResult.successor} eolYear={eolResult.eolYear} />
            )}
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
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
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
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-600 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
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
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-600 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
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
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 shrink-0">
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
                <img src={photoUrl(photo.machine_id, photo.filename)} alt={photo.original_name}
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
            <img src={photoUrl(lightbox.machine_id, lightbox.filename)} alt={lightbox.original_name}
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
  const [expanded, setExpanded] = useState(true);
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
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>

        {editingName ? (
          <input autoFocus value={nameVal} onChange={(e) => setNameVal(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
            className="flex-1 bg-white border border-blue-300 rounded-lg px-3 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400" />
        ) : (
          <button onClick={() => { setNameVal(machine.name); setEditingName(true); }}
            className="flex-1 text-left font-semibold text-gray-900 text-sm hover:text-blue-600 flex items-center gap-1.5">
            {machine.name}
            <HiPencil className="w-3.5 h-3.5 text-gray-300" />
          </button>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {photoCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <HiPhoto className="w-3.5 h-3.5" />{photoCount}
            </span>
          )}
          <button onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400" title={expanded ? "Collapse" : "Expand"}>
            <HiChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
          <button onClick={() => { if (confirm(`Remove machine "${machine.name}"?`)) onDelete(); }}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500" title="Delete machine">
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
            eolResult={checkPLCObsolete(machine.plc_make, machine.plc_model, machine.plc_series)} />
          <FieldGroup title="HMI" Icon={HiComputerDesktop}
            fields={[
              { key: "hmi_make",    label: "Make",        placeholder: "e.g. Allen-Bradley" },
              { key: "hmi_model",   label: "Model",       placeholder: "e.g. PanelView Plus 7" },
              { key: "hmi_part_no", label: "Part number", placeholder: "e.g. 2711P-T7C22D9P" },
            ]}
            machine={machine} onSave={saveFields} />
          <FieldGroup title="VFD" Icon={HiBolt}
            fields={[
              { key: "vfd_make",    label: "Make",    placeholder: "e.g. Allen-Bradley" },
              { key: "vfd_model",   label: "Model",   placeholder: "e.g. PowerFlex 525" },
              { key: "vfd_hp",      label: "HP",      placeholder: "e.g. 5 HP" },
              { key: "vfd_voltage", label: "Voltage", placeholder: "e.g. 480V" },
            ]}
            machine={machine} onSave={saveFields} />
          <FieldGroup title="Servo Drive" Icon={HiCog8Tooth}
            fields={[
              { key: "servo_drive_make",  label: "Drive Make",  placeholder: "e.g. Allen-Bradley, Yaskawa" },
              { key: "servo_drive_model", label: "Drive Model", placeholder: "e.g. Kinetix 5500, SGDV" },
            ]}
            machine={machine} onSave={saveFields} />
          <FieldGroup title="Servo Motor" Icon={HiCog8Tooth}
            fields={[
              { key: "servo_motor_make",    label: "Motor Make",    placeholder: "e.g. Allen-Bradley, Fanuc" },
              { key: "servo_motor_model",   label: "Motor Model",   placeholder: "e.g. MP-Series, αiS" },
              { key: "servo_motor_part_no", label: "Motor Part No", placeholder: "e.g. MPL-B430P-MJ72AA" },
            ]}
            machine={machine} onSave={saveFields} />
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
// Renders outside the screen wrapper; @media print reveals it and hides the UI.
function PrintView({ mapping }: { mapping: Mapping }) {
  const machines = mapping.machines ?? [];
  const totalPhotos = machines.reduce((s, m) => s + (m.photos ?? []).length, 0);
  const eolCount    = machines.filter((m) => checkPLCObsolete(m.plc_make, m.plc_model, m.plc_series).obsolete).length;
  const plcCount    = machines.filter((m) => m.plc_make || m.plc_model).length;
  const driveCount  = machines.filter((m) => m.vfd_make || m.vfd_model || m.servo_drive_make).length;
  const reportDate  = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const printUrl    = typeof window !== "undefined" ? window.location.href : "";

  const CAT_PRINT = {
    machine: { label: "Machine Overview",  borderColor: "#6b7280", bgColor: "#f9fafb", textColor: "#374151" },
    plc:     { label: "PLC",               borderColor: "#3b82f6", bgColor: "#eff6ff", textColor: "#1d4ed8" },
    hmi:     { label: "HMI",               borderColor: "#8b5cf6", bgColor: "#f5f3ff", textColor: "#6d28d9" },
    vfd:     { label: "VFD",               borderColor: "#f59e0b", bgColor: "#fffbeb", textColor: "#b45309" },
    servo:   { label: "Servo",             borderColor: "#16a34a", bgColor: "#f0fdf4", textColor: "#15803d" },
    other:   { label: "Other",             borderColor: "#9ca3af", bgColor: "#f9fafb", textColor: "#6b7280" },
  } as const;
  type CatKey = keyof typeof CAT_PRINT;

  function getCatSpecs(machine: MappingMachine, cat: CatKey): { label: string; value: string; mono?: boolean }[] {
    if (cat === "plc") return [
      { label: "Make",   value: machine.plc_make   ?? "" },
      { label: "Model",  value: machine.plc_model  ?? "" },
      { label: "Series", value: machine.plc_series ?? "" },
      { label: "P/N",    value: machine.plc_part_no ?? "", mono: true },
    ].filter((s) => s.value);
    if (cat === "hmi") return [
      { label: "Make",  value: machine.hmi_make   ?? "" },
      { label: "Model", value: machine.hmi_model  ?? "" },
      { label: "P/N",   value: machine.hmi_part_no ?? "", mono: true },
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
      { label: "Motor P/N",   value: machine.servo_motor_part_no ?? "", mono: true },
    ].filter((s) => s.value);
    return [];
  }

  // Bordered engineering spec table — same visual language as the screen view
  function SpecDataTable({ specs, eolResult }: {
    specs: { label: string; value: string; mono?: boolean }[];
    eolResult?: ReturnType<typeof checkPLCObsolete>;
  }) {
    return (
      <div>
        <div style={{ border: "1px solid #e5e7eb" }}>
          {specs.map((spec, i) => (
            <div key={spec.label} style={{ display: "flex", borderTop: i > 0 ? "1px solid #e5e7eb" : "none" }}>
              <div style={{
                width: 80, flexShrink: 0, background: "#f9fafb",
                borderRight: "1px solid #e5e7eb",
                padding: "7px 10px", display: "flex", alignItems: "center",
              }}>
                <span style={{ fontSize: 7, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.12em", color: "#9ca3af" }}>{spec.label}</span>
              </div>
              <div style={{ padding: "7px 10px", flex: 1, background: "#fff", display: "flex", alignItems: "center" }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: "#111827",
                  fontFamily: spec.mono ? "'Courier New', monospace" : "inherit",
                }}>{spec.value}</span>
              </div>
            </div>
          ))}
        </div>
        {eolResult?.obsolete && (
          <div style={{ marginTop: 7, background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 3, padding: "7px 10px" }}>
            <div style={{ fontSize: 8, fontWeight: 900, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>⚠ End of Life</div>
            <div style={{ fontSize: 9, color: "#78350f", lineHeight: 1.5 }}>{eolResult.note}</div>
            {eolResult.successor && (
              <div style={{ marginTop: 3, fontSize: 9, color: "#065f46" }}>
                <span style={{ fontWeight: 700 }}>Successor: </span>{eolResult.successor}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Photo grid — 2 columns with filename captions below each image
  function PhotoGrid({ photos, wide }: { photos: MappingPhoto[]; wide?: boolean }) {
    return (
      <div style={{
        display: "grid",
        gridTemplateColumns: wide ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
        gap: 10,
        padding: 12,
      }}>
        {photos.map((photo) => (
          <div key={photo.id} style={{ breakInside: "avoid" }}>
            <img
              src={photoUrl(photo.machine_id, photo.filename)}
              alt={photo.original_name}
              style={{
                width: "100%", display: "block",
                aspectRatio: "4/3", objectFit: "cover",
                border: "1px solid #d1d5db", borderRadius: 3,
              }}
            />
            <div style={{
              fontSize: 7, color: "#9ca3af", marginTop: 3,
              textAlign: "center", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
              fontFamily: "'Courier New', monospace",
            }}>
              {photo.original_name}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media screen { .mapping-print-root { display: none; } }
        @media print  {
          .mapping-print-root { display: block; }
          .mapping-screen-only { display: none !important; }
          body { margin: 0; }
          @page { margin: 0.5in 0.55in 0.6in; size: letter portrait; }
        }
        @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
        .print-page-break { break-before: page; }
      `}</style>

      <div className="mapping-print-root" style={{ fontFamily: "Arial, 'Helvetica Neue', sans-serif", fontSize: 11, color: "#111827", lineHeight: 1.4 }}>

        {/* ══════════ TITLE BLOCK ══════════ */}
        <div style={{ marginBottom: 24, border: "2px solid #166534" }}>

          {/* Branding strip */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "6px 16px", background: "#021a0d", borderBottom: "1px solid #14532d",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", color: "#4ade80", textTransform: "uppercase" }}>I&amp;I Automation</span>
              <span style={{ color: "#166534", fontSize: 14 }}>·</span>
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.22em", color: "#86efac", textTransform: "uppercase" }}>Equipment Mapping Report</span>
            </div>
            <span style={{ fontSize: 8, color: "#4ade80", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Confidential</span>
          </div>

          {/* Title + stats row */}
          <div style={{ display: "flex", alignItems: "flex-start", padding: "16px 16px 0", background: "#052e16", gap: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#ffffff", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
                {mapping.plant_name || mapping.name}
              </div>
              {mapping.plant_name && (
                <div style={{ fontSize: 13, color: "#86efac", marginTop: 5, fontWeight: 600 }}>{mapping.name}</div>
              )}
              {(mapping.city || mapping.state) && (
                <div style={{ fontSize: 11, color: "#4ade80", marginTop: 3 }}>
                  {[mapping.city, mapping.state].filter(Boolean).join(", ")}
                </div>
              )}
            </div>
            {/* Stats boxes */}
            <div style={{ display: "flex", border: "1px solid #166534", background: "rgba(0,0,0,0.25)", flexShrink: 0, alignSelf: "flex-start", marginTop: 4 }}>
              {[
                { n: machines.length, l: "Machines" },
                { n: totalPhotos,     l: "Photos"   },
                { n: plcCount,        l: "PLCs"     },
                { n: driveCount,      l: "Drives"   },
              ].map(({ n, l }, i) => (
                <div key={l} style={{ padding: "10px 18px", textAlign: "center", borderLeft: i > 0 ? "1px solid #166534" : "none", minWidth: 56 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#ffffff", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{n}</div>
                  <div style={{ fontSize: 7, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "#4ade80", marginTop: 3 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Engineering title-block footer row */}
          <div style={{ display: "flex", borderTop: "1px solid #14532d", marginTop: 14, background: "#052e16" }}>
            <div style={{ flex: 1, padding: "7px 16px", borderRight: "1px solid #14532d" }}>
              <div style={{ fontSize: 7, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: "#166534", marginBottom: 1 }}>Prepared By</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#4ade80" }}>I&amp;I Automation</div>
            </div>
            {eolCount > 0 ? (
              <div style={{ flex: 2, padding: "7px 16px", background: "rgba(217,119,6,0.15)", borderRight: "1px solid #14532d" }}>
                <div style={{ fontSize: 7, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: "#92400e", marginBottom: 1 }}>EOL Alert</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24" }}>
                  ⚠ {eolCount} End-of-Life PLC{eolCount !== 1 ? "s" : ""} Detected — Replacement Recommended
                </div>
              </div>
            ) : (
              <div style={{ flex: 2, padding: "7px 16px", borderRight: "1px solid #14532d" }}>
                <div style={{ fontSize: 7, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: "#166534", marginBottom: 1 }}>Status</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#4ade80" }}>No EOL equipment detected</div>
              </div>
            )}
            <div style={{ padding: "7px 16px", minWidth: 130 }}>
              <div style={{ fontSize: 7, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: "#166534", marginBottom: 1 }}>Date</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#4ade80", fontFamily: "'Courier New', monospace" }}>{reportDate}</div>
            </div>
          </div>
        </div>

        {/* ══════════ EQUIPMENT INDEX ══════════ */}
        <div style={{ marginBottom: 24, border: "1px solid #e5e7eb" }}>
          <div style={{
            padding: "5px 12px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb",
            fontSize: 8, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em", color: "#6b7280",
          }}>
            Equipment Index — {machines.length} Machine{machines.length !== 1 ? "s" : ""} · {totalPhotos} Photos
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
            {machines.map((m, i) => {
              const mEol = checkPLCObsolete(m.plc_make, m.plc_model, m.plc_series);
              const col = i % 3;
              const row = Math.floor(i / 3);
              const totalRows = Math.ceil(machines.length / 3);
              return (
                <div key={m.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 12px",
                  borderRight: col < 2 ? "1px solid #e5e7eb" : "none",
                  borderBottom: row < totalRows - 1 ? "1px solid #e5e7eb" : "none",
                }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: "#166534", fontFamily: "'Courier New', monospace", minWidth: 22 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#111827", flex: 1 }}>{m.name}</span>
                  {mEol.obsolete && (
                    <span style={{
                      fontSize: 7, fontWeight: 900, color: "#92400e",
                      background: "#fef3c7", padding: "1px 4px", borderRadius: 2,
                      textTransform: "uppercase", letterSpacing: "0.08em", border: "1px solid #fbbf24",
                    }}>EOL</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════ MACHINE SECTIONS ══════════ */}
        {machines.map((machine, idx) => {
          const photos = machine.photos ?? [];

          // Group photos by category
          const photosByCat: Partial<Record<CatKey, MappingPhoto[]>> = {};
          for (const p of photos) {
            const k = p.category as CatKey;
            if (!photosByCat[k]) photosByCat[k] = [];
            photosByCat[k]!.push(p);
          }
          const orderedCats = (["machine", "plc", "hmi", "vfd", "servo"] as CatKey[])
            .filter((k) => (photosByCat[k] ?? []).length > 0);

          // "other" photos grouped by custom label
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
          const machineEol = checkPLCObsolete(machine.plc_make, machine.plc_model, machine.plc_series);

          return (
            <div key={machine.id} className={idx > 0 ? "print-page-break" : ""} style={{ marginBottom: 32 }}>

              {/* ── Machine header bar ── */}
              <div style={{ display: "flex", alignItems: "stretch", background: "#052e16", border: "2px solid #166534" }}>
                {/* ISA-style equipment tag */}
                <div style={{
                  display: "flex", alignItems: "stretch", flexShrink: 0,
                  borderRight: "2px solid #4ade80",
                }}>
                  <div style={{
                    background: "#4ade80", color: "#052e16",
                    padding: "0 8px", fontSize: 9, fontWeight: 900,
                    fontFamily: "'Courier New', monospace",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>M</div>
                  <div style={{
                    background: "#fff", color: "#111827",
                    padding: "0 12px", fontSize: 16, fontWeight: 900,
                    fontFamily: "'Courier New', monospace",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    minWidth: 44,
                  }}>
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                </div>

                <div style={{ flex: 1, padding: "10px 16px" }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em", lineHeight: 1.1 }}>
                    {machine.name}
                  </div>
                  {machine.notes && (
                    <div style={{ fontSize: 9, color: "#86efac", marginTop: 3, fontStyle: "italic" }}>{machine.notes}</div>
                  )}
                </div>

                <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", gap: 4 }}>
                  {photos.length > 0 && (
                    <div style={{ fontSize: 9, color: "#4ade80", fontWeight: 700 }}>
                      {photos.length} Photo{photos.length !== 1 ? "s" : ""}
                    </div>
                  )}
                  {machineEol.obsolete && (
                    <div style={{
                      fontSize: 8, fontWeight: 900, color: "#fbbf24",
                      background: "rgba(217,119,6,0.2)", padding: "2px 7px",
                      borderRadius: 2, textTransform: "uppercase", letterSpacing: "0.08em",
                    }}>⚠ EOL PLC</div>
                  )}
                </div>
              </div>

              {/* ── Category sections ── */}
              <div style={{ border: "1px solid #e5e7eb", borderTop: "2px solid #166534" }}>

                {orderedCats.map((catKey) => {
                  const meta = CAT_PRINT[catKey];
                  const catPhotos = photosByCat[catKey] ?? [];
                  const specs = getCatSpecs(machine, catKey);
                  const isSpecCat = catKey === "plc" || catKey === "hmi" || catKey === "vfd" || catKey === "servo";

                  return (
                    <div key={catKey} style={{ borderBottom: "1px solid #e5e7eb", breakInside: "avoid" }}>
                      {/* Section header */}
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "5px 12px", background: meta.bgColor,
                        borderLeft: `4px solid ${meta.borderColor}`, borderBottom: "1px solid #e5e7eb",
                      }}>
                        <span style={{ fontSize: 8, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em", color: meta.textColor }}>
                          {meta.label}
                        </span>
                        <span style={{ fontSize: 8, color: "#9ca3af", fontFamily: "'Courier New', monospace" }}>
                          {catPhotos.length} photo{catPhotos.length !== 1 ? "s" : ""}
                          {isSpecCat && specs.length > 0 ? ` · ${specs.length} field${specs.length !== 1 ? "s" : ""}` : ""}
                        </span>
                      </div>

                      {/* Section body: photos left, specs right for spec categories */}
                      <div style={{ display: "flex", alignItems: "flex-start" }}>
                        {/* Photos */}
                        <div style={{ flex: isSpecCat ? "1 1 55%" : "1 1 100%", borderRight: isSpecCat && specs.length > 0 ? "1px solid #e5e7eb" : "none" }}>
                          <PhotoGrid photos={catPhotos} wide={!isSpecCat && catPhotos.length >= 3} />
                        </div>

                        {/* Spec data table */}
                        {isSpecCat && (
                          <div style={{ flex: "0 0 45%", padding: 12 }}>
                            {specs.length > 0 ? (
                              <SpecDataTable
                                specs={specs}
                                eolResult={catKey === "plc" ? machineEol : undefined}
                              />
                            ) : (
                              <div style={{ fontSize: 10, color: "#d1d5db", fontStyle: "italic", padding: "8px 0" }}>No specs recorded</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Spec-only sections (specs exist but no photos for that category) */}
                {specOnlyCats.map((catKey) => {
                  const meta = CAT_PRINT[catKey];
                  const specs = getCatSpecs(machine, catKey);
                  return (
                    <div key={`spec-${catKey}`} style={{ borderBottom: "1px solid #e5e7eb", breakInside: "avoid" }}>
                      <div style={{
                        padding: "5px 12px", background: meta.bgColor,
                        borderLeft: `4px solid ${meta.borderColor}`, borderBottom: "1px solid #e5e7eb",
                      }}>
                        <span style={{ fontSize: 8, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em", color: meta.textColor }}>{meta.label}</span>
                      </div>
                      <div style={{ padding: 12 }}>
                        <SpecDataTable
                          specs={specs}
                          eolResult={catKey === "plc" ? machineEol : undefined}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* "Other" photo groups */}
                {otherGroups.map((group) => (
                  <div key={group.label} style={{ borderBottom: "1px solid #e5e7eb", breakInside: "avoid" }}>
                    <div style={{
                      padding: "5px 12px", background: "#f9fafb",
                      borderLeft: "4px solid #9ca3af", borderBottom: "1px solid #e5e7eb",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <span style={{ fontSize: 8, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em", color: "#6b7280" }}>{group.label}</span>
                      <span style={{ fontSize: 8, color: "#9ca3af", fontFamily: "'Courier New', monospace" }}>{group.photos.length} photo{group.photos.length !== 1 ? "s" : ""}</span>
                    </div>
                    <PhotoGrid photos={group.photos} wide={group.photos.length >= 3} />
                  </div>
                ))}

                {orderedCats.length === 0 && otherGroups.length === 0 && !hasSpecs && (
                  <div style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 11, fontStyle: "italic" }}>
                    No photos or specs recorded for this machine.
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* ══════════ DOCUMENT FOOTER ══════════ */}
        <div style={{
          marginTop: 24, paddingTop: 10,
          borderTop: "2px solid #e5e7eb",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 8, color: "#9ca3af",
        }}>
          <div>
            <span style={{ fontWeight: 900, color: "#166534" }}>I&amp;I Automation</span>
            {" "}· Equipment Mapping Report · {mapping.plant_name || mapping.name}
          </div>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 7 }}>{printUrl}</div>
          <div>Printed {new Date().toLocaleDateString()}</div>
        </div>

      </div>
    </>
  );
}

// ─── In-app view mode ─────────────────────────────────────────────────────────

function PhotoTile({ photo, onClick }: { photo: MappingPhoto; onClick: () => void }) {
  const [err, setErr] = useState(false);
  return (
    <button type="button" onClick={onClick}
      className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 hover:ring-2 hover:ring-green-500 hover:ring-offset-2 transition-all duration-200 group shadow-sm">
      {err ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 bg-gray-50 gap-1">
          <HiCamera className="w-7 h-7" />
          <span className="text-[9px] text-gray-300">No image</span>
        </div>
      ) : (
        <>
          <img src={photoUrl(photo.machine_id, photo.filename)} alt={photo.original_name}
            loading="lazy" decoding="async"
            onError={() => setErr(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </>
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

function MappingView({ mapping }: { mapping: Mapping }) {
  const machines = mapping.machines ?? [];
  const [lightbox, setLightbox] = useState<{ photo: MappingPhoto; list: MappingPhoto[]; idx: number } | null>(null);
  const [activeTab, setActiveTab] = useState(machines[0]?.id ?? "");

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
        { threshold: 0, rootMargin: "-5% 0px -60% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, [machines]);

  const totalPhotos = machines.reduce((s, m) => s + (m.photos ?? []).length, 0);
  const eolCount    = machines.filter((m) => checkPLCObsolete(m.plc_make, m.plc_model, m.plc_series).obsolete).length;
  const reportDate  = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  // Spec table rendered as bordered engineering data cells
  function SpecTable({ rows, catKey, plcEol }: {
    rows: { label: string; value: string }[];
    catKey: SpecCatKey;
    plcEol?: ReturnType<typeof checkPLCObsolete>;
  }) {
    const meta = SPEC_META[catKey];
    const SIcon = meta.Icon;
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-4 h-4 flex items-center justify-center shrink-0"
            style={{ background: meta.bg, color: meta.accent, borderRadius: 2 }}>
            <SIcon className="w-2.5 h-2.5" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: meta.text }}>{meta.label}</span>
          {catKey === "plc" && plcEol?.obsolete && (
            <EOLBadge note={plcEol.note!} successor={plcEol.successor} eolYear={plcEol.eolYear} />
          )}
        </div>
        <div style={{ border: "1px solid #e5e7eb" }}>
          {rows.map((r, i) => (
            <div key={r.label} className="flex items-stretch"
              style={{ borderTop: i > 0 ? "1px solid #e5e7eb" : undefined }}>
              <div className="flex items-center px-2.5 shrink-0"
                style={{ width: 88, background: "#f9fafb", borderRight: "1px solid #e5e7eb", minHeight: 30 }}>
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 leading-tight">{r.label}</span>
              </div>
              <div className="flex items-center px-3 py-1.5 flex-1 bg-white">
                <span className="text-sm font-bold text-gray-900 font-mono leading-snug">{r.value}</span>
              </div>
            </div>
          ))}
        </div>
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

  return (
    <>
      {/* True viewport-width breakout */}
      <div style={{ width: "100vw", marginLeft: "calc(-50vw + 50%)", position: "relative" }}
        className="-mt-4 sm:-mt-8">

        {/* ── Report header ── */}
        <div className="relative overflow-hidden" style={{ background: "linear-gradient(160deg, #052e16 0%, #14532d 100%)" }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 px-5 sm:px-8 py-5">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-green-500 mb-1">Equipment Mapping Report</p>
              <h1 className="text-white font-black text-xl sm:text-2xl leading-tight truncate">{mapping.name}</h1>
              {(mapping.plant_name || mapping.city) && (
                <p className="text-green-300 text-sm mt-0.5">
                  {mapping.plant_name}{mapping.city ? ` · ${mapping.city}, ${mapping.state}` : ""}
                </p>
              )}
            </div>
            <div className="flex gap-5 sm:gap-8 shrink-0">
              {[
                { n: machines.length, l: "Machines", Icon: HiCog8Tooth, c: "#4ade80" },
                { n: totalPhotos,     l: "Photos",   Icon: HiPhoto,     c: "#86efac" },
                { n: machines.filter(m => m.plc_make || m.plc_model).length, l: "PLCs", Icon: HiCpuChip, c: "#93c5fd" },
                { n: machines.filter(m => m.vfd_make || m.servo_drive_make).length, l: "Drives", Icon: HiBolt, c: "#fcd34d" },
              ].map(({ n, l, Icon, c }) => (
                <div key={l} className="text-center">
                  <div className="text-3xl font-black text-white tabular-nums leading-none">{n}</div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Icon className="w-3 h-3" style={{ color: c }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: c }}>{l}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Drawing title-block footer row */}
          <div className="relative border-t border-white/10 px-5 sm:px-8 py-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-green-700">Prepared by</p>
                <p className="text-[11px] font-bold text-green-400">I&amp;I Automation</p>
              </div>
              {eolCount > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded"
                  style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
                  <span className="text-[10px] font-black text-amber-400">⚠</span>
                  <span className="text-[10px] font-bold text-amber-400">{eolCount} EOL PLC{eolCount > 1 ? "s" : ""} detected</span>
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-[8px] font-black uppercase tracking-widest text-green-700">Date</p>
              <p className="text-[11px] font-mono font-bold text-green-400">{reportDate}</p>
            </div>
          </div>

          {/* Mobile tab strip */}
          <div className="lg:hidden border-t border-white/10 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <div className="flex min-w-max px-4">
              {machines.map((m, i) => {
                const mEol = checkPLCObsolete(m.plc_make, m.plc_model, m.plc_series);
                return (
                  <button key={m.id}
                    onClick={() => { setActiveTab(m.id); document.getElementById(`mv-${m.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                    className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold border-b-2 transition-all whitespace-nowrap ${
                      activeTab === m.id ? "border-green-400 text-green-300" : "border-transparent text-white/40 hover:text-white/70"
                    }`}>
                    <span className="font-mono opacity-60">{String(i + 1).padStart(2, "0")}</span>
                    <span className="uppercase tracking-wide">{m.name}</span>
                    {mEol.obsolete && <span className="text-amber-400 text-[9px] font-black">EOL</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Two-panel layout: sidebar + content ── */}
        <div className="flex">

          {/* Dark sticky sidebar — desktop only */}
          <aside className="hidden lg:flex flex-col shrink-0 bg-gray-950 border-r border-gray-800"
            style={{ width: 210, position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
            <div className="px-3 py-3 border-b border-gray-800">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">Equipment Index</p>
              <p className="text-[10px] text-gray-600 mt-0.5 font-mono">{machines.length} machines · {totalPhotos} photos</p>
            </div>
            <nav className="flex-1 py-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              {machines.map((m, i) => {
                const mEol = checkPLCObsolete(m.plc_make, m.plc_model, m.plc_series);
                const isActive = activeTab === m.id;
                return (
                  <button key={m.id}
                    onClick={() => { setActiveTab(m.id); document.getElementById(`mv-${m.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2.5 transition-all border-l-2"
                    style={{
                      borderLeftColor: isActive ? "#4ade80" : "transparent",
                      background: isActive ? "rgba(20,83,45,0.35)" : undefined,
                    }}>
                    <span className="font-mono text-[10px] shrink-0 tabular-nums"
                      style={{ color: isActive ? "#4ade80" : "#374151" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className={`text-xs font-bold uppercase tracking-wide flex-1 min-w-0 truncate leading-tight ${isActive ? "text-green-300" : "text-gray-500"}`}>
                      {m.name}
                    </span>
                    {mEol.obsolete && (
                      <span className="text-[9px] font-black text-amber-500 shrink-0">EOL</span>
                    )}
                  </button>
                );
              })}
            </nav>
            {/* Legend */}
            <div className="px-3 py-3 border-t border-gray-800">
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-gray-700 mb-2">Legend</p>
              {[
                { dot: "#3b82f6", label: "PLC / Control System" },
                { dot: "#8b5cf6", label: "HMI / Operator Panel" },
                { dot: "#f59e0b", label: "VFD / Variable Drive" },
                { dot: "#22c55e", label: "Servo System" },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-2 mb-1.5">
                  <div className="w-2 h-2 shrink-0" style={{ background: l.dot, borderRadius: 1 }} />
                  <span className="text-[9px] text-gray-600 font-medium leading-tight">{l.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-800">
                <div className="w-2 h-2 shrink-0 bg-amber-500" style={{ borderRadius: 1 }} />
                <span className="text-[9px] text-amber-600 font-black">EOL = Vendor discontinued</span>
              </div>
            </div>
          </aside>

          {/* Main content — graph-paper background */}
          <div className="flex-1 min-w-0 divide-y-2 divide-gray-300"
            style={{ background: "#f1f5f1", backgroundImage: "radial-gradient(rgba(0,0,0,0.055) 1px, transparent 1px)", backgroundSize: "18px 18px" }}>
            {machines.map((machine, idx) => {
              const groups    = buildGroups(machine);
              const allPhotos = groups.flatMap((g) => g.photos);
              const ctrlCats  = (["plc", "hmi"] as SpecCatKey[]).filter((k) => specRows(machine, k).length > 0);
              const driveCats = (["vfd", "servo"] as SpecCatKey[]).filter((k) => specRows(machine, k).length > 0);
              const hasSpecs  = ctrlCats.length > 0 || driveCats.length > 0;
              const plcEol    = checkPLCObsolete(machine.plc_make, machine.plc_model, machine.plc_series);

              return (
                <div id={`mv-${machine.id}`} key={machine.id} className="bg-white"
                  style={{ borderLeft: `4px solid ${plcEol.obsolete ? "#f59e0b" : "#166534"}` }}
                  onClick={() => setActiveTab(machine.id)}>

                  {/* Machine header */}
                  <div className="flex items-center gap-3 px-4 sm:px-5 py-2.5"
                    style={{ background: "linear-gradient(90deg, #14532d 0%, #166534 100%)" }}>
                    {/* ISA-style equipment tag */}
                    <div className="flex items-stretch shrink-0 overflow-hidden" style={{ borderRadius: 2 }}>
                      <div className="flex items-center justify-center px-1.5 bg-green-400 text-gray-950 font-black text-[10px] font-mono">M</div>
                      <div className="flex items-center justify-center px-2 bg-white text-gray-900 font-black text-[11px] font-mono">
                        {String(idx + 1).padStart(2, "0")}
                      </div>
                    </div>
                    <div className="w-px h-4 bg-green-600 shrink-0" />
                    <h2 className="text-white font-black text-sm uppercase tracking-widest flex-1 min-w-0 truncate">{machine.name}</h2>
                    {machine.notes && (
                      <span className="hidden sm:block text-green-300 text-[11px] italic shrink-0 max-w-[200px] truncate">{machine.notes}</span>
                    )}
                    {plcEol.obsolete && (
                      <span className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 shrink-0 text-[9px] font-black text-amber-900 bg-amber-400" style={{ borderRadius: 2 }}>
                        ⚠ EOL PLC
                      </span>
                    )}
                    {allPhotos.length > 0 && (
                      <span className="flex items-center gap-1 text-green-300 text-[11px] font-bold shrink-0">
                        <HiPhoto className="w-3 h-3" />{allPhotos.length}
                      </span>
                    )}
                  </div>

                  {/* Spec sections */}
                  {hasSpecs && (
                    <div className="border-b border-gray-200">
                      {ctrlCats.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 px-4 sm:px-5 py-1.5 border-b border-gray-200"
                            style={{ background: "#f8fafc" }}>
                            <HiCpuChip className="w-3 h-3 text-gray-400" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Control Systems</span>
                          </div>
                          <div className={ctrlCats.length === 2 ? "grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-200" : ""}>
                            {ctrlCats.map((catKey) => (
                              <div key={catKey} className="px-4 sm:px-5 py-3.5">
                                <SpecTable rows={specRows(machine, catKey)} catKey={catKey} plcEol={plcEol} />
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      {driveCats.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 px-4 sm:px-5 py-1.5 border-y border-gray-200"
                            style={{ background: "#f8fafc" }}>
                            <HiBolt className="w-3 h-3 text-gray-400" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Drive Systems</span>
                          </div>
                          <div className={driveCats.length === 2 ? "grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-200" : ""}>
                            {driveCats.map((catKey) => (
                              <div key={catKey} className="px-4 sm:px-5 py-3.5">
                                <SpecTable rows={specRows(machine, catKey)} catKey={catKey} />
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Photo documentation */}
                  {allPhotos.length > 0 && (
                    <>
                      <div className="flex items-center justify-between px-4 sm:px-5 py-1.5 border-b border-gray-200"
                        style={{ background: "#f8fafc" }}>
                        <div className="flex items-center gap-2">
                          <HiPhoto className="w-3 h-3 text-gray-400" />
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Field Documentation</span>
                        </div>
                        <span className="text-[9px] font-mono text-gray-400">{allPhotos.length} photos</span>
                      </div>
                      <div className="px-4 sm:px-5 py-4 space-y-4">
                        {groups.map((group) => {
                          const cat = PHOTO_CATEGORIES.find((c) => c.key === group.catKey);
                          const GIcon = cat?.Icon ?? HiCamera;
                          return (
                            <div key={group.key}>
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${cat?.color ?? "bg-gray-100 text-gray-500"}`}
                                  style={{ borderRadius: 2 }}>
                                  <GIcon className="w-3 h-3" />{group.label}
                                </div>
                                <span className="text-[9px] font-mono text-gray-400">{group.photos.length}</span>
                                <div className="flex-1 h-px bg-gray-200" />
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
                    <div className="flex items-center gap-2 px-5 py-5 text-gray-300">
                      <HiCamera className="w-4 h-4" />
                      <span className="text-sm">No data recorded yet</span>
                    </div>
                  )}
                </div>
              );
            })}
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
            <img src={photoUrl(lightbox.photo.machine_id, lightbox.photo.filename)}
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
                    ? "ring-2 ring-green-400 ring-offset-1 ring-offset-black opacity-100"
                    : "opacity-35 hover:opacity-60"
                }`}>
                <img src={photoUrl(p.machine_id, p.filename)} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
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
  const [viewMode, setViewMode] = useState(false);
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
        <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
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
      <PrintView mapping={mapping} />

      {/* Screen UI */}
      <div className="mapping-screen-only max-w-2xl mx-auto space-y-4 pb-24">

        {/* Top bar */}
        <div className="flex items-start gap-3">
          <button onClick={() => navigate("/mappings")}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 shrink-0 mt-0.5" title="Back">
            <HiArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <input autoFocus value={titleVal} onChange={(e) => setTitleVal(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                className="w-full text-xl font-bold bg-white border-b-2 border-blue-400 focus:outline-none pb-0.5" />
            ) : (
              <button onClick={() => { setTitleVal(mapping.name); setEditingTitle(true); }} className="text-left w-full">
                <h1 className="text-xl font-bold text-gray-900 hover:text-blue-600 flex items-center gap-1.5">
                  {mapping.name}
                  <HiPencil className="w-4 h-4 text-gray-300" />
                </h1>
              </button>
            )}
            <p className="text-sm text-gray-400 mt-0.5">
              {mapping.plant_name}{mapping.city && mapping.state ? ` · ${mapping.city}, ${mapping.state}` : ""}
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            {/* View / Edit toggle */}
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              <button onClick={() => setViewMode(false)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${!viewMode ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                <HiPencilSquare className="w-3.5 h-3.5" />
                Edit
              </button>
              <button onClick={() => setViewMode(true)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                <HiEye className="w-3.5 h-3.5" />
                View
              </button>
            </div>
            <button onClick={toggleStatus}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                isComplete
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200"
                  : "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100"
              }`}>
              {isComplete ? <HiCheckCircle className="w-4 h-4" /> : <HiClock className="w-4 h-4" />}
              <span className="hidden sm:inline">{isComplete ? "Complete" : "In progress"}</span>
            </button>
            <button onClick={() => window.print()}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-400" title="Print / Export PDF">
              <HiPrinter className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View mode */}
        {viewMode && <MappingView mapping={mapping} />}

        {/* Edit mode — machines */}
        {!viewMode && machines.length === 0 ? (
          <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
            <HiBuildingOffice2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">No machines yet</p>
            <p className="text-xs mt-1">Add your first machine to start mapping</p>
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
          <form onSubmit={handleAddMachine} className="bg-white border-2 border-dashed border-blue-300 rounded-2xl p-4 space-y-3">
            <label className="block text-sm font-medium text-gray-700">Machine name</label>
            <input autoFocus type="text"
              placeholder="e.g. Conveyor Line 1, Compressor, Cooling Tower…"
              value={newMachineName} onChange={(e) => setNewMachineName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <div className="flex gap-2">
              <button type="submit" disabled={addingMachine}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50">
                {addingMachine ? "Adding…" : "Add machine"}
              </button>
              <button type="button" onClick={() => setShowAddMachine(false)}
                className="px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        ) : !viewMode && (
          <button onClick={() => setShowAddMachine(true)}
            className="w-full py-4 bg-white border-2 border-dashed border-gray-200 rounded-2xl text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/30 transition-all text-sm font-medium flex items-center justify-center gap-2">
            <HiPlus className="w-5 h-5" />
            Add machine
          </button>
        )}

        {/* Summary — only in edit mode */}
        {!viewMode && machines.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Summary</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Machines", value: machines.length },
                { label: "Photos",   value: machines.reduce((s, m) => s + (m.photos ?? []).length, 0) },
                { label: "With PLC", value: machines.filter((m) => m.plc_make || m.plc_model).length },
                { label: "With VFD", value: machines.filter((m) => m.vfd_make || m.vfd_model).length },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-xl p-3 text-center border border-gray-100">
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

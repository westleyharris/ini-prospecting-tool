import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  HiArrowLeft, HiPrinter, HiPlus, HiTrash, HiPencil,
  HiChevronDown, HiCheckCircle, HiClock, HiCamera,
  HiCpuChip, HiComputerDesktop, HiBolt, HiPhoto,
  HiBuildingOffice2, HiDocumentText, HiXMark,
} from "react-icons/hi2";
import {
  getMapping, updateMapping, createMachine, updateMachine,
  deleteMachine, uploadPhoto, deletePhoto, rerunOcr,
  photoUrl,
  type Mapping, type MappingMachine, type MappingPhoto,
} from "../api/mappings";

// ─── Photo category config ────────────────────────────────────────────────────
const PHOTO_CATEGORIES = [
  { key: "machine" as const, label: "Overview",  Icon: HiBuildingOffice2, color: "bg-gray-100 text-gray-600",   printLabel: "Machine" },
  { key: "plc"     as const, label: "PLC",        Icon: HiCpuChip,         color: "bg-blue-100 text-blue-700",   printLabel: "PLC" },
  { key: "hmi"     as const, label: "HMI",        Icon: HiComputerDesktop, color: "bg-purple-100 text-purple-700", printLabel: "HMI" },
  { key: "vfd"     as const, label: "VFD",        Icon: HiBolt,            color: "bg-amber-100 text-amber-700", printLabel: "VFD" },
  { key: "other"   as const, label: "Other",      Icon: HiCamera,          color: "bg-gray-100 text-gray-500",   printLabel: "Other" },
];
type PhotoCategory = (typeof PHOTO_CATEGORIES)[number]["key"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseOcr(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

// ─── Field group ──────────────────────────────────────────────────────────────
function FieldGroup({
  title, Icon, fields, machine, onSave,
}: {
  title: string;
  Icon: React.ElementType;
  fields: { key: keyof MappingMachine; label: string; placeholder: string }[];
  machine: MappingMachine;
  onSave: (data: Partial<MappingMachine>) => Promise<void>;
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
          <span className="text-sm font-medium text-gray-700">{title}</span>
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingCategory = useRef<PhotoCategory>("other");
  const photos = machine.photos ?? [];

  function triggerUpload(category: PhotoCategory) {
    pendingCategory.current = category;
    if (fileInputRef.current) { fileInputRef.current.value = ""; fileInputRef.current.click(); }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const category = pendingCategory.current;
    setUploading(category);
    try {
      for (const file of Array.from(files)) {
        const photo = await uploadPhoto(machine.id, file, category, photos.length);
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

  const photosByCategory: Record<string, MappingPhoto[]> = {};
  for (const p of photos) {
    if (!photosByCategory[p.category]) photosByCategory[p.category] = [];
    photosByCategory[p.category].push(p);
  }

  return (
    <div className="space-y-3">
      <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment"
        className="hidden" onChange={handleFileChange} />

      {/* Category buttons */}
      <div className="grid grid-cols-5 gap-1.5">
        {PHOTO_CATEGORIES.map((cat) => {
          const count = (photosByCategory[cat.key] ?? []).length;
          const isUploading = uploading === cat.key;
          const CatIcon = cat.Icon;
          return (
            <button key={cat.key} onClick={() => triggerUpload(cat.key)} disabled={!!uploading}
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
      </div>

      {/* Thumbnails */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((photo) => {
            const cat = PHOTO_CATEGORIES.find((c) => c.key === photo.category);
            const ocrData = parseOcr(photo.ocr_raw);
            const hasOcr = Object.entries(ocrData).some(([k, v]) => k !== "raw" && v);
            const ocrError = !!ocrData.error;
            return (
              <div key={photo.id} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                <img src={photoUrl(photo.machine_id, photo.filename)} alt={photo.original_name}
                  className="w-full h-full object-cover cursor-pointer" onClick={() => setLightbox(photo)} />
                <div className={`absolute bottom-0 left-0 right-0 flex items-center gap-1 px-1.5 py-1 ${cat?.color ?? "bg-gray-100 text-gray-500"} bg-opacity-90`}>
                  {cat && <cat.Icon className="w-3 h-3 shrink-0" />}
                  <span className="text-[9px] font-medium truncate">{cat?.label}</span>
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
            machine={machine} onSave={saveFields} />
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
// This renders outside the no-print wrapper so @media print can reveal it
function PrintView({ mapping }: { mapping: Mapping }) {
  const machines = mapping.machines ?? [];

  return (
    <>
      {/* Global print styles */}
      <style>{`
        @media screen { .mapping-print-root { display: none; } }
        @media print {
          .mapping-print-root { display: block; }
          .mapping-screen-only { display: none !important; }
          body { margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #111; }
          .print-machine { border: 2px solid #16a34a; border-radius: 8px; padding: 14px; margin-bottom: 18px; page-break-inside: avoid; }
          .print-machine-title { font-size: 15px; font-weight: bold; color: #166534; border-bottom: 1px solid #bbf7d0; padding-bottom: 6px; margin-bottom: 10px; }
          .print-specs { display: flex; gap: 28px; flex-wrap: wrap; margin-bottom: 10px; }
          .print-spec-block { }
          .print-spec-type { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 2px; }
          .print-spec-value { font-weight: 700; font-size: 12px; }
          .print-spec-sub { color: #6b7280; font-size: 11px; }
          .print-notes { font-style: italic; color: #374151; margin-bottom: 10px; font-size: 11px; }
          .print-photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; }
          .print-photo { }
          .print-photo img { width: 100%; border-radius: 5px; border: 1px solid #e5e7eb; display: block; }
          .print-photo-label { font-size: 9px; color: #9ca3af; margin-top: 3px; }
          .print-header { margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb; }
          .print-title { font-size: 20px; font-weight: bold; color: #111827; }
          .print-subtitle { font-size: 12px; color: #6b7280; margin-top: 4px; }
          .print-summary { font-size: 11px; color: #9ca3af; margin-top: 2px; }
        }
      `}</style>

      <div className="mapping-print-root">
        <div className="print-header">
          <div className="print-title">{mapping.plant_name ?? "Plant"} — Equipment Mapping</div>
          <div className="print-subtitle">
            {mapping.name}
            {mapping.city && mapping.state ? ` · ${mapping.city}, ${mapping.state}` : ""}
          </div>
          <div className="print-summary">
            {machines.length} machine{machines.length !== 1 ? "s" : ""} ·
            {machines.reduce((s, m) => s + (m.photos ?? []).length, 0)} photos ·
            Printed {new Date().toLocaleDateString()}
          </div>
        </div>

        {machines.map((machine, idx) => (
          <div key={machine.id} className="print-machine">
            <div className="print-machine-title">{idx + 1}. {machine.name}</div>

            <div className="print-specs">
              {(machine.plc_make || machine.plc_model) && (
                <div className="print-spec-block">
                  <div className="print-spec-type">PLC</div>
                  <div className="print-spec-value">{[machine.plc_make, machine.plc_model].filter(Boolean).join(" ")}</div>
                  {machine.plc_series  && <div className="print-spec-sub">Series: {machine.plc_series}</div>}
                  {machine.plc_part_no && <div className="print-spec-sub">P/N: {machine.plc_part_no}</div>}
                </div>
              )}
              {(machine.hmi_make || machine.hmi_model) && (
                <div className="print-spec-block">
                  <div className="print-spec-type">HMI</div>
                  <div className="print-spec-value">{[machine.hmi_make, machine.hmi_model].filter(Boolean).join(" ")}</div>
                  {machine.hmi_part_no && <div className="print-spec-sub">P/N: {machine.hmi_part_no}</div>}
                </div>
              )}
              {(machine.vfd_make || machine.vfd_model) && (
                <div className="print-spec-block">
                  <div className="print-spec-type">VFD</div>
                  <div className="print-spec-value">{[machine.vfd_make, machine.vfd_model].filter(Boolean).join(" ")}</div>
                  {machine.vfd_hp      && <div className="print-spec-sub">{machine.vfd_hp}</div>}
                  {machine.vfd_voltage && <div className="print-spec-sub">{machine.vfd_voltage}</div>}
                </div>
              )}
            </div>

            {machine.notes && <div className="print-notes">{machine.notes}</div>}

            {(machine.photos ?? []).length > 0 && (
              <div className="print-photos">
                {(machine.photos ?? []).map((photo) => {
                  const cat = PHOTO_CATEGORIES.find((c) => c.key === photo.category);
                  return (
                    <div key={photo.id} className="print-photo">
                      <img
                        src={photoUrl(photo.machine_id, photo.filename)}
                        alt={photo.original_name}
                      />
                      <div className="print-photo-label">{cat?.printLabel ?? photo.category}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
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
            <button onClick={toggleStatus}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                isComplete
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200"
                  : "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100"
              }`}>
              {isComplete ? <HiCheckCircle className="w-4 h-4" /> : <HiClock className="w-4 h-4" />}
              {isComplete ? "Complete" : "In progress"}
            </button>
            <button onClick={() => window.print()}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-400" title="Print / Export PDF">
              <HiPrinter className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Machines */}
        {machines.length === 0 ? (
          <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
            <HiBuildingOffice2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">No machines yet</p>
            <p className="text-xs mt-1">Add your first machine to start mapping</p>
          </div>
        ) : (
          <div className="space-y-4">
            {machines.map((machine, idx) => (
              <MachineCard key={machine.id} machine={machine} index={idx}
                onUpdate={handleMachineUpdate} onDelete={() => handleDeleteMachine(machine.id)} />
            ))}
          </div>
        )}

        {/* Add machine */}
        {showAddMachine ? (
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
        ) : (
          <button onClick={() => setShowAddMachine(true)}
            className="w-full py-4 bg-white border-2 border-dashed border-gray-200 rounded-2xl text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/30 transition-all text-sm font-medium flex items-center justify-center gap-2">
            <HiPlus className="w-5 h-5" />
            Add machine
          </button>
        )}

        {/* Summary */}
        {machines.length > 0 && (
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

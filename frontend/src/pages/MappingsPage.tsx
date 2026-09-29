import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  HiPlus, HiMagnifyingGlass, HiTrash, HiChevronRight,
  HiMap, HiCheckCircle, HiClock, HiXMark, HiDocumentChartBar,
} from "react-icons/hi2";
import { listMappings, createMapping, deleteMapping, type Mapping } from "../api/mappings";
import EmptyState from "../components/EmptyState";

const STATUS_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  in_progress: { label: "In progress", color: "bg-amber-100 text-amber-800 border-amber-600", Icon: HiClock },
  complete:    { label: "Complete",    color: "bg-emerald-100 text-emerald-800 border-emerald-600", Icon: HiCheckCircle },
};

const INK  = "#00182e";
const HAIR = "rgba(0,24,46,0.3)";

// ─── Searchable plant picker ──────────────────────────────────────────────────
interface PlantOption { id: string; name: string | null; city: string | null; state: string | null }

function PlantPicker({
  plants,
  value,
  onChange,
}: {
  plants: PlantOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = plants.find((p) => p.id === value);

  const filtered = query.trim()
    ? plants.filter((p) => {
        const q = query.toLowerCase();
        return (
          (p.name ?? "").toLowerCase().includes(q) ||
          (p.city ?? "").toLowerCase().includes(q) ||
          (p.state ?? "").toLowerCase().includes(q)
        );
      }).slice(0, 30)
    : plants.slice(0, 30);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function select(plant: PlantOption) {
    onChange(plant.id);
    setQuery("");
    setOpen(false);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setQuery("");
  }

  return (
    <div ref={ref} className="relative">
      <div
        className="flex items-center border-2 border-brand-navy/25 px-3 py-2.5 bg-white cursor-text focus-within:border-brand-navy"
        onClick={() => { setOpen(true); }}
      >
        <HiMagnifyingGlass className="w-4 h-4 text-gray-400 shrink-0 mr-2" />
        {selected && !open ? (
          <span className="flex-1 text-sm text-gray-900 truncate">
            {selected.name ?? "Unknown"}
            {selected.city ? <span className="text-gray-400 ml-1">— {selected.city}, {selected.state}</span> : null}
          </span>
        ) : (
          <input
            autoFocus={open}
            type="text"
            placeholder={selected ? "Search to change…" : "Search plants by name, city, or state…"}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            className="flex-1 text-sm bg-transparent focus:outline-none placeholder-gray-400"
          />
        )}
        {(selected || query) && (
          <button onClick={clear} className="ml-1 p-0.5 rounded-full hover:bg-gray-100 text-gray-400">
            <HiXMark className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-brand-navy shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400">No plants match "{query}"</div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); select(p); }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 flex items-center justify-between ${
                  p.id === value ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-800"
                }`}
              >
                <span className="truncate">{p.name ?? "Unknown"}</span>
                {p.city && (
                  <span className="text-xs text-gray-400 ml-2 shrink-0">{p.city}, {p.state}</span>
                )}
              </button>
            ))
          )}
          {plants.length > 30 && !query.trim() && (
            <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
              Type to search all {plants.length} plants
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MappingsPage() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPlantId, setNewPlantId] = useState("");
  const [plants, setPlants] = useState<PlantOption[]>([]);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    load();
    fetch("/api/plants?limit=5000", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setPlants(Array.isArray(d) ? d : (d.plants ?? [])))
      .catch(console.error);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await listMappings();
      setMappings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newPlantId) { alert("Select a plant."); return; }
    setCreating(true);
    try {
      const m = await createMapping({ plant_id: newPlantId, name: newName.trim() || "New Mapping" });
      navigate(`/mappings/${m.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create mapping");
      setCreating(false);
    }
  }

  async function handleDelete(m: Mapping, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete mapping "${m.name}"? This will remove all machines and photos.`)) return;
    await deleteMapping(m.id);
    setMappings((prev) => prev.filter((x) => x.id !== m.id));
  }

  // ?plant_id= scopes the list to one plant (linked from the plant table)
  const plantScope = searchParams.get("plant_id");
  const scopedPlantName = plantScope
    ? mappings.find((m) => m.plant_id === plantScope)?.plant_name ?? "this plant"
    : null;

  const filtered = mappings.filter((m) => {
    if (plantScope && m.plant_id !== plantScope) return false;
    const q = search.toLowerCase();
    return (
      !q ||
      m.name.toLowerCase().includes(q) ||
      (m.plant_name ?? "").toLowerCase().includes(q) ||
      (m.city ?? "").toLowerCase().includes(q) ||
      (m.state ?? "").toLowerCase().includes(q)
    );
  });

  // Group by plant
  const grouped: Record<string, Mapping[]> = {};
  for (const m of filtered) {
    const key = m.plant_id;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  }

  return (
    <div className="space-y-4">
      {/* Drawing-register header */}
      <div className="flex flex-wrap items-stretch border-2 border-brand-navy bg-white">
        <div className="flex-1 min-w-0 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 shrink-0 bg-brand-lime border border-brand-navy" />
            <h1 className="font-mono text-lg sm:text-xl font-bold text-brand-navy uppercase tracking-wide">
              Mappings
            </h1>
          </div>
          <p className="font-mono text-[10px] text-brand-navy/40 mt-1 uppercase tracking-[0.14em]">
            Equipment drawing register · Plant visit documentation
          </p>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-3 bg-brand-navy text-brand-lime font-mono text-[11px] font-bold uppercase tracking-wider hover:bg-brand-navy-700 border-t-2 sm:border-t-0 sm:border-l-2 border-brand-navy w-full sm:w-auto justify-center"
        >
          {showNew ? <HiXMark className="w-4 h-4" /> : <HiPlus className="w-4 h-4" />}
          {showNew ? "Cancel" : "New mapping"}
        </button>
      </div>

      {/* Plant scope chip — set when arriving from a plant's Mappings button */}
      {plantScope && (
        <div className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-brand-navy">
          <span className="font-mono text-[10px] font-bold text-brand-navy/50 uppercase tracking-wider">
            Filtered to plant
          </span>
          <span className="font-mono text-[11px] font-bold text-brand-navy truncate">{scopedPlantName}</span>
          <button
            onClick={() => {
              searchParams.delete("plant_id");
              setSearchParams(searchParams, { replace: true });
            }}
            className="ml-auto flex items-center gap-1 font-mono text-[10px] font-bold text-brand-navy/60 hover:text-brand-navy uppercase tracking-wider"
          >
            <HiXMark className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      )}

      {/* New mapping form */}
      {showNew && (
        <form onSubmit={handleCreate} className="bg-white border-2 border-brand-navy p-4 space-y-4">
          <h2 className="font-mono text-[11px] font-bold text-brand-navy uppercase tracking-[0.16em]">New mapping</h2>

          <div>
            <label className="block font-mono text-[10px] font-bold text-brand-navy/50 uppercase tracking-wider mb-1.5">Plant</label>
            <PlantPicker plants={plants} value={newPlantId} onChange={setNewPlantId} />
          </div>

          <div>
            <label className="block font-mono text-[10px] font-bold text-brand-navy/50 uppercase tracking-wider mb-1.5">
              Mapping name <span className="font-normal opacity-60">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Line 1-3 + Utilities"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border-2 border-brand-navy/25 px-3 py-2.5 font-mono text-sm focus:outline-none focus:border-brand-navy"
            />
          </div>

          <button
            type="submit"
            disabled={creating || !newPlantId}
            className="w-full py-2.5 bg-brand-navy text-brand-lime font-mono text-[11px] font-bold uppercase tracking-wider hover:bg-brand-navy-700 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create & open editor"}
          </button>
        </form>
      )}

      {/* Search */}
      <div className="relative">
        <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-navy/30" />
        <input
          type="text"
          placeholder="Search mappings or plants…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border-2 border-brand-navy/20 bg-white font-mono text-sm focus:outline-none focus:border-brand-navy"
        />
      </div>

      {/* List — drawing-register style */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          Icon={HiMap}
          title={search ? "No mappings match your search" : "No mappings yet"}
          hint={search ? "Try a different search term." : "Create a mapping to document a plant's equipment."}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([plantId, items]) => {
            const plantName = items[0].plant_name ?? plantId;
            return (
            <div key={plantId} className="bg-white"
              style={{ border: `2px solid ${INK}`, boxShadow: "4px 4px 0 rgba(0,24,46,0.12)" }}>
              {/* Plant header — register title bar */}
              <div className="flex items-center gap-2.5 px-3 sm:px-4 py-2"
                style={{ borderBottom: `2px solid ${INK}` }}>
                <span className="w-2.5 h-2.5 shrink-0 bg-brand-lime" style={{ border: `1.5px solid ${INK}` }} />
                <h2 className="font-black text-xs uppercase tracking-[0.18em] flex-1 min-w-0 truncate" style={{ color: INK }}>
                  {plantName}
                </h2>
                <span className="font-mono text-[10px] font-bold shrink-0" style={{ color: INK, opacity: 0.45 }}>
                  {items.length} mapping{items.length !== 1 ? "s" : ""}
                </span>
                {items.length >= 2 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/mappings/plant/${plantId}`);
                    }}
                    className="flex items-center gap-1 shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-1 border hover:bg-brand-lime"
                    style={{ color: INK, borderColor: INK }}
                    title="Consolidated drawing, register, and deck for every line at this plant"
                  >
                    <HiDocumentChartBar className="w-3.5 h-3.5" />
                    Plant report
                  </button>
                )}
              </div>

              {items.map((m, i) => {
                const meta = STATUS_META[m.status] ?? STATUS_META.in_progress;
                return (
                  <div
                    key={m.id}
                    onClick={() => navigate(`/mappings/${m.id}`)}
                    className="group flex items-center gap-3 px-3 sm:px-4 py-2.5 cursor-pointer hover:bg-[#f7f8f4] transition-colors"
                    style={{ borderTop: i > 0 ? `1px solid ${HAIR}` : undefined }}
                  >
                    {/* Register index number */}
                    <span className="font-mono text-[11px] font-bold tabular-nums shrink-0 w-7" style={{ color: INK, opacity: 0.45 }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm truncate" style={{ color: INK }}>{m.name}</span>
                        <span className={`inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border ${meta.color}`}>
                          <meta.Icon className="w-3 h-3" />
                          {meta.label}
                        </span>
                      </div>
                      <p className="font-mono text-[10px] mt-0.5 truncate" style={{ color: INK, opacity: 0.45 }}>
                        {m.city && m.state ? `${m.city}, ${m.state} · ` : ""}
                        {new Date(m.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleDelete(m, e)}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Delete mapping"
                      >
                        <HiTrash className="w-4 h-4" />
                      </button>
                      <HiChevronRight className="w-4 h-4" style={{ color: INK, opacity: 0.3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

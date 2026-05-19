import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  HiPlus, HiMagnifyingGlass, HiTrash, HiChevronRight,
  HiMap, HiCheckCircle, HiClock, HiXMark,
} from "react-icons/hi2";
import { listMappings, createMapping, deleteMapping, type Mapping } from "../api/mappings";

const STATUS_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  in_progress: { label: "In progress", color: "bg-yellow-100 text-yellow-700", Icon: HiClock },
  complete:    { label: "Complete",    color: "bg-emerald-100 text-emerald-700", Icon: HiCheckCircle },
};

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
        className="flex items-center border border-gray-300 rounded-xl px-3 py-2.5 bg-white cursor-text focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-400"
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
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
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

  const filtered = mappings.filter((m) => {
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
    const key = m.plant_name ?? m.plant_id;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Mappings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Equipment maps collected during plant visits</p>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium"
        >
          {showNew ? <HiXMark className="w-4 h-4" /> : <HiPlus className="w-4 h-4" />}
          {showNew ? "Cancel" : "New mapping"}
        </button>
      </div>

      {/* New mapping form */}
      {showNew && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700">New mapping</h2>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Plant</label>
            <PlantPicker plants={plants} value={newPlantId} onChange={setNewPlantId} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Mapping name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Line 1-3 + Utilities"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <button
            type="submit"
            disabled={creating || !newPlantId}
            className="w-full py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {creating ? "Creating…" : "Create & open editor"}
          </button>
        </form>
      )}

      {/* Search */}
      <div className="relative">
        <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search mappings or plants…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          {search ? "No mappings match your search." : "No mappings yet. Create one to get started."}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([plantName, items]) => (
            <div key={plantName}>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">
                {plantName}
              </h2>
              <div className="space-y-2">
                {items.map((m) => {
                  const meta = STATUS_META[m.status] ?? STATUS_META.in_progress;
                  return (
                    <div
                      key={m.id}
                      onClick={() => navigate(`/mappings/${m.id}`)}
                      className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                        <HiMap className="w-5 h-5 text-blue-500" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 text-sm">{m.name}</span>
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>
                            <meta.Icon className="w-3 h-3" />
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {m.city && m.state ? `${m.city}, ${m.state} · ` : ""}
                          {new Date(m.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => handleDelete(m, e)}
                          className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete mapping"
                        >
                          <HiTrash className="w-4 h-4" />
                        </button>
                        <HiChevronRight className="w-4 h-4 text-gray-300" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

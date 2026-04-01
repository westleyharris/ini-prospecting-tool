import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import PlantMap from "../components/PlantMap";
import RoutePanel from "../components/RoutePanel";
import { fetchPlants, type Plant } from "../api/plants";

export default function MapPage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "contacted" | "not_contacted">("all");
  const [search, setSearch] = useState("");
  const [focusedPlantId, setFocusedPlantId] = useState<string | null>(null);
  const [dropdownClosed, setDropdownClosed] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const [dropdownRect, setDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const [hideNonIcp, setHideNonIcp] = useState(true);

  // Route state
  const [routeMode, setRouteMode] = useState(false);
  const [routePlantIds, setRoutePlantIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchPlants({ limit: 2000 })
      .then((data) => {
        if (!cancelled) setPlants(data);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const showContactedOnly = filter === "contacted";
  const showNotContactedOnly = filter === "not_contacted";

  const filteredForSearch = useMemo(() => {
    if (filter === "contacted") return plants.filter((p) => p.contacted === 1);
    if (filter === "not_contacted") return plants.filter((p) => p.contacted === 0);
    return plants;
  }, [plants, filter]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return filteredForSearch.filter((p) => (p.name ?? "").toLowerCase().includes(q)).slice(0, 10);
  }, [filteredForSearch, search]);

  const showDropdown = !dropdownClosed && !!(search.trim() && searchResults.length > 0);

  useEffect(() => {
    if (!showDropdown) { setDropdownRect(null); return; }
    const el = searchWrapperRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setDropdownRect({ top: r.bottom, left: r.left, width: r.width });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [showDropdown, search, searchResults]);

  // Route handlers
  const handleToggleRouteMode = () => {
    setRouteMode((prev) => {
      if (prev) setRoutePlantIds([]); // clear route when turning off
      return !prev;
    });
  };

  const handleRouteToggle = (plantId: string) => {
    setRoutePlantIds((prev) =>
      prev.includes(plantId) ? prev.filter((id) => id !== plantId) : [...prev, plantId]
    );
  };

  const handleMoveUp = (plantId: string) => {
    setRoutePlantIds((prev) => {
      const i = prev.indexOf(plantId);
      if (i <= 0) return prev;
      const next = [...prev];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
  };

  const handleMoveDown = (plantId: string) => {
    setRoutePlantIds((prev) => {
      const i = prev.indexOf(plantId);
      if (i < 0 || i === prev.length - 1) return prev;
      const next = [...prev];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      return next;
    });
  };

  const routePlants = useMemo(
    () => routePlantIds.map((id) => plants.find((p) => p.id === id)).filter(Boolean) as Plant[],
    [routePlantIds, plants]
  );

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between relative z-20">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Plant Map</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-start sm:items-center">
          {/* Search */}
          <div ref={searchWrapperRef} className="relative w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setDropdownClosed(false);
                if (!e.target.value) setFocusedPlantId(null);
              }}
              placeholder="Search plants by name"
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 min-w-0"
            />
            {dropdownRect != null &&
              createPortal(
                <div
                  className="fixed z-[9999] rounded-lg border border-gray-200 bg-white shadow-lg max-h-64 overflow-auto"
                  style={{ top: dropdownRect.top + 4, left: dropdownRect.left, width: dropdownRect.width }}
                >
                  {searchResults.map((plant) => (
                    <button
                      key={plant.id}
                      type="button"
                      onClick={() => {
                        setFocusedPlantId(plant.id);
                        setSearch(plant.name ?? "");
                        setDropdownClosed(true);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50"
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">{plant.name ?? "Unknown plant"}</p>
                      {(plant.formatted_address ?? plant.short_formatted_address) && (
                        <p className="text-xs text-gray-500 truncate">
                          {plant.formatted_address ?? plant.short_formatted_address}
                        </p>
                      )}
                    </button>
                  ))}
                </div>,
                document.body
              )}
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Filter:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | "contacted" | "not_contacted")}
              className="rounded-md border-gray-300 shadow-sm text-sm"
            >
              <option value="all">All plants</option>
              <option value="contacted">Contacted only</option>
              <option value="not_contacted">Not contacted only</option>
            </select>
          </div>

          {/* ICP toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!hideNonIcp}
              onChange={(e) => setHideNonIcp(!e.target.checked)}
              className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="text-sm text-gray-600">Show non-ICP</span>
          </label>

          {/* Route mode toggle */}
          <button
            type="button"
            onClick={handleToggleRouteMode}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              routeMode
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            {routeMode ? "Exit Route Mode" : "Plan Route"}
            {routeMode && routePlantIds.length > 0 && (
              <span className="ml-1 bg-white/20 text-white text-xs rounded-full px-1.5 py-px font-bold">
                {routePlantIds.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Route mode hint */}
      {routeMode && (
        <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          Route mode active — open any plant popup and click <strong>Add to Route</strong> to build your route.
        </p>
      )}

      {/* Map + route panel */}
      {loading ? (
        <div className="h-[50vh] sm:h-[600px] bg-gray-100 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">Loading map...</p>
        </div>
      ) : (
        <div className="lg:flex lg:flex-row lg:gap-4 lg:items-start space-y-4 lg:space-y-0">
          <div className="w-full lg:flex-1 lg:min-w-0">
            <PlantMap
              plants={plants}
              showContactedOnly={showContactedOnly}
              showNotContactedOnly={showNotContactedOnly}
              hideNonIcp={hideNonIcp}
              focusedPlantId={focusedPlantId}
              routeMode={routeMode}
              routePlantIds={routePlantIds}
              onRouteToggle={handleRouteToggle}
            />
          </div>
          {routeMode && (
            <RoutePanel
              routePlants={routePlants}
              onRemove={handleRouteToggle}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onClear={() => setRoutePlantIds([])}
            />
          )}
        </div>
      )}
    </div>
  );
}

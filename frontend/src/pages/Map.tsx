import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import PlantMap from "../components/PlantMap";
import { fetchPlants, type Plant } from "../api/plants";

export default function MapPage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "contacted" | "not_contacted">(
    "all"
  );
  const [search, setSearch] = useState("");
  const [focusedPlantId, setFocusedPlantId] = useState<string | null>(null);
  const [dropdownClosed, setDropdownClosed] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const [dropdownRect, setDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

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
    return () => {
      cancelled = true;
    };
  }, []);

  const showContactedOnly = filter === "contacted";
  const showNotContactedOnly = filter === "not_contacted";

  const filteredForSearch = useMemo(() => {
    if (filter === "contacted") {
      return plants.filter((p) => p.contacted === 1);
    }
    if (filter === "not_contacted") {
      return plants.filter((p) => p.contacted === 0);
    }
    return plants;
  }, [plants, filter]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return filteredForSearch
      .filter((p) => (p.name ?? "").toLowerCase().includes(q))
      .slice(0, 10);
  }, [filteredForSearch, search]);

  const showDropdown =
    !dropdownClosed && !!(search.trim() && searchResults.length > 0);

  useEffect(() => {
    if (!showDropdown) {
      setDropdownRect(null);
      return;
    }
    const el = searchWrapperRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setDropdownRect({ top: r.bottom, left: r.left, width: r.width });
    };
    update();
    const onScrollOrResize = () => update();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [showDropdown, search, searchResults]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between relative z-20">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
          Plant Map
        </h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div ref={searchWrapperRef} className="relative w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setDropdownClosed(false);
                if (!e.target.value) {
                  setFocusedPlantId(null);
                }
              }}
              placeholder="Search plants by name"
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 min-w-0"
            />
            {dropdownRect != null &&
              createPortal(
                <div
                  className="fixed z-[9999] rounded-lg border border-gray-200 bg-white shadow-lg max-h-64 overflow-auto"
                  style={{
                    top: dropdownRect.top + 4,
                    left: dropdownRect.left,
                    width: dropdownRect.width,
                  }}
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
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {plant.name ?? "Unknown plant"}
                      </p>
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
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Filter:</span>
            <select
              value={filter}
              onChange={(e) =>
                setFilter(e.target.value as "all" | "contacted" | "not_contacted")
              }
              className="rounded-md border-gray-300 shadow-sm text-sm"
            >
              <option value="all">All plants</option>
              <option value="contacted">Contacted only</option>
              <option value="not_contacted">Not contacted only</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-[600px] bg-gray-100 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">Loading map...</p>
        </div>
      ) : (
        <PlantMap
          plants={plants}
          showContactedOnly={showContactedOnly}
          showNotContactedOnly={showNotContactedOnly}
          focusedPlantId={focusedPlantId}
        />
      )}
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import MetricsCards from "../components/MetricsCards";
import PlantTable from "../components/PlantTable";
import AddPlantModal from "../components/AddPlantModal";
import {
  fetchPlants,
  fetchMetrics,
  runPipeline,
  type Plant,
  type Metrics,
} from "../api/plants";
import { getDisplayType } from "../utils/plant";

function filterPlants(
  plants: Plant[],
  search: string,
  locationFilter: string,
  contactedFilter: "all" | "yes" | "no",
  customerFilter: "all" | "yes" | "no",
  relevanceFilter: string
): Plant[] {
  let result = plants;

  if (locationFilter.trim()) {
    const loc = locationFilter.trim().toLowerCase();
    result = result.filter((p) => {
      const city = (p.city ?? "").toLowerCase();
      const state = (p.state ?? "").toLowerCase();
      const postalCode = (p.postal_code ?? "").toLowerCase();
      const fullAddr = (p.formatted_address ?? "").toLowerCase();
      const shortAddr = (p.short_formatted_address ?? "").toLowerCase();
      return (
        city.includes(loc) ||
        state.includes(loc) ||
        postalCode.includes(loc) ||
        fullAddr.includes(loc) ||
        shortAddr.includes(loc)
      );
    });
  }

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    result = result.filter((p) => {
      const name = (p.name ?? "").toLowerCase();
      const address = (p.formatted_address ?? "").toLowerCase();
      const shortAddr = (p.short_formatted_address ?? "").toLowerCase();
      const phone = (p.phone ?? "").toLowerCase();
      const notes = (p.notes ?? "").toLowerCase();
      const displayType = getDisplayType(p) || "";
      const type = displayType.toLowerCase();
      const summary = (p.editorial_summary ?? p.generative_summary ?? "").toLowerCase();
      const city = (p.city ?? "").toLowerCase();
      const state = (p.state ?? "").toLowerCase();
      const postalCode = (p.postal_code ?? "").toLowerCase();
      const relevance = (p.manufacturing_relevance ?? "").toLowerCase();
      const reason = (p.manufacturing_reason ?? "").toLowerCase();
      const typesJson = p.types ?? "";
      return (
        name.includes(q) ||
        address.includes(q) ||
        shortAddr.includes(q) ||
        phone.includes(q) ||
        notes.includes(q) ||
        type.includes(q) ||
        summary.includes(q) ||
        city.includes(q) ||
        state.includes(q) ||
        postalCode.includes(q) ||
        relevance.includes(q) ||
        reason.includes(q) ||
        typesJson.toLowerCase().includes(q)
      );
    });
  }

  if (contactedFilter === "yes") {
    result = result.filter((p) => p.contacted === 1);
  } else if (contactedFilter === "no") {
    result = result.filter((p) => p.contacted === 0);
  }

  if (customerFilter === "yes") {
    result = result.filter((p) => p.current_customer === 1);
  } else if (customerFilter === "no") {
    result = result.filter((p) => p.current_customer === 0);
  }

  if (relevanceFilter !== "all") {
    result = result.filter((p) => (p.manufacturing_relevance ?? "") === relevanceFilter);
  }

  return result;
}

export default function Dashboard() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [contactedFilter, setContactedFilter] = useState<"all" | "yes" | "no">("all");
  const [customerFilter, setCustomerFilter] = useState<"all" | "yes" | "no">("all");
  const [relevanceFilter, setRelevanceFilter] = useState("all");
  const [showAddPlant, setShowAddPlant] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const filteredPlants = useMemo(
    () => filterPlants(plants, search, locationFilter, contactedFilter, customerFilter, relevanceFilter),
    [plants, search, locationFilter, contactedFilter, customerFilter, relevanceFilter]
  );

  const totalFiltered = filteredPlants.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedPlants = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredPlants.slice(start, start + pageSize);
  }, [filteredPlants, safePage, pageSize]);
  const startItem = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalFiltered);
  const allFilteredIds = useMemo(() => filteredPlants.map((p) => p.id), [filteredPlants]);

  const load = async () => {
    setLoading(true);
    try {
      const [plantsData, metricsData] = await Promise.all([
        fetchPlants({ limit: 50000 }),
        fetchMetrics(),
      ]);
      setPlants(plantsData);
      setMetrics(metricsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, locationFilter, contactedFilter, customerFilter, relevanceFilter]);

  const handleRunPipeline = async () => {
    setPipelineRunning(true);
    setPipelineError(null);
    try {
      const result = await runPipeline(location || undefined);
      alert(
        `Pipeline complete. Added: ${result.added}, Updated: ${result.updated}, Total: ${result.total}`
      );
      await load();
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : "Pipeline failed");
    } finally {
      setPipelineRunning(false);
    }
  };

  const hasActiveFilters = search || locationFilter || contactedFilter !== "all" || customerFilter !== "all" || relevanceFilter !== "all";

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
        <div className="flex flex-col gap-2 w-full sm:flex-row sm:w-auto">
          <button
            onClick={() => setShowAddPlant(true)}
            className="inline-flex items-center justify-center px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm w-full sm:w-auto"
          >
            Add plant
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm w-full sm:w-auto min-w-0">
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Zip or city (optional)"
              className="flex-1 min-w-0 text-sm border-0 p-0 focus:ring-0 focus:outline-none"
            />
            <span className="text-gray-300 shrink-0 hidden sm:inline">|</span>
            <button
              onClick={handleRunPipeline}
              disabled={pipelineRunning}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {pipelineRunning ? "Running..." : "Run pipeline"}
            </button>
          </div>
        </div>
      </div>

      {pipelineError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {pipelineError}
        </div>
      )}

      <section aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2 sm:mb-3">
          Overview
        </h2>
        <MetricsCards metrics={metrics} loading={loading} />
      </section>

      {/* Plants section */}
      <section className="min-w-0">
        <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-2 sm:mb-3">Plants</h2>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-w-0">
          {/* Search and filters bar */}
          <div className="p-3 sm:p-5 border-b border-gray-100 bg-gray-50/50">
            <div className="flex flex-col gap-4">
              {/* Search row */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex-1 min-w-0">
                  <label htmlFor="search" className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                    Search plants
                  </label>
                  <input
                    id="search"
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name, address, phone, type..."
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 min-w-0"
                  />
                </div>
                <div className="w-full sm:w-52 min-w-0">
                  <label htmlFor="location-filter" className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                    Location
                  </label>
                  <input
                    id="location-filter"
                    type="text"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    placeholder="City, state, or zip"
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 min-w-0"
                  />
                </div>
              </div>
              {/* Filter row */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-3">
                <div className="min-w-0">
                  <label htmlFor="contacted-filter" className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                    Contacted
                  </label>
                  <select
                    id="contacted-filter"
                    value={contactedFilter}
                    onChange={(e) => setContactedFilter(e.target.value as "all" | "yes" | "no")}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 min-w-0 sm:min-w-[100px]"
                  >
                    <option value="all">All</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label htmlFor="customer-filter" className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                    Customer
                  </label>
                  <select
                    id="customer-filter"
                    value={customerFilter}
                    onChange={(e) => setCustomerFilter(e.target.value as "all" | "yes" | "no")}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 min-w-0 sm:min-w-[100px]"
                  >
                    <option value="all">All</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div className="min-w-0 col-span-2 sm:col-span-1">
                  <label htmlFor="relevance-filter" className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                    Relevance
                  </label>
                  <select
                    id="relevance-filter"
                    value={relevanceFilter}
                    onChange={(e) => setRelevanceFilter(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 min-w-0 sm:min-w-[100px]"
                  >
                    <option value="all">All</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setLocationFilter("");
                      setContactedFilter("all");
                      setCustomerFilter("all");
                      setRelevanceFilter("all");
                    }}
                    className="px-3 py-2 text-sm font-medium text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-lg col-span-2 sm:col-span-1"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Pagination bar (header) */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 px-3 sm:px-4 py-3 border-b border-gray-100 bg-white">
            <p className="text-xs sm:text-sm text-gray-500 order-2 sm:order-1">
              {totalFiltered === 0
                ? "No plants match filters"
                : `Showing ${startItem}–${endItem} of ${totalFiltered}`}
              {plants.length !== totalFiltered && totalFiltered > 0 && (
                <span className="text-gray-400 hidden sm:inline"> (filtered from {plants.length})</span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 order-1 sm:order-2">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-gray-500">Rows</span>
                <select
                  aria-label="Rows per page"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-2 sm:py-1.5 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 min-h-[36px] sm:min-h-0"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="px-3 py-2 sm:py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px] sm:min-h-0"
                  >
                    Previous
                  </button>
                  <span className="px-2 sm:px-3 py-2 sm:py-1.5 text-xs sm:text-sm text-gray-600 min-w-[60px] sm:min-w-[80px] text-center">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="px-3 py-2 sm:py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px] sm:min-h-0"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>

          <PlantTable
            plants={paginatedPlants}
            loading={loading}
            onUpdate={load}
            embedded
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            allFilteredIds={allFilteredIds}
            totalFilteredCount={totalFiltered}
          />

          {/* Pagination bar (footer) */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 px-3 sm:px-4 py-3 border-t border-gray-100 bg-white">
            <p className="text-xs sm:text-sm text-gray-500 order-2 sm:order-1">
              {totalFiltered === 0
                ? "No plants match filters"
                : `Showing ${startItem}–${endItem} of ${totalFiltered}`}
              {plants.length !== totalFiltered && totalFiltered > 0 && (
                <span className="text-gray-400 hidden sm:inline"> (filtered from {plants.length})</span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 order-1 sm:order-2">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-gray-500">Rows</span>
                <select
                  aria-label="Rows per page (footer)"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-2 sm:py-1.5 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 min-h-[36px] sm:min-h-0"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="px-3 py-2 sm:py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px] sm:min-h-0"
                  >
                    Previous
                  </button>
                  <span className="px-2 sm:px-3 py-2 sm:py-1.5 text-xs sm:text-sm text-gray-600 min-w-[60px] sm:min-w-[80px] text-center">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="px-3 py-2 sm:py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px] sm:min-h-0"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {showAddPlant && (
        <AddPlantModal
          onClose={() => setShowAddPlant(false)}
          onAdded={load}
        />
      )}
    </div>
  );
}

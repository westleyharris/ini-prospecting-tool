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
  statusFilter: string,
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

  if (statusFilter !== "all") {
    result = result.filter((p) => (p.business_status ?? "") === statusFilter);
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [relevanceFilter, setRelevanceFilter] = useState("all");
  const [showAddPlant, setShowAddPlant] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredPlants = useMemo(
    () => filterPlants(plants, search, locationFilter, contactedFilter, customerFilter, statusFilter, relevanceFilter),
    [plants, search, locationFilter, contactedFilter, customerFilter, statusFilter, relevanceFilter]
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
  }, [search, locationFilter, contactedFilter, customerFilter, statusFilter, relevanceFilter]);

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

  const hasActiveFilters = search || locationFilter || contactedFilter !== "all" || customerFilter !== "all" || statusFilter !== "all" || relevanceFilter !== "all";

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowAddPlant(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
          >
            Add plant
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Zip or city (optional)"
              className="w-40 text-sm border-0 p-0 focus:ring-0 focus:outline-none"
            />
            <span className="text-gray-300">|</span>
            <button
              onClick={handleRunPipeline}
              disabled={pipelineRunning}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

      <MetricsCards metrics={metrics} loading={loading} />

      {/* Plants section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Plants</h2>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Search and filters bar */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="flex-1 min-w-0">
                  <input
                    id="search"
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search plants by name, address, phone, type..."
                    className="block w-full rounded-lg border-gray-300 shadow-sm text-sm placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="location-filter"
                    type="text"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    placeholder="City, state, zip"
                    className="w-32 rounded-lg border-gray-300 shadow-sm text-sm placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <select
                    id="contacted-filter"
                    value={contactedFilter}
                    onChange={(e) => setContactedFilter(e.target.value as "all" | "yes" | "no")}
                    className="rounded-lg border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="all">Contacted: All</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                  <select
                    id="customer-filter"
                    value={customerFilter}
                    onChange={(e) => setCustomerFilter(e.target.value as "all" | "yes" | "no")}
                    className="rounded-lg border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="all">Customer: All</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                  <select
                    id="status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-lg border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="all">Status: All</option>
                    <option value="OPERATIONAL">Operational</option>
                    <option value="CLOSED_TEMPORARILY">Closed temporarily</option>
                    <option value="CLOSED_PERMANENTLY">Closed permanently</option>
                  </select>
                  <select
                    id="relevance-filter"
                    value={relevanceFilter}
                    onChange={(e) => setRelevanceFilter(e.target.value)}
                    className="rounded-lg border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="all">Relevance: All</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setLocationFilter("");
                        setContactedFilter("all");
                        setCustomerFilter("all");
                        setStatusFilter("all");
                        setRelevanceFilter("all");
                      }}
                      className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              {/* Pagination bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  {totalFiltered === 0
                    ? "No plants match filters"
                    : `Showing ${startItem}–${endItem} of ${totalFiltered}`}
                  {plants.length !== totalFiltered && totalFiltered > 0 && (
                    <span className="text-gray-400"> (filtered from {plants.length})</span>
                  )}
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Rows</span>
                    <select
                      id="page-size"
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="rounded-lg border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500 py-1.5"
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
                        className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1.5 text-sm text-gray-600 min-w-[80px] text-center">
                        {safePage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage >= totalPages}
                        className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <PlantTable plants={paginatedPlants} loading={loading} onUpdate={load} embedded />
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

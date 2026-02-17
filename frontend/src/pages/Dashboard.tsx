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
  contactedFilter: "all" | "yes" | "no",
  customerFilter: "all" | "yes" | "no",
  statusFilter: string,
  relevanceFilter: string
): Plant[] {
  let result = plants;

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
  const [contactedFilter, setContactedFilter] = useState<"all" | "yes" | "no">("all");
  const [customerFilter, setCustomerFilter] = useState<"all" | "yes" | "no">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [relevanceFilter, setRelevanceFilter] = useState("all");
  const [showAddPlant, setShowAddPlant] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredPlants = useMemo(
    () => filterPlants(plants, search, contactedFilter, customerFilter, statusFilter, relevanceFilter),
    [plants, search, contactedFilter, customerFilter, statusFilter, relevanceFilter]
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
        fetchPlants({ limit: 500 }),
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
  }, [search, contactedFilter, customerFilter, statusFilter, relevanceFilter]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
              Search area (zip or city)
            </label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. 75001 or Dallas, TX (blank = DFW)"
              className="block w-full sm:w-56 rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowAddPlant(true)}
            className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 whitespace-nowrap"
          >
            Add plant
          </button>
          <button
            onClick={handleRunPipeline}
            disabled={pipelineRunning}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {pipelineRunning ? "Running pipeline..." : "Run pipeline"}
          </button>
        </div>
      </div>

      {pipelineError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {pipelineError}
        </div>
      )}

      <MetricsCards metrics={metrics} loading={loading} />

      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex-1 min-w-0">
            <label htmlFor="search" className="sr-only">
              Search plants
            </label>
            <input
              id="search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, address, phone, type, notes..."
              className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-wrap gap-3 sm:items-center">
            <div className="flex items-center gap-2">
              <label htmlFor="contacted-filter" className="text-sm text-gray-600 whitespace-nowrap">
                Contacted
              </label>
              <select
                id="contacted-filter"
                value={contactedFilter}
                onChange={(e) => setContactedFilter(e.target.value as "all" | "yes" | "no")}
                className="rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="customer-filter" className="text-sm text-gray-600 whitespace-nowrap">
                Customer
              </label>
              <select
                id="customer-filter"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value as "all" | "yes" | "no")}
                className="rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="status-filter" className="text-sm text-gray-600 whitespace-nowrap">
                Status
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="OPERATIONAL">Operational</option>
                <option value="CLOSED_TEMPORARILY">Closed temporarily</option>
                <option value="CLOSED_PERMANENTLY">Closed permanently</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="relevance-filter" className="text-sm text-gray-600 whitespace-nowrap">
                Relevance
              </label>
              <select
                id="relevance-filter"
                value={relevanceFilter}
                onChange={(e) => setRelevanceFilter(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            {(search || contactedFilter !== "all" || customerFilter !== "all" || statusFilter !== "all" || relevanceFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setContactedFilter("all");
                  setCustomerFilter("all");
                  setStatusFilter("all");
                  setRelevanceFilter("all");
                }}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-sm text-gray-500">
            {totalFiltered === 0
              ? "No plants match filters"
              : `Showing ${startItem}-${endItem} of ${totalFiltered} plants`}
            {plants.length !== totalFiltered && totalFiltered > 0 && (
              <span className="ml-1"> (filtered from {plants.length})</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="page-size" className="text-sm text-gray-600">
              Rows per page
            </label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
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
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      <PlantTable plants={paginatedPlants} loading={loading} onUpdate={load} />

      {showAddPlant && (
        <AddPlantModal
          onClose={() => setShowAddPlant(false)}
          onAdded={load}
        />
      )}
    </div>
  );
}

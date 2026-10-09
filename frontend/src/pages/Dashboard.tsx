import { useState, useEffect, useMemo } from "react";
import { HiPlus, HiMagnifyingGlass, HiXMark } from "react-icons/hi2";
import PageHeader from "../components/PageHeader";
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
  relevanceFilter: string,
  followUpFilter: "all" | "due" | "none",
  icpFilter: "all" | "icp" | "not_icp"
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

  if (icpFilter === "icp") {
    result = result.filter((p) => !p.not_icp);
  } else if (icpFilter === "not_icp") {
    result = result.filter((p) => p.not_icp === 1);
  }

  if (followUpFilter !== "all") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const msPerDay = 24 * 60 * 60 * 1000;
    result = result.filter((p) => {
      const raw = p.follow_up_date;
      if (!raw) {
        return followUpFilter === "none";
      }
      if (followUpFilter === "none") return false;
      const d = new Date(`${raw}T00:00:00`);
      if (isNaN(d.getTime())) return false;
      const diffDays = Math.round((d.getTime() - today.getTime()) / msPerDay);
      return diffDays <= 7;
    });
  }

  return result;
}

const fieldClass =
  "block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-brand-navy-600 focus:ring-1 focus:ring-brand-navy-600 min-w-0";
const labelClass = "block text-xs font-medium text-gray-500 mb-1";

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
  const [followUpFilter, setFollowUpFilter] = useState<"all" | "due" | "none">("all");
  const [icpFilter, setIcpFilter] = useState<"all" | "icp" | "not_icp">("all");
  const [showAddPlant, setShowAddPlant] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const filteredPlants = useMemo(
    () =>
      filterPlants(
        plants,
        search,
        locationFilter,
        contactedFilter,
        customerFilter,
        relevanceFilter,
        followUpFilter,
        icpFilter
      ),
    [plants, search, locationFilter, contactedFilter, customerFilter, relevanceFilter, followUpFilter, icpFilter]
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
  }, [search, locationFilter, contactedFilter, customerFilter, relevanceFilter, followUpFilter, icpFilter]);

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

  const hasActiveFilters =
    search ||
    locationFilter ||
    contactedFilter !== "all" ||
    customerFilter !== "all" ||
    relevanceFilter !== "all" ||
    followUpFilter !== "all" ||
    icpFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setLocationFilter("");
    setContactedFilter("all");
    setCustomerFilter("all");
    setRelevanceFilter("all");
    setFollowUpFilter("all");
    setIcpFilter("all");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        subtitle="Plants, pipeline, and field activity."
        actions={
          <button
            type="button"
            onClick={() => setShowAddPlant(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-brand-navy text-white text-sm font-medium hover:bg-brand-navy-700 shadow-sm"
          >
            <HiPlus className="w-4 h-4" />
            Add plant
          </button>
        }
      />

      <MetricsCards metrics={metrics} loading={loading} />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="min-w-0 sm:mr-auto">
          <p className="text-sm font-semibold text-gray-900">Find plants</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Run the prospecting pipeline for a zip code or city.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Zip or city (optional)"
            className={`${fieldClass} sm:w-56`}
          />
          <button
            type="button"
            onClick={handleRunPipeline}
            disabled={pipelineRunning}
            className="shrink-0 px-4 py-2 rounded-lg bg-brand-navy text-white text-sm font-medium hover:bg-brand-navy-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pipelineRunning ? "Running…" : "Run pipeline"}
          </button>
        </div>
      </div>

      {pipelineError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {pipelineError}
        </div>
      )}

      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-w-0">
        <div className="px-4 sm:px-5 py-4 border-b border-gray-100">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <h2 className="text-base font-semibold text-gray-900">Plants</h2>
            <p className="text-sm text-gray-500">
              {loading
                ? "Loading…"
                : totalFiltered === 0
                  ? "No plants match"
                  : `${startItem}–${endItem} of ${totalFiltered.toLocaleString()}`}
              {!loading && plants.length !== totalFiltered && totalFiltered > 0
                ? ` · ${plants.length.toLocaleString()} total`
                : ""}
            </p>
          </div>

          <div className="relative mb-3">
            <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              id="search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, address, phone, type…"
              className={`${fieldClass} pl-9`}
            />
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-3">
            <div className="col-span-2 sm:col-span-1 sm:w-44 min-w-0">
              <label htmlFor="location-filter" className={labelClass}>Location</label>
              <input
                id="location-filter"
                type="text"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder="City, state, or zip"
                className={fieldClass}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="contacted-filter" className={labelClass}>Contacted</label>
              <select
                id="contacted-filter"
                value={contactedFilter}
                onChange={(e) => setContactedFilter(e.target.value as "all" | "yes" | "no")}
                className={`${fieldClass} sm:min-w-[7.5rem]`}
              >
                <option value="all">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="customer-filter" className={labelClass}>Customer</label>
              <select
                id="customer-filter"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value as "all" | "yes" | "no")}
                className={`${fieldClass} sm:min-w-[7.5rem]`}
              >
                <option value="all">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="relevance-filter" className={labelClass}>Relevance</label>
              <select
                id="relevance-filter"
                value={relevanceFilter}
                onChange={(e) => setRelevanceFilter(e.target.value)}
                className={`${fieldClass} sm:min-w-[7.5rem]`}
              >
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="followup-filter" className={labelClass}>Follow-ups</label>
              <select
                id="followup-filter"
                value={followUpFilter}
                onChange={(e) => setFollowUpFilter(e.target.value as "all" | "due" | "none")}
                className={`${fieldClass} sm:min-w-[8.5rem]`}
              >
                <option value="all">All</option>
                <option value="due">Due & overdue</option>
                <option value="none">No follow-up</option>
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="icp-filter" className={labelClass}>ICP</label>
              <select
                id="icp-filter"
                value={icpFilter}
                onChange={(e) => setIcpFilter(e.target.value as "all" | "icp" | "not_icp")}
                className={`${fieldClass} sm:min-w-[8.5rem]`}
              >
                <option value="all">All</option>
                <option value="icp">ICP only</option>
                <option value="not_icp">Non-ICP only</option>
              </select>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg col-span-2 sm:col-span-1"
              >
                <HiXMark className="w-4 h-4" />
                Clear
              </button>
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-5 py-3 border-t border-gray-100 bg-gray-50/60">
          <p className="text-sm text-gray-500">
            {totalFiltered === 0
              ? "No plants match filters"
              : `Showing ${startItem}–${endItem} of ${totalFiltered.toLocaleString()}`}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Rows</span>
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-brand-navy-600 focus:ring-1 focus:ring-brand-navy-600"
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
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-2 text-sm text-gray-600 tabular-nums">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
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

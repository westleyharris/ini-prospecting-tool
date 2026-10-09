import type { Metrics } from "../api/plants";

interface MetricsCardsProps {
  metrics: Metrics | null;
  loading: boolean;
}

const CARDS: { key: string; label: string; get: (m: Metrics) => number }[] = [
  { key: "total", label: "Plants", get: (m) => m.total },
  { key: "contacted", label: "Contacted", get: (m) => m.contacted },
  { key: "customers", label: "Customers", get: (m) => m.currentCustomers ?? 0 },
  { key: "followups", label: "Follow-ups", get: (m) => m.pendingFollowUps },
  { key: "new", label: "New this week", get: (m) => m.newThisWeek },
  { key: "visits", label: "Visits", get: (m) => m.totalVisits ?? 0 },
  { key: "mappings", label: "Mappings", get: (m) => m.totalMappings ?? 0 },
  { key: "projects", label: "Projects", get: (m) => m.totalProjects ?? 0 },
  { key: "comms", label: "Comms", get: (m) => m.totalCommissionings ?? 0 },
];

export default function MetricsCards({ metrics, loading }: MetricsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-9 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-16 mb-3" />
            <div className="h-7 bg-gray-200 rounded w-10" />
          </div>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-9 gap-3">
      {CARDS.map(({ key, label, get }) => (
        <div key={key} className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3.5 min-w-0">
          <p className="text-xs font-medium text-gray-500 truncate">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-brand-navy tracking-tight">
            {get(metrics).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}

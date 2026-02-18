import type { Metrics } from "../api/plants";

interface MetricsCardsProps {
  metrics: Metrics | null;
  loading: boolean;
}

export default function MetricsCards({ metrics, loading }: MetricsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse flex flex-col items-center">
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const cards: { label: string; value: number; color: string }[] = [
    { label: "Total Plants", value: metrics.total, color: "text-blue-600" },
    { label: "Contacted", value: metrics.contacted, color: "text-green-600" },
    {
      label: "Current Customers",
      value: metrics.currentCustomers ?? 0,
      color: "text-emerald-600",
    },
    {
      label: "Pending Follow-ups",
      value: metrics.pendingFollowUps,
      color: "text-amber-600",
    },
    { label: "New This Week", value: metrics.newThisWeek, color: "text-purple-600" },
    { label: "Visits", value: metrics.totalVisits ?? 0, color: "text-sky-600" },
    { label: "Projects", value: metrics.totalProjects ?? 0, color: "text-indigo-600" },
    { label: "Commissionings", value: metrics.totalCommissionings ?? 0, color: "text-teal-600" },
  ];

  const coreCards = cards.slice(0, 5);
  const crmCards = cards.slice(5, 8);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {coreCards.map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-center">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
            <p className={`mt-1.5 text-2xl font-bold tabular-nums ${color}`}>{value.toLocaleString()}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 text-center">CRM</p>
        <div className="grid grid-cols-3 gap-3">
          {crmCards.map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
              <p className={`mt-1 text-xl font-bold tabular-nums ${color}`}>{value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

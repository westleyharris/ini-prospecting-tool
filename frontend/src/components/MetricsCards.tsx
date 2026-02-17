import type { Metrics } from "../api/plants";

interface MetricsCardsProps {
  metrics: Metrics | null;
  loading: boolean;
}

export default function MetricsCards({ metrics, loading }: MetricsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow p-6 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
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

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      {cards.map(({ label, value, color }) => (
        <div key={label} className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className={`mt-2 text-2xl font-semibold ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

import { useState, useEffect } from "react";
import { fetchVisits, getVisitFileUrl, type Visit } from "../api/visits";
import { fetchPlants, type Plant } from "../api/plants";

export default function ReportsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [plantFilter, setPlantFilter] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const [visitsData, plantsData] = await Promise.all([
        fetchVisits(plantFilter || undefined),
        fetchPlants({ limit: 1000 }),
      ]);
      setVisits(visitsData);
      setPlants(plantsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [plantFilter]);

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString();
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
      <p className="text-gray-600">
        All visits with uploaded Word documents. Add visits from the Dashboard via plant → Visits.
      </p>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label htmlFor="plant-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Filter by plant
          </label>
          <select
            id="plant-filter"
            value={plantFilter}
            onChange={(e) => setPlantFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500 min-w-[200px]"
          >
            <option value="">All plants</option>
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name ?? p.short_formatted_address ?? p.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-full mb-4" />
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        ) : visits.length === 0 ? (
          <p className="p-8 text-gray-500 text-center">No visits yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Visit date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Files
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {visits.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {v.plant_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(v.visit_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                      {v.notes ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {v.files && v.files.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {v.files.map((f) => (
                            <a
                              key={f.id}
                              href={getVisitFileUrl(v.id, f.filename)}
                              download={f.original_name}
                              className="text-sm text-blue-600 hover:underline"
                            >
                              {f.original_name}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

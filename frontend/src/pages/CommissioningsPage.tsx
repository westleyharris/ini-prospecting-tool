import { useState, useEffect } from "react";
import { fetchCommissionings, type Commissioning } from "../api/commissionings";
import { fetchPlants, type Plant } from "../api/plants";

export default function CommissioningsPage() {
  const [commissionings, setCommissionings] = useState<Commissioning[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [plantFilter, setPlantFilter] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const [commissioningsData, plantsData] = await Promise.all([
        fetchCommissionings(plantFilter || undefined),
        fetchPlants({ limit: 1000 }),
      ]);
      setCommissionings(commissioningsData);
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
      <h1 className="text-2xl font-bold text-gray-900">Commissionings</h1>
      <p className="text-gray-600">
        Projects converted to commissionings after PO received (COMM numbers).
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
        ) : commissionings.length === 0 ? (
          <p className="p-8 text-gray-500 text-center">No commissionings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    COMM #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PR #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {commissionings.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {c.comm_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {c.pr_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {c.plant_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(c.created_at)}
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

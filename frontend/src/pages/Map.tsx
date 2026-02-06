import { useState, useEffect } from "react";
import PlantMap from "../components/PlantMap";
import { fetchPlants, type Plant } from "../api/plants";

export default function MapPage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "contacted" | "not_contacted">(
    "all"
  );

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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Plant Map</h1>
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

      {loading ? (
        <div className="h-[600px] bg-gray-100 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">Loading map...</p>
        </div>
      ) : (
        <PlantMap
          plants={plants}
          showContactedOnly={showContactedOnly}
          showNotContactedOnly={showNotContactedOnly}
        />
      )}
    </div>
  );
}

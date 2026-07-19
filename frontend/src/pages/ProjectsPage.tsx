import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchProjects, type Project } from "../api/projects";
import { fetchPlants, type Plant } from "../api/plants";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { HiBriefcase } from "react-icons/hi2";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [plantFilter, setPlantFilter] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const [projectsData, plantsData] = await Promise.all([
        fetchProjects(plantFilter || undefined),
        fetchPlants({ limit: 1000 }),
      ]);
      setProjects(projectsData);
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

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800",
    sent: "bg-blue-100 text-blue-800",
    won: "bg-green-100 text-green-800",
    lost: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        subtitle="Quotations with PR numbers. Create projects from the Dashboard via plant → Projects."
      />

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label htmlFor="plant-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Filter by plant
          </label>
          <select
            id="plant-filter"
            value={plantFilter}
            onChange={(e) => setPlantFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm text-sm focus:border-brand-lime focus:ring-brand-lime min-w-[200px]"
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
        ) : projects.length === 0 ? (
          <EmptyState
            Icon={HiBriefcase}
            title="No projects yet"
            hint="Create a project from the Dashboard via a plant's Projects button."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PR #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {p.pr_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {p.plant_name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                          statusColors[p.status] ?? "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                      {p.notes ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/projects/${p.id}`}
                        className="text-brand-navy-600 hover:underline text-sm"
                      >
                        Open
                      </Link>
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

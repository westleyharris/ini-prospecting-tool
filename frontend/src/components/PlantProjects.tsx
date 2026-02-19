import { useState, useEffect } from "react";
import type { Plant } from "../api/plants";
import { fetchProjects, createProject, type Project } from "../api/projects";
import ProjectDetail from "./ProjectDetail";

interface PlantProjectsProps {
  plant: Plant;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function PlantProjects({ plant, onClose, onUpdate }: PlantProjectsProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [sourceVisitId, setSourceVisitId] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchProjects(plant.id);
      setProjects(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [plant.id]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const created = await createProject({
        plant_id: plant.id,
        source_visit_id: sourceVisitId.trim() || undefined,
        status: "draft",
        notes: notes.trim() || undefined,
      });
      setProjects((prev) => [created, ...prev]);
      setSelectedProject(created);
      setSourceVisitId("");
      setNotes("");
      onUpdate?.();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Projects — {plant.name ?? "Plant"}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">Create a new project or open an existing one below.</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
          </div>
          <div className="px-6 py-4 border-b border-gray-200">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Create project</p>
            <form onSubmit={handleCreateProject} className="space-y-2">
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Link to visit (optional)</label>
                  <input
                    type="text"
                    placeholder="Visit ID"
                    value={sourceVisitId}
                    onChange={(e) => setSourceVisitId(e.target.value)}
                    className="block w-40 rounded border-gray-300 text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-xs text-gray-500 mb-0.5">Notes</label>
                  <input
                    type="text"
                    placeholder="Project notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="block w-full rounded border-gray-300 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create project"}
                </button>
              </div>
            </form>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <p className="text-gray-500">Loading projects...</p>
            ) : projects.length === 0 ? (
              <p className="text-gray-500">No projects yet. Create a project to get a PR number.</p>
            ) : (
              <ul className="space-y-2">
                {projects.map((proj) => (
                  <li key={proj.id}>
                    <button
                      onClick={() => setSelectedProject(proj)}
                      className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 flex justify-between items-center"
                    >
                      <span className="font-medium text-gray-900">{proj.pr_number}</span>
                      <span className="text-sm text-gray-500">{proj.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      {selectedProject && (
        <ProjectDetail
          project={selectedProject}
          plantName={plant.name ?? undefined}
          onClose={() => setSelectedProject(null)}
          onUpdate={() => {
            load();
            onUpdate?.();
          }}
        />
      )}
    </>
  );
}

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchProject, type Project } from "../api/projects";
import ProjectDetail from "../components/ProjectDetail";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("Invalid project");
      setLoading(false);
      return;
    }
    fetchProject(id)
      .then(setProject)
      .catch(() => setError("Project not found"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleClose = () => navigate("/projects");
  const handleUpdate = () => {
    if (id) fetchProject(id).then(setProject);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }
  if (error || !project) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">{error ?? "Project not found"}</p>
        <button
          onClick={() => navigate("/projects")}
          className="text-blue-600 hover:underline"
        >
          Back to projects
        </button>
      </div>
    );
  }

  return (
    <ProjectDetail
      project={project}
      plantName={project.plant_name ?? undefined}
      onClose={handleClose}
      onUpdate={handleUpdate}
    />
  );
}

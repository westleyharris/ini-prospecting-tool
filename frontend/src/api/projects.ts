export interface ProjectFile {
  id: string;
  project_id: string;
  filename: string;
  original_name: string;
  file_type: string;
  created_at: string;
}

export interface Project {
  id: string;
  plant_id: string;
  pr_number: string;
  status: string;
  source_visit_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  plant_name?: string;
  files?: ProjectFile[];
}

export async function fetchProjects(plantId?: string): Promise<Project[]> {
  const url = plantId ? `/api/projects?plant_id=${encodeURIComponent(plantId)}` : "/api/projects";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json();
}

export async function fetchProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`);
  if (!res.ok) throw new Error("Failed to fetch project");
  return res.json();
}

export async function createProject(data: {
  plant_id: string;
  source_visit_id?: string;
  status?: string;
  notes?: string;
}): Promise<Project> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create project");
  }
  return res.json();
}

export async function updateProject(
  id: string,
  data: { status?: string; notes?: string }
): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update project");
  return res.json();
}

export async function uploadProjectFile(
  projectId: string,
  file: File,
  fileType?: string
): Promise<ProjectFile> {
  const form = new FormData();
  form.set("file", file);
  if (fileType) form.set("file_type", fileType);

  const res = await fetch(`/api/projects/${projectId}/files`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to upload file");
  }
  return res.json();
}

export function getProjectFileUrl(projectId: string, filename: string): string {
  return `/api/projects/${projectId}/files/${encodeURIComponent(filename)}`;
}

export async function convertToCommissioning(projectId: string): Promise<{ comm_number: string }> {
  const res = await fetch(`/api/projects/${projectId}/convert-to-commissioning`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create commissioning");
  }
  return res.json();
}

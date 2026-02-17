export interface VisitFile {
  id: string;
  visit_id: string;
  filename: string;
  original_name: string;
  content_type: string | null;
  created_at: string;
}

export interface Visit {
  id: string;
  plant_id: string;
  visit_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  plant_name?: string;
  files?: VisitFile[];
}

export async function fetchVisits(plantId?: string): Promise<Visit[]> {
  const url = plantId ? `/api/visits?plant_id=${encodeURIComponent(plantId)}` : "/api/visits";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch visits");
  return res.json();
}

export async function fetchVisit(id: string): Promise<Visit & { files: VisitFile[] }> {
  const res = await fetch(`/api/visits/${id}`);
  if (!res.ok) throw new Error("Failed to fetch visit");
  return res.json();
}

export async function createVisit(data: {
  plant_id: string;
  visit_date: string;
  notes?: string;
  file?: File;
}): Promise<Visit & { files: VisitFile[] }> {
  const form = new FormData();
  form.set("plant_id", data.plant_id);
  form.set("visit_date", data.visit_date);
  if (data.notes) form.set("notes", data.notes);
  if (data.file) form.set("file", data.file);

  const res = await fetch("/api/visits", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create visit");
  }
  return res.json();
}

export function getVisitFileUrl(visitId: string, filename: string): string {
  return `/api/visits/${visitId}/files/${encodeURIComponent(filename)}`;
}

export async function deleteVisit(id: string): Promise<void> {
  const res = await fetch(`/api/visits/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete visit");
}

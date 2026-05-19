const BASE = "/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MappingPhoto {
  id: string;
  machine_id: string;
  category: "plc" | "hmi" | "vfd" | "machine" | "other";
  filename: string;
  original_name: string;
  ocr_raw: string | null;
  sort_order: number;
  created_at: string;
}

export interface MappingMachine {
  id: string;
  mapping_id: string;
  name: string;
  sort_order: number;
  plc_make: string | null;
  plc_model: string | null;
  plc_series: string | null;
  plc_part_no: string | null;
  hmi_make: string | null;
  hmi_model: string | null;
  hmi_part_no: string | null;
  vfd_make: string | null;
  vfd_model: string | null;
  vfd_hp: string | null;
  vfd_voltage: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  photos?: MappingPhoto[];
}

export interface Mapping {
  id: string;
  plant_id: string;
  name: string;
  status: "in_progress" | "complete";
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  plant_name?: string;
  city?: string;
  state?: string;
  formatted_address?: string;
  machines?: MappingMachine[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? res.statusText);
  }
  return res.json();
}

// ─── Mappings ─────────────────────────────────────────────────────────────────

export function listMappings(plant_id?: string): Promise<Mapping[]> {
  const qs = plant_id ? `?plant_id=${encodeURIComponent(plant_id)}` : "";
  return apiFetch(`${BASE}/mappings${qs}`);
}

export function getMapping(id: string): Promise<Mapping> {
  return apiFetch(`${BASE}/mappings/${id}`);
}

export function createMapping(data: { plant_id: string; name?: string; notes?: string }): Promise<Mapping> {
  return apiFetch(`${BASE}/mappings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function updateMapping(id: string, data: Partial<Pick<Mapping, "name" | "status" | "notes">>): Promise<Mapping> {
  return apiFetch(`${BASE}/mappings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function deleteMapping(id: string): Promise<{ ok: boolean }> {
  return apiFetch(`${BASE}/mappings/${id}`, { method: "DELETE" });
}

// ─── Machines ─────────────────────────────────────────────────────────────────

export function createMachine(
  mappingId: string,
  data: Partial<Omit<MappingMachine, "id" | "mapping_id" | "created_at" | "updated_at" | "photos">>
): Promise<MappingMachine> {
  return apiFetch(`${BASE}/mappings/${mappingId}/machines`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function updateMachine(
  machineId: string,
  data: Partial<Omit<MappingMachine, "id" | "mapping_id" | "created_at" | "updated_at" | "photos">>
): Promise<MappingMachine> {
  return apiFetch(`${BASE}/mappings/machines/${machineId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function deleteMachine(machineId: string): Promise<{ ok: boolean }> {
  return apiFetch(`${BASE}/mappings/machines/${machineId}`, { method: "DELETE" });
}

// ─── Photos ───────────────────────────────────────────────────────────────────

export function uploadPhoto(
  machineId: string,
  file: File,
  category: MappingPhoto["category"],
  sortOrder?: number
): Promise<MappingPhoto> {
  const form = new FormData();
  form.append("photo", file);
  form.append("category", category);
  if (sortOrder !== undefined) form.append("sort_order", String(sortOrder));
  return apiFetch(`${BASE}/mappings/machines/${machineId}/photos`, {
    method: "POST",
    body: form,
  });
}

export function deletePhoto(photoId: string): Promise<{ ok: boolean }> {
  return apiFetch(`${BASE}/mappings/photos/${photoId}`, { method: "DELETE" });
}

export function rerunOcr(photoId: string): Promise<MappingPhoto> {
  return apiFetch(`${BASE}/mappings/photos/${photoId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rerun_ocr: true }),
  });
}

/** Resolve a mapping photo filename → full URL served via /uploads */
export function photoUrl(machineId: string, filename: string): string {
  return `/uploads/mappings/${machineId}/${filename}`;
}

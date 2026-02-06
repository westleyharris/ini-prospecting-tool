export interface Plant {
  id: string;
  place_id: string;
  name: string | null;
  formatted_address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  business_status: string | null;
  google_maps_uri: string | null;
  primary_type: string | null;
  types: string | null;
  rating: number | null;
  user_rating_count: number | null;
  plus_code: string | null;
  primary_type_display_name: string | null;
  short_formatted_address: string | null;
  price_level: string | null;
  regular_opening_hours: string | null;
  photo_name: string | null;
  editorial_summary: string | null;
  generative_summary: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  manufacturing_relevance: string | null;
  manufacturing_reason: string | null;
  distance_miles: number | null;
  data_source: string;
  contacted: number;
  current_customer: number;
  follow_up_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Metrics {
  total: number;
  contacted: number;
  currentCustomers: number;
  pendingFollowUps: number;
  newThisWeek: number;
}

export async function fetchPlants(params?: {
  contacted?: boolean;
  limit?: number;
  offset?: number;
}): Promise<Plant[]> {
  const search = new URLSearchParams();
  if (params?.contacted !== undefined) {
    search.set("contacted", params.contacted ? "true" : "false");
  }
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  const qs = search.toString();
  const res = await fetch(`/api/plants${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch plants");
  return res.json();
}

export async function fetchMetrics(): Promise<Metrics> {
  const res = await fetch("/api/plants/metrics");
  if (!res.ok) throw new Error("Failed to fetch metrics");
  return res.json();
}

export async function updatePlant(
  id: string,
  updates: {
    contacted?: boolean;
    current_customer?: boolean;
    follow_up_date?: string | null;
    notes?: string | null;
  }
): Promise<Plant> {
  const res = await fetch(`/api/plants/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update plant");
  return res.json();
}

export async function deletePlant(id: string): Promise<void> {
  const res = await fetch(`/api/plants/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete plant");
}

export async function deletePlantsBulk(ids: string[]): Promise<{ deleted: number }> {
  const res = await fetch("/api/plants/bulk", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to delete plants");
  }
  return res.json();
}

export async function cleanupNonManufacturing(): Promise<{
  deleted: number;
  ids: string[];
}> {
  const res = await fetch("/api/plants/cleanup-non-manufacturing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to cleanup non-manufacturing plants");
  return res.json();
}

export async function runPipeline(location?: string): Promise<{
  added: number;
  updated: number;
  total: number;
}> {
  const res = await fetch("/api/pipeline/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location: location?.trim() || undefined }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Pipeline run failed");
  }
  return res.json();
}

export interface Commissioning {
  id: string;
  project_id: string;
  comm_number: string;
  created_at: string;
  pr_number?: string;
  plant_id?: string;
  plant_name?: string;
  project_status?: string;
}

export async function fetchCommissionings(plantId?: string): Promise<Commissioning[]> {
  const url = plantId
    ? `/api/commissionings?plant_id=${encodeURIComponent(plantId)}`
    : "/api/commissionings";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch commissionings");
  return res.json();
}

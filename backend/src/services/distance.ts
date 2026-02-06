const REFERENCE_ADDRESS = "Forney TX, 75126";

let cachedRef: { lat: number; lng: number } | null = null;

/**
 * Get reference coordinates for "Distance from me". Cached after first geocode.
 */
export async function getReferenceCoords(
  apiKey: string
): Promise<{ lat: number; lng: number } | null> {
  if (cachedRef) return cachedRef;
  try {
    const { geocodeToLatLng } = await import("./geocoding.js");
    cachedRef = await geocodeToLatLng(apiKey, REFERENCE_ADDRESS);
    return cachedRef;
  } catch {
    return null;
  }
}

/**
 * Haversine formula: distance in miles between two lat/lng points.
 */
export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

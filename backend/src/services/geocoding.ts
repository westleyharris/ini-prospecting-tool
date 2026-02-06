export interface Viewport {
  rectangle: {
    low: { latitude: number; longitude: number };
    high: { latitude: number; longitude: number };
  };
}

interface GeocodeResult {
  results?: Array<{
    geometry?: {
      viewport?: {
        southwest: { lat: number; lng: number };
        northeast: { lat: number; lng: number };
      };
      bounds?: {
        southwest: { lat: number; lng: number };
        northeast: { lat: number; lng: number };
      };
      location?: { lat: number; lng: number };
    };
  }>;
  status: string;
}

/**
 * Geocode a zip code or city name to lat/lng bounds for Places API search.
 * Uses Google Geocoding API (same key as Places).
 */
export async function geocodeToViewport(
  apiKey: string,
  location: string
): Promise<Viewport> {
  // Append USA for zip codes to disambiguate (e.g. 75001 vs Paris 75001)
  const address =
    /^\d{5}(-\d{4})?$/.test(location.trim()) ? `${location}, USA` : `${location}, USA`;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding API error ${res.status}`);

  const data = (await res.json()) as GeocodeResult;

  if (data.status !== "OK" || !data.results?.length) {
    throw new Error(`Could not geocode "${location}". Try a zip code (e.g. 75001) or city (e.g. Dallas, TX).`);
  }

  const geometry = data.results[0].geometry;
  if (!geometry) throw new Error(`No geometry for "${location}"`);

  const viewport = geometry.viewport ?? geometry.bounds;
  if (!viewport) {
    // Fallback: use location point with ~15 mile radius
    const loc = geometry.location;
    if (!loc) throw new Error(`No bounds for "${location}"`);
    const delta = 0.15; // ~15 miles
    return {
      rectangle: {
        low: { latitude: loc.lat - delta, longitude: loc.lng - delta },
        high: { latitude: loc.lat + delta, longitude: loc.lng + delta },
      },
    };
  }

  return {
    rectangle: {
      low: {
        latitude: viewport.southwest.lat,
        longitude: viewport.southwest.lng,
      },
      high: {
        latitude: viewport.northeast.lat,
        longitude: viewport.northeast.lng,
      },
    },
  };
}

/**
 * Geocode an address to lat/lng. Returns center point.
 */
export async function geocodeToLatLng(
  apiKey: string,
  address: string
): Promise<{ lat: number; lng: number }> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding API error ${res.status}`);

  const data = (await res.json()) as GeocodeResult;

  if (data.status !== "OK" || !data.results?.length) {
    throw new Error(`Could not geocode "${address}".`);
  }

  const loc = data.results[0].geometry?.location;
  if (!loc) throw new Error(`No location for "${address}"`);

  return { lat: loc.lat, lng: loc.lng };
}

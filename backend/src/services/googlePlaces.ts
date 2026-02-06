const PLACES_API_BASE = "https://places.googleapis.com/v1";

export interface PlaceResult {
  id?: string;
  name?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  businessStatus?: string;
  googleMapsUri?: string;
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  plusCode?: { globalCode?: string; compoundCode?: string };
  priceLevel?: string;
  photos?: Array<{ name?: string }>;
  editorialSummary?: { text?: string };
  generativeSummary?: {
    overview?: { text?: string; languageCode?: string };
    disclaimerText?: { text?: string };
  };
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
  regularOpeningHours?: {
    openNow?: boolean;
    periods?: Array<{
      open?: { day?: number; hour?: number; minute?: number };
      close?: { day?: number; hour?: number; minute?: number };
    }>;
    weekdayDescriptions?: string[];
  };
}

export interface SearchTextResponse {
  places?: PlaceResult[];
  nextPageToken?: string;
}

export async function searchText(
  apiKey: string,
  textQuery: string,
  options?: {
    pageToken?: string;
    locationRestriction?: {
      rectangle: {
        low: { latitude: number; longitude: number };
        high: { latitude: number; longitude: number };
      };
    };
  }
): Promise<SearchTextResponse> {
  const url = `${PLACES_API_BASE}/places:searchText`;
  const body: Record<string, unknown> = {
    textQuery,
    pageSize: 20,
    ...(options?.pageToken && { pageToken: options.pageToken }),
    ...(options?.locationRestriction && {
      locationRestriction: options.locationRestriction,
    }),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress,places.location,places.addressComponents,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.businessStatus,places.googleMapsUri,places.primaryType,places.primaryTypeDisplayName,places.types,places.rating,places.userRatingCount,places.plusCode,places.priceLevel,places.photos,places.editorialSummary,places.generativeSummary,places.regularOpeningHours,places.viewport,nextPageToken",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Places API error ${res.status}: ${err}`);
  }

  return res.json() as Promise<SearchTextResponse>;
}

/** Fetch Place Details for a single place (e.g. to get generativeSummary when missing). */
export async function getPlaceDetails(
  apiKey: string,
  placeId: string,
  fields?: string[]
): Promise<PlaceResult> {
  const fieldMask =
    fields?.join(",") ??
    "id,displayName,primaryType,primaryTypeDisplayName,types,editorialSummary,generativeSummary";
  const url = `${PLACES_API_BASE}/places/${placeId}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Place Details error ${res.status}: ${err}`);
  }
  return res.json() as Promise<PlaceResult>;
}

export const DFW_VIEWPORT = {
  rectangle: {
    low: { latitude: 32.45, longitude: -97.55 },
    high: { latitude: 33.35, longitude: -96.55 },
  },
};

/** Integratec-focused search queries: industrial facilities with automation/instrumentation needs.
 * Targets bottling, beverage, process industries, textile, paper, and related manufacturing. */
export const MANUFACTURING_QUERIES = [
  "brewery",
  "bottling plant",
  "beverage manufacturer",
  "food processing plant",
  "dairy plant",
  "textile mill",
  "paper mill",
  "chemical plant",
  "pharmaceutical manufacturing",
  "water treatment plant",
  "packaging facility",
  "distillery",
  "winery",
  "cold storage",
  "plastics manufacturer",
  "meat processing plant",
  "poultry plant",
  "cannery",
  "flour mill",
  "sugar refinery",
  "oil refinery",
  "steel mill",
  "foundry",
  "cement plant",
  "glass manufacturer",
  "rubber manufacturer",
  "fertilizer plant",
  "printing plant",
  "corrugated box manufacturer",
  "injection molding",
  "metal fabrication",
  "industrial facility",
];

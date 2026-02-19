import { v4 as uuidv4 } from "uuid";
import {
  searchText,
  getPlaceDetails,
  DFW_VIEWPORT,
  MANUFACTURING_QUERIES,
  type PlaceResult,
} from "./googlePlaces.js";
import { geocodeToViewport } from "./geocoding.js";
import { isExcludedAsNonManufacturing } from "./manufacturingFilter.js";
import { interpretPlacesInBatches, type PlaceForInterpretation } from "./llmInterpretation.js";
import { db } from "../db.js";

export interface IngestionOptions {
  /** Zip code (e.g. 75001) or city (e.g. Dallas, TX). Default: DFW area */
  location?: string;
}

export async function runIngestion(
  apiKey: string,
  options?: IngestionOptions
): Promise<{
  added: number;
  updated: number;
  total: number;
}> {
  let added = 0;
  let updated = 0;
  const seenPlaceIds = new Set<string>();

  let viewport = DFW_VIEWPORT;
  if (options?.location?.trim()) {
    viewport = await geocodeToViewport(apiKey, options.location.trim());
  }

  const upsertStmt = db.prepare(`
    INSERT INTO plants (id, place_id, name, formatted_address, lat, lng, phone, website, business_status, google_maps_uri, primary_type, types, rating, user_rating_count, plus_code, primary_type_display_name, short_formatted_address, price_level, regular_opening_hours, photo_name, editorial_summary, generative_summary, city, state, postal_code, manufacturing_relevance, manufacturing_reason, data_source, contacted, follow_up_date, notes, created_at, updated_at)
    VALUES (@id, @place_id, @name, @formatted_address, @lat, @lng, @phone, @website, @business_status, @google_maps_uri, @primary_type, @types, @rating, @user_rating_count, @plus_code, @primary_type_display_name, @short_formatted_address, @price_level, @regular_opening_hours, @photo_name, @editorial_summary, @generative_summary, @city, @state, @postal_code, @manufacturing_relevance, @manufacturing_reason, @data_source, 0, NULL, NULL, datetime('now'), datetime('now'))
    ON CONFLICT(place_id) DO UPDATE SET
      name = excluded.name,
      formatted_address = excluded.formatted_address,
      lat = excluded.lat,
      lng = excluded.lng,
      phone = excluded.phone,
      website = excluded.website,
      business_status = excluded.business_status,
      google_maps_uri = excluded.google_maps_uri,
      primary_type = excluded.primary_type,
      types = excluded.types,
      rating = excluded.rating,
      user_rating_count = excluded.user_rating_count,
      plus_code = excluded.plus_code,
      primary_type_display_name = excluded.primary_type_display_name,
      short_formatted_address = excluded.short_formatted_address,
      price_level = excluded.price_level,
      regular_opening_hours = excluded.regular_opening_hours,
      photo_name = excluded.photo_name,
      editorial_summary = excluded.editorial_summary,
      generative_summary = excluded.generative_summary,
      city = excluded.city,
      state = excluded.state,
      postal_code = excluded.postal_code,
      manufacturing_relevance = excluded.manufacturing_relevance,
      manufacturing_reason = excluded.manufacturing_reason,
      updated_at = datetime('now')
  `);

  const openaiKey = (process.env.OPENAI_API_KEY ?? "").trim();

  for (const query of MANUFACTURING_QUERIES) {
    let pageToken: string | undefined;

    do {
      const result = await searchText(apiKey, query, {
        locationRestriction: viewport,
        pageToken,
      });

      let places = (result.places ?? []).filter((p) => !isExcludedAsNonManufacturing(p));

      for (const place of places) {
        const needsSummary = !place.generativeSummary?.overview?.text && !place.editorialSummary?.text;
        const needsTypes = !place.primaryType && (!place.types?.length || onlyGenericTypes(place.types));
        if (needsSummary || needsTypes) {
          const placeId = place.id ?? place.name?.replace("places/", "");
          if (placeId) {
            try {
              const details = await getPlaceDetails(apiKey, placeId);
              if (details.generativeSummary?.overview?.text) {
                place.generativeSummary = details.generativeSummary;
              }
              if (details.editorialSummary?.text && !place.editorialSummary?.text) {
                place.editorialSummary = details.editorialSummary;
              }
              if (needsTypes) {
                if (details.primaryType && !place.primaryType) {
                  place.primaryType = details.primaryType;
                  place.primaryTypeDisplayName = details.primaryTypeDisplayName ?? place.primaryTypeDisplayName;
                }
                if (details.types?.length && (!place.types?.length || onlyGenericTypes(place.types))) {
                  place.types = details.types;
                }
              }
            } catch {
              /* ignore - keep place without enrichment */
            }
            await new Promise((r) => setTimeout(r, 150));
          }
        }
      }

      // Re-filter after enrichment: details may have added excluded types (e.g. building_materials_store)
      places = places.filter((p) => !isExcludedAsNonManufacturing(p));

      const rows: NonNullable<ReturnType<typeof placeToRow>>[] = [];
      for (const place of places) {
        const row = placeToRow(place);
        if (!row) continue;
        if (seenPlaceIds.has(row.place_id)) continue;
        seenPlaceIds.add(row.place_id);
        rows.push(row);
      }

      let interpretationMap = new Map<number, { relevance: string; reason: string }>();
      if (openaiKey && rows.length > 0) {
        const forInterpretation: PlaceForInterpretation[] = rows.map((r, i) => ({
          index: i,
          name: r.name ?? "",
          types: r.types ? (JSON.parse(r.types) as string[]) : [],
          primaryType: r.primary_type,
          editorialSummary: r.editorial_summary,
          generativeSummary: r.generative_summary,
          formattedAddress: r.formatted_address,
        }));
        try {
          const results = await interpretPlacesInBatches(openaiKey, forInterpretation);
          for (const [idx, res] of results) {
            interpretationMap.set(idx, { relevance: res.relevance, reason: res.reason });
          }
        } catch (err) {
          console.warn("LLM interpretation failed:", err);
        }
      }

      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const interp = interpretationMap.get(idx);
        if (interp?.relevance === "none") continue;

        const existing = db
          .prepare("SELECT id FROM plants WHERE place_id = ?")
          .get(row.place_id) as { id: string } | undefined;

        upsertStmt.run({
          id: existing?.id ?? uuidv4(),
          place_id: row.place_id,
          name: row.name,
          formatted_address: row.formatted_address,
          lat: row.lat,
          lng: row.lng,
          phone: row.phone,
          website: row.website,
          business_status: row.business_status,
          google_maps_uri: row.google_maps_uri,
          primary_type: row.primary_type,
          types: row.types,
          rating: row.rating,
          user_rating_count: row.user_rating_count,
          plus_code: row.plus_code,
          primary_type_display_name: row.primary_type_display_name,
          short_formatted_address: row.short_formatted_address,
          price_level: row.price_level,
          regular_opening_hours: row.regular_opening_hours,
          photo_name: row.photo_name,
          editorial_summary: row.editorial_summary,
          generative_summary: row.generative_summary,
          city: row.city,
          state: row.state,
          postal_code: row.postal_code,
          manufacturing_relevance: interp?.relevance ?? null,
          manufacturing_reason: interp?.reason ?? null,
          data_source: "google_places",
        });

        if (existing) updated++;
        else added++;
      }

      pageToken = result.nextPageToken ?? undefined;
      if (pageToken) {
        await new Promise((r) => setTimeout(r, 500));
      }
    } while (pageToken);
  }

  const totalRow = db.prepare("SELECT COUNT(*) as c FROM plants").get() as {
    c: number;
  };
  return { added, updated, total: totalRow.c };
}

/** Check if types array has only generic values (establishment, point_of_interest) */
function onlyGenericTypes(types: string[] | undefined): boolean {
  if (!types?.length) return true;
  const generic = new Set(["establishment", "point_of_interest"]);
  return types.every((t) => generic.has(t.toLowerCase()));
}

/** Extract city, state, postal_code from addressComponents */
function parseAddressComponents(
  components?: Array<{ longText?: string; shortText?: string; types?: string[] }>
): { city: string | null; state: string | null; postal_code: string | null } {
  if (!components?.length) return { city: null, state: null, postal_code: null };
  let city: string | null = null;
  let state: string | null = null;
  let postal_code: string | null = null;
  for (const c of components) {
    const types = c.types ?? [];
    const text = c.longText ?? c.shortText ?? null;
    if (!text) continue;
    if (types.includes("locality")) city = text;
    else if (types.includes("administrative_area_level_1")) state = text;
    else if (types.includes("postal_code")) postal_code = text;
  }
  return { city, state, postal_code };
}

function placeToRow(place: PlaceResult): {
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
} | null {
  const placeId =
    place.id ?? place.name?.replace("places/", "") ?? null;
  if (!placeId) return null;

  const name = place.displayName?.text ?? place.formattedAddress ?? null;
  const formatted_address = place.formattedAddress ?? null;
  const lat = place.location?.latitude ?? null;
  const lng = place.location?.longitude ?? null;
  const phone =
    place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null;
  const website = place.websiteUri ?? null;
  const business_status = place.businessStatus ?? null;
  const google_maps_uri = place.googleMapsUri ?? null;
  const primary_type = place.primaryType ?? null;
  const types =
    place.types?.length ? JSON.stringify(place.types) : null;
  const rating = place.rating ?? null;
  const user_rating_count = place.userRatingCount ?? null;
  const plus_code =
    place.plusCode?.compoundCode ?? place.plusCode?.globalCode ?? null;
  const primary_type_display_name =
    place.primaryTypeDisplayName?.text ?? null;
  const short_formatted_address = place.shortFormattedAddress ?? null;
  const price_level = place.priceLevel ?? null;
  const regular_opening_hours = place.regularOpeningHours
    ? JSON.stringify(place.regularOpeningHours)
    : null;
  const photo_name = place.photos?.[0]?.name ?? null;
  const editorial_summary = place.editorialSummary?.text ?? null;
  const generative_summary = place.generativeSummary?.overview?.text ?? null;
  const { city, state, postal_code } = parseAddressComponents(
    place.addressComponents
  );

  return {
    place_id: placeId,
    name,
    formatted_address,
    lat,
    lng,
    phone,
    website,
    business_status,
    google_maps_uri,
    primary_type,
    types,
    rating,
    user_rating_count,
    plus_code,
    primary_type_display_name,
    short_formatted_address,
    price_level,
    regular_opening_hours,
    photo_name,
    editorial_summary,
    generative_summary,
    city,
    state,
    postal_code,
  };
}

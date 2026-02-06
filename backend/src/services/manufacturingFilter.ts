/**
 * Excludes places that are clearly NOT manufacturing facilities.
 * Uses place types (definitive) and summary keywords (strong signals)
 * to filter out grocery stores, restaurants, retail chains, etc.
 * Conservative: we only exclude when we're confident it's not manufacturing.
 */

/** Place types that are definitively not manufacturing plants.
 * From Google Place Types - these will never be factories. */
const EXCLUDED_PLACE_TYPES = new Set([
  "supermarket",
  "grocery_store",
  "convenience_store",
  "department_store",
  "discount_store",
  "clothing_store",
  "shoe_store",
  "electronics_store",
  "furniture_store",
  "hardware_store",
  "liquor_store",
  "pet_store",
  "book_store",
  "restaurant",
  "cafe",
  "coffee_shop",
  "bar",
  "meal_delivery",
  "meal_takeaway",
  "fast_food_restaurant",
  "gas_station",
  "pharmacy",
  "drugstore",
  "bank",
  "atm",
  "hotel",
  "motel",
  "lodging",
  "real_estate_agency",
  "car_dealer",
  "car_rental",
  "car_wash",
  "car_repair",
  "parking",
  "church",
  "mosque",
  "synagogue",
  "hindu_temple",
  "school",
  "university",
  "library",
  "hospital",
  "doctor",
  "dentist",
  "gym",
  "fitness_center",
  "spa",
  "hair_salon",
  "barber_shop",
  "nail_salon",
  "movie_theater",
  "bowling_alley",
  "amusement_park",
  "zoo",
  "aquarium",
  "museum",
  "art_gallery",
  "night_club",
  "casino",
  "stadium",
  "park",
]);

/** Summary keywords that strongly indicate non-manufacturing.
 * Case-insensitive match against editorial_summary and generative_summary. */
const EXCLUDED_SUMMARY_PATTERNS = [
  /\bsupermarket\b/i,
  /\bgrocery\s*(store|chain)?\b/i,
  /\bconvenience\s*store\b/i,
  /\bretail\s*chain\b/i,
  /\bchain\s*(store|restaurant|shop)\b/i,
  /\brestaurant\b/i,
  /\bcafe\b/i,
  /\bcoffee\s*shop\b/i,
  /\bbar\s+and\s+grill\b/i,
  /\bgas\s*station\b/i,
  /\bpharmacy\b/i,
  /\bhotel\b/i,
  /\bmotel\b/i,
  /\bbank\b/i,
  /\bfast\s*food\b/i,
  /\bpizza\s*(restaurant|parlor|place)\b/i,
  /\bhamburger\s*restaurant\b/i,
  /\bseafood\s*market\b/i,
  /\bproduce\s*(market|stand)\b/i,
  /\borganic\s*(products?|market)\b/i,
  /\bpremade\s*meals?\b/i,
  /\bserving\s+(food|meals?|coffee)\b/i,
  /\beatery\b/i,
  /\bbakery\b/i,
  /\bice\s*cream\s*shop\b/i,
  /\bdeli\b/i,
  /\bbistro\b/i,
  /\btavern\b/i,
  /\b(bar|restaurant)\s+and\s+grill\b/i,
  /\bgrill\s+(house|restaurant|bar)\b/i,
];

/** Keywords indicating manufacturing/industrial despite type (bar, store, etc).
 * If name or summary matches, do NOT exclude - overrides type-based exclusion. */
const MANUFACTURING_POSITIVE_SIGNALS = [
  /\bbrewery\b/i,
  /\bbreweries\b/i,
  /\bbrewing\b/i,
  /\bbottling\b/i,
  /\bbottling\s*plant\b/i,
  /\bdistillery\b/i,
  /\bdistilleries\b/i,
  /\bwinery\b/i,
  /\bwineries\b/i,
  /\btextile\s*(mill|manufacturing|plant)?\b/i,
  /\bpaper\s*mill\b/i,
  /\bfood\s*processing\b/i,
  /\bdairy\s*(plant|processor|manufacturing)?\b/i,
  /\bchemical\s*plant\b/i,
  /\bpharmaceutical\b/i,
  /\bwater\s*treatment\b/i,
  /\bpackaging\s*(facility|plant)?\b/i,
  /\bcold\s*storage\b/i,
  /\bplastics\s*(manufactur|plant)?\b/i,
  /\bbeverage\s*(manufactur|producer)?\b/i,
  /\bmeat\s*processing\b/i,
  /\bpoultry\s*(plant|processing)?\b/i,
  /\bcannery\b/i,
  /\bflour\s*mill\b/i,
  /\bsugar\s*refinery\b/i,
  /\boil\s*refinery\b/i,
  /\bsteel\s*mill\b/i,
  /\bfoundry\b/i,
  /\bcement\s*(plant|mill)?\b/i,
  /\bglass\s*(manufactur|plant)?\b/i,
  /\brubber\s*(manufactur|plant)?\b/i,
  /\bfertilizer\s*(plant)?\b/i,
  /\bprinting\s*(plant|press)?\b/i,
  /\bcorrugated\b/i,
  /\binjection\s*molding\b/i,
  /\bmetal\s*fabrication\b/i,
  /\bindustrial\s*(plant|facility|manufacturing)\b/i,
];

export interface PlaceForFilter {
  displayName?: { text?: string } | string | null;
  primaryType?: string | null;
  types?: string[];
  editorialSummary?: { text?: string } | string | null;
  generativeSummary?: { overview?: { text?: string } } | string | null;
}

function getSummaryText(place: PlaceForFilter): string {
  const ed = place.editorialSummary;
  const gen = place.generativeSummary;
  const edText = typeof ed === "string" ? ed : ed?.text ?? "";
  const genText =
    typeof gen === "string"
      ? gen
      : gen?.overview?.text ?? "";
  return `${edText} ${genText}`.trim();
}

/**
 * Returns true if the place should be EXCLUDED (not a manufacturing facility).
 * Returns false if we should keep it (could be manufacturing or unclear).
 * Positive override: if name/summary strongly suggests manufacturing, keep even if type is bar/store.
 */
export function isExcludedAsNonManufacturing(place: PlaceForFilter): boolean {
  const name =
    typeof place.displayName === "string"
      ? place.displayName
      : place.displayName?.text ?? "";
  const summary = getSummaryText(place);
  const combined = `${name} ${summary}`;

  for (const pattern of MANUFACTURING_POSITIVE_SIGNALS) {
    if (pattern.test(combined)) {
      return false;
    }
  }

  const allTypes = [
    ...(place.primaryType ? [place.primaryType.toLowerCase()] : []),
    ...(place.types ?? []).map((t) => t.toLowerCase()),
  ];

  for (const t of allTypes) {
    if (EXCLUDED_PLACE_TYPES.has(t)) {
      return true;
    }
  }

  const summaryForExclusion = getSummaryText(place);
  if (!summaryForExclusion) return false;

  for (const pattern of EXCLUDED_SUMMARY_PATTERNS) {
    if (pattern.test(summaryForExclusion)) {
      return true;
    }
  }

  return false;
}

/** DB plant shape (from SELECT *) */
export interface DbPlantForFilter {
  name?: string | null;
  primary_type?: string | null;
  types?: string | null;
  editorial_summary?: string | null;
  generative_summary?: string | null;
}

/** Check if an existing DB plant should be excluded (e.g. for cleanup). */
export function isExcludedFromDbPlant(plant: DbPlantForFilter): boolean {
  let types: string[] = [];
  try {
    const t = plant.types;
    if (typeof t === "string") {
      const parsed = JSON.parse(t);
      types = Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    /* ignore */
  }
  return isExcludedAsNonManufacturing({
    displayName: plant.name ?? undefined,
    primaryType: plant.primary_type ?? undefined,
    types,
    editorialSummary: plant.editorial_summary ?? undefined,
    generativeSummary: plant.generative_summary ?? undefined,
  });
}

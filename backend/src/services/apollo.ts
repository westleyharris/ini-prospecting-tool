const APOLLO_API_BASE = "https://api.apollo.io/api/v1";

/** Manufacturing-relevant job titles for contact discovery */
export const MANUFACTURING_TITLES = [
  "plant manager",
  "maintenance manager",
  "maintenance director",
  "director of maintenance",
  "purchasing manager",
  "procurement manager",
  "operations manager",
  "facilities manager",
  "facilities director",
  "vp operations",
  "vp of operations",
  "coo",
  "chief operating officer",
];

/**
 * Extract domain from a website URL (e.g. https://www.acme.com/about -> acme.com)
 */
export function extractDomain(website: string | null): string | null {
  if (!website?.trim()) return null;
  try {
    let url = website.trim();
    if (!url.startsWith("http")) url = `https://${url}`;
    const hostname = new URL(url).hostname;
    if (!hostname) return null;
    // Remove www. prefix
    return hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

interface ApolloPerson {
  id?: string;
  first_name?: string;
  last_name?: string;
  last_name_obfuscated?: string;
  title?: string;
  linkedin_url?: string;
  organization?: { name?: string };
}

interface ApolloSearchResponse {
  people?: ApolloPerson[];
  total_entries?: number;
  pagination?: { page: number; per_page: number; total_pages: number };
}

/**
 * Search for people at a company by domain. Does not consume credits.
 * Does not return emails - use enrichPeople for that.
 */
export async function searchPeopleByDomain(
  apiKey: string,
  domain: string,
  options?: { perPage?: number; page?: number }
): Promise<ApolloSearchResponse> {
  const key = (apiKey || "").trim();
  if (!key) throw new Error("Apollo API key is required");

  const perPage = Math.min(options?.perPage ?? 10, 25);
  const page = options?.page ?? 1;

  const res = await fetch(`${APOLLO_API_BASE}/mixed_people/api_search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": key,
    },
    body: JSON.stringify({
      q_organization_domains_list: [domain],
      person_titles: MANUFACTURING_TITLES,
      per_page: perPage,
      page,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apollo API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as ApolloSearchResponse;

  // Apollo may use /mixed_people/api_search - try that if search returns 404
  if (!data.people && res.status === 200) {
    return data;
  }

  return data;
}

interface EnrichedPerson {
  id?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  sanitized_email?: string;
  phone_numbers?: Array<{ raw_number?: string; sanitized_number?: string }>;
  linkedin_url?: string;
}

interface ApolloEnrichResponse {
  people?: EnrichedPerson[];
}

/**
 * Enrich people by Apollo ID to get emails and phone numbers. Consumes credits.
 */
export async function enrichPeople(
  apiKey: string,
  apolloIds: string[],
  options?: { revealEmail?: boolean; revealPhone?: boolean }
): Promise<ApolloEnrichResponse> {
  if (apolloIds.length === 0) return { people: [] };
  if (apolloIds.length > 10) {
    throw new Error("Apollo bulk enrichment supports max 10 people per request");
  }

  const key = (apiKey || "").trim();
  if (!key) throw new Error("Apollo API key is required");

  const details = apolloIds.map((id) => ({ id }));

  const res = await fetch(`${APOLLO_API_BASE}/people/bulk_match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": key,
    },
    body: JSON.stringify({
      details,
      reveal_personal_emails: options?.revealEmail ?? true,
      reveal_phone_number: options?.revealPhone ?? false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apollo enrich error ${res.status}: ${text}`);
  }

  return res.json() as Promise<ApolloEnrichResponse>;
}

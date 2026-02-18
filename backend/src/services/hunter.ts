const HUNTER_API_BASE = "https://api.hunter.io/v2";

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
    return hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export interface HunterEmail {
  value: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  position_raw?: string;
  seniority?: string;
  department?: string;
  linkedin?: string | null;
  twitter?: string | null;
  phone_number?: string | null;
  type?: string;
  confidence?: number;
  verification?: { status?: string; date?: string };
}

export interface HunterDomainSearchResponse {
  data?: {
    domain?: string;
    organization?: string;
    emails?: HunterEmail[];
  };
  meta?: {
    results?: number;
    limit?: number;
    offset?: number;
  };
  errors?: Array<{ id?: string; code?: number; details?: string }>;
}

/**
 * Search for people at a company by domain. Returns contacts with emails included.
 * Hunter's Domain Search returns emails directly (no separate enrich step needed).
 */
export async function searchPeopleByDomain(
  apiKey: string,
  domain: string,
  options?: { limit?: number; offset?: number }
): Promise<HunterDomainSearchResponse> {
  const key = (apiKey || "").trim();
  if (!key) throw new Error("Hunter API key is required");

  const limit = Math.min(options?.limit ?? 10, 100);
  const offset = options?.offset ?? 0;

  const params = new URLSearchParams({
    domain,
    limit: String(limit),
    offset: String(offset),
    type: "personal", // Exclude generic role emails like info@company.com
    job_titles: MANUFACTURING_TITLES.join(","),
    department: "operations,management", // Manufacturing-relevant departments
  });

  const res = await fetch(`${HUNTER_API_BASE}/domain-search?${params}`, {
    headers: {
      "X-Api-Key": key,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hunter API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as HunterDomainSearchResponse;

  if (data.errors && data.errors.length > 0) {
    const err = data.errors[0];
    throw new Error(err.details || `Hunter API error: ${err.id || err.code}`);
  }

  return data;
}

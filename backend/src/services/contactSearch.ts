/**
 * Contact discovery via n8n webhook workflow.
 * Sends company name + location to the n8n personnel-search workflow
 * and returns structured contact results.
 */

const N8N_WEBHOOK_URL = "https://wharris.app.n8n.cloud/webhook/personnel-search";

export interface N8nContact {
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  source_url: string | null;
}

export interface ContactSearchInput {
  name: string;
  city: string | null;
  state: string | null;
}

/** Split a full name string into first / last */
function splitName(fullName: string | null): { first: string | null; last: string | null } {
  if (!fullName || !fullName.trim()) return { first: null, last: null };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: null };
  const first = parts[0];
  const last = parts.slice(1).join(" ");
  return { first, last };
}

export async function searchContactsWithN8n(
  company: ContactSearchInput
): Promise<N8nContact[]> {
  const location = [company.city, company.state].filter(Boolean).join(", ") || "";

  const payload = {
    companyName: company.name,
    location,
  };

  console.log(`[n8n-search] Sending request for "${company.name}" @ "${location}"`);

  const res = await fetch(N8N_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`n8n webhook error ${res.status}: ${text}`);
  }

  const data = await res.json() as {
    personnelCount?: number;
    personnel?: Array<{
      name?: string;
      jobTitle?: string;
      company?: string;
      location?: string;
      email?: string;
      phone?: string;
      linkedinUrl?: string;
      sourceUrl?: string;
      yearsExperience?: string;
    }>;
  };

  const personnel = data.personnel ?? [];

  console.log(`[n8n-search] Received ${personnel.length} contacts`);

  return personnel.map((p) => {
    const { first, last } = splitName(p.name ?? null);
    return {
      first_name: first,
      last_name: last,
      title: p.jobTitle?.trim() || null,
      email: p.email?.trim().toLowerCase() || null,
      phone: p.phone?.trim() || null,
      linkedin_url: p.linkedinUrl?.trim() || null,
      source_url: p.sourceUrl?.trim() || null,
    };
  });
}

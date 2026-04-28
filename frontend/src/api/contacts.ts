export interface Contact {
  id: string;
  plant_id: string;
  apollo_id: string | null;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  source: string;
  source_url: string | null;
  notes: string | null;
  last_contacted: string | null;
  verified: number; // 0 or 1
  buying_role: "decision_maker" | "technical_influencer" | "champion" | "gatekeeper" | "unknown";
  created_at: string;
  updated_at: string;
  // joined from plants table (present when fetched from /api/contacts)
  plant_name?: string | null;
  plant_city?: string | null;
  plant_state?: string | null;
  plant_website?: string | null;
  plant_address?: string | null;
}

export async function fetchContacts(plantId?: string): Promise<Contact[]> {
  const url = plantId
    ? `/api/plants/${plantId}/contacts`
    : `/api/contacts`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch contacts");
  return res.json();
}

export async function findContacts(plantId: string): Promise<{
  added: number;
  total: number;
  contacts: Contact[];
}> {
  const res = await fetch(`/api/plants/${plantId}/find-contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to find contacts");
  }
  return res.json();
}

export async function enrichContact(contactId: string): Promise<Contact> {
  const res = await fetch(`/api/contacts/${contactId}/enrich`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to enrich contact");
  }
  return res.json();
}

export async function createContact(data: {
  plant_id: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  phone?: string;
}): Promise<Contact> {
  const res = await fetch("/api/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create contact");
  }
  return res.json();
}

export async function patchContact(contactId: string, data: Partial<Pick<Contact,
  "notes" | "last_contacted" | "verified" | "buying_role" | "first_name" | "last_name" | "title" | "email" | "phone" | "linkedin_url"
>>): Promise<Contact> {
  const res = await fetch(`/api/contacts/${contactId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update contact");
  }
  return res.json();
}

export async function deleteContact(contactId: string): Promise<void> {
  const res = await fetch(`/api/contacts/${contactId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete contact");
}

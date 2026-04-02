import { useState, useEffect, useRef } from "react";
import type { Plant } from "../api/plants";
import {
  fetchContacts,
  findContacts,
  enrichContact,
  deleteContact,
  createContact,
  type Contact,
} from "../api/contacts";

interface PlantContactsProps {
  plant: Plant;
  onClose: () => void;
}

// ─── Email Draft Modal ────────────────────────────────────────────────────────

interface DraftEmailProps {
  contact: Contact;
  plant: Plant;
  onClose: () => void;
}

function roleCategory(title: string | null): string {
  if (!title) return "operations";
  const t = title.toLowerCase();
  if (t.includes("maintenance")) return "maintenance";
  if (t.includes("reliability")) return "reliability";
  if (t.includes("plant manager") || t.includes("site manager")) return "plant";
  if (t.includes("purchasing") || t.includes("procurement") || t.includes("supply chain")) return "purchasing";
  if (t.includes("facilities")) return "facilities";
  if (t.includes("coo") || t.includes("chief operating") || t.includes("vp of operations") || t.includes("vp operations")) return "executive";
  return "operations";
}

function buildSubject(contact: Contact, _plant: Plant): string {
  const cat = roleCategory(contact.title);
  switch (cat) {
    case "maintenance":
      return `Quick question about your maintenance program`;
    case "reliability":
      return `Cutting unplanned failures — worth a 10-minute conversation?`;
    case "purchasing":
      return `Local MRO supplier — faster lead times, no minimums`;
    case "plant":
      return `Helping nearby plants cut maintenance costs — quick question`;
    case "executive":
      return `Reducing operational downtime — are you open to a conversation?`;
    case "facilities":
      return `Local support for your facility — quick question`;
    default:
      return `Quick question — local industrial partner nearby`;
  }
}

function buildBody(contact: Contact, plant: Plant): string {
  const firstName = contact.first_name ?? "there";
  const plantName = plant.name ?? "your facility";
  const cat = roleCategory(contact.title);

  const bodies: Record<string, string> = {
    maintenance: `Hi ${firstName},

Quick question — how much unplanned downtime is ${plantName} dealing with right now?

I ask because we're INI Industrial Networks out of Rockwall, TX — about [X miles] from you. We work specifically with maintenance teams at plants like yours to cut reactive maintenance and get ahead of failures before they take a line down.

Most of the maintenance managers we talk to are fighting the same battles: aging equipment, parts that take too long to arrive, and not enough hours in the day. We help on all three fronts — predictive maintenance support, on-site technical help, and MRO supply with same-day availability on critical items.

Being down the road from you isn't just a detail — it means we can actually show up when something breaks, not just ship you a catalog.

Worth a 15-minute call this week to see if there's a fit? I'm not going to waste your time.

[Your Name]
INI Industrial Networks | Rockwall, TX
[Your Phone]`,

    reliability: `Hi ${firstName},

I'll keep this short — we work with reliability engineers at manufacturing plants across the region, and I wanted to reach out because of what we're seeing with plants similar to ${plantName}.

Most of the reliability teams we talk to are understaffed and reactive when they want to be proactive. We help by filling in the gaps — vibration analysis support, condition monitoring programs, and helping get buy-in from maintenance and operations when the data says a failure is coming.

We're based in Rockwall, TX — about [X miles] from you — so this isn't a remote vendor relationship. We can be on-site, work alongside your team, and actually understand your equipment.

If you have 15 minutes this week, I'd love to learn what your biggest reliability headaches are right now. No sales pitch — just a conversation.

[Your Name]
INI Industrial Networks | Rockwall, TX
[Your Phone]`,

    plant: `Hi ${firstName},

I'll be direct — I'm reaching out because ${plantName} is on our radar as a plant we'd genuinely like to work with.

We're INI Industrial Networks, based in Rockwall, TX — [X miles] from you. We partner with plant managers to reduce maintenance costs and unplanned downtime. Not with a software dashboard or a corporate contract — with real, on-the-ground support from people who understand how plants actually run.

The plants we work with typically see the biggest wins in three areas: getting ahead of equipment failures before they become shutdowns, tightening up MRO spend, and having a reliable local partner who picks up the phone.

If any of that sounds relevant to what you're dealing with at ${plantName}, I'd love 15 minutes of your time. Happy to come to you.

[Your Name]
INI Industrial Networks | Rockwall, TX
[Your Phone]`,

    purchasing: `Hi ${firstName},

If you're sourcing MRO parts and maintenance supplies through a national distributor right now, I have a question worth considering — what happens when you need something critical and it's on backorder?

We're INI Industrial Networks out of Rockwall, TX — [X miles] from ${plantName}. We stock industrial MRO, maintenance equipment, and technical supplies, and because we're local, we can typically get critical items to you same-day when a national distributor is telling you 2 weeks.

No minimums, flexible terms, and you'd be working with people who actually answer the phone.

Would it be worth a quick call to see if we carry what you're buying? I can have a product line overview to you in 10 minutes.

[Your Name]
INI Industrial Networks | Rockwall, TX
[Your Phone]`,

    facilities: `Hi ${firstName},

Managing a facility the size of ${plantName} means something always needs attention — and waiting on a vendor who's three states away doesn't help.

We're INI Industrial Networks, based in Rockwall, TX — about [X miles] from you. We support facilities teams with MRO supply, equipment maintenance, and on-site technical help. Local stock, local people, fast response.

I won't take much of your time — worth a 10-minute call to see if we can make your job easier?

[Your Name]
INI Industrial Networks | Rockwall, TX
[Your Phone]`,

    executive: `Hi ${firstName},

One question: what's unplanned downtime actually costing ${plantName} per year?

Most operations leaders I talk to have a rough number in their head, but the full picture — lost production, emergency labor, expedited parts, cascading delays — is usually 3-4x what they initially think.

We're INI Industrial Networks out of Rockwall, TX — [X miles] from ${plantName}. We work with operations leadership at manufacturing plants to systematically reduce that number through better maintenance programs, faster parts availability, and on-site support that doesn't require a plane ticket.

If this is a priority for you, I'd like to understand what you're dealing with. 20 minutes, no pitch deck. Just a conversation about whether there's a fit.

[Your Name]
INI Industrial Networks | Rockwall, TX
[Your Phone]`,

    operations: `Hi ${firstName},

Quick question — when something breaks down at ${plantName}, how long does it typically take to get back up and running?

We're INI Industrial Networks, based in Rockwall, TX — [X miles] from you. We work with operations teams at manufacturing plants to close the gap between "something failed" and "we're back online." Local parts inventory, on-site technical support, and maintenance programs that reduce how often you're in that situation in the first place.

Worth a 15-minute conversation to see if we can help? Happy to come to you.

[Your Name]
INI Industrial Networks | Rockwall, TX
[Your Phone]`,
  };

  return bodies[cat] ?? bodies.operations;
}

function DraftEmailModal({ contact, plant, onClose }: DraftEmailProps) {
  const subject = buildSubject(contact, plant);
  const body = buildBody(contact, plant);
  const [copied, setCopied] = useState<"subject" | "body" | "all" | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const copy = (text: string, which: "subject" | "body" | "all") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Draft Email — {[contact.first_name, contact.last_name].filter(Boolean).join(" ")}
            </h3>
            {contact.title && (
              <p className="text-xs text-gray-500 mt-0.5">{contact.title} · {plant.name}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* To */}
          {contact.email && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-800 font-mono bg-gray-50 border border-gray-200 rounded px-3 py-1.5 flex-1">
                  {contact.email}
                </span>
                <button
                  onClick={() => copy(contact.email!, "subject")}
                  className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 flex-1">
                {subject}
              </span>
              <button
                onClick={() => copy(subject, "subject")}
                className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap"
              >
                {copied === "subject" ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-500">Body</label>
              <button
                onClick={() => copy(body, "body")}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                {copied === "body" ? "✓ Copied" : "Copy body"}
              </button>
            </div>
            <textarea
              ref={bodyRef}
              readOnly
              value={body}
              className="w-full h-72 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded px-3 py-2 resize-none font-sans leading-relaxed focus:outline-none"
            />
          </div>

          <p className="text-xs text-amber-600">
            Replace <span className="font-mono">[Your Name]</span>, <span className="font-mono">[X miles]</span>, <span className="font-mono">[Your Phone]</span>, and <span className="font-mono">[Your Email]</span> before sending.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <button
            onClick={() => copy(`Subject: ${subject}\n\n${body}`, "all")}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            {copied === "all" ? "✓ Copied!" : "Copy full email"}
          </button>
          {contact.email && (
            <a
              href={`mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
            >
              Open in mail app ↗
            </a>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PlantContacts({ plant, onClose }: PlantContactsProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [finding, setFinding] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addFirst, setAddFirst] = useState("");
  const [addLast, setAddLast] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [draftContact, setDraftContact] = useState<Contact | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchContacts(plant.id);
      setContacts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [plant.id]);

  const handleFindContacts = async () => {
    setFinding(true);
    try {
      const result = await findContacts(plant.id);
      setContacts(result.contacts);
      if (result.added > 0) {
        alert(`Found ${result.added} new contact${result.added === 1 ? "" : "s"}.`);
      } else if (result.total > 0) {
        alert("No new contacts found. Existing contacts are shown.");
      } else {
        alert("No contacts found for this company. Try again or add manually.");
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to find contacts");
    } finally {
      setFinding(false);
    }
  };

  const handleEnrich = async (contact: Contact) => {
    setEnrichingId(contact.id);
    try {
      const updated = await enrichContact(contact.id);
      setContacts((prev) => prev.map((c) => (c.id === contact.id ? updated : c)));
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to enrich contact");
    } finally {
      setEnrichingId(null);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFirst.trim() && !addLast.trim()) {
      alert("Enter at least first or last name.");
      return;
    }
    setAdding(true);
    try {
      const created = await createContact({
        plant_id: plant.id,
        first_name: addFirst.trim() || undefined,
        last_name: addLast.trim() || undefined,
        title: addTitle.trim() || undefined,
        email: addEmail.trim() || undefined,
        phone: addPhone.trim() || undefined,
      });
      setContacts((prev) => [created, ...prev]);
      setShowAddForm(false);
      setAddFirst(""); setAddLast(""); setAddTitle(""); setAddEmail(""); setAddPhone("");
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to add contact");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (contact: Contact) => {
    if (!confirm(`Remove ${contact.first_name ?? ""} ${contact.last_name ?? ""}?`)) return;
    setDeletingId(contact.id);
    try {
      await deleteContact(contact.id);
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete contact");
    } finally {
      setDeletingId(null);
    }
  };

  const displayName = (c: Contact) =>
    [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown";

  const sourceLabel = (c: Contact) => {
    if (!c.source) return null;
    if (c.source === "n8n-search") {
      return (
        <span className="inline-block text-xs px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-700">
          AI found
        </span>
      );
    }
    if (c.source === "manual") {
      return (
        <span className="inline-block text-xs px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-500">
          manual
        </span>
      );
    }
    return null;
  };

  return (
    <>
      {draftContact && (
        <DraftEmailModal
          contact={draftContact}
          plant={plant}
          onClose={() => setDraftContact(null)}
        />
      )}

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Contacts — {plant.name ?? "Plant"}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Toolbar */}
          <div className="px-6 py-4 border-b border-gray-200 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowAddForm((v) => !v)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
              >
                {showAddForm ? "Cancel" : "Add contact"}
              </button>
              <button
                onClick={handleFindContacts}
                disabled={finding}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {finding ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Searching web...
                  </span>
                ) : (
                  "Search with AI"
                )}
              </button>
            </div>

            {showAddForm && (
              <form
                onSubmit={handleAddContact}
                className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-4 bg-gray-50 rounded-md"
              >
                <input type="text" placeholder="First name" value={addFirst}
                  onChange={(e) => setAddFirst(e.target.value)}
                  className="rounded border-gray-300 text-sm" />
                <input type="text" placeholder="Last name" value={addLast}
                  onChange={(e) => setAddLast(e.target.value)}
                  className="rounded border-gray-300 text-sm" />
                <input type="text" placeholder="Title" value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  className="rounded border-gray-300 text-sm sm:col-span-2" />
                <input type="email" placeholder="Email" value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  className="rounded border-gray-300 text-sm" />
                <input type="tel" placeholder="Phone" value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  className="rounded border-gray-300 text-sm" />
                <button type="submit" disabled={adding}
                  className="sm:col-span-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm">
                  {adding ? "Adding..." : "Save contact"}
                </button>
              </form>
            )}

            {!plant.website && (
              <p className="text-xs text-amber-600">
                No website set — AI search works better with a company website.
              </p>
            )}
          </div>

          {/* Contact list */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <p className="text-gray-500 text-sm">Loading contacts...</p>
            ) : contacts.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No contacts yet. Add one manually or use &quot;Search with AI&quot; to find
                maintenance, operations, and reliability contacts.
              </p>
            ) : (
              <ul className="space-y-3">
                {contacts.map((contact) => (
                  <li key={contact.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start gap-4">
                      {/* Info */}
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 flex items-center gap-2 flex-wrap">
                          {displayName(contact)}
                          {sourceLabel(contact)}
                        </p>
                        {contact.title && (
                          <p className="text-sm text-gray-600 mt-0.5">{contact.title}</p>
                        )}
                        {contact.email && (
                          <a href={`mailto:${contact.email}`}
                            className="text-sm text-blue-600 hover:underline block mt-1 truncate">
                            {contact.email}
                          </a>
                        )}
                        {contact.phone && (
                          <a href={`tel:${contact.phone}`}
                            className="text-sm text-blue-600 hover:underline block mt-1">
                            {contact.phone}
                          </a>
                        )}
                        {contact.linkedin_url && (
                          <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline block mt-1">
                            LinkedIn ↗
                          </a>
                        )}
                        {contact.source_url && (
                          <a href={contact.source_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-gray-400 hover:text-gray-600 hover:underline block mt-1 truncate max-w-xs"
                            title={contact.source_url}>
                            🔗 Source ↗
                          </a>
                        )}
                        {!contact.email && contact.apollo_id && (
                          <p className="text-xs text-amber-600 mt-1">
                            Legacy contact — click &quot;Get email&quot; to retrieve
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {contact.email && (
                          <button
                            onClick={() => setDraftContact(contact)}
                            className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded hover:bg-indigo-100 whitespace-nowrap"
                          >
                            ✉ Draft email
                          </button>
                        )}
                        {contact.apollo_id && !contact.email && (
                          <button
                            onClick={() => handleEnrich(contact)}
                            disabled={enrichingId === contact.id}
                            className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                          >
                            {enrichingId === contact.id ? "Getting..." : "Get email"}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(contact)}
                          disabled={deletingId === contact.id}
                          className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                        >
                          {deletingId === contact.id ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

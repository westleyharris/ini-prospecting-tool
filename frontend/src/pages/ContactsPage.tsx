import { useState, useEffect, useMemo } from "react";
import { fetchContacts, deleteContact, type Contact } from "../api/contacts";

// ─── Role helpers ─────────────────────────────────────────────────────────────

type RoleKey = "maintenance" | "reliability" | "plant" | "operations" | "purchasing" | "executive" | "facilities" | "other";

const ROLE_META: Record<RoleKey, { label: string; color: string; bg: string; ring: string }> = {
  maintenance: { label: "Maintenance",  color: "text-blue-700",   bg: "bg-blue-100",   ring: "ring-blue-200" },
  reliability: { label: "Reliability",  color: "text-violet-700", bg: "bg-violet-100", ring: "ring-violet-200" },
  plant:       { label: "Plant Mgr",    color: "text-emerald-700",bg: "bg-emerald-100",ring: "ring-emerald-200" },
  operations:  { label: "Operations",   color: "text-orange-700", bg: "bg-orange-100", ring: "ring-orange-200" },
  purchasing:  { label: "Purchasing",   color: "text-teal-700",   bg: "bg-teal-100",   ring: "ring-teal-200" },
  executive:   { label: "Executive",    color: "text-rose-700",   bg: "bg-rose-100",   ring: "ring-rose-200" },
  facilities:  { label: "Facilities",   color: "text-amber-700",  bg: "bg-amber-100",  ring: "ring-amber-200" },
  other:       { label: "Other",        color: "text-gray-600",   bg: "bg-gray-100",   ring: "ring-gray-200" },
};

function getRole(title: string | null): RoleKey {
  if (!title) return "other";
  const t = title.toLowerCase();
  if (t.includes("maintenance")) return "maintenance";
  if (t.includes("reliability")) return "reliability";
  if (t.includes("plant manager") || t.includes("site manager")) return "plant";
  if (t.includes("purchasing") || t.includes("procurement") || t.includes("supply chain")) return "purchasing";
  if (t.includes("facilities")) return "facilities";
  if (t.includes("coo") || t.includes("chief operating") || t.includes("vp of operations") || t.includes("vp operations") || t.includes("director of operations") || t.includes("operations manager")) return "operations";
  if (t.includes("president") || t.includes("ceo") || t.includes("owner") || t.includes("general manager")) return "executive";
  if (t.includes("operations")) return "operations";
  return "other";
}

function initials(c: Contact): string {
  const f = c.first_name?.[0] ?? "";
  const l = c.last_name?.[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

// ─── Email draft ──────────────────────────────────────────────────────────────

function buildEmailDraft(contact: Contact): { subject: string; body: string } {
  const firstName = contact.first_name ?? "there";
  const plantName = contact.plant_name ?? "your facility";
  const role = getRole(contact.title);

  const subjects: Record<RoleKey, string> = {
    maintenance: "Quick question about your maintenance program",
    reliability: "Cutting unplanned failures — worth a 10-minute conversation?",
    purchasing:  "Local MRO supplier — faster lead times, no minimums",
    plant:       "Helping nearby plants cut maintenance costs — quick question",
    executive:   "Reducing operational downtime — are you open to a conversation?",
    facilities:  "Local support for your facility — quick question",
    operations:  "Quick question — local industrial partner nearby",
    other:       "Quick question — local industrial partner nearby",
  };

  const bodies: Record<RoleKey, string> = {
    maintenance: `Hi ${firstName},\n\nQuick question — how much unplanned downtime is ${plantName} dealing with right now?\n\nI ask because we're INI Industrial Networks out of Rockwall, TX — about [X miles] from you. We work specifically with maintenance teams at plants like yours to cut reactive maintenance and get ahead of failures before they take a line down.\n\nMost of the maintenance managers we talk to are fighting the same battles: aging equipment, parts that take too long to arrive, and not enough hours in the day. We help on all three fronts — predictive maintenance support, on-site technical help, and MRO supply with same-day availability on critical items.\n\nBeing down the road from you isn't just a detail — it means we can actually show up when something breaks, not just ship you a catalog.\n\nWorth a 15-minute call this week to see if there's a fit? I'm not going to waste your time.\n\n[Your Name]\nINI Industrial Networks | Rockwall, TX\n[Your Phone]`,

    reliability: `Hi ${firstName},\n\nI'll keep this short — we work with reliability engineers at manufacturing plants across the region, and I wanted to reach out because of what we're seeing with plants similar to ${plantName}.\n\nMost of the reliability teams we talk to are understaffed and reactive when they want to be proactive. We help by filling in the gaps — vibration analysis support, condition monitoring programs, and helping get buy-in from maintenance and operations when the data says a failure is coming.\n\nWe're based in Rockwall, TX — about [X miles] from you — so this isn't a remote vendor relationship. We can be on-site, work alongside your team, and actually understand your equipment.\n\nIf you have 15 minutes this week, I'd love to learn what your biggest reliability headaches are right now. No sales pitch — just a conversation.\n\n[Your Name]\nINI Industrial Networks | Rockwall, TX\n[Your Phone]`,

    plant: `Hi ${firstName},\n\nI'll be direct — I'm reaching out because ${plantName} is on our radar as a plant we'd genuinely like to work with.\n\nWe're INI Industrial Networks, based in Rockwall, TX — [X miles] from you. We partner with plant managers to reduce maintenance costs and unplanned downtime. Not with a software dashboard or a corporate contract — with real, on-the-ground support from people who understand how plants actually run.\n\nThe plants we work with typically see the biggest wins in three areas: getting ahead of equipment failures before they become shutdowns, tightening up MRO spend, and having a reliable local partner who picks up the phone.\n\nIf any of that sounds relevant to what you're dealing with at ${plantName}, I'd love 15 minutes of your time. Happy to come to you.\n\n[Your Name]\nINI Industrial Networks | Rockwall, TX\n[Your Phone]`,

    purchasing: `Hi ${firstName},\n\nIf you're sourcing MRO parts and maintenance supplies through a national distributor right now, I have a question worth considering — what happens when you need something critical and it's on backorder?\n\nWe're INI Industrial Networks out of Rockwall, TX — [X miles] from ${plantName}. We stock industrial MRO, maintenance equipment, and technical supplies, and because we're local, we can typically get critical items to you same-day when a national distributor is telling you 2 weeks.\n\nNo minimums, flexible terms, and you'd be working with people who actually answer the phone.\n\nWould it be worth a quick call to see if we carry what you're buying?\n\n[Your Name]\nINI Industrial Networks | Rockwall, TX\n[Your Phone]`,

    executive: `Hi ${firstName},\n\nOne question: what's unplanned downtime actually costing ${plantName} per year?\n\nMost operations leaders I talk to have a rough number in their head, but the full picture — lost production, emergency labor, expedited parts, cascading delays — is usually 3-4x what they initially think.\n\nWe're INI Industrial Networks out of Rockwall, TX — [X miles] from ${plantName}. We work with operations leadership at manufacturing plants to systematically reduce that number through better maintenance programs, faster parts availability, and on-site support that doesn't require a plane ticket.\n\nIf this is a priority for you, I'd like to understand what you're dealing with. 20 minutes, no pitch deck.\n\n[Your Name]\nINI Industrial Networks | Rockwall, TX\n[Your Phone]`,

    facilities: `Hi ${firstName},\n\nManaging a facility the size of ${plantName} means something always needs attention — and waiting on a vendor who's three states away doesn't help.\n\nWe're INI Industrial Networks, based in Rockwall, TX — about [X miles] from you. We support facilities teams with MRO supply, equipment maintenance, and on-site technical help. Local stock, local people, fast response.\n\nWorth a 10-minute call to see if we can make your job easier?\n\n[Your Name]\nINI Industrial Networks | Rockwall, TX\n[Your Phone]`,

    operations: `Hi ${firstName},\n\nQuick question — when something breaks down at ${plantName}, how long does it typically take to get back up and running?\n\nWe're INI Industrial Networks, based in Rockwall, TX — [X miles] from you. We work with operations teams at manufacturing plants to close the gap between "something failed" and "we're back online." Local parts inventory, on-site technical support, and maintenance programs that reduce how often you're in that situation in the first place.\n\nWorth a 15-minute conversation to see if we can help?\n\n[Your Name]\nINI Industrial Networks | Rockwall, TX\n[Your Phone]`,

    other: `Hi ${firstName},\n\nI'm reaching out because we work with manufacturing plants across the region and ${plantName} is on our radar.\n\nWe're INI Industrial Networks out of Rockwall, TX — [X miles] from you. We help plants reduce unplanned downtime, improve maintenance programs, and source critical MRO parts faster than national distributors can.\n\nWould you be open to a quick 15-minute call to see if there's a fit?\n\n[Your Name]\nINI Industrial Networks | Rockwall, TX\n[Your Phone]`,
  };

  return { subject: subjects[role], body: bodies[role] };
}

// ─── Draft modal ──────────────────────────────────────────────────────────────

function DraftEmailModal({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const { subject, body } = buildEmailDraft(contact);
  const [copied, setCopied] = useState<"subject" | "body" | "all" | null>(null);

  const copy = (text: string, which: typeof copied) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Draft Email — {[contact.first_name, contact.last_name].filter(Boolean).join(" ")}
            </h3>
            {contact.title && <p className="text-xs text-gray-500 mt-0.5">{contact.title} · {contact.plant_name}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {contact.email && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <span className="text-sm font-mono bg-gray-50 border border-gray-200 rounded px-3 py-1.5 block">{contact.email}</span>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-500">Subject</label>
              <button onClick={() => copy(subject, "subject")} className="text-xs text-gray-400 hover:text-gray-600">
                {copied === "subject" ? "✓ Copied" : "Copy"}
              </button>
            </div>
            <span className="text-sm bg-gray-50 border border-gray-200 rounded px-3 py-1.5 block">{subject}</span>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-500">Body</label>
              <button onClick={() => copy(body, "body")} className="text-xs text-gray-400 hover:text-gray-600">
                {copied === "body" ? "✓ Copied" : "Copy body"}
              </button>
            </div>
            <textarea readOnly value={body} className="w-full h-64 text-sm bg-gray-50 border border-gray-200 rounded px-3 py-2 resize-none font-sans leading-relaxed focus:outline-none" />
          </div>
          <p className="text-xs text-amber-600">Replace <span className="font-mono">[Your Name]</span>, <span className="font-mono">[X miles]</span>, and <span className="font-mono">[Your Phone]</span> before sending.</p>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <button onClick={() => copy(`Subject: ${subject}\n\n${body}`, "all")} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            {copied === "all" ? "✓ Copied!" : "Copy full email"}
          </button>
          {contact.email && (
            <a href={`mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
              className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700">
              Open in mail app ↗
            </a>
          )}
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 px-3 py-2">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Contact card ─────────────────────────────────────────────────────────────

function ContactCard({ contact, onDelete, onDraft }: {
  contact: Contact;
  onDelete: (id: string) => void;
  onDraft: (c: Contact) => void;
}) {
  const role = getRole(contact.title);
  const meta = ROLE_META[role];
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unknown";
  const location = [contact.plant_city, contact.plant_state].filter(Boolean).join(", ");
  const isAI = contact.source === "n8n-search";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* Avatar + name row */}
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ring-2 ${meta.bg} ${meta.color} ${meta.ring}`}>
          {initials(contact)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm leading-snug">{name}</span>
            {isAI && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium border border-blue-100">AI</span>
            )}
          </div>
          {contact.title && (
            <span className={`inline-block text-xs font-medium mt-0.5 px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
              {contact.title}
            </span>
          )}
        </div>
      </div>

      {/* Company */}
      {contact.plant_name && (
        <div className="flex items-start gap-2 text-sm text-gray-700">
          <svg className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 21h16.5M4.5 3h15l.75 18H3.75L4.5 3zM9 21V9m6 12V9M9 9h6M9 6h6" />
          </svg>
          <div>
            <span className="font-medium">{contact.plant_name}</span>
            {location && <span className="text-gray-400 text-xs block">{location}</span>}
          </div>
        </div>
      )}

      {/* Contact info */}
      <div className="space-y-1.5">
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-xs text-blue-600 hover:underline truncate">
            <svg className="w-3.5 h-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {contact.email}
          </a>
        )}
        {contact.phone && (
          <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
            <svg className="w-3.5 h-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            {contact.phone}
          </a>
        )}
        {contact.linkedin_url && (
          <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
            <svg className="w-3.5 h-3.5 shrink-0 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
            </svg>
            LinkedIn
          </a>
        )}
        {contact.source_url && (
          <a href={contact.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 truncate" title={contact.source_url}>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Source
          </a>
        )}
      </div>

      {/* No contact info */}
      {!contact.email && !contact.phone && !contact.linkedin_url && (
        <p className="text-xs text-gray-400 italic">No contact info</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-gray-100 mt-auto">
        {contact.email && (
          <button onClick={() => onDraft(contact)}
            className="flex-1 text-xs py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium transition-colors">
            ✉ Draft email
          </button>
        )}
        <button onClick={() => onDelete(contact.id)}
          className="text-xs py-1.5 px-3 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
          Remove
        </button>
      </div>
    </div>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm font-medium text-gray-600 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Role distribution bar ────────────────────────────────────────────────────

function RoleBar({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) return null;
  const counts: Partial<Record<RoleKey, number>> = {};
  for (const c of contacts) {
    const r = getRole(c.title);
    counts[r] = (counts[r] ?? 0) + 1;
  }
  const sorted = (Object.entries(counts) as [RoleKey, number][]).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Role breakdown</p>
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {sorted.map(([role, count]) => {
          const pct = (count / contacts.length) * 100;
          const bgMap: Record<RoleKey, string> = {
            maintenance: "bg-blue-400", reliability: "bg-violet-400", plant: "bg-emerald-400",
            operations: "bg-orange-400", purchasing: "bg-teal-400", executive: "bg-rose-400",
            facilities: "bg-amber-400", other: "bg-gray-300",
          };
          return <div key={role} className={`${bgMap[role]} rounded-full`} style={{ width: `${pct}%` }} title={`${ROLE_META[role].label}: ${count}`} />;
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
        {sorted.map(([role, count]) => (
          <span key={role} className={`text-xs font-medium flex items-center gap-1 ${ROLE_META[role].color}`}>
            <span className={`w-2 h-2 rounded-full inline-block ${ROLE_META[role].bg.replace("bg-", "bg-").replace("-100", "-400")}`} />
            {ROLE_META[role].label} ({count})
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const ROLE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All roles" },
  ...Object.entries(ROLE_META).map(([k, v]) => ({ value: k, label: v.label })),
];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [draftContact, setDraftContact] = useState<Contact | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchContacts()
      .then(setContacts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // stats (computed on full list)
  const stats = useMemo(() => ({
    total: contacts.length,
    withEmail: contacts.filter(c => c.email).length,
    withPhone: contacts.filter(c => c.phone).length,
    withLinkedIn: contacts.filter(c => c.linkedin_url).length,
    plants: new Set(contacts.map(c => c.plant_id)).size,
  }), [contacts]);

  // filtered list
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter(c => {
      if (q) {
        const hay = [c.first_name, c.last_name, c.title, c.email, c.plant_name, c.plant_city]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (roleFilter !== "all" && getRole(c.title) !== roleFilter) return false;
      if (sourceFilter === "ai" && c.source !== "n8n-search") return false;
      if (sourceFilter === "manual" && c.source !== "manual") return false;
      return true;
    });
  }, [contacts, search, roleFilter, sourceFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this contact?")) return;
    setDeletingId(id);
    try {
      await deleteContact(id);
      setContacts(prev => prev.filter(c => c.id !== id));
    } catch {
      alert("Failed to delete contact");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      {draftContact && <DraftEmailModal contact={draftContact} onClose={() => setDraftContact(null)} />}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? "Loading..." : `${stats.total} contact${stats.total !== 1 ? "s" : ""} across ${stats.plants} plant${stats.plants !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {/* Stats row */}
        {!loading && contacts.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Total contacts" value={stats.total} />
            <StatCard label="Have email" value={stats.withEmail} sub={`${Math.round(stats.withEmail / stats.total * 100)}% coverage`} />
            <StatCard label="Have phone" value={stats.withPhone} />
            <StatCard label="Have LinkedIn" value={stats.withLinkedIn} />
            <StatCard label="Plants covered" value={stats.plants} />
          </div>
        )}

        {/* Role distribution */}
        {!loading && contacts.length > 0 && <RoleBar contacts={contacts} />}

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, title, company, email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="rounded-lg border border-gray-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {ROLE_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="rounded-lg border border-gray-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">All sources</option>
            <option value="ai">AI found</option>
            <option value="manual">Manual</option>
          </select>
        </div>

        {/* Results count */}
        {!loading && search || roleFilter !== "all" || sourceFilter !== "all" ? (
          <p className="text-sm text-gray-500 -mt-3">
            Showing {filtered.length} of {contacts.length} contacts
          </p>
        ) : null}

        {/* Contact grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-52 animate-pulse">
                <div className="flex gap-3 mb-4">
                  <div className="w-11 h-11 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-full" />
                  <div className="h-3 bg-gray-200 rounded w-5/6" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="font-medium text-gray-500">
              {contacts.length === 0 ? "No contacts yet" : "No contacts match your filters"}
            </p>
            <p className="text-sm mt-1">
              {contacts.length === 0
                ? `Open a plant on the dashboard and use "Search with AI" to find contacts.`
                : "Try adjusting your search or filters."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(contact => (
              deletingId === contact.id
                ? <div key={contact.id} className="bg-white rounded-xl border border-gray-200 p-5 h-52 animate-pulse opacity-50" />
                : <ContactCard key={contact.id} contact={contact} onDelete={handleDelete} onDraft={setDraftContact} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

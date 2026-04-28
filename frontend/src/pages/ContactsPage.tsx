import { useState, useEffect, useMemo } from "react";
import { fetchContacts, patchContact, deleteContact, type Contact } from "../api/contacts";

type RoleKey = "maintenance" | "reliability" | "plant" | "operations" | "purchasing" | "executive" | "facilities" | "other";

const ROLE_META: Record<RoleKey, { label: string; color: string; bg: string; ring: string }> = {
  maintenance: { label: "Maintenance",  color: "text-blue-700",    bg: "bg-blue-100",    ring: "ring-blue-200" },
  reliability: { label: "Reliability",  color: "text-violet-700",  bg: "bg-violet-100",  ring: "ring-violet-200" },
  plant:       { label: "Plant Mgr",    color: "text-emerald-700", bg: "bg-emerald-100", ring: "ring-emerald-200" },
  operations:  { label: "Operations",   color: "text-orange-700",  bg: "bg-orange-100",  ring: "ring-orange-200" },
  purchasing:  { label: "Purchasing",   color: "text-teal-700",    bg: "bg-teal-100",    ring: "ring-teal-200" },
  executive:   { label: "Executive",    color: "text-rose-700",    bg: "bg-rose-100",    ring: "ring-rose-200" },
  facilities:  { label: "Facilities",   color: "text-amber-700",   bg: "bg-amber-100",   ring: "ring-amber-200" },
  other:       { label: "Other",        color: "text-gray-600",    bg: "bg-gray-100",    ring: "ring-gray-200" },
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

function initials(c: Contact) {
  return ((c.first_name?.[0] ?? "") + (c.last_name?.[0] ?? "")).toUpperCase() || "?";
}

function ContactCard({ contact, onUpdate, onDelete }: {
  contact: Contact;
  onUpdate: (c: Contact) => void;
  onDelete: (id: string) => void;
}) {
  const role = getRole(contact.title);
  const meta = ROLE_META[role];
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unknown";
  const location = [contact.plant_city, contact.plant_state].filter(Boolean).join(", ");
  const isVerified = contact.verified === 1;
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(contact.notes ?? "");

  const saveNote = async () => {
    const updated = await patchContact(contact.id, { notes: noteText.trim() || null });
    onUpdate(updated);
    setEditingNote(false);
  };

  const toggleVerified = async () => {
    const updated = await patchContact(contact.id, { verified: isVerified ? 0 : 1 });
    onUpdate(updated);
  };

  const markContacted = async () => {
    const today = new Date().toISOString().split("T")[0];
    const updated = await patchContact(contact.id, { last_contacted: today });
    onUpdate(updated);
  };

  return (
    <div className={`bg-white rounded-xl border p-5 flex flex-col gap-3 hover:shadow-md transition-shadow ${isVerified ? "border-emerald-200" : "border-gray-200"}`}>
      {/* Avatar + name */}
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ring-2 ${meta.bg} ${meta.color} ${meta.ring}`}>
          {initials(contact)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{name}</span>
            {isVerified && <span className="text-emerald-600 text-xs font-medium">✓ verified</span>}
            {contact.source === "n8n-search" && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">AI</span>
            )}
          </div>
          {contact.title && (
            <span className={`inline-block text-xs font-medium mt-0.5 px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
              {contact.title}
            </span>
          )}
        </div>
        <button onClick={toggleVerified} title={isVerified ? "Mark unverified" : "Mark as verified"}
          className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center border text-xs transition-colors ${isVerified ? "bg-emerald-100 border-emerald-300 text-emerald-600" : "bg-gray-50 border-gray-200 text-gray-300 hover:border-emerald-300 hover:text-emerald-500"}`}>
          ✓
        </button>
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
        {contact.email ? (
          <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-xs text-blue-600 hover:underline truncate">
            <svg className="w-3.5 h-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            {contact.email}
          </a>
        ) : <span className="text-xs text-gray-300 flex items-center gap-2"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>No email</span>}

        {contact.phone ? (
          <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
            <svg className="w-3.5 h-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            {contact.phone}
          </a>
        ) : <span className="text-xs text-gray-300 flex items-center gap-2"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>No phone</span>}

        {contact.linkedin_url && (
          <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
            <svg className="w-3.5 h-3.5 shrink-0 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
            LinkedIn ↗
          </a>
        )}
        {contact.source_url && (
          <a href={contact.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 truncate" title={contact.source_url}>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            Source ↗
          </a>
        )}
        {contact.last_contacted && (
          <p className="text-xs text-gray-400">Contacted {new Date(contact.last_contacted).toLocaleDateString()}</p>
        )}
      </div>

      {/* Note */}
      {editingNote ? (
        <div className="space-y-1">
          <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2} autoFocus
            placeholder="Notes, context, objections…"
            className="w-full text-xs rounded border border-gray-300 px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400" />
          <div className="flex gap-2">
            <button onClick={saveNote} className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded">Save</button>
            <button onClick={() => { setNoteText(contact.notes ?? ""); setEditingNote(false); }} className="text-xs text-gray-400">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditingNote(true)} className="text-left text-xs text-gray-400 hover:text-gray-600 truncate">
          {contact.notes ? `📝 ${contact.notes}` : "+ Add note"}
        </button>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-gray-100 mt-auto">
        <button onClick={markContacted} title="Log as contacted today"
          className="flex-1 text-xs py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200">
          📞 Contacted
        </button>
        <button onClick={() => onDelete(contact.id)}
          className="text-xs py-1.5 px-3 rounded-lg text-red-500 hover:bg-red-50">
          Remove
        </button>
      </div>
    </div>
  );
}

const ROLE_OPTIONS = [
  { value: "all", label: "All roles" },
  ...Object.entries(ROLE_META).map(([k, v]) => ({ value: k, label: v.label })),
];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [verifiedFilter, setVerifiedFilter] = useState("all");

  useEffect(() => {
    fetchContacts().then(setContacts).catch(console.error).finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => ({
    total: contacts.length,
    withEmail: contacts.filter(c => c.email).length,
    withPhone: contacts.filter(c => c.phone).length,
    verified: contacts.filter(c => c.verified === 1).length,
    plants: new Set(contacts.map(c => c.plant_id)).size,
  }), [contacts]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter(c => {
      if (q) {
        const hay = [c.first_name, c.last_name, c.title, c.email, c.plant_name, c.plant_city, c.notes].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (roleFilter !== "all" && getRole(c.title) !== roleFilter) return false;
      if (verifiedFilter === "verified" && c.verified !== 1) return false;
      if (verifiedFilter === "unverified" && c.verified === 1) return false;
      return true;
    });
  }, [contacts, search, roleFilter, verifiedFilter]);

  const handleUpdate = (updated: Contact) => setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
  const handleDelete = async (id: string) => {
    if (!confirm("Remove this contact?")) return;
    try { await deleteContact(id); setContacts(prev => prev.filter(c => c.id !== id)); }
    catch { alert("Failed to delete"); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {loading ? "Loading…" : `${stats.total} contact${stats.total !== 1 ? "s" : ""} across ${stats.plants} plant${stats.plants !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Stats */}
      {!loading && contacts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total },
            { label: "Have email", value: stats.withEmail },
            { label: "Have phone", value: stats.withPhone },
            { label: "Verified", value: stats.verified, highlight: true },
            { label: "Plants", value: stats.plants },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "bg-emerald-50 border-emerald-200" : "bg-white border-gray-200"}`}>
              <p className={`text-xl font-bold ${s.highlight ? "text-emerald-700" : "text-gray-900"}`}>{s.value}</p>
              <p className={`text-xs font-medium mt-0.5 ${s.highlight ? "text-emerald-600" : "text-gray-500"}`}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" placeholder="Search name, title, company, email…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="rounded-lg border border-gray-300 text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={verifiedFilter} onChange={e => setVerifiedFilter(e.target.value)}
          className="rounded-lg border border-gray-300 text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All contacts</option>
          <option value="verified">Verified only</option>
          <option value="unverified">Needs verification</option>
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-56 animate-pulse">
              <div className="flex gap-3 mb-4"><div className="w-11 h-11 rounded-full bg-gray-200"/><div className="flex-1 space-y-2 pt-1"><div className="h-3 bg-gray-200 rounded w-3/4"/><div className="h-3 bg-gray-200 rounded w-1/2"/></div></div>
              <div className="space-y-2"><div className="h-3 bg-gray-200 rounded w-full"/><div className="h-3 bg-gray-200 rounded w-5/6"/></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          <p className="font-medium text-gray-500">{contacts.length === 0 ? "No contacts yet" : "No contacts match your filters"}</p>
          <p className="text-sm mt-1">{contacts.length === 0 ? `Open a plant on the dashboard and use "Search with AI" to find contacts.` : "Try adjusting your filters."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(contact => (
            <ContactCard key={contact.id} contact={contact} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

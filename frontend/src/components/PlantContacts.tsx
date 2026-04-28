import { useState, useEffect } from "react";
import type { Plant } from "../api/plants";
import {
  fetchContacts,
  findContacts,
  enrichContact,
  deleteContact,
  createContact,
  patchContact,
  type Contact,
} from "../api/contacts";

interface PlantContactsProps {
  plant: Plant;
  onClose: () => void;
}

const SOURCE_LABEL: Record<string, { text: string; color: string }> = {
  "n8n-search": { text: "AI found",  color: "bg-blue-100 text-blue-700" },
  "manual":     { text: "manual",    color: "bg-gray-100 text-gray-500" },
};

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
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

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

  useEffect(() => { load(); }, [plant.id]);

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
        alert("No contacts found. Try adding manually.");
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
      setContacts(prev => prev.map(c => c.id === contact.id ? updated : c));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to enrich contact");
    } finally {
      setEnrichingId(null);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFirst.trim() && !addLast.trim()) { alert("Enter at least first or last name."); return; }
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
      setContacts(prev => [created, ...prev]);
      setShowAddForm(false);
      setAddFirst(""); setAddLast(""); setAddTitle(""); setAddEmail(""); setAddPhone("");
    } catch (err) {
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
      setContacts(prev => prev.filter(c => c.id !== contact.id));
    } catch { alert("Failed to delete contact"); }
    finally { setDeletingId(null); }
  };

  const handleSaveNote = async (id: string) => {
    try {
      const updated = await patchContact(id, { notes: noteText.trim() || null });
      setContacts(prev => prev.map(c => c.id === id ? updated : c));
      setEditingNoteId(null);
    } catch { /* ignore */ }
  };

  const handleToggleVerified = async (contact: Contact) => {
    try {
      const updated = await patchContact(contact.id, { verified: contact.verified === 1 ? 0 : 1 });
      setContacts(prev => prev.map(c => c.id === contact.id ? updated : c));
    } catch { /* ignore */ }
  };

  const handleMarkContacted = async (contact: Contact) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const updated = await patchContact(contact.id, { last_contacted: today });
      setContacts(prev => prev.map(c => c.id === contact.id ? updated : c));
    } catch { /* ignore */ }
  };

  const displayName = (c: Contact) =>
    [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Contacts — {plant.name ?? "Plant"}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-gray-200 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowAddForm(v => !v)}
              className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">
              {showAddForm ? "Cancel" : "+ Add contact"}
            </button>
            <button onClick={handleFindContacts} disabled={finding}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center gap-2">
              {finding ? (
                <><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Searching…</>
              ) : "Search with AI"}
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleAddContact} className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-gray-50 rounded-md">
              <input type="text" placeholder="First name" value={addFirst} onChange={e => setAddFirst(e.target.value)} className="rounded border-gray-300 text-sm" />
              <input type="text" placeholder="Last name" value={addLast} onChange={e => setAddLast(e.target.value)} className="rounded border-gray-300 text-sm" />
              <input type="text" placeholder="Title" value={addTitle} onChange={e => setAddTitle(e.target.value)} className="rounded border-gray-300 text-sm sm:col-span-2" />
              <input type="email" placeholder="Email" value={addEmail} onChange={e => setAddEmail(e.target.value)} className="rounded border-gray-300 text-sm" />
              <input type="tel" placeholder="Phone" value={addPhone} onChange={e => setAddPhone(e.target.value)} className="rounded border-gray-300 text-sm" />
              <button type="submit" disabled={adding} className="sm:col-span-2 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm">
                {adding ? "Adding…" : "Save contact"}
              </button>
            </form>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : contacts.length === 0 ? (
            <p className="text-sm text-gray-500">No contacts yet. Add one manually or use "Search with AI".</p>
          ) : (
            <ul className="space-y-3">
              {contacts.map(contact => {
                const srcMeta = SOURCE_LABEL[contact.source] ?? { text: contact.source, color: "bg-gray-100 text-gray-500" };
                const isVerified = contact.verified === 1;
                return (
                  <li key={contact.id} className={`border rounded-lg p-4 ${isVerified ? "border-emerald-200 bg-emerald-50/30" : "border-gray-200"}`}>
                    <div className="flex justify-between items-start gap-3">
                      {/* Info */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 text-sm">{displayName(contact)}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${srcMeta.color}`}>{srcMeta.text}</span>
                          {isVerified && <span className="text-xs text-emerald-600 font-medium">✓ verified</span>}
                        </div>
                        {contact.title && <p className="text-sm text-gray-600">{contact.title}</p>}
                        {contact.email && (
                          <a href={`mailto:${contact.email}`} className="text-sm text-blue-600 hover:underline block truncate">{contact.email}</a>
                        )}
                        {contact.phone && (
                          <a href={`tel:${contact.phone}`} className="text-sm text-blue-600 hover:underline block">{contact.phone}</a>
                        )}
                        {contact.linkedin_url && (
                          <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline block">LinkedIn ↗</a>
                        )}
                        {contact.source_url && (
                          <a href={contact.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-gray-600 block truncate" title={contact.source_url}>🔗 Source ↗</a>
                        )}
                        {contact.last_contacted && (
                          <p className="text-xs text-gray-400">Last contacted: {new Date(contact.last_contacted).toLocaleDateString()}</p>
                        )}

                        {/* Notes */}
                        {editingNoteId === contact.id ? (
                          <div className="mt-2 space-y-1">
                            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2} autoFocus
                              placeholder="Notes, objections, context…"
                              className="w-full text-xs rounded border border-gray-300 px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            <div className="flex gap-2">
                              <button onClick={() => handleSaveNote(contact.id)} className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded">Save</button>
                              <button onClick={() => setEditingNoteId(null)} className="text-xs text-gray-500">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingNoteId(contact.id); setNoteText(contact.notes ?? ""); }}
                            className="text-xs text-gray-400 hover:text-gray-600 mt-1 block truncate max-w-full">
                            {contact.notes ? `📝 ${contact.notes}` : "+ Add note"}
                          </button>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button onClick={() => handleToggleVerified(contact)}
                          title={isVerified ? "Mark unverified" : "Mark verified"}
                          className={`px-2.5 py-1 text-xs rounded border transition-colors ${isVerified ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-white text-gray-400 border-gray-200 hover:border-emerald-300 hover:text-emerald-600"}`}>
                          ✓
                        </button>
                        <button onClick={() => handleMarkContacted(contact)}
                          className="px-2.5 py-1 text-xs rounded bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
                          title="Log contact today">
                          📞
                        </button>
                        {contact.apollo_id && !contact.email && (
                          <button onClick={() => handleEnrich(contact)} disabled={enrichingId === contact.id}
                            className="px-2.5 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50">
                            {enrichingId === contact.id ? "…" : "Get email"}
                          </button>
                        )}
                        <button onClick={() => handleDelete(contact)} disabled={deletingId === contact.id}
                          className="px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 rounded disabled:opacity-50">
                          {deletingId === contact.id ? "…" : "Remove"}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

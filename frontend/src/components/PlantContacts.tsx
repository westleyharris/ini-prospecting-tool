import { useState, useEffect } from "react";
import type { Plant } from "../api/plants";
import {
  fetchContacts,
  findContacts,
  enrichContact,
  deleteContact,
  type Contact,
} from "../api/contacts";

interface PlantContactsProps {
  plant: Plant;
  onClose: () => void;
}

export default function PlantContacts({ plant, onClose }: PlantContactsProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [finding, setFinding] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    if (!plant.website) {
      alert("This plant has no website. Add a website to find contacts.");
      return;
    }
    setFinding(true);
    try {
      const result = await findContacts(plant.id);
      setContacts(result.contacts);
      if (result.added > 0) {
        alert(`Found ${result.added} new contact${result.added === 1 ? "" : "s"}. Use "Get email" to retrieve contact details (consumes Apollo credits).`);
      } else if (result.total > 0) {
        alert("No new contacts found. Existing contacts are shown.");
      } else {
        alert("No contacts found for this company domain. Try a different plant.");
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
      setContacts((prev) =>
        prev.map((c) => (c.id === contact.id ? updated : c))
      );
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to enrich contact");
    } finally {
      setEnrichingId(null);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
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
        <div className="px-6 py-4 border-b border-gray-200">
          <button
            onClick={handleFindContacts}
            disabled={finding || !plant.website}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {finding ? "Searching..." : "Find contacts (Apollo)"}
          </button>
          {!plant.website && (
            <p className="text-sm text-amber-600 mt-2">
              No website — add a website to this plant to find contacts.
            </p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-gray-500">Loading contacts...</p>
          ) : contacts.length === 0 ? (
            <p className="text-gray-500">
              No contacts yet. Click &quot;Find contacts&quot; to search Apollo for people at this company.
            </p>
          ) : (
            <ul className="space-y-4">
              {contacts.map((contact) => (
                <li
                  key={contact.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {displayName(contact)}
                      </p>
                      {contact.title && (
                        <p className="text-sm text-gray-600">{contact.title}</p>
                      )}
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-sm text-blue-600 hover:underline block mt-1"
                        >
                          {contact.email}
                        </a>
                      )}
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone}`}
                          className="text-sm text-blue-600 hover:underline block mt-1"
                        >
                          {contact.phone}
                        </a>
                      )}
                      {contact.linkedin_url && (
                        <a
                          href={contact.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline block mt-1"
                        >
                          LinkedIn ↗
                        </a>
                      )}
                      {!contact.email && contact.apollo_id && (
                        <p className="text-xs text-amber-600 mt-1">
                          Click &quot;Get email&quot; to retrieve (consumes credits)
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {contact.apollo_id && !contact.email && (
                        <button
                          onClick={() => handleEnrich(contact)}
                          disabled={enrichingId === contact.id}
                          className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                        >
                          {enrichingId === contact.id ? "Getting..." : "Get email"}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(contact)}
                        disabled={deletingId === contact.id}
                        className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
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
  );
}

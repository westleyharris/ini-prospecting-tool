import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db.js";
import {
  searchPeopleByDomain,
  enrichPeople,
  extractDomain,
} from "../services/apollo.js";

export const contactsRouter = Router();

contactsRouter.post("/", (req, res) => {
  try {
    const { plant_id, first_name, last_name, title, email, phone } = req.body;
    if (!plant_id || typeof plant_id !== "string") {
      return res.status(400).json({ error: "plant_id is required" });
    }
    const plant = db.prepare("SELECT id FROM plants WHERE id = ?").get(plant_id);
    if (!plant) {
      return res.status(404).json({ error: "Plant not found" });
    }
    const id = uuidv4();
    db.prepare(
      `INSERT INTO contacts (id, plant_id, apollo_id, first_name, last_name, title, email, phone, source, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'manual', datetime('now'), datetime('now'))`
    ).run(
      id,
      plant_id,
      first_name ?? null,
      last_name ?? null,
      title ?? null,
      email ?? null,
      phone ?? null
    );
    const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id);
    res.status(201).json(contact);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create contact" });
  }
});

contactsRouter.get("/", (req, res) => {
  try {
    const plantId = req.query.plant_id as string | undefined;
    let sql = `
      SELECT c.*,
             p.name        AS plant_name,
             p.city        AS plant_city,
             p.state       AS plant_state,
             p.website     AS plant_website,
             p.formatted_address AS plant_address
      FROM contacts c
      LEFT JOIN plants p ON c.plant_id = p.id
      WHERE 1=1`;
    const params: string[] = [];

    if (plantId) {
      sql += " AND c.plant_id = ?";
      params.push(plantId);
    }

    sql += " ORDER BY c.created_at DESC";
    const contacts = params.length
      ? db.prepare(sql).all(...params)
      : db.prepare(sql).all();
    res.json(contacts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

contactsRouter.get("/:id", (req, res) => {
  try {
    const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(
      req.params.id
    );
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }
    res.json(contact);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch contact" });
  }
});

contactsRouter.post("/:id/enrich", async (req, res) => {
  try {
    const id = req.params.id as string;
    const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id) as
      | { apollo_id: string | null }
      | undefined;

    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }
    if (!contact.apollo_id) {
      return res.status(400).json({
        error: "Contact has no Apollo ID - cannot enrich",
      });
    }

    const apiKey = (process.env.APOLLO_API_KEY || "").trim();
    if (!apiKey) {
      return res.status(503).json({
        error: "APOLLO_API_KEY not configured. Add it to .env in the project root.",
      });
    }

    const result = await enrichPeople(apiKey, [contact.apollo_id], {
      revealEmail: true,
      revealPhone: false, // Apollo requires webhook_url for phone numbers
    });

    const person = result.people?.[0];
    if (!person) {
      return res.status(404).json({ error: "Apollo could not enrich this contact" });
    }

    const email = person.email ?? person.sanitized_email ?? null;
    const phone = person.phone_numbers?.[0]?.sanitized_number ??
      person.phone_numbers?.[0]?.raw_number ??
      null;

    db.prepare(
      `UPDATE contacts SET
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        title = COALESCE(?, title),
        email = ?,
        phone = ?,
        linkedin_url = COALESCE(?, linkedin_url),
        updated_at = datetime('now')
      WHERE id = ?`
    ).run(
      person.first_name ?? null,
      person.last_name ?? null,
      person.title ?? null,
      email,
      phone,
      person.linkedin_url ?? null,
      id
    );

    const updated = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Enrichment failed",
    });
  }
});

contactsRouter.patch("/:id", (req, res) => {
  try {
    const id = req.params.id as string;
    const contact = db.prepare("SELECT id FROM contacts WHERE id = ?").get(id);
    if (!contact) return res.status(404).json({ error: "Contact not found" });

    const allowed = ["notes", "last_contacted", "verified", "buying_role", "first_name", "last_name", "title", "email", "phone", "linkedin_url"];
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const key of allowed) {
      if (key in req.body) {
        fields.push(`${key} = ?`);
        values.push(req.body[key] ?? null);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: "No valid fields to update" });

    fields.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE contacts SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    const updated = db.prepare(`
      SELECT c.*, p.name AS plant_name, p.city AS plant_city, p.state AS plant_state,
             p.website AS plant_website, p.formatted_address AS plant_address
      FROM contacts c LEFT JOIN plants p ON c.plant_id = p.id WHERE c.id = ?`).get(id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update contact" });
  }
});

contactsRouter.delete("/:id", (req, res) => {
  try {
    const id = req.params.id as string;
    const result = db.prepare("DELETE FROM contacts WHERE id = ?").run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Contact not found" });
    }

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

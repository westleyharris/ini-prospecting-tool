import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db.js";
import { getReferenceCoords } from "../services/distance.js";
import { haversineMiles } from "../services/distance.js";
import {
  searchPeopleByDomain,
  extractDomain,
} from "../services/hunter.js";
import { isExcludedFromDbPlant } from "../services/manufacturingFilter.js";

export const plantsRouter = Router();

plantsRouter.get("/", async (req, res) => {
  try {
    const contacted = req.query.contacted as string | undefined;
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50000, 1), 50000);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    let sql = `SELECT p.*,
      (SELECT COUNT(*) FROM visits v WHERE v.plant_id = p.id) as visit_count,
      (SELECT COUNT(*) FROM projects proj WHERE proj.plant_id = p.id) as project_count
      FROM plants p WHERE 1=1`;
    const params: (string | number)[] = [];

    if (contacted !== undefined) {
      if (contacted === "true" || contacted === "1") {
        sql += " AND p.contacted = 1";
      } else if (contacted === "false" || contacted === "0") {
        sql += " AND p.contacted = 0";
      }
    }

    sql += " ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const plants = db.prepare(sql).all(...params) as Record<string, unknown>[];

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    const ref = apiKey ? await getReferenceCoords(apiKey) : null;

    const plantsWithDistance = plants.map((p) => {
      const plant = { ...p };
      if (ref && p.lat != null && p.lng != null) {
        (plant as Record<string, unknown>).distance_miles = Math.round(
          haversineMiles(ref.lat, ref.lng, p.lat as number, p.lng as number) * 10
        ) / 10;
      } else {
        (plant as Record<string, unknown>).distance_miles = null;
      }
      return plant;
    });

    res.json(plantsWithDistance);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch plants" });
  }
});

plantsRouter.post("/", (req, res) => {
  try {
    const { name, formatted_address, city, state, postal_code, phone, website, notes } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    const id = uuidv4();
    const placeId = `manual-${id}`;
    const shortAddr = [city, state].filter(Boolean).join(", ") || formatted_address?.trim() || null;

    db.prepare(
      `INSERT INTO plants (
        id, place_id, name, formatted_address, city, state, postal_code,
        phone, website, data_source, notes, short_formatted_address,
        contacted, current_customer, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, 0, 0, datetime('now'), datetime('now'))`
    ).run(
      id,
      placeId,
      name.trim(),
      formatted_address?.trim() || null,
      city?.trim() || null,
      state?.trim() || null,
      postal_code?.trim() || null,
      phone?.trim() || null,
      website?.trim() || null,
      notes?.trim() || null,
      shortAddr
    );

    const plant = db.prepare("SELECT * FROM plants WHERE id = ?").get(id) as Record<string, unknown>;
    (plant as Record<string, unknown>).visit_count = 0;
    (plant as Record<string, unknown>).project_count = 0;
    (plant as Record<string, unknown>).distance_miles = null;
    res.status(201).json(plant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create plant" });
  }
});

plantsRouter.get("/metrics", (req, res) => {
  try {
    const total = (
      db.prepare("SELECT COUNT(*) as c FROM plants").get() as { c: number }
    ).c;
    const contacted = (
      db.prepare("SELECT COUNT(*) as c FROM plants WHERE contacted = 1").get() as {
        c: number;
      }
    ).c;
    const currentCustomers = (
      db.prepare("SELECT COUNT(*) as c FROM plants WHERE current_customer = 1").get() as {
        c: number;
      }
    ).c;
    const pendingFollowUps = (
      db
        .prepare(
          "SELECT COUNT(*) as c FROM plants WHERE follow_up_date IS NOT NULL AND follow_up_date >= date('now')"
        )
        .get() as { c: number }
    ).c;
    const newThisWeek = (
      db
        .prepare(
          "SELECT COUNT(*) as c FROM plants WHERE created_at >= date('now', '-7 days')"
        )
        .get() as { c: number }
    ).c;

    const totalVisits = (db.prepare("SELECT COUNT(*) as c FROM visits").get() as { c: number }).c;
    const totalProjects = (db.prepare("SELECT COUNT(*) as c FROM projects").get() as { c: number }).c;
    const totalCommissionings = (db.prepare("SELECT COUNT(*) as c FROM commissionings").get() as { c: number }).c;

    res.json({
      total,
      contacted,
      currentCustomers,
      pendingFollowUps,
      newThisWeek,
      totalVisits,
      totalProjects,
      totalCommissionings,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

plantsRouter.get("/:id/photo", async (req, res) => {
  try {
    const id = req.params.id as string;
    const plant = db.prepare("SELECT photo_name FROM plants WHERE id = ?").get(id) as
      | { photo_name: string | null }
      | undefined;
    if (!plant?.photo_name) {
      return res.status(404).json({ error: "No photo for this plant" });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "Photo service unavailable" });
    }

    const url = `https://places.googleapis.com/v1/${plant.photo_name}/media?maxWidthPx=150&maxHeightPx=150&key=${apiKey}`;
    const imgRes = await fetch(url, { redirect: "follow" });
    if (!imgRes.ok) {
      return res.status(imgRes.status).json({ error: "Failed to fetch photo" });
    }

    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buffer = await imgRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch photo" });
  }
});

plantsRouter.get("/:id/contacts", (req, res) => {
  try {
    const plantId = req.params.id as string;
    const plant = db.prepare("SELECT id FROM plants WHERE id = ?").get(plantId);
    if (!plant) {
      return res.status(404).json({ error: "Plant not found" });
    }
    const contacts = db
      .prepare("SELECT * FROM contacts WHERE plant_id = ? ORDER BY created_at DESC")
      .all(plantId);
    res.json(contacts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

plantsRouter.post("/:id/find-contacts", async (req, res) => {
  try {
    const plantId = req.params.id as string;
    const plant = db.prepare("SELECT * FROM plants WHERE id = ?").get(plantId) as
      | { id: string; website: string | null; name: string | null }
      | undefined;

    if (!plant) {
      return res.status(404).json({ error: "Plant not found" });
    }

    const domain = extractDomain(plant.website);
    if (!domain) {
      return res.status(400).json({
        error: "Plant has no website. Add a website to find contacts.",
      });
    }

    const apiKey = (process.env.HUNTER_API_KEY || "").trim();
    if (!apiKey) {
      return res.status(503).json({
        error: "HUNTER_API_KEY not configured. Add it to .env in the project root.",
      });
    }

    const result = await searchPeopleByDomain(apiKey, domain, {
      limit: 10,
      offset: 0,
    });

    const emails = result.data?.emails ?? [];
    const existingEmails = new Set(
      (
        db
          .prepare("SELECT email FROM contacts WHERE plant_id = ? AND email IS NOT NULL")
          .all(plantId) as { email: string }[]
      ).map((c) => c.email.toLowerCase())
    );

    const insertStmt = db.prepare(`
      INSERT INTO contacts (id, plant_id, apollo_id, first_name, last_name, title, email, phone, linkedin_url, source, created_at, updated_at)
      VALUES (@id, @plant_id, NULL, @first_name, @last_name, @title, @email, @phone, @linkedin_url, 'hunter', datetime('now'), datetime('now'))
    `);

    let added = 0;
    for (const person of emails) {
      const email = person.value?.trim();
      if (!email || existingEmails.has(email.toLowerCase())) continue;
      existingEmails.add(email.toLowerCase());

      const linkedin = person.linkedin?.trim() || null;
      const linkedinUrl = linkedin && !linkedin.startsWith("http") ? `https://linkedin.com/in/${linkedin.replace(/^\//, "")}` : linkedin;

      insertStmt.run({
        id: uuidv4(),
        plant_id: plantId,
        first_name: person.first_name ?? null,
        last_name: person.last_name ?? null,
        title: person.position ?? person.position_raw ?? null,
        email,
        phone: person.phone_number ?? null,
        linkedin_url: linkedinUrl,
      });
      added++;
    }

    const contacts = db
      .prepare("SELECT * FROM contacts WHERE plant_id = ? ORDER BY created_at DESC")
      .all(plantId);

    res.json({
      added,
      total: contacts.length,
      contacts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to find contacts",
    });
  }
});

plantsRouter.get("/:id", async (req, res) => {
  try {
    const plant = db.prepare("SELECT * FROM plants WHERE id = ?").get(
      req.params.id
    ) as Record<string, unknown> | undefined;
    if (!plant) {
      return res.status(404).json({ error: "Plant not found" });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    const ref = apiKey ? await getReferenceCoords(apiKey) : null;
    if (ref && plant.lat != null && plant.lng != null) {
      plant.distance_miles =
        Math.round(
          haversineMiles(
            ref.lat,
            ref.lng,
            plant.lat as number,
            plant.lng as number
          ) * 10
        ) / 10;
    } else {
      plant.distance_miles = null;
    }

    res.json(plant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch plant" });
  }
});

plantsRouter.patch("/:id", (req, res) => {
  try {
    const { contacted, current_customer, follow_up_date, notes } = req.body;
    const id = req.params.id as string;

    const updates: string[] = ["updated_at = datetime('now')"];
    const params: (string | number | null)[] = [];

    if (typeof contacted === "boolean") {
      updates.push("contacted = ?");
      params.push(contacted ? 1 : 0);
    }
    if (typeof current_customer === "boolean") {
      updates.push("current_customer = ?");
      params.push(current_customer ? 1 : 0);
    }
    if (follow_up_date !== undefined) {
      updates.push("follow_up_date = ?");
      params.push(follow_up_date === null || follow_up_date === "" ? null : follow_up_date);
    }
    if (notes !== undefined) {
      updates.push("notes = ?");
      params.push(notes ?? null);
    }

    if (params.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    params.push(id);
    const sql = `UPDATE plants SET ${updates.join(", ")} WHERE id = ?`;
    const result = db.prepare(sql).run(...params);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Plant not found" });
    }

    const plant = db.prepare("SELECT * FROM plants WHERE id = ?").get(req.params.id);
    res.json(plant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update plant" });
  }
});

plantsRouter.post("/cleanup-non-manufacturing", (req, res) => {
  try {
    const plants = db.prepare("SELECT id, name, primary_type, types, editorial_summary, generative_summary, manufacturing_reason FROM plants").all() as Array<{
      id: string;
      name: string | null;
      primary_type: string | null;
      types: string | null;
      editorial_summary: string | null;
      generative_summary: string | null;
      manufacturing_reason: string | null;
    }>;
    const toDelete = plants.filter((p) => isExcludedFromDbPlant(p));
    const ids = toDelete.map((p) => p.id);
    if (ids.length === 0) {
      return res.json({ deleted: 0, ids: [], message: "No non-manufacturing plants found" });
    }
    const placeholders = ids.map(() => "?").join(",");
    db.prepare(`DELETE FROM contacts WHERE plant_id IN (${placeholders})`).run(...ids);
    const result = db.prepare(`DELETE FROM plants WHERE id IN (${placeholders})`).run(...ids);
    res.json({ deleted: result.changes, ids });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to cleanup non-manufacturing plants" });
  }
});

plantsRouter.delete("/bulk", (req, res) => {
  try {
    const ids = req.body?.ids as string[] | undefined;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array required" });
    }

    const placeholders = ids.map(() => "?").join(",");
    db.prepare(`DELETE FROM contacts WHERE plant_id IN (${placeholders})`).run(...ids);
    const stmt = db.prepare(`DELETE FROM plants WHERE id IN (${placeholders})`);
    const result = stmt.run(...ids);

    res.json({ deleted: result.changes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete plants" });
  }
});

plantsRouter.delete("/:id", (req, res) => {
  try {
    const id = req.params.id as string;
    db.prepare("DELETE FROM contacts WHERE plant_id = ?").run(id);
    const result = db.prepare("DELETE FROM plants WHERE id = ?").run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Plant not found" });
    }

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete plant" });
  }
});

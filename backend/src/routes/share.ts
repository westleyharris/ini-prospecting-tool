import { Router } from "express";
import { randomBytes } from "crypto";
import { db } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { loadMapping, loadPlantMappings } from "./mappings.js";

export const shareRouter = Router();

function now() {
  return new Date().toISOString();
}

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

shareRouter.get("/:token", (req, res) => {
  const row = db
    .prepare("SELECT token, kind, mapping_id, plant_id FROM mapping_shares WHERE token = ?")
    .get(req.params.token) as
    | { token: string; kind: string; mapping_id: string | null; plant_id: string | null }
    | undefined;

  if (!row) return res.status(404).json({ error: "This share link is not valid." });

  if (row.kind === "plant") {
    if (!row.plant_id) return res.status(404).json({ error: "This share link is not valid." });
    const mappings = loadPlantMappings(row.plant_id);
    if (mappings.length === 0) {
      return res.status(404).json({ error: "No mappings are available for this plant." });
    }
    const plant = db
      .prepare("SELECT executive_brief FROM plants WHERE id = ?")
      .get(row.plant_id) as { executive_brief: string | null } | undefined;
    return res.json({
      kind: "plant",
      mappings,
      executive_brief: plant?.executive_brief ?? null,
    });
  }

  if (!row.mapping_id) return res.status(404).json({ error: "This share link is not valid." });
  const mapping = loadMapping(row.mapping_id);
  if (!mapping) return res.status(404).json({ error: "This mapping is no longer available." });
  return res.json({ kind: "mapping", mapping });
});

shareRouter.post("/mapping/:id", requireAuth, (req, res) => {
  const mapping = db.prepare("SELECT id FROM mappings WHERE id = ?").get(req.params.id);
  if (!mapping) return res.status(404).json({ error: "Not found" });

  const existing = db
    .prepare("SELECT token FROM mapping_shares WHERE kind = 'mapping' AND mapping_id = ?")
    .get(req.params.id) as { token: string } | undefined;
  if (existing) return res.json({ token: existing.token, path: `/s/${existing.token}` });

  const token = newToken();
  db.prepare(
    `INSERT INTO mapping_shares (token, kind, mapping_id, plant_id, created_at) VALUES (?, 'mapping', ?, NULL, ?)`
  ).run(token, req.params.id, now());
  res.status(201).json({ token, path: `/s/${token}` });
});

shareRouter.post("/plant/:plantId", requireAuth, (req, res) => {
  const plant = db.prepare("SELECT id FROM plants WHERE id = ?").get(req.params.plantId);
  if (!plant) return res.status(404).json({ error: "Plant not found" });

  const existing = db
    .prepare("SELECT token FROM mapping_shares WHERE kind = 'plant' AND plant_id = ?")
    .get(req.params.plantId) as { token: string } | undefined;
  if (existing) return res.json({ token: existing.token, path: `/s/${existing.token}` });

  const token = newToken();
  db.prepare(
    `INSERT INTO mapping_shares (token, kind, mapping_id, plant_id, created_at) VALUES (?, 'plant', NULL, ?, ?)`
  ).run(token, req.params.plantId, now());
  res.status(201).json({ token, path: `/s/${token}` });
});

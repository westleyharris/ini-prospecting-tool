import { Router } from "express";
import { randomUUID } from "crypto";
import multer from "multer";
import { join } from "path";
import { existsSync, unlinkSync } from "fs";
import { db } from "../db.js";
import { getMappingPhotosPath, getUploadsPath } from "../services/uploads.js";
import { ocrPhoto } from "../services/ocr.js";

export const mappingsRouter = Router();

// ─── Multer config ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // Temp — we'll move later; for simplicity store directly in mappings root
    cb(null, join(getUploadsPath(), "mappings"));
  },
  filename: (_req, file, cb) => {
    const ext = file.originalname.split(".").pop() ?? "jpg";
    cb(null, `${randomUUID()}.${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images allowed"));
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function now() {
  return new Date().toISOString();
}

// ─── MAPPINGS CRUD ────────────────────────────────────────────────────────────

// GET /api/mappings?plant_id=xxx   — list all mappings (optionally filtered by plant)
mappingsRouter.get("/", (req, res) => {
  const { plant_id } = req.query;
  let rows;
  if (plant_id) {
    rows = db
      .prepare(
        `SELECT m.*, p.name as plant_name, p.city, p.state
         FROM mappings m
         JOIN plants p ON p.id = m.plant_id
         WHERE m.plant_id = ?
         ORDER BY m.created_at DESC`
      )
      .all(plant_id as string);
  } else {
    rows = db
      .prepare(
        `SELECT m.*, p.name as plant_name, p.city, p.state
         FROM mappings m
         JOIN plants p ON p.id = m.plant_id
         ORDER BY m.created_at DESC`
      )
      .all();
  }
  res.json(rows);
});

// GET /api/mappings/:id   — single mapping with machines + photos
mappingsRouter.get("/:id", (req, res) => {
  const mapping = db
    .prepare(
      `SELECT m.*, p.name as plant_name, p.city, p.state, p.formatted_address
       FROM mappings m
       JOIN plants p ON p.id = m.plant_id
       WHERE m.id = ?`
    )
    .get(req.params.id);

  if (!mapping) return res.status(404).json({ error: "Not found" });

  const machines = db
    .prepare(
      `SELECT * FROM mapping_machines WHERE mapping_id = ? ORDER BY sort_order ASC, created_at ASC`
    )
    .all(req.params.id);

  const machineIds = (machines as { id: string }[]).map((m) => m.id);
  let photos: unknown[] = [];
  if (machineIds.length > 0) {
    const placeholders = machineIds.map(() => "?").join(",");
    photos = db
      .prepare(
        `SELECT * FROM mapping_photos WHERE machine_id IN (${placeholders}) ORDER BY sort_order ASC, created_at ASC`
      )
      .all(...machineIds);
  }

  // Nest photos under their machines
  const photosByMachine: Record<string, unknown[]> = {};
  for (const p of photos as { machine_id: string }[]) {
    if (!photosByMachine[p.machine_id]) photosByMachine[p.machine_id] = [];
    photosByMachine[p.machine_id].push(p);
  }

  const result = {
    ...(mapping as object),
    machines: (machines as { id: string }[]).map((m) => ({
      ...m,
      photos: photosByMachine[m.id] ?? [],
    })),
  };

  res.json(result);
});

// POST /api/mappings   — create mapping
mappingsRouter.post("/", (req, res) => {
  const { plant_id, name, notes } = req.body;
  if (!plant_id) return res.status(400).json({ error: "plant_id required" });

  const plant = db.prepare("SELECT id FROM plants WHERE id = ?").get(plant_id);
  if (!plant) return res.status(404).json({ error: "Plant not found" });

  const id = randomUUID();
  const ts = now();
  db.prepare(
    `INSERT INTO mappings (id, plant_id, name, status, notes, created_at, updated_at)
     VALUES (?, ?, ?, 'in_progress', ?, ?, ?)`
  ).run(id, plant_id, name ?? "New Mapping", notes ?? null, ts, ts);

  res.status(201).json(db.prepare("SELECT * FROM mappings WHERE id = ?").get(id));
});

// PATCH /api/mappings/:id
mappingsRouter.patch("/:id", (req, res) => {
  const mapping = db.prepare("SELECT id FROM mappings WHERE id = ?").get(req.params.id);
  if (!mapping) return res.status(404).json({ error: "Not found" });

  const fields: string[] = [];
  const values: unknown[] = [];

  const allowed = ["name", "status", "notes"] as const;
  for (const key of allowed) {
    if (key in req.body) {
      fields.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }

  if (fields.length === 0) return res.status(400).json({ error: "No fields to update" });

  fields.push("updated_at = ?");
  values.push(now());
  values.push(req.params.id);

  db.prepare(`UPDATE mappings SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  res.json(db.prepare("SELECT * FROM mappings WHERE id = ?").get(req.params.id));
});

// DELETE /api/mappings/:id
mappingsRouter.delete("/:id", (req, res) => {
  const mapping = db.prepare("SELECT id FROM mappings WHERE id = ?").get(req.params.id);
  if (!mapping) return res.status(404).json({ error: "Not found" });

  // Photos are deleted by cascade; also clean up files
  const machines = db
    .prepare("SELECT id FROM mapping_machines WHERE mapping_id = ?")
    .all(req.params.id) as { id: string }[];

  for (const machine of machines) {
    const photos = db
      .prepare("SELECT filename FROM mapping_photos WHERE machine_id = ?")
      .all(machine.id) as { filename: string }[];
    for (const photo of photos) {
      const fp = join(getMappingPhotosPath(machine.id), photo.filename);
      if (existsSync(fp)) unlinkSync(fp);
    }
  }

  db.prepare("DELETE FROM mappings WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ─── MACHINES CRUD ────────────────────────────────────────────────────────────

// GET /api/mappings/:id/machines
mappingsRouter.get("/:id/machines", (req, res) => {
  const rows = db
    .prepare(
      `SELECT mm.*,
        (SELECT COUNT(*) FROM mapping_photos WHERE machine_id = mm.id) as photo_count
       FROM mapping_machines mm
       WHERE mapping_id = ?
       ORDER BY sort_order ASC, created_at ASC`
    )
    .all(req.params.id);
  res.json(rows);
});

// POST /api/mappings/:id/machines
mappingsRouter.post("/:id/machines", (req, res) => {
  const mapping = db.prepare("SELECT id FROM mappings WHERE id = ?").get(req.params.id);
  if (!mapping) return res.status(404).json({ error: "Not found" });

  const id = randomUUID();
  const ts = now();
  const {
    name = "New Machine",
    sort_order = 0,
    plc_make, plc_model, plc_series, plc_part_no,
    hmi_make, hmi_model, hmi_part_no,
    vfd_make, vfd_model, vfd_hp, vfd_voltage,
    notes,
  } = req.body;

  db.prepare(
    `INSERT INTO mapping_machines
      (id, mapping_id, name, sort_order,
       plc_make, plc_model, plc_series, plc_part_no,
       hmi_make, hmi_model, hmi_part_no,
       vfd_make, vfd_model, vfd_hp, vfd_voltage,
       notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id, req.params.id, name, sort_order,
    plc_make ?? null, plc_model ?? null, plc_series ?? null, plc_part_no ?? null,
    hmi_make ?? null, hmi_model ?? null, hmi_part_no ?? null,
    vfd_make ?? null, vfd_model ?? null, vfd_hp ?? null, vfd_voltage ?? null,
    notes ?? null, ts, ts
  );

  res.status(201).json(db.prepare("SELECT * FROM mapping_machines WHERE id = ?").get(id));
});

// PATCH /api/mappings/machines/:machineId
mappingsRouter.patch("/machines/:machineId", (req, res) => {
  const machine = db.prepare("SELECT id FROM mapping_machines WHERE id = ?").get(req.params.machineId);
  if (!machine) return res.status(404).json({ error: "Not found" });

  const fields: string[] = [];
  const values: unknown[] = [];

  const allowed = [
    "name", "sort_order",
    "plc_make", "plc_model", "plc_series", "plc_part_no",
    "hmi_make", "hmi_model", "hmi_part_no",
    "vfd_make", "vfd_model", "vfd_hp", "vfd_voltage",
    "notes",
  ] as const;

  for (const key of allowed) {
    if (key in req.body) {
      fields.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }

  if (fields.length === 0) return res.status(400).json({ error: "No fields to update" });

  fields.push("updated_at = ?");
  values.push(now());
  values.push(req.params.machineId);

  db.prepare(`UPDATE mapping_machines SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  res.json(db.prepare("SELECT * FROM mapping_machines WHERE id = ?").get(req.params.machineId));
});

// DELETE /api/mappings/machines/:machineId
mappingsRouter.delete("/machines/:machineId", (req, res) => {
  const machine = db.prepare("SELECT id FROM mapping_machines WHERE id = ?").get(req.params.machineId) as { id: string } | undefined;
  if (!machine) return res.status(404).json({ error: "Not found" });

  // Clean up photo files
  const photos = db
    .prepare("SELECT filename FROM mapping_photos WHERE machine_id = ?")
    .all(machine.id) as { filename: string }[];

  for (const photo of photos) {
    const fp = join(getMappingPhotosPath(machine.id), photo.filename);
    if (existsSync(fp)) unlinkSync(fp);
  }

  db.prepare("DELETE FROM mapping_machines WHERE id = ?").run(req.params.machineId);
  res.json({ ok: true });
});

// ─── PHOTOS ───────────────────────────────────────────────────────────────────

// POST /api/mappings/machines/:machineId/photos — upload photo
mappingsRouter.post(
  "/machines/:machineId/photos",
  upload.single("photo"),
  async (req, res) => {
    const machine = db
      .prepare("SELECT id FROM mapping_machines WHERE id = ?")
      .get(req.params.machineId) as { id: string } | undefined;

    if (!machine) {
      if (req.file) unlinkSync(req.file.path);
      return res.status(404).json({ error: "Machine not found" });
    }

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { category = "other", sort_order = 0 } = req.body;

    // Move file to machine-specific folder
    const destDir = getMappingPhotosPath(machine.id);
    const destPath = join(destDir, req.file.filename);
    const { renameSync } = await import("fs");
    renameSync(req.file.path, destPath);

    const id = randomUUID();
    const ts = now();

    db.prepare(
      `INSERT INTO mapping_photos (id, machine_id, category, filename, original_name, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, machine.id, category, req.file.filename, req.file.originalname, sort_order, ts);

    const photo = db.prepare("SELECT * FROM mapping_photos WHERE id = ?").get(id);

    // Run OCR asynchronously — respond immediately, update when done
    res.status(201).json({ ...photo as object, ocr_status: "pending" });

    // Run OCR in background
    ocrPhoto(destPath, category)
      .then((result) => {
        db.prepare("UPDATE mapping_photos SET ocr_raw = ? WHERE id = ?").run(
          JSON.stringify(result),
          id
        );

        // Auto-fill machine fields if they're empty and we got data
        if (category === "plc") {
          const updates: string[] = [];
          const vals: unknown[] = [];
          const m = db.prepare("SELECT * FROM mapping_machines WHERE id = ?").get(machine.id) as Record<string, unknown>;
          if (!m.plc_make && result.make)   { updates.push("plc_make = ?");   vals.push(result.make); }
          if (!m.plc_model && result.model) { updates.push("plc_model = ?");  vals.push(result.model); }
          if (!m.plc_series && result.series) { updates.push("plc_series = ?"); vals.push(result.series); }
          if (!m.plc_part_no && result.part_no) { updates.push("plc_part_no = ?"); vals.push(result.part_no); }
          if (updates.length) {
            updates.push("updated_at = ?"); vals.push(now()); vals.push(machine.id);
            db.prepare(`UPDATE mapping_machines SET ${updates.join(", ")} WHERE id = ?`).run(...vals);
          }
        } else if (category === "hmi") {
          const updates: string[] = [];
          const vals: unknown[] = [];
          const m = db.prepare("SELECT * FROM mapping_machines WHERE id = ?").get(machine.id) as Record<string, unknown>;
          if (!m.hmi_make && result.make)   { updates.push("hmi_make = ?");   vals.push(result.make); }
          if (!m.hmi_model && result.model) { updates.push("hmi_model = ?");  vals.push(result.model); }
          if (!m.hmi_part_no && result.part_no) { updates.push("hmi_part_no = ?"); vals.push(result.part_no); }
          if (updates.length) {
            updates.push("updated_at = ?"); vals.push(now()); vals.push(machine.id);
            db.prepare(`UPDATE mapping_machines SET ${updates.join(", ")} WHERE id = ?`).run(...vals);
          }
        } else if (category === "vfd") {
          const updates: string[] = [];
          const vals: unknown[] = [];
          const m = db.prepare("SELECT * FROM mapping_machines WHERE id = ?").get(machine.id) as Record<string, unknown>;
          if (!m.vfd_make && result.make)     { updates.push("vfd_make = ?");    vals.push(result.make); }
          if (!m.vfd_model && result.model)   { updates.push("vfd_model = ?");   vals.push(result.model); }
          if (!m.vfd_hp && result.hp)         { updates.push("vfd_hp = ?");      vals.push(result.hp); }
          if (!m.vfd_voltage && result.voltage) { updates.push("vfd_voltage = ?"); vals.push(result.voltage); }
          if (updates.length) {
            updates.push("updated_at = ?"); vals.push(now()); vals.push(machine.id);
            db.prepare(`UPDATE mapping_machines SET ${updates.join(", ")} WHERE id = ?`).run(...vals);
          }
        }
      })
      .catch((err) => {
        console.error("OCR failed:", err);
        db.prepare("UPDATE mapping_photos SET ocr_raw = ? WHERE id = ?").run(
          JSON.stringify({ error: String(err) }),
          id
        );
      });
  }
);

// GET /api/mappings/machines/:machineId/photos — list photos for a machine
mappingsRouter.get("/machines/:machineId/photos", (req, res) => {
  const photos = db
    .prepare("SELECT * FROM mapping_photos WHERE machine_id = ? ORDER BY sort_order ASC, created_at ASC")
    .all(req.params.machineId);
  res.json(photos);
});

// DELETE /api/mappings/photos/:photoId
mappingsRouter.delete("/photos/:photoId", (req, res) => {
  const photo = db
    .prepare("SELECT * FROM mapping_photos WHERE id = ?")
    .get(req.params.photoId) as { id: string; machine_id: string; filename: string } | undefined;

  if (!photo) return res.status(404).json({ error: "Not found" });

  const fp = join(getMappingPhotosPath(photo.machine_id), photo.filename);
  if (existsSync(fp)) unlinkSync(fp);

  db.prepare("DELETE FROM mapping_photos WHERE id = ?").run(req.params.photoId);
  res.json({ ok: true });
});

// PATCH /api/mappings/photos/:photoId  — update sort_order or re-run OCR
mappingsRouter.patch("/photos/:photoId", async (req, res) => {
  const photo = db
    .prepare("SELECT * FROM mapping_photos WHERE id = ?")
    .get(req.params.photoId) as { id: string; machine_id: string; filename: string; category: string } | undefined;

  if (!photo) return res.status(404).json({ error: "Not found" });

  const { sort_order, rerun_ocr } = req.body;

  if (sort_order !== undefined) {
    db.prepare("UPDATE mapping_photos SET sort_order = ? WHERE id = ?").run(sort_order, photo.id);
  }

  if (rerun_ocr) {
    const fp = join(getMappingPhotosPath(photo.machine_id), photo.filename);
    try {
      const result = await ocrPhoto(fp, photo.category);
      db.prepare("UPDATE mapping_photos SET ocr_raw = ? WHERE id = ?").run(
        JSON.stringify(result),
        photo.id
      );
    } catch (err) {
      return res.status(500).json({ error: String(err) });
    }
  }

  res.json(db.prepare("SELECT * FROM mapping_photos WHERE id = ?").get(photo.id));
});

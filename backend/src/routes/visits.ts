import { Router } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { unlinkSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { db } from "../db.js";
import { getVisitFilesPath } from "../services/uploads.js";

export const visitsRouter = Router();

const ALLOWED_MIMES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/pdf",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      ALLOWED_MIMES.includes(file.mimetype) ||
      file.originalname.toLowerCase().endsWith(".doc") ||
      file.originalname.toLowerCase().endsWith(".docx") ||
      file.originalname.toLowerCase().endsWith(".pdf");
    cb(null, !!ok);
  },
});

visitsRouter.get("/", (req, res) => {
  try {
    const plantId = req.query.plant_id as string | undefined;
    let sql = `SELECT v.*, pl.name as plant_name FROM visits v
               LEFT JOIN plants pl ON v.plant_id = pl.id WHERE 1=1`;
    const params: string[] = [];

    if (plantId) {
      sql += " AND v.plant_id = ?";
      params.push(plantId);
    }

    sql += " ORDER BY v.visit_date DESC, v.created_at DESC";
    const visits =
      params.length > 0
        ? db.prepare(sql).all(...params)
        : db.prepare(sql).all();

    const visitsWithFiles = (visits as { id: string; plant_id: string }[]).map((v) => {
      const files = db.prepare("SELECT * FROM visit_files WHERE visit_id = ? ORDER BY created_at").all(v.id);
      return { ...v, files };
    });
    res.json(visitsWithFiles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch visits" });
  }
});

visitsRouter.get("/:id", (req, res) => {
  try {
    const visit = db.prepare("SELECT * FROM visits WHERE id = ?").get(req.params.id);
    if (!visit) {
      return res.status(404).json({ error: "Visit not found" });
    }
    const files = db
      .prepare("SELECT * FROM visit_files WHERE visit_id = ? ORDER BY created_at")
      .all(req.params.id);
    res.json({ ...visit, files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch visit" });
  }
});

visitsRouter.post("/", upload.single("file"), (req, res) => {
  try {
    const { plant_id, visit_date, notes } = req.body;
    if (!plant_id || !visit_date) {
      return res.status(400).json({ error: "plant_id and visit_date are required" });
    }
    const plant = db.prepare("SELECT id FROM plants WHERE id = ?").get(plant_id);
    if (!plant) {
      return res.status(404).json({ error: "Plant not found" });
    }

    const id = uuidv4();
    db.prepare(
      `INSERT INTO visits (id, plant_id, visit_date, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run(id, plant_id, visit_date, notes ?? null);

    if (req.file && req.file.buffer) {
      const ext = req.file.originalname.split(".").pop() || "bin";
      const storedName = `${uuidv4()}.${ext}`;
      const destDir = getVisitFilesPath(id);
      const filePath = join(destDir, storedName);
      writeFileSync(filePath, req.file.buffer);

      db.prepare(
        `INSERT INTO visit_files (id, visit_id, filename, original_name, content_type, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).run(uuidv4(), id, storedName, req.file.originalname || storedName, req.file.mimetype || null);
    }

    const visit = db.prepare("SELECT * FROM visits WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    const files = db.prepare("SELECT * FROM visit_files WHERE visit_id = ?").all(id);
    res.status(201).json({ ...(visit ?? {}), files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create visit" });
  }
});

visitsRouter.get("/:id/files/:filename", (req, res) => {
  try {
    const { id, filename } = req.params;
    const file = db
      .prepare("SELECT * FROM visit_files WHERE visit_id = ? AND filename = ?")
      .get(id, filename) as { original_name: string } | undefined;
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    const filePath = join(getVisitFilesPath(id), filename);
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on disk" });
    }
    res.download(filePath, file.original_name);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to download file" });
  }
});

visitsRouter.delete("/:id", (req, res) => {
  try {
    const id = req.params.id;
    const files = db.prepare("SELECT filename FROM visit_files WHERE visit_id = ?").all(id) as { filename: string }[];
    const dir = getVisitFilesPath(id);
    for (const f of files) {
      const p = join(dir, f.filename);
      if (existsSync(p)) {
        try {
          unlinkSync(p);
        } catch {
          /* ignore */
        }
      }
    }
    db.prepare("DELETE FROM visit_files WHERE visit_id = ?").run(id);
    const result = db.prepare("DELETE FROM visits WHERE id = ?").run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Visit not found" });
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete visit" });
  }
});

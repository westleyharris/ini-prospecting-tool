import { Router } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { unlinkSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { db, getNextSequence } from "../db.js";
import { getProjectFilesPath } from "../services/uploads.js";

export const projectsRouter = Router();

const ALLOWED_MIMES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const ok =
      ALLOWED_MIMES.includes(file.mimetype) ||
      name.endsWith(".doc") ||
      name.endsWith(".docx") ||
      name.endsWith(".pdf") ||
      name.endsWith(".xls") ||
      name.endsWith(".xlsx") ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".png");
    cb(null, !!ok);
  },
});

projectsRouter.get("/", (req, res) => {
  try {
    const plantId = req.query.plant_id as string | undefined;
    let sql = `SELECT p.*, pl.name as plant_name FROM projects p
               LEFT JOIN plants pl ON p.plant_id = pl.id WHERE 1=1`;
    const params: string[] = [];

    if (plantId) {
      sql += " AND p.plant_id = ?";
      params.push(plantId);
    }

    sql += " ORDER BY p.created_at DESC";
    const projects =
      params.length > 0
        ? db.prepare(sql).all(...params)
        : db.prepare(sql).all();
    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

projectsRouter.get("/:id", (req, res) => {
  try {
    const project = db
      .prepare(
        `SELECT p.*, pl.name as plant_name FROM projects p
         LEFT JOIN plants pl ON p.plant_id = pl.id WHERE p.id = ?`
      )
      .get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    const files = db
      .prepare("SELECT * FROM project_files WHERE project_id = ? ORDER BY created_at")
      .all(req.params.id);
    res.json({ ...project, files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

projectsRouter.post("/", (req, res) => {
  try {
    const { plant_id, source_visit_id, status, notes } = req.body;
    if (!plant_id) {
      return res.status(400).json({ error: "plant_id is required" });
    }
    const plant = db.prepare("SELECT id FROM plants WHERE id = ?").get(plant_id);
    if (!plant) {
      return res.status(404).json({ error: "Plant not found" });
    }

    const id = uuidv4();
    const { formatted: pr_number } = getNextSequence("pr");

    db.prepare(
      `INSERT INTO projects (id, plant_id, pr_number, status, source_visit_id, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run(
      id,
      plant_id,
      pr_number,
      status ?? "draft",
      source_visit_id ?? null,
      notes ?? null
    );

    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    const plantRow = db.prepare("SELECT name FROM plants WHERE id = ?").get(plant_id) as { name: string } | undefined;
    res.status(201).json({
      ...(project ?? {}),
      plant_name: plantRow?.name ?? null,
      files: [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create project" });
  }
});

projectsRouter.patch("/:id", (req, res) => {
  try {
    const { status, notes } = req.body;
    const id = req.params.id;
    const updates: string[] = [];
    const params: unknown[] = [];

    if (status !== undefined) {
      updates.push("status = ?");
      params.push(status);
    }
    if (notes !== undefined) {
      updates.push("notes = ?");
      params.push(notes);
    }
    updates.push("updated_at = datetime('now')");
    params.push(id);

    db.prepare(
      `UPDATE projects SET ${updates.join(", ")} WHERE id = ?`
    ).run(...params);

    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update project" });
  }
});

projectsRouter.post("/:id/files", upload.single("file"), (req, res) => {
  try {
    const projectId = req.params.id;
    const fileType = (req.body.file_type as string) || "other";

    const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const ext = req.file.originalname.split(".").pop() || "bin";
    const storedName = `${uuidv4()}.${ext}`;
    const destDir = getProjectFilesPath(projectId);
    const filePath = join(destDir, storedName);
    writeFileSync(filePath, req.file.buffer);

    const fileId = uuidv4();
    db.prepare(
      `INSERT INTO project_files (id, project_id, filename, original_name, file_type, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).run(fileId, projectId, storedName, req.file.originalname || storedName, fileType);

    const file = db.prepare("SELECT * FROM project_files WHERE id = ?").get(fileId);
    res.status(201).json(file);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

projectsRouter.get("/:id/files/:filename", (req, res) => {
  try {
    const { id, filename } = req.params;
    const file = db
      .prepare("SELECT * FROM project_files WHERE project_id = ? AND filename = ?")
      .get(id, filename) as { original_name: string } | undefined;
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    const filePath = join(getProjectFilesPath(id), filename);
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on disk" });
    }
    res.download(filePath, file.original_name);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to download file" });
  }
});

projectsRouter.post("/:id/convert-to-commissioning", (req, res) => {
  try {
    const projectId = req.params.id;
    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as
      | { id: string; plant_id: string }
      | undefined;
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const existing = db.prepare("SELECT id FROM commissionings WHERE project_id = ?").get(projectId);
    if (existing) {
      return res.status(400).json({ error: "Project already has a commissioning" });
    }

    const commId = uuidv4();
    const { formatted: comm_number } = getNextSequence("comm");

    db.prepare(
      `INSERT INTO commissionings (id, project_id, comm_number, created_at)
       VALUES (?, ?, ?, datetime('now'))`
    ).run(commId, projectId, comm_number);

    const commissioning = db.prepare("SELECT * FROM commissionings WHERE id = ?").get(commId);
    res.status(201).json(commissioning);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create commissioning" });
  }
});

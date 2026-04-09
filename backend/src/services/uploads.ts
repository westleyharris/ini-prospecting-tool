import { existsSync, mkdirSync } from "fs";
import { join } from "path";

function resolveUploadsPath(): string {
  if (process.env.UPLOADS_PATH) return process.env.UPLOADS_PATH;
  if (process.env.NODE_ENV === "production") return "/data/uploads";
  return join(process.cwd(), "uploads");
}

const UPLOADS_PATH = resolveUploadsPath();

function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

// Ensure base uploads dir exists on load
ensureDir(UPLOADS_PATH);
ensureDir(join(UPLOADS_PATH, "visits"));
ensureDir(join(UPLOADS_PATH, "projects"));

export function getUploadsPath(): string {
  return UPLOADS_PATH;
}

export function getVisitFilesPath(visitId: string): string {
  const p = join(UPLOADS_PATH, "visits", visitId);
  ensureDir(p);
  return p;
}

export function getProjectFilesPath(projectId: string): string {
  const p = join(UPLOADS_PATH, "projects", projectId);
  ensureDir(p);
  return p;
}

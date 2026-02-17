import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const UPLOADS_PATH = process.env.UPLOADS_PATH || join(process.cwd(), "uploads");

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

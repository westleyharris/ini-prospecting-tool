import sharp from "sharp";
import { join, extname, basename } from "path";
import { existsSync, mkdirSync, unlinkSync } from "fs";
import { unlink } from "fs/promises";
import { getUploadsPath } from "./uploads.js";

/**
 * Derivative sizes:
 *   sm   480px WebP  — grids, filmstrip
 *   md  1280px WebP  — lightbox, on-screen drawing, print/PDF
 *   deck 1400px JPEG — PowerPoint (no WebP)
 *
 * Originals are normalized on upload to 2400px JPEG so a phone photo is not
 * 12 MB forever. Existing files still generate derivatives on first request.
 */
export type ThumbSize = "sm" | "md" | "deck";

const SIZE_PX: Record<ThumbSize, number> = {
  sm: 480,
  md: 1280,
  deck: 1400,
};

const MAX_ORIGINAL_PX = 2400;
const ORIGINAL_JPEG_QUALITY = 82;

let active = 0;
const MAX_CONCURRENT = 3;
const waiters: Array<() => void> = [];
const inflight = new Map<string, Promise<{ path: string; contentType: string }>>();

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiters.push(resolve));
}

function release(): void {
  const next = waiters.shift();
  if (next) next();
  else active = Math.max(0, active - 1);
}

function thumbFilePath(machineId: string, filename: string, size: ThumbSize): string {
  const dir = join(getUploadsPath(), "thumbs", size, "mappings", machineId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const base = basename(filename, extname(filename));
  const ext = size === "deck" ? ".jpg" : ".webp";
  return join(dir, `${base}${ext}`);
}

function originalPath(machineId: string, filename: string): string {
  return join(getUploadsPath(), "mappings", machineId, filename);
}

async function writeDerivative(src: string, dest: string, size: ThumbSize): Promise<void> {
  const pipeline = sharp(src).rotate().resize(SIZE_PX[size], SIZE_PX[size], {
    fit: "inside",
    withoutEnlargement: true,
  });
  if (size === "deck") {
    await pipeline.jpeg({ quality: 80, mozjpeg: true }).toFile(dest);
  } else {
    await pipeline.webp({ quality: size === "sm" ? 78 : 80 }).toFile(dest);
  }
}

/**
 * Downscale and re-encode a field photo so storage and later reads stay small.
 * Writes JPEG to destPath. Safe to call with src === dest via a temp file.
 */
export async function normalizeUpload(srcPath: string, destPath: string): Promise<void> {
  await sharp(srcPath)
    .rotate()
    .resize(MAX_ORIGINAL_PX, MAX_ORIGINAL_PX, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: ORIGINAL_JPEG_QUALITY, mozjpeg: true })
    .toFile(destPath);
}

export async function getOrCreateThumb(
  machineId: string,
  filename: string,
  size: ThumbSize
): Promise<{ path: string; contentType: string }> {
  const key = `${machineId}/${filename}/${size}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const work = (async () => {
    const src = originalPath(machineId, filename);
    if (!existsSync(src)) throw new Error("Original not found");

    const tPath = thumbFilePath(machineId, filename, size);
    const contentType = size === "deck" ? "image/jpeg" : "image/webp";
    if (existsSync(tPath)) return { path: tPath, contentType };

    await acquire();
    try {
      if (!existsSync(tPath)) await writeDerivative(src, tPath, size);
      return { path: tPath, contentType };
    } finally {
      release();
    }
  })();

  inflight.set(key, work);
  try {
    return await work;
  } finally {
    inflight.delete(key);
  }
}

/** Build sm/md/deck so the first page view is a cache hit. Failures are ignored. */
export async function warmDerivatives(machineId: string, filename: string): Promise<void> {
  await Promise.allSettled(
    (["sm", "md", "deck"] as ThumbSize[]).map((size) => getOrCreateThumb(machineId, filename, size))
  );
}

export async function removeIfExists(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    /* already gone */
  }
}

/** Remove the original and any sm/md/deck derivatives. */
export function deletePhotoFiles(machineId: string, filename: string): void {
  const orig = originalPath(machineId, filename);
  if (existsSync(orig)) unlinkSync(orig);
  for (const size of ["sm", "md", "deck"] as ThumbSize[]) {
    const t = thumbFilePath(machineId, filename, size);
    if (existsSync(t)) unlinkSync(t);
  }
}

import sharp from "sharp";
import { join, extname, basename } from "path";
import { existsSync, mkdirSync } from "fs";
import { getUploadsPath } from "./uploads.js";

// Supported thumb widths — "sm" for thumbnail grids/filmstrips, "md" for print
export type ThumbSize = "sm" | "md";

const SIZE_PX: Record<ThumbSize, number> = {
  sm: 480,   // thumbnail grids + lightbox filmstrip
  md: 1200,  // print report — readable at 2-column A4/letter width
};

function thumbFilePath(machineId: string, filename: string, size: ThumbSize): string {
  const dir = join(getUploadsPath(), "thumbs", size, "mappings", machineId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const base = basename(filename, extname(filename));
  return join(dir, `${base}.webp`);
}

/**
 * Returns the path to a cached WebP thumbnail, generating it first if needed.
 * Falls back to the original if sharp fails (e.g. unsupported format).
 */
export async function getOrCreateThumb(
  machineId: string,
  filename: string,
  size: ThumbSize
): Promise<{ path: string; contentType: string }> {
  const originalPath = join(getUploadsPath(), "mappings", machineId, filename);
  if (!existsSync(originalPath)) throw new Error("Original not found");

  const tPath = thumbFilePath(machineId, filename, size);

  if (!existsSync(tPath)) {
    await sharp(originalPath)
      .rotate()                                    // honour EXIF orientation
      .resize(SIZE_PX[size], undefined, { withoutEnlargement: true })
      .webp({ quality: size === "sm" ? 80 : 85 })
      .toFile(tPath);
  }

  return { path: tPath, contentType: "image/webp" };
}

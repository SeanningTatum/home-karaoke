import { computeCoverCrop } from "@/lib/image/crop";

// Client-only browser boundary — `createImageBitmap` + `<canvas>` don't exist
// under Vitest's `node` test environment (and wouldn't run meaningfully under
// jsdom either, since jsdom has no real 2D rasterizer), so this is
// deliberately kept as a thin, untested wrapper around `computeCoverCrop`
// (which carries the unit tests) and the browser's own image decode/encode.

/**
 * Center-crops `file` to a square and re-encodes it as a `size`x`size` JPEG
 * `Blob` for avatar upload. Runs entirely client-side via the Canvas 2D API.
 * Resolves `null` when the browser can't decode or encode the image (corrupt
 * file, missing 2D context) — callers treat that as "no photo".
 */
export async function downscaleAvatar(
  file: File,
  size = 512,
  quality = 0.85
): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;

  const { sx, sy, sw, sh } = computeCoverCrop(bitmap.width, bitmap.height, size);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, size, size);
  bitmap.close();

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
}

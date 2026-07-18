// Pure geometry for client-side avatar downscaling (feat-011). No I/O, no
// DOM — `downscale.ts` is the thin browser-boundary wrapper that feeds this
// math into `canvas.drawImage`.

export interface CoverCrop {
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
}

/**
 * Largest centered square source rect for a "cover" crop of `srcW`x`srcH`
 * down to a `target`x`target` destination — landscape crops the sides,
 * portrait crops top/bottom, square is a no-op. The crop is purely a
 * function of the source aspect ratio; `target` doesn't change the math
 * (it's the destination canvas size the caller scales into) but is kept in
 * the signature so call sites read as "crop for this target size".
 */
export const computeCoverCrop = (
  srcW: number,
  srcH: number,
  target: number
): CoverCrop => {
  void target;
  const side = Math.min(srcW, srcH);
  return {
    sx: (srcW - side) / 2,
    sy: (srcH - side) / 2,
    sw: side,
    sh: side,
  };
};

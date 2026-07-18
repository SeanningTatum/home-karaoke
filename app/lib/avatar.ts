// Pure helpers for guest avatar uploads (feat-010). No I/O — validation
// predicates, the R2 object key, and the public image URL. Callers (the
// upload route + the avatar-serving route) resolve the side effects.

/** Hard cap on an uploaded avatar's size — 2 MiB. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/**
 * Cap on the RAW picker file the client will feed into `createImageBitmap` —
 * a browser-memory guard, not the upload cap. Phone photos (3–10 MB) must
 * pass: the actual uploaded payload is the downscaled 512px JPEG, enforced
 * server-side against `MAX_AVATAR_BYTES`.
 */
export const MAX_RAW_AVATAR_BYTES = 20 * 1024 * 1024;

/** Inclusive at `MAX_RAW_AVATAR_BYTES` — mirrors `isWithinAvatarSize`. */
export const isWithinRawAvatarSize = (size: number): boolean =>
  size <= MAX_RAW_AVATAR_BYTES;

/** MIME types accepted for an avatar upload. */
export const ALLOWED_AVATAR_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const isAllowedAvatarType = (type: string): boolean =>
  (ALLOWED_AVATAR_TYPES as readonly string[]).includes(type);

/** Inclusive at `MAX_AVATAR_BYTES` — a file exactly at the cap is allowed. */
export const isWithinAvatarSize = (size: number): boolean =>
  size <= MAX_AVATAR_BYTES;

/** R2 object key for a user's avatar. */
export const avatarKey = (userId: string): string => `avatars/${userId}`;

/**
 * Public URL for a user's avatar image. The `version` cache-buster changes
 * whenever the user re-uploads, so clients fetch the fresh image rather than
 * a stale cached one.
 */
export const avatarImageUrl = (userId: string, version: number): string =>
  `/api/avatar/${userId}?v=${version}`;

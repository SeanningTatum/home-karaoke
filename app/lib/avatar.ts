// Pure helpers for guest avatar uploads (feat-010). No I/O — validation
// predicates, the R2 object key, and the public image URL. Callers (the
// upload route + the avatar-serving route) resolve the side effects.

/** Hard cap on an uploaded avatar's size — 2 MiB. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

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

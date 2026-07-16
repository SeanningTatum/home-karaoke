// Pure URL-building helpers for the room/join flow. Kept dependency-free
// (no `window`, no React) so the join-QR value can be computed in a loader
// (SSR, request-derived origin) as easily as in a test.

/**
 * Builds the absolute guest-facing join URL for a room code, e.g.
 * `buildJoinUrl("https://example.com", "KQ7-3FP")` ->
 * `"https://example.com/join/KQ7-3FP"`.
 *
 * `origin` should come from the request (`new URL(request.url).origin`) in
 * a loader — never `window.location`, since this needs to be correct
 * during SSR.
 */
export const buildJoinUrl = (origin: string, code: string): string =>
  `${origin.replace(/\/+$/, "")}/join/${encodeURIComponent(code)}`;

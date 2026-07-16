// Pure, dependency-free YouTube helpers — no `fetch`, no Effect, no
// CloudflareEnv. Kept separate from `app/services/youtube.ts` (the Effect
// service that actually calls the API) so they're trivially unit-testable
// and reusable from the tRPC route layer (query normalization for the D1
// cache check) without spinning up a service Layer.

/**
 * Lowercases, trims, and collapses internal whitespace so "Never Gonna  Give"
 * and " never gonna give " normalize to the same D1 `search_log.normalizedQuery`
 * cache key.
 */
export const normalizeSearchQuery = (query: string): string =>
  query.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Biases a search query toward karaoke versions unless the caller already
 * asked for one — avoids appending "karaoke karaoke" or similar.
 */
export const withKaraokeBias = (query: string): string =>
  /karaoke/i.test(query) ? query : `${query} karaoke`;

// YouTube video ids are always exactly 11 chars from this alphabet.
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const isValidVideoId = (candidate: string | null | undefined): candidate is string =>
  typeof candidate === "string" && VIDEO_ID_PATTERN.test(candidate);

/**
 * Extracts a video id from a YouTube URL — `watch?v=`, `youtu.be/`,
 * `shorts/`, and `embed/` forms (with or without a `www.`/`m.` subdomain).
 * Returns `null` for anything that isn't a recognizable YouTube video URL
 * (including non-YouTube domains and malformed URLs) rather than throwing.
 */
export const parseYouTubeUrl = (input: string): string | null => {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return isValidVideoId(id) ? id : null;
  }

  if (host !== "youtube.com") return null;

  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v");
    return isValidVideoId(id) ? id : null;
  }

  const shortsMatch = /^\/shorts\/([^/]+)/.exec(url.pathname);
  if (shortsMatch) return isValidVideoId(shortsMatch[1]) ? shortsMatch[1] : null;

  const embedMatch = /^\/embed\/([^/]+)/.exec(url.pathname);
  if (embedMatch) return isValidVideoId(embedMatch[1]) ? embedMatch[1] : null;

  return null;
};

// Matches ISO 8601 durations as returned by `contentDetails.duration`
// (always a "PT..." time-only duration for YouTube, but weeks/days are
// accepted too for robustness). At least one component must be present.
const ISO_DURATION_PATTERN =
  /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

/**
 * Parses an ISO 8601 duration string (e.g. `"PT4M13S"`, `"PT1H2M3S"`) into
 * whole seconds. Returns `null` for anything that doesn't match — never
 * throws.
 */
export const parseIsoDuration = (iso: string): number | null => {
  const match = ISO_DURATION_PATTERN.exec(iso.trim());
  if (!match) return null;

  const [, weeks, days, hours, minutes, seconds] = match;
  if (!weeks && !days && !hours && !minutes && !seconds) return null;

  const total =
    Number(weeks ?? 0) * 7 * 86400 +
    Number(days ?? 0) * 86400 +
    Number(hours ?? 0) * 3600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0);

  return Math.round(total);
};

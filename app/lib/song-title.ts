/**
 * Display-only cleanup for YouTube video titles (feat-014).
 *
 * Karaoke search results carry a lot of SEO cruft that costs real space on a
 * 10-foot TV — real rows from this repo's own `song` table:
 *
 *   "Teenage Dirtbag - Wheatus | Karaoke Version | KaraFun"
 *   "DANCING QUEEN -  ABBA (HD Karaoke)"
 *   "PSY - GANGNAM STYLE(강남스타일) M/V"
 *   "Darude - Sandstorm"
 *
 * Nothing here mutates stored data: the raw `title` stays the value written to
 * `room_song` history, the queue payload, and the phone tabs. This helper only
 * decides what the TV *renders*, and always hands back the raw string so
 * callers can keep it as the accessible/full value.
 */

/** Words that only ever describe a recording, never name a song. */
const NOISE_WORDS = [
  "karaoke",
  "karaoke version",
  "sing along",
  "singalong",
  "instrumental",
  "backing track",
  "no vocals",
  "with lyrics",
  "lyrics",
  "lyric video",
  "official video",
  "official music video",
  "official audio",
  "official lyric video",
  "music video",
  // Listed as bare words too, not only as phrases: `isNoiseOnly` classifies a
  // bracket group word-by-word, so "(Official Video)" is only recognized as
  // noise if BOTH words are in this vocabulary.
  "official",
  "video",
  "audio",
  "remaster",
  "remastered",
  "hd",
  "hq",
  "4k",
  "1080p",
  "720p",
  "m/v",
  "mv",
  "higher key",
  "lower key",
  "male key",
  "female key",
];

/** A bracket group `(...)`, `[...]` or `{...}` plus its contents. */
const BRACKET_GROUP = /[([{]([^)\]}]*)[)\]}]/g;

/** Runs of whitespace, including the double spaces real titles ship with. */
const WHITESPACE = /\s+/g;

/** Separator characters left dangling once a segment is removed. */
const DANGLING_SEPARATORS = /^[\s\-–—|·,:]+|[\s\-–—|·,:]+$/g;

/**
 * The first spaced hyphen/en-dash/em-dash — the artist/song separator every
 * publisher uses. Spaces are required on both sides so a hyphenated song name
 * ("Spider-Man") is never split.
 */
const ARTIST_SEPARATOR = /\s[-–—]\s/;

/**
 * Reduces a string to comparable letters+digits for channel matching:
 * lowercase, strip everything non-alphanumeric, then drop the boilerplate
 * words channels decorate their names with. "officialpsy" -> "psy",
 * "KaraFun Karaoke" -> "karafun", "Rick Astley" -> "rickastley".
 */
export const normalizeForMatch = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/official|vevo|karaoke|channel|topic|records|music/g, "");

const isNoiseOnly = (value: string): boolean => {
  // Unicode-aware on purpose: an ASCII-only strip would reduce "(강남스타일)"
  // to an empty string and classify it as noise, deleting real title content
  // for every non-Latin song. Keeping `\p{L}\p{N}` means non-Latin words
  // survive, fail the NOISE_WORDS lookup, and mark the group as meaningful.
  const stripped = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}/\s]/gu, " ")
    .replace(WHITESPACE, " ")
    .trim();
  if (stripped.length === 0) return true;
  // Every remaining word must be noise (or a bare number, e.g. "(HD 1080)").
  return stripped
    .split(" ")
    .every((word) => NOISE_WORDS.includes(word) || /^\d+$/.test(word));
};

/** Drops noise words from a segment that ALSO carries real content. */
const stripNoiseWords = (value: string): string => {
  let result = value;
  // Longest-first so "karaoke version" is consumed before "karaoke".
  for (const word of [...NOISE_WORDS].sort((a, b) => b.length - a.length)) {
    const escaped = word.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&");
    result = result.replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "gi"), " ");
  }
  return result.replace(WHITESPACE, " ").trim();
};

/**
 * Removes bracket groups whose contents are entirely noise — "(HD Karaoke)",
 * "(Official Video)", "(4K Remaster)" — while keeping meaningful ones, which
 * is why this can't just delete every bracket: "GANGNAM STYLE(강남스타일)"
 * must survive intact.
 */
const stripNoiseBrackets = (value: string): string =>
  value.replace(BRACKET_GROUP, (match, inner: string) =>
    isNoiseOnly(inner) ? " " : match
  );

/**
 * Removes pipe-delimited segments that are pure noise ("| Karaoke Version")
 * or just the publishing channel's name ("| KaraFun"), and strips noise words
 * out of the segments that remain. A segment carrying real content is always
 * kept — "Tom Jones MEDLEY Karaoke | You're My World, ..." keeps both halves
 * (minus the word "Karaoke"), because dropping the whole first segment would
 * throw away the artist.
 */
const stripPipeSegments = (value: string, channel?: string): string => {
  if (!value.includes("|")) return value;
  const normalizedChannel = channel ? normalizeForMatch(channel) : "";

  const kept = value
    .split("|")
    .map((segment) => segment.trim())
    .filter((segment) => {
      if (segment.length === 0) return false;
      if (isNoiseOnly(segment)) return false;
      if (normalizedChannel.length > 0) {
        const normalizedSegment = normalizeForMatch(segment);
        // Only a segment that IS the channel name gets dropped — not one that
        // merely contains it, or "KaraFun Presents Some Song" would vanish.
        if (
          normalizedSegment.length > 0 &&
          normalizedSegment === normalizedChannel
        ) {
          return false;
        }
      }
      return true;
    })
    .map(stripNoiseWords)
    .filter((segment) => segment.length > 0);

  return kept.join(" | ");
};

export interface CleanedTitle {
  /** What the TV shows as the primary line. Never empty. */
  readonly song: string;
  /** Secondary credit, or `null` when the title carried no artist half. */
  readonly artist: string | null;
  /** The untouched input — keep this as the accessible/full value. */
  readonly raw: string;
}

/**
 * Cleans a YouTube title for display and splits it into song + artist.
 *
 * The split direction is decided from data rather than assumed, because both
 * conventions are common in the same queue: karaoke channels publish
 * `Song - Artist` ("Teenage Dirtbag - Wheatus") while official channels
 * publish `Artist - Song` ("Darude - Sandstorm"). When the left segment
 * matches `channel`, the left side is the artist; otherwise the karaoke
 * convention wins.
 *
 * @param title Raw video title.
 * @param channel Publishing channel name (`QueueItem.channel`), when known.
 */
export const cleanSongTitle = (
  title: string,
  channel?: string
): CleanedTitle => {
  const raw = title;

  const cleaned = stripNoiseWords(
    stripNoiseBrackets(stripPipeSegments(title, channel))
  )
    .replace(WHITESPACE, " ")
    .replace(DANGLING_SEPARATORS, "")
    .trim();

  // Cleaning ate everything (a title that was nothing but noise) — the raw
  // string is always better than an empty banner.
  if (cleaned.length === 0) {
    return { song: raw.trim(), artist: null, raw };
  }

  const separatorMatch = cleaned.match(ARTIST_SEPARATOR);
  if (!separatorMatch || separatorMatch.index === undefined) {
    return { song: cleaned, artist: null, raw };
  }

  const left = cleaned.slice(0, separatorMatch.index).trim();
  const right = cleaned
    .slice(separatorMatch.index + separatorMatch[0].length)
    .trim();

  // A one-sided split ("- Sandstorm") isn't a credit, it's a stray dash.
  if (left.length === 0 || right.length === 0) {
    return { song: cleaned, artist: null, raw };
  }

  const normalizedChannel = channel ? normalizeForMatch(channel) : "";
  const normalizedLeft = normalizeForMatch(left);
  const leftIsChannel =
    normalizedChannel.length > 0 &&
    normalizedLeft.length > 0 &&
    (normalizedChannel === normalizedLeft ||
      normalizedChannel.includes(normalizedLeft) ||
      normalizedLeft.includes(normalizedChannel));

  return leftIsChannel
    ? { song: right, artist: left, raw }
    : { song: left, artist: right, raw };
};

/**
 * `137` -> `"2:17"`. Used for the TV's remaining-time readout, so it clamps
 * at zero rather than ever rendering a negative countdown, and drops hours in
 * (`"1:04:09"`) for the occasional 60-minute medley.
 */
export const formatDuration = (totalSeconds: number): string => {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
};

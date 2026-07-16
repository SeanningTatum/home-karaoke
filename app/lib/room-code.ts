// Unambiguous alphabet — excludes 0/O, 1/I/L (easily confused when read
// aloud or typed on a phone). 31 symbols: "23456789" + 23 letters.
export const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

const CODE_CHAR_COUNT = 6;

// Matches the exact format produced by `generateRoomCode`: 6 alphabet chars,
// hyphen after the 3rd — e.g. "KQ7-3FP". Mirrored (not imported) by
// `app/lib/schemas/room.ts`'s `RoomCode` Effect Schema for server-side
// validation; this copy is for cheap client-side UI checks (landing page
// join form) that shouldn't pull in `effect`.
export const ROOM_CODE_PATTERN = new RegExp(
  `^[${ROOM_CODE_ALPHABET}]{3}-[${ROOM_CODE_ALPHABET}]{3}$`
);

/** Injectable random byte source — Workers-safe default via `crypto.getRandomValues`. */
export type RandomSource = (byteCount: number) => Uint8Array;

export const defaultRandomSource: RandomSource = (byteCount) =>
  crypto.getRandomValues(new Uint8Array(byteCount));

/**
 * Generates a room code like "KQ7-3FP" — 6 characters from
 * `ROOM_CODE_ALPHABET`, split into two groups of 3 by a hyphen. Pure aside
 * from the injected random source, so it's fully deterministic under test.
 */
export const generateRoomCode = (
  random: RandomSource = defaultRandomSource
): string => {
  const bytes = random(CODE_CHAR_COUNT);
  let chars = "";
  for (let i = 0; i < CODE_CHAR_COUNT; i++) {
    chars += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
  }
  return `${chars.slice(0, 3)}-${chars.slice(3)}`;
};

/**
 * Normalizes free-typed input into the room-code shape as the visitor types:
 * uppercases, strips anything outside `ROOM_CODE_ALPHABET`, caps at 6
 * alphabet chars, and inserts the group hyphen once past the 3rd char. Used
 * by the landing page's join form for a "type anything, get KQ7-3FP back"
 * input experience. Pure — safe to unit test without a DOM.
 */
export const normalizeRoomCodeInput = (raw: string): string => {
  const alnum = raw
    .toUpperCase()
    .replace(new RegExp(`[^${ROOM_CODE_ALPHABET}]`, "g"), "")
    .slice(0, CODE_CHAR_COUNT);
  return alnum.length > 3 ? `${alnum.slice(0, 3)}-${alnum.slice(3)}` : alnum;
};

/** True when `code` is a complete, well-formed room code (e.g. "KQ7-3FP"). */
export const isCompleteRoomCode = (code: string): boolean =>
  ROOM_CODE_PATTERN.test(code);

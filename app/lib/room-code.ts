// Unambiguous alphabet — excludes 0/O, 1/I/L (easily confused when read
// aloud or typed on a phone). 31 symbols: "23456789" + 23 letters.
export const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

const CODE_CHAR_COUNT = 6;

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

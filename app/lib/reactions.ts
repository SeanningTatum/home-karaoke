// Pure reaction logic for the live karaoke room. Same discipline as
// `app/lib/room-state.ts`: every function here is a deterministic value
// transform — no I/O, no ambient randomness (the particle factory takes an
// injected `rng`), no clock reads. The tally shape feeds both the DO's
// ephemeral `RoomLiveState.reactions` (unit-tested via room-state) and the
// end-of-song recap; the particle helpers feed the shared `ReactionOverlay`.
import {
  MAX_REACTION_BATCH,
  REACTION_EMOJIS,
  type ReactionEmoji,
} from "@/lib/schemas/room-ws";

// --- Tally -------------------------------------------------------------------

/**
 * Running count per emoji for the currently-playing song. Sparse by design —
 * an emoji nobody has sent yet is simply absent rather than `0`.
 */
export type ReactionTally = Readonly<Partial<Record<ReactionEmoji, number>>>;

export const EMPTY_TALLY: ReactionTally = {};

/**
 * Normalizes a wire `count` into a whole number in `[1, MAX_REACTION_BATCH]`.
 * Missing/undefined → 1; non-integers are floored; out-of-range values clamp
 * to the nearest bound. Defensive twin of the schema's `between` check so a
 * message that somehow bypassed validation still can't inflate the tally.
 */
export const clampReactionCount = (count?: number): number => {
  if (count == null || !Number.isFinite(count)) return 1;
  const floored = Math.floor(count);
  if (floored < 1) return 1;
  if (floored > MAX_REACTION_BATCH) return MAX_REACTION_BATCH;
  return floored;
};

/** Adds a (clamped) batch for `emoji` to `tally`, returning a new tally. */
export const applyReactionTally = (
  tally: ReactionTally,
  emoji: ReactionEmoji,
  count?: number
): ReactionTally => ({
  ...tally,
  [emoji]: (tally[emoji] ?? 0) + clampReactionCount(count),
});

/** Sum of every emoji count in the tally. */
export const tallyTotal = (tally: ReactionTally): number =>
  REACTION_EMOJIS.reduce((sum, emoji) => sum + (tally[emoji] ?? 0), 0);

/**
 * Recap-ready breakdown: one entry per emoji with a positive count, sorted by
 * count descending. Ties break by palette order (`REACTION_EMOJIS`) so the
 * result is fully deterministic regardless of insertion order.
 */
export const tallyBreakdown = (
  tally: ReactionTally
): ReadonlyArray<{ readonly emoji: ReactionEmoji; readonly count: number }> =>
  REACTION_EMOJIS.map((emoji) => ({ emoji, count: tally[emoji] ?? 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return REACTION_EMOJIS.indexOf(a.emoji) - REACTION_EMOJIS.indexOf(b.emoji);
    });

// --- Particles ---------------------------------------------------------------

/** One fly-up emoji instance rendered by `ReactionOverlay`. */
export interface ReactionParticle {
  readonly id: string;
  readonly emoji: ReactionEmoji;
  /** Horizontal start position, viewport percent (~5-95). */
  readonly leftPct: number;
  /** Horizontal drift applied over the float, px (~±60). */
  readonly driftPx: number;
  /** Float duration, ms (2500-4000). */
  readonly durationMs: number;
  /** Rotation applied over the float, degrees (~±20). */
  readonly rotateDeg: number;
}

/**
 * Builds one particle deterministically from an injected `rng` (`() => number`
 * in `[0, 1)`, e.g. `Math.random`) and a caller-supplied unique `id`. Kept
 * pure so it's unit-testable with a stub rng; the overlay owns the real
 * randomness and id generation.
 */
export const makeParticle = (
  emoji: ReactionEmoji,
  rng: () => number,
  id: string
): ReactionParticle => ({
  id,
  emoji,
  leftPct: 5 + rng() * 90,
  driftPx: (rng() - 0.5) * 120,
  durationMs: 2500 + rng() * 1500,
  rotateDeg: (rng() - 0.5) * 40,
});

/**
 * DOM safety valve — the most fly-up emoji on screen at once. Independent of
 * the count clamp: many bursts in quick succession are capped here so a busy
 * chorus can't pile up thousands of nodes.
 */
export const MAX_ACTIVE_PARTICLES = 40;

/**
 * Appends `incoming` to `current` and keeps only the newest `cap` particles
 * (newest = latest appended). Returns a new array.
 */
export const capParticles = (
  current: readonly ReactionParticle[],
  incoming: readonly ReactionParticle[],
  cap: number
): ReactionParticle[] => {
  const combined = [...current, ...incoming];
  return combined.length <= cap
    ? combined
    : combined.slice(combined.length - cap);
};

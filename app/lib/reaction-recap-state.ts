// Pure state-transition logic for `ReactionRecap`'s display lifecycle (see
// that component's doc comment). Mirrors `now-up-overlay-state.ts`'s
// discipline — a deterministic `(state, ...) => state` value transform, no
// I/O, no timers — so the component's timer effects stay thin wrappers
// around decisions made here.
//
// Unlike `NowUpOverlay` (whose parent owns the entire visible-then-null
// timing and this module only decides the exit-animation lag), `ReactionRecap`
// owns its OWN "how long to stay visible" timer internally: the `recap` prop
// only ever flips non-null -> non-null (a new recap) or stays as-is, never
// null -> ... -> null on a schedule the parent controls. So this module
// splits into two independent transitions:
//   - `nextReactionRecapDisplayState` — reacts to the `recap` PROP changing
//     (a new recap arriving, or the parent hard-clearing it).
//   - `beginReactionRecapExit` — reacts to the component's OWN internal
//     "been visible long enough" timer firing (no prop involved).

export interface ReactionRecapPayload {
  readonly singerNickname: string;
  readonly total: number;
  readonly breakdown: ReadonlyArray<{
    readonly emoji: string;
    readonly count: number;
  }>;
}

export interface ReactionRecapDisplayState {
  /** The recap currently rendered, or `null` if nothing's shown. */
  readonly displayedRecap: ReactionRecapPayload | null;
  /** Whether the card should be playing its exit animation right now. */
  readonly isExiting: boolean;
}

export interface ReactionRecapTransition {
  readonly next: ReactionRecapDisplayState;
  /** `true` exactly when a NEW recap just started displaying — the caller
   * should (re)start its `RECAP_MS` visible timer. */
  readonly startVisibleTimer: boolean;
}

export const initialReactionRecapDisplayState = (
  recap: ReactionRecapPayload | null
): ReactionRecapDisplayState => ({ displayedRecap: recap, isExiting: false });

/**
 * Given the card's current display state and the latest `recap` prop, decide
 * the next display state.
 *
 * - `recap` non-null — show it immediately, cancelling any exit animation in
 *   progress for a previous recap (a new song's recap arriving before the
 *   last one finished its exit).
 * - `recap` null while something is displayed — the parent hard-cleared it
 *   out of band (not the normal `onDone` flow, which already resets internal
 *   state before nulling the parent's prop) — reset with no exit animation,
 *   since there's no graceful path back through the parent here.
 * - `recap` null and nothing displayed — no-op.
 */
export function nextReactionRecapDisplayState(
  current: ReactionRecapDisplayState,
  recap: ReactionRecapPayload | null
): ReactionRecapTransition {
  if (recap) {
    return {
      next: { displayedRecap: recap, isExiting: false },
      startVisibleTimer: true,
    };
  }

  if (!current.displayedRecap) {
    return { next: current, startVisibleTimer: false };
  }

  return { next: exitedReactionRecapDisplayState, startVisibleTimer: false };
}

/**
 * Transition fired by the component's own internal `RECAP_MS` visible timer
 * (not a prop change) — moves a currently-displayed, not-yet-exiting recap
 * into its exit animation. No-op if nothing's displayed or it's already
 * exiting (a defensive guard against a stray/duplicate timer fire).
 */
export function beginReactionRecapExit(
  current: ReactionRecapDisplayState
): ReactionRecapDisplayState {
  if (!current.displayedRecap || current.isExiting) return current;
  return { displayedRecap: current.displayedRecap, isExiting: true };
}

/** State once the exit animation finishes (`animationend` or the fallback
 * timeout, whichever comes first). */
export const exitedReactionRecapDisplayState: ReactionRecapDisplayState = {
  displayedRecap: null,
  isExiting: false,
};

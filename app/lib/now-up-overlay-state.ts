// Pure state-transition logic for `NowUpOverlay`'s lagged display state (see
// that component's doc comment). A deterministic `(state, singer) => state`
// value transform — no I/O, no timers — so the exit-animation decision is
// unit-testable without a DOM. The component owns the actual `setTimeout`
// for the fallback unmount; this module only decides *what* the next state
// should be.

export interface NowUpSinger {
  readonly nickname: string;
}

export interface NowUpDisplayState {
  /** The singer currently rendered, or `null` if nothing's shown. Lags the
   * `singer` prop by one exit animation on the null-edge (see `startExit`
   * below). */
  readonly displayedSinger: NowUpSinger | null;
  /** Whether the card should be playing its exit animation right now. */
  readonly isExiting: boolean;
}

export interface NowUpDisplayTransition {
  readonly next: NowUpDisplayState;
  /** `true` exactly when the transition just entered the exiting phase —
   * the caller should (re)start its fallback-unmount timer. */
  readonly startExit: boolean;
}

export const initialNowUpDisplayState = (
  singer: NowUpSinger | null
): NowUpDisplayState => ({ displayedSinger: singer, isExiting: false });

/**
 * Given the overlay's current display state and the latest `singer` prop,
 * decide the next display state.
 *
 * - `singer` non-null (a new or replacement singer) — show it immediately,
 *   cancelling any exit animation in progress for the previous one.
 * - `singer` null while something is displayed — begin (or continue) the
 *   exit animation instead of an instant unmount.
 * - `singer` null and nothing displayed — no-op.
 */
export function nextNowUpDisplayState(
  current: NowUpDisplayState,
  singer: NowUpSinger | null
): NowUpDisplayTransition {
  if (singer) {
    return { next: { displayedSinger: singer, isExiting: false }, startExit: false };
  }

  if (!current.displayedSinger) {
    return { next: current, startExit: false };
  }

  return {
    next: { displayedSinger: current.displayedSinger, isExiting: true },
    startExit: true,
  };
}

/** State once the exit animation finishes (`animationend` or the fallback
 * timeout, whichever comes first). */
export const exitedNowUpDisplayState: NowUpDisplayState = {
  displayedSinger: null,
  isExiting: false,
};

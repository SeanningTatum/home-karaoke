import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { InitialsAvatar } from "@/components/room/initials-avatar";
import {
  exitedNowUpDisplayState,
  initialNowUpDisplayState,
  nextNowUpDisplayState,
  type NowUpDisplayState,
} from "@/lib/now-up-overlay-state";
import { cn } from "@/lib/utils";

export interface NowUpOverlayProps {
  /** The singer to announce, or `null` for no announcement. Owned by the
   * caller (`$code.tsx`), which also owns the ~5s auto-dismiss timer —
   * see that file's doc comment for the item-id-change latching logic. */
  readonly singer: { readonly nickname: string } | null;
}

/** How long the exit animation is given to finish (`animate-now-up-out` is
 * 0.45s — see app.css) before this component force-unmounts anyway. Guards
 * two cases: a missed `animationend` event, and `prefers-reduced-motion`
 * collapsing the animation to ~0ms — some browsers skip firing the event
 * entirely for a near-zero-duration animation, so relying on it alone can
 * leave the card stuck on screen forever. */
const EXIT_FALLBACK_MS = 600;

/**
 * "You're up!" name card — announces the next singer on the host TV screen
 * (`/room/:code`) whenever `playback.currentItem` advances to a genuinely
 * new item (a skip, a video ending, or the queue resuming after sitting
 * idle mid-party). Distinct from `CelebrationBurst`, which fires exactly
 * once per session for the very first lobby -> playing transition; this
 * card fires on every *subsequent* singer change instead.
 *
 * Split into two layers so assistive tech and reduced-motion preferences
 * are independent (they're not mutually exclusive populations):
 * - a permanently-mounted `sr-only` `aria-live` region — live regions
 *   inserted into the DOM at announce time are silently dropped by NVDA,
 *   older JAWS, and some iOS VoiceOver versions, so the container never
 *   unmounts and only its TEXT changes; it announces regardless of the
 *   motion preference, tracking `singer` directly (not the lagged
 *   `displayedSinger` below);
 * - the visual full-screen card (`aria-hidden` — the live region already
 *   speaks), `pointer-events-none` so it never blocks the controls
 *   underneath (per design.md §6, motion never blocks interaction). It
 *   renders for reduced-motion viewers too — this is the singer
 *   announcement itself, not a decorative flourish — it just appears and
 *   disappears statically because the global `prefers-reduced-motion` net
 *   in app.css collapses both the entrance and exit keyframes to 0.01ms.
 *
 * `displayedSinger` intentionally lags `singer` by one exit animation: when
 * the parent clears `singer` back to `null` (its dismiss timer firing), the
 * card keeps rendering the last singer with `animate-now-up-out` applied
 * instead of hard-unmounting, and only clears for real on `animationend`
 * (or the `EXIT_FALLBACK_MS` timeout, whichever comes first). A new singer
 * arriving mid-exit cancels the exit and shows immediately.
 */
export function NowUpOverlay({ singer }: NowUpOverlayProps) {
  const { t } = useTranslation("room");

  const [display, setDisplay] = useState<NowUpDisplayState>(() =>
    initialNowUpDisplayState(singer)
  );
  const displayRef = useRef(display);
  displayRef.current = display;
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearExitTimer = () => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  };

  useEffect(() => {
    clearExitTimer();

    // `nextNowUpDisplayState` is the pure decision (app/lib/now-up-overlay-state.ts,
    // unit-tested there); this effect only owns the side effect it asks for —
    // (re)starting the fallback-unmount timer.
    const { next, startExit } = nextNowUpDisplayState(displayRef.current, singer);
    setDisplay(next);

    if (startExit) {
      exitTimerRef.current = setTimeout(() => {
        setDisplay(exitedNowUpDisplayState);
        exitTimerRef.current = null;
      }, EXIT_FALLBACK_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singer]);

  useEffect(() => clearExitTimer, []);

  const handleAnimationEnd = () => {
    // Functional updater: `display.isExiting` from the render closure can be
    // stale if animationend lands while a new-singer update is queued but not
    // yet committed — `prev` is always the latest committed value. The timer
    // clear is a no-op outside the exit window (the ref only holds a timer
    // while an exit is in flight).
    clearExitTimer();
    setDisplay((prev) => (prev.isExiting ? exitedNowUpDisplayState : prev));
  };

  const { displayedSinger, isExiting } = display;

  return (
    <>
      <div aria-live="polite" className="sr-only" data-testid="room-now-up-live">
        {singer ? t("now_up.headline", { name: singer.nickname }) : null}
      </div>
      {displayedSinger && (
        <div
          aria-hidden
          data-testid="room-now-up-overlay"
          onAnimationEnd={handleAnimationEnd}
          className={cn(
            "pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-background via-primary to-secondary",
            isExiting ? "animate-now-up-out" : "animate-now-up"
          )}
        >
          <InitialsAvatar name={displayedSinger.nickname} size="lg" className="shadow-glow-accent" />
          <p className="tv-headline text-center text-foreground">
            {t("now_up.headline", { name: displayedSinger.nickname })}
          </p>
        </div>
      )}
    </>
  );
}

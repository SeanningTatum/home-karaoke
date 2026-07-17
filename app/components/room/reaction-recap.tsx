import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  beginReactionRecapExit,
  exitedReactionRecapDisplayState,
  initialReactionRecapDisplayState,
  nextReactionRecapDisplayState,
  type ReactionRecapDisplayState,
  type ReactionRecapPayload,
} from "@/lib/reaction-recap-state";
import { cn } from "@/lib/utils";

export interface ReactionRecapProps {
  /** The end-of-song recap to announce, or `null` for no announcement. Owned
   * by the caller (`$code.tsx`) — set from the `reaction.recap` broadcast and
   * cleared via `onDone` below. Unlike `NowUpOverlay`, this component owns
   * its OWN "how long to stay visible" timer (`RECAP_MS`) rather than the
   * caller nulling the prop on a schedule — see `reaction-recap-state.ts`'s
   * doc comment for why the two components split this responsibility
   * differently. */
  readonly recap: ReactionRecapPayload | null;
  /** Called once the card has fully finished (visible hold + exit animation).
   * The caller should clear its `recap` state here — this is also the signal
   * that it's safe to stop deferring the "You're up" card. */
  readonly onDone: () => void;
}

/** How long the recap stays fully visible before it starts exiting. Exported
 * so the caller can defer the "You're up" announcement (card + fanfare) by
 * the same duration — see `$code.tsx`'s currentItem-change effect. */
export const RECAP_MS = 3500;

/** How long the exit animation is given to finish (`animate-now-up-out` is
 * 0.45s — see app.css) before this component force-finishes anyway. Same
 * belt-and-suspenders guard as `NowUpOverlay.EXIT_FALLBACK_MS`: a missed
 * `animationend` event, or `prefers-reduced-motion` collapsing the animation
 * to ~0ms and some browsers skipping the event entirely for it. */
const EXIT_FALLBACK_MS = 600;

/**
 * End-of-song crowd recap card — announces how the crowd reacted to the song
 * that just finished, on the host TV screen (`/room/:code`). Fired from the
 * `reaction.recap` broadcast, which the server sends BEFORE the
 * `playback.updated` that advances to the next singer, so `$code.tsx` defers
 * its "You're up" card/fanfare until this one has finished (see `RECAP_MS`).
 *
 * Visual/a11y split mirrors `NowUpOverlay`: a permanently-mounted `sr-only`
 * `aria-live` region (tracks `recap` directly, not the lagged
 * `displayedRecap` below) plus a decorative `aria-hidden` full-screen card
 * reusing the same `animate-now-up` / `animate-now-up-out` entrance/exit
 * keyframes. Zero-reaction songs never reach here — the server sends no
 * `reaction.recap` for those, so `recap` simply never turns non-null.
 */
export function ReactionRecap({ recap, onDone }: ReactionRecapProps) {
  const { t } = useTranslation("room");

  const [display, setDisplay] = useState<ReactionRecapDisplayState>(() =>
    initialReactionRecapDisplayState(recap)
  );
  const displayRef = useRef(display);
  displayRef.current = display;

  const visibleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Ref-stash `onDone` so the effects below stay keyed on `recap` alone —
  // same pattern as `CelebrationBurst`'s `onDoneRef`.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  const clearVisibleTimer = () => {
    if (visibleTimerRef.current) {
      clearTimeout(visibleTimerRef.current);
      visibleTimerRef.current = null;
    }
  };
  const clearExitFallbackTimer = () => {
    if (exitFallbackTimerRef.current) {
      clearTimeout(exitFallbackTimerRef.current);
      exitFallbackTimerRef.current = null;
    }
  };

  // Finalizes the exit — called from whichever of `animationend` or the
  // fallback timer fires first. Guarded on `displayRef.current.isExiting` so
  // the second of the two calls is a no-op instead of double-firing `onDone`.
  const finishExit = () => {
    if (!displayRef.current.isExiting) return;
    clearExitFallbackTimer();
    setDisplay(exitedReactionRecapDisplayState);
    onDoneRef.current();
  };

  useEffect(() => {
    clearVisibleTimer();
    clearExitFallbackTimer();

    // `nextReactionRecapDisplayState` is the pure decision
    // (app/lib/reaction-recap-state.ts, unit-tested there); this effect only
    // owns the side effect it asks for — (re)starting the RECAP_MS visible
    // timer that eventually begins the exit animation.
    const { next, startVisibleTimer } = nextReactionRecapDisplayState(
      displayRef.current,
      recap
    );
    setDisplay(next);

    if (startVisibleTimer) {
      visibleTimerRef.current = setTimeout(() => {
        visibleTimerRef.current = null;
        setDisplay((prev) => beginReactionRecapExit(prev));
        exitFallbackTimerRef.current = setTimeout(() => {
          exitFallbackTimerRef.current = null;
          finishExit();
        }, EXIT_FALLBACK_MS);
      }, RECAP_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recap]);

  useEffect(
    () => () => {
      clearVisibleTimer();
      clearExitFallbackTimer();
    },
    []
  );

  const handleAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
    // Only the container's own exit animation may finalize — a child
    // animation's animationend would otherwise bubble here and prematurely
    // finish the recap.
    if (event.target !== event.currentTarget) return;
    finishExit();
  };

  const { displayedRecap, isExiting } = display;

  return (
    <>
      <div
        aria-live="polite"
        className="sr-only"
        data-testid="reaction-recap-live"
      >
        {recap
          ? t("reactions.aria_recap", {
              name: recap.singerNickname,
              count: recap.total,
            })
          : null}
      </div>
      {displayedRecap && (
        <div
          aria-hidden
          data-testid="reaction-recap"
          onAnimationEnd={handleAnimationEnd}
          className={cn(
            "pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-background via-primary to-secondary",
            isExiting ? "animate-now-up-out" : "animate-now-up"
          )}
        >
          <p className="tv-title text-center text-foreground">
            {t("reactions.recap_title", { name: displayedRecap.singerNickname })}
          </p>
          <p className="tv-display text-center text-foreground">
            {t("reactions.recap_total", { count: displayedRecap.total })}
          </p>
          {displayedRecap.breakdown.length > 0 && (
            <ul className="flex flex-wrap items-center justify-center gap-4">
              {displayedRecap.breakdown.map((entry) => (
                <li
                  key={entry.emoji}
                  className="flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-5 py-2"
                >
                  <span aria-hidden className="text-4xl">
                    {entry.emoji}
                  </span>
                  <span className="tv-body text-foreground">{entry.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

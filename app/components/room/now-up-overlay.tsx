import { useTranslation } from "react-i18next";

import { InitialsAvatar } from "@/components/room/initials-avatar";

export interface NowUpOverlayProps {
  /** The singer to announce, or `null` to render nothing. Owned by the
   * caller (`$code.tsx`), which also owns the ~2.5s auto-dismiss timer and
   * the `prefers-reduced-motion` gate — see that file's doc comment for the
   * item-id-change latching logic. This component is purely presentational. */
  readonly singer: { readonly nickname: string } | null;
}

/**
 * "You're up!" full-screen name card — a brief overlay on the host TV
 * screen (`/room/:code`) announcing the next singer whenever
 * `playback.currentItem` advances to a genuinely new item (a skip, a video
 * ending, or the queue resuming after sitting idle mid-party). Distinct
 * from `CelebrationBurst`, which fires exactly once per session for the
 * very first lobby -> playing transition; this card fires on every
 * *subsequent* singer change instead.
 *
 * `aria-live="polite"` + `pointer-events-none` so it announces itself to
 * screen readers without ever blocking interaction with the controls
 * underneath (per design.md §6, motion never blocks interaction).
 */
export function NowUpOverlay({ singer }: NowUpOverlayProps) {
  const { t } = useTranslation("room");

  if (!singer) return null;

  return (
    <div
      aria-live="polite"
      data-testid="room-now-up-overlay"
      className="animate-now-up pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-background/95 via-primary/25 to-secondary/25"
    >
      <InitialsAvatar name={singer.nickname} size="lg" className="shadow-glow-accent" />
      <p className="tv-headline text-center text-foreground">
        {t("now_up.headline", { name: singer.nickname })}
      </p>
    </div>
  );
}

import { useTranslation } from "react-i18next";

import { InitialsAvatar } from "@/components/room/initials-avatar";

export interface NowUpOverlayProps {
  /** The singer to announce, or `null` for no announcement. Owned by the
   * caller (`$code.tsx`), which also owns the ~2.5s auto-dismiss timer —
   * see that file's doc comment for the item-id-change latching logic. */
  readonly singer: { readonly nickname: string } | null;
}

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
 *   motion preference;
 * - the visual full-screen card (`aria-hidden` — the live region already
 *   speaks), gated on `prefers-reduced-motion` at render, and
 *   `pointer-events-none` so it never blocks the controls underneath (per
 *   design.md §6, motion never blocks interaction).
 */
export function NowUpOverlay({ singer }: NowUpOverlayProps) {
  const { t } = useTranslation("room");

  // Render-time read is deliberate: `singer` only ever changes client-side
  // (WS-driven state), so every announce re-renders through this check;
  // SSR renders the (empty) live region only.
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <>
      <div aria-live="polite" className="sr-only" data-testid="room-now-up-live">
        {singer ? t("now_up.headline", { name: singer.nickname }) : null}
      </div>
      {singer && !prefersReducedMotion && (
        <div
          aria-hidden
          data-testid="room-now-up-overlay"
          className="animate-now-up pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-background/95 via-primary/25 to-secondary/25"
        >
          <InitialsAvatar name={singer.nickname} size="lg" className="shadow-glow-accent" />
          <p className="tv-headline text-center text-foreground">
            {t("now_up.headline", { name: singer.nickname })}
          </p>
        </div>
      )}
    </>
  );
}

import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import { IconDeviceMobile } from "@tabler/icons-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface JoinPanelProps {
  /** Absolute join URL — built server-side from the request origin, never `window.location`. */
  readonly joinUrl: string;
  /** Display code, e.g. "KQ7-3FP". */
  readonly code: string;
  /**
   * "lg" — the lobby hero panel: big display-font code, large QR, idle
   * glow ring, friendly prompt line. "sm" (default) — the persistent
   * corner panel shown while a song is playing, so guests can always join
   * without the host having to leave the singing view.
   */
  readonly size?: "lg" | "sm";
  readonly className?: string;
}

/** QR code + room code for guests to scan and join — sized for the lobby hero or the always-visible corner affordance. */
export function JoinPanel({ joinUrl, code, size = "sm", className }: JoinPanelProps) {
  const { t } = useTranslation("room");
  const isLarge = size === "lg";

  const card = (
      <Card
        className={cn(
          isLarge
            // Lobby hero fills its grid column so it matches the height of
            // the roster/queue board in the right column (beta feedback:
            // the QR card used to be `w-fit` and floated, leaving the two
            // lobby columns visibly mismatched in height).
            ? "h-full w-full border-primary/30 bg-card/80 shadow-glow-accent"
            : cn("w-fit", className)
        )}
      >
        <CardContent
          className={cn(
            // Both variants stack top-to-bottom now (beta feedback: the sm
            // corner card used to be a side-by-side row that squished the QR
            // against the code). QR on top, then the hint label, then the
            // code — centered in either size.
            "flex flex-col items-center gap-3 p-4",
            isLarge && "h-full justify-center gap-6 p-10"
          )}
        >
          {/* Literal white, not a theme token: QR scanners need a light quiet
              zone with dark modules in every theme, so this surface must not
              follow dark mode. */}
          <div
            data-testid="room-join-qr"
            className={cn(
              "flex shrink-0 items-center justify-center rounded-md bg-white p-2",
              isLarge && "rounded-2xl p-6"
            )}
          >
            <QRCodeSVG value={joinUrl} size={isLarge ? 240 : 144} />
          </div>
          <div
            className={cn(
              "flex flex-col items-center gap-1 text-center",
              isLarge && "gap-3"
            )}
          >
            <span
              className={cn(
                "flex items-center text-muted-foreground",
                isLarge
                  ? "tv-label gap-2"
                  : "gap-1.5 text-xs uppercase tracking-wider"
              )}
            >
              <IconDeviceMobile className={isLarge ? "size-6" : "size-3.5"} />
              {t("join.hint")}
            </span>
            <span
              data-testid="room-code-text"
              className={cn(
                "font-bold whitespace-nowrap text-foreground",
                isLarge
                  ? "tv-code"
                  : "font-mono text-2xl tracking-wider"
              )}
            >
              {code}
            </span>
          </div>
          {isLarge && (
            <div className="flex flex-col items-center gap-2 text-center">
              <p
                data-testid="room-lobby-prompt"
                className="tv-body text-muted-foreground"
              >
                {t("lobby.prompt")}
              </p>
              {/* Calm fine-print footer (was a shouty uppercase banner
                  orphaned below the card). Kept inside the QR card so the
                  "how to control playback" note reads as part of the join
                  affordance, not a floating label. */}
              <p
                data-testid="room-lobby-playback-hint"
                className="max-w-xs text-lg leading-snug text-muted-foreground/70"
              >
                {t("lobby.playback_hint")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
  );

  // "sm" keeps the Card as the component root (pre-phase-4 DOM shape for the
  // corner panel); only the lobby hero needs the relative wrapper for its glow.
  if (!isLarge) return card;

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col items-center justify-center",
        className
      )}
    >
      {/* Subtle idle glow behind the hero panel — CSS-only (Tailwind's
          built-in `animate-pulse`), gated by `motion-reduce:animate-none`
          in addition to the app-wide reduced-motion duration collapse. */}
      <div
        aria-hidden
        className="animate-pulse motion-reduce:animate-none absolute -inset-8 -z-10 rounded-[2.5rem] bg-gradient-accent opacity-25 blur-3xl"
      />
      {card}
    </div>
  );
}

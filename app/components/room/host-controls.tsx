import { useTranslation } from "react-i18next";
import { IconPlayerPlayFilled, IconPlayerPauseFilled, IconPlayerSkipForwardFilled } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlaybackState } from "@/lib/schemas/room-ws";

export interface HostControlsProps {
  readonly playback: PlaybackState | null;
  readonly queueLength: number;
  readonly onPlay: () => void;
  readonly onPause: () => void;
  readonly onSkip: () => void;
  /** "tv" — the host TV screen (`/room/:code`): large gradient play/pause
   * per design.md §3, sized for 10-foot viewing. "compact" (default) — the
   * guest phone Controls tab on `/join/:code`, unchanged icon-button sizing. */
  readonly size?: "tv" | "compact";
}

/**
 * Host transport controls — play/pause + skip. Play/pause is the single
 * primary transport action, so on the TV screen (per design.md §3) it's the
 * one control that gets the gradient accent + glow treatment; skip stays a
 * plain secondary button in both sizes.
 */
export function HostControls({
  playback,
  queueLength,
  onPlay,
  onPause,
  onSkip,
  size = "compact",
}: HostControlsProps) {
  const { t } = useTranslation("room");
  const isTv = size === "tv";

  const hasSomethingToPlay = Boolean(playback?.currentItem) || queueLength > 0;
  const isPlaying = playback?.status === "playing";

  return (
    <div className={cn("flex items-center", isTv ? "gap-4" : "gap-2")}>
      <Button
        variant={isTv ? "default" : "secondary"}
        size={isTv ? "icon-lg" : "icon"}
        data-testid="room-play-pause-button"
        disabled={!hasSomethingToPlay}
        aria-label={isPlaying ? t("controls.pause") : t("controls.play")}
        onClick={isPlaying ? onPause : onPlay}
        className={cn(
          // Play/pause is the single primary transport action — per
          // design.md §3 it gets the gradient accent in BOTH sizes (TV: big
          // + glow; compact/phone: same fill, unchanged footprint) rather
          // than the plain `secondary` fill every other control keeps.
          "bg-gradient-accent text-primary-foreground hover:opacity-90",
          isTv ? "size-16 rounded-full shadow-glow-accent" : "rounded-full"
        )}
      >
        {isPlaying ? (
          <IconPlayerPauseFilled className={isTv ? "size-7" : "size-4"} />
        ) : (
          <IconPlayerPlayFilled className={isTv ? "size-7" : "size-4"} />
        )}
      </Button>
      <Button
        variant="secondary"
        size={isTv ? "icon-lg" : "icon"}
        data-testid="room-skip-button"
        disabled={!playback?.currentItem}
        aria-label={t("controls.skip")}
        onClick={onSkip}
        className={cn(isTv && "size-12 rounded-full")}
      >
        <IconPlayerSkipForwardFilled className={isTv ? "size-5" : "size-4"} />
      </Button>
    </div>
  );
}

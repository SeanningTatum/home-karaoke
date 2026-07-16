import { useTranslation } from "react-i18next";
import { IconPlayerPlayFilled, IconPlayerPauseFilled, IconPlayerSkipForwardFilled } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import type { PlaybackState } from "@/lib/schemas/room-ws";

export interface HostControlsProps {
  readonly playback: PlaybackState | null;
  readonly queueLength: number;
  readonly onPlay: () => void;
  readonly onPause: () => void;
  readonly onSkip: () => void;
}

/**
 * Minimal host transport controls for Phase 3 — play/pause + skip. The
 * full controls tab (volume, reorder, guest-reorder toggle) is Phase 5.
 */
export function HostControls({
  playback,
  queueLength,
  onPlay,
  onPause,
  onSkip,
}: HostControlsProps) {
  const { t } = useTranslation("room");

  const hasSomethingToPlay = Boolean(playback?.currentItem) || queueLength > 0;
  const isPlaying = playback?.status === "playing";

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="icon"
        data-testid="room-play-pause-button"
        disabled={!hasSomethingToPlay}
        aria-label={isPlaying ? t("controls.pause") : t("controls.play")}
        onClick={isPlaying ? onPause : onPlay}
      >
        {isPlaying ? (
          <IconPlayerPauseFilled className="size-4" />
        ) : (
          <IconPlayerPlayFilled className="size-4" />
        )}
      </Button>
      <Button
        variant="secondary"
        size="icon"
        data-testid="room-skip-button"
        disabled={!playback?.currentItem}
        aria-label={t("controls.skip")}
        onClick={onSkip}
      >
        <IconPlayerSkipForwardFilled className="size-4" />
      </Button>
    </div>
  );
}

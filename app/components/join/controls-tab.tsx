import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { IconVolume2 } from "@tabler/icons-react";

import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { HostControls } from "@/components/room/host-controls";
import { QueueRail } from "@/components/room/queue-rail";
import { api } from "@/trpc/client";
import type {
  ClientMessage,
  PlaybackState,
  QueueItem,
  RoomSettings,
} from "@/lib/schemas/room-ws";

export interface ControlsTabProps {
  readonly roomId: string;
  readonly queue: readonly QueueItem[];
  readonly playback: PlaybackState | null;
  readonly settings: RoomSettings | null;
  readonly send: (message: ClientMessage) => boolean;
}

/**
 * Host-only "Controls" tab on `/join/:code` — lets the host drive playback
 * (play/pause/skip/volume), toggle guest reordering, and manage the queue
 * (reorder/remove any item) from a phone while the actual video plays on
 * the `/room/:code` screen. The volume slider only drives the WS
 * `playback.setVolume` message — the audio itself lives in the
 * `YoutubePlayer` on the host screen, not here.
 *
 * Skip also records play history (`room.recordPlayed`) using this tab's own
 * `playback.currentItem` — the host may be driving playback entirely from
 * here, so history recording can't only live on the `/room/:code` screen's
 * skip button.
 */
export function ControlsTab({
  roomId,
  queue,
  playback,
  settings,
  send,
}: ControlsTabProps) {
  const { t } = useTranslation("room");
  const [localVolume, setLocalVolume] = useState(playback?.volume ?? 80);

  useEffect(() => {
    if (playback) setLocalVolume(playback.volume);
  }, [playback?.volume]);

  const recordPlayed = api.room.recordPlayed.useMutation({
    onError: (error) => {
      // Best-effort — history is a nice-to-have, never blocks the actual
      // transport control the user just triggered.
      console.error("room.recordPlayed failed", error);
    },
  });

  const recordCurrentIfPlaying = () => {
    const current = playback?.currentItem;
    if (!current) return;
    recordPlayed.mutate({
      roomId,
      videoId: current.videoId,
      singerNickname: current.singerNickname,
      addedByUserId: current.addedByUserId ?? undefined,
      // Idempotency key — dedupes a dual-screen double-record (e.g. host TV
      // videoEnded + this phone skip landing on the same performance).
      queueItemId: current.id,
    });
  };

  const handleSkip = () => {
    recordCurrentIfPlaying();
    send({ type: "playback.skip", currentItemId: playback?.currentItem?.id });
  };

  const handleGuestReorderChange = (checked: boolean) => {
    // Single write path: the room DO applies this live AND persists it to D1
    // (see `karaoke-room.ts`). If the socket is closed the message never
    // leaves, so nothing changes anywhere — the switch stays put (it's driven
    // by the DO's broadcast `settings`) and D1 can't drift ahead. Just tell
    // the host it didn't apply while they're offline.
    const delivered = send({ type: "room.setGuestReorder", allowed: checked });
    if (!delivered) toast.error(t("controls.guest_reorder_offline"));
  };

  return (
    <div data-testid="join-controls-tab" className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {t("controls.playback_heading")}
        </h3>
        <HostControls
          playback={playback}
          queueLength={queue.length}
          onPlay={() => send({ type: "playback.play" })}
          onPause={() => send({ type: "playback.pause" })}
          onSkip={handleSkip}
        />
        <div className="flex items-center gap-3">
          <IconVolume2 className="size-4 shrink-0 text-muted-foreground" />
          <Slider
            data-testid="room-volume-slider"
            value={[localVolume]}
            min={0}
            max={100}
            step={1}
            onValueChange={(values) => setLocalVolume(values[0] ?? localVolume)}
            onValueCommit={(values) =>
              send({
                type: "playback.setVolume",
                volume: values[0] ?? localVolume,
              })
            }
          />
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {localVolume}
          </span>
        </div>
      </section>

      <section className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="guest-reorder-switch" className="text-sm font-medium">
            {t("controls.guest_reorder_label")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("controls.guest_reorder_description")}
          </p>
        </div>
        <Switch
          id="guest-reorder-switch"
          data-testid="room-guest-reorder-switch"
          checked={settings?.allowGuestReorder ?? false}
          onCheckedChange={handleGuestReorderChange}
        />
      </section>

      <section className="flex min-h-0 flex-1 flex-col gap-2">
        <QueueRail
          queue={queue}
          viewerRole="host"
          reorderable
          onReorder={(queueItemId, toIndex) =>
            send({ type: "queue.reorder", queueItemId, toIndex })
          }
          onRemove={(queueItemId) => send({ type: "queue.remove", queueItemId })}
        />
      </section>
    </div>
  );
}

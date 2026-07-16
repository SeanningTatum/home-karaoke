import type { ClientMessage, PlaybackState, QueueItem } from "@/lib/schemas/room-ws";
import { NowSingingBanner } from "@/components/room/now-singing-banner";
import { QueueRail } from "@/components/room/queue-rail";

export interface QueueTabProps {
  readonly queue: readonly QueueItem[];
  readonly playback: PlaybackState | null;
  readonly ownUserId: string | null;
  /** Live from `state.settings.allowGuestReorder` — gates drag-to-reorder for this guest. */
  readonly allowGuestReorder: boolean;
  readonly send: (message: ClientMessage) => void;
}

/**
 * Queue tab of `/join/:code` — live WS state, own items highlighted,
 * drag-to-reorder enabled only when the host has turned on guest
 * reordering, and a remove button on the guest's own queued items
 * (`canPerform`'s `queue.remove` rule already allows this independent of
 * the reorder setting).
 */
export function QueueTab({
  queue,
  playback,
  ownUserId,
  allowGuestReorder,
  send,
}: QueueTabProps) {
  return (
    <div data-testid="join-queue-tab" className="flex flex-col gap-4">
      <NowSingingBanner currentItem={playback?.currentItem ?? null} />
      <QueueRail
        queue={queue}
        ownUserId={ownUserId}
        viewerRole="guest"
        reorderable={allowGuestReorder}
        onReorder={(queueItemId, toIndex) =>
          send({ type: "queue.reorder", queueItemId, toIndex })
        }
        onRemove={(queueItemId) => send({ type: "queue.remove", queueItemId })}
      />
    </div>
  );
}

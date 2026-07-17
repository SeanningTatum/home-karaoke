import { useTranslation } from "react-i18next";
import { IconPlaylistAdd } from "@tabler/icons-react";

import { ownQueueStanding } from "@/lib/room-state";
import type { QueueItem } from "@/lib/schemas/room-ws";

export interface PositionBarProps {
  readonly queue: readonly QueueItem[];
  readonly ownUserId: string | null;
}

/**
 * Small persistent bottom bar on `/join/:code` — "You have N songs queued —
 * next one is #K." Purely derived client-side from the live `queue` state
 * plus the viewer's own id (`ownQueueStanding` in `app/lib/room-state.ts`);
 * no new wire message. Renders nothing once the viewer has nothing queued.
 */
export function PositionBar({ queue, ownUserId }: PositionBarProps) {
  const { t } = useTranslation("room");
  const { count, nextPosition } = ownQueueStanding(queue, ownUserId);

  if (count === 0 || nextPosition === null) return null;

  return (
    <div
      data-testid="join-position-bar"
      className="flex items-center gap-2 rounded-lg border border-primary/30 bg-card/95 px-3 py-2 text-sm shadow-sm backdrop-blur"
    >
      <IconPlaylistAdd className="size-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 truncate font-medium text-foreground">
        {t("position.summary", { count, position: nextPosition })}
      </p>
    </div>
  );
}

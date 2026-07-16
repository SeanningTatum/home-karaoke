import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconGripVertical, IconMusic, IconPlaylist, IconX } from "@tabler/icons-react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QueueItem, Role } from "@/lib/schemas/room-ws";

export interface QueueRailProps {
  readonly queue: readonly QueueItem[];
  readonly className?: string;
  /**
   * Current viewer's user id (guest join view) — items where
   * `addedByUserId` matches get a "You" marker and (for guests) a remove
   * button. `null`/omitted (host view) renders no highlighting.
   */
  readonly ownUserId?: string | null;
  /** The current viewer's role — determines remove permission (host: any
   * item; guest: own item only), mirroring `canPerform`'s `queue.remove`
   * rule in `app/lib/room-state.ts`. Defaults to "host". */
  readonly viewerRole?: Role;
  /** Whether drag-to-reorder is enabled for this viewer — host: always;
   * guest: only when `state.settings.allowGuestReorder` is on. */
  readonly reorderable?: boolean;
  /** Sends `queue.reorder` over the room socket. Required when `reorderable`. */
  readonly onReorder?: (queueItemId: string, toIndex: number) => void;
  /** Sends `queue.remove` over the room socket. Omit to hide remove buttons entirely. */
  readonly onRemove?: (queueItemId: string) => void;
}

/**
 * Live queue rail shared by the host screen (`/room/:code`) and the guest
 * Queue tab (`/join/:code`) — drag-to-reorder via dnd-kit (Phase 5) plus
 * per-item remove buttons gated by `viewerRole`/`ownUserId`.
 *
 * Reordering is optimistic: `displayQueue` updates immediately on drag end
 * (via `arrayMove`) so the list doesn't snap back while the `queue.reorder`
 * round-trip is in flight, then resyncs from the authoritative `queue` prop
 * whenever the server's `queue.updated`/`room.state` broadcast arrives.
 */
export function QueueRail({
  queue,
  className,
  ownUserId = null,
  viewerRole = "host",
  reorderable = false,
  onReorder,
  onRemove,
}: QueueRailProps) {
  const { t } = useTranslation("room");
  const [displayQueue, setDisplayQueue] = useState<readonly QueueItem[]>(queue);

  useEffect(() => {
    setDisplayQueue(queue);
  }, [queue]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Touch needs a short hold before a drag starts so a normal vertical
    // scroll on a phone isn't hijacked into a drag — the handle itself is
    // also the only draggable surface, which is the primary scroll guard.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = displayQueue.findIndex((q) => q.id === active.id);
    const newIndex = displayQueue.findIndex((q) => q.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    setDisplayQueue((prev) => arrayMove([...prev], oldIndex, newIndex));
    onReorder?.(String(active.id), newIndex);
  };

  return (
    <div
      data-testid="room-queue-rail"
      className={cn("flex h-full flex-col gap-3", className)}
    >
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          <IconPlaylist className="size-4" />
          {t("queue.title")}
        </h2>
        <Badge variant="secondary" data-testid="room-queue-count">
          {t("queue.count", { count: queue.length })}
        </Badge>
      </div>

      {queue.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("queue.empty")}
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={displayQueue.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-2 overflow-y-auto">
              {displayQueue.map((item) => {
                const isOwn =
                  ownUserId != null && item.addedByUserId === ownUserId;
                const canRemove =
                  Boolean(onRemove) && (viewerRole === "host" || isOwn);
                return (
                  <QueueRow
                    key={item.id}
                    item={item}
                    isOwn={isOwn}
                    reorderable={reorderable}
                    canRemove={canRemove}
                    onRemove={onRemove}
                  />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

interface QueueRowProps {
  readonly item: QueueItem;
  readonly isOwn: boolean;
  readonly reorderable: boolean;
  readonly canRemove: boolean;
  readonly onRemove?: (queueItemId: string) => void;
}

function QueueRow({ item, isOwn, reorderable, canRemove, onRemove }: QueueRowProps) {
  const { t } = useTranslation("room");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: !reorderable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid="room-queue-item"
      data-own={isOwn ? "true" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md border border-border bg-card p-2",
        isOwn && "border-primary/50 bg-primary/5",
        isDragging && "z-10 opacity-70 shadow-md"
      )}
    >
      {reorderable && (
        <button
          type="button"
          data-testid="room-queue-drag-handle"
          aria-label={t("queue.drag_handle")}
          className="flex shrink-0 touch-none items-center justify-center rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <IconGripVertical className="size-4" />
        </button>
      )}
      {item.thumbnailUrl ? (
        <img
          src={item.thumbnailUrl}
          alt=""
          className="size-12 shrink-0 rounded object-cover"
        />
      ) : (
        <span className="flex size-12 shrink-0 items-center justify-center rounded bg-muted">
          <IconMusic className="size-5 text-muted-foreground" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">
          {item.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {t("queue.singer", { name: item.singerNickname })}
        </p>
      </div>
      {isOwn && (
        <Badge
          variant="outline"
          data-testid="room-queue-own-marker"
          className="shrink-0"
        >
          {t("queue.you")}
        </Badge>
      )}
      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid="room-queue-remove"
          aria-label={t("queue.remove")}
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove?.(item.id)}
        >
          <IconX className="size-4" />
        </Button>
      )}
    </li>
  );
}

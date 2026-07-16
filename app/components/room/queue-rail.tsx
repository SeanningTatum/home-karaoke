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
import { InitialsAvatar } from "@/components/room/initials-avatar";
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
  /** "tv" — the host TV screen (`/room/:code`): 10-foot type scale, added-by
   * chip. "compact" (default) — the guest phone Search/Queue/Controls tabs
   * on `/join/:code`, unchanged sizing. */
  readonly size?: "tv" | "compact";
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
  size = "compact",
  onReorder,
  onRemove,
}: QueueRailProps) {
  const { t } = useTranslation("room");
  const isTv = size === "tv";
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
        <h2
          className={cn(
            "flex items-center text-muted-foreground",
            isTv
              ? "tv-title gap-2 normal-case text-foreground"
              : "gap-1.5 text-sm font-medium uppercase tracking-wider"
          )}
        >
          <IconPlaylist className={isTv ? "size-8 text-primary" : "size-4"} />
          {t("queue.title")}
        </h2>
        <Badge
          variant="secondary"
          data-testid="room-queue-count"
          className={
            // `Badge` bakes in `text-xs` unconditionally via its own
            // `cn()`, which `tailwind-merge` only strips in favor of
            // another RECOGNIZED Tailwind class — a custom `tv-label`
            // utility isn't recognized and would silently lose the
            // cascade to Badge's own `text-xs`. Composing the tv-label
            // spec (24px/600/uppercase/0.04em tracking, design.md's TV
            // type scale) from plain Tailwind utilities here instead so
            // the override actually applies.
            isTv
              ? "px-4 py-1.5 text-2xl font-semibold uppercase tracking-[0.04em]"
              : undefined
          }
        >
          {t("queue.count", { count: queue.length })}
        </Badge>
      </div>

      {queue.length === 0 ? (
        <p
          className={cn(
            "text-center text-muted-foreground",
            isTv ? "tv-body mt-10" : "mt-6 text-sm"
          )}
        >
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
            <ul
              className={cn(
                "flex flex-col overflow-y-auto",
                isTv ? "gap-3" : "gap-2"
              )}
            >
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
                    isTv={isTv}
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
  /** TV type scale + added-by chip (see `QueueRailProps.size`). */
  readonly isTv?: boolean;
}

function QueueRow({
  item,
  isOwn,
  reorderable,
  canRemove,
  onRemove,
  isTv = false,
}: QueueRowProps) {
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
        "flex items-center rounded-md border border-border bg-card",
        isTv ? "gap-4 rounded-xl p-4" : "gap-2 p-2",
        isOwn && "border-primary/50 bg-primary/5",
        isDragging && "z-10 opacity-70 shadow-md"
      )}
    >
      {reorderable && (
        <button
          type="button"
          data-testid="room-queue-drag-handle"
          aria-label={t("queue.drag_handle")}
          className={cn(
            "flex shrink-0 touch-none items-center justify-center rounded text-muted-foreground hover:text-foreground active:cursor-grabbing",
            isTv ? "p-2" : "p-1"
          )}
          {...attributes}
          {...listeners}
        >
          <IconGripVertical className={isTv ? "size-6" : "size-4"} />
        </button>
      )}
      {item.thumbnailUrl ? (
        <img
          src={item.thumbnailUrl}
          alt=""
          className={cn(
            "shrink-0 rounded object-cover",
            isTv ? "size-20 rounded-lg" : "size-12"
          )}
        />
      ) : (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded bg-muted",
            isTv ? "size-20 rounded-lg" : "size-12"
          )}
        >
          <IconMusic
            className={cn("text-muted-foreground", isTv ? "size-8" : "size-5")}
          />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate font-medium leading-tight",
            isTv ? "tv-body" : "text-sm"
          )}
        >
          {item.title}
        </p>
        {/* Added-by chip — `item.singerNickname` is server-set from the
            adding guest's own WS identity (see `applyClientMessage` /
            `karaoke-room.ts`'s `x-nickname` header), never client-reported,
            so it already IS "who added this" data end-to-end. */}
        {isTv ? (
          <div className="mt-2 flex items-center gap-2">
            <InitialsAvatar name={item.singerNickname} size="sm" />
            <p
              // Not `tv-label`: that utility is uppercase, which reads
              // oddly on a person's nickname — a plain 24px/semibold
              // size still clears the "nothing under 24px" TV rule.
              className="truncate text-2xl font-semibold text-muted-foreground"
            >
              {t("queue.singer", { name: item.singerNickname })}
            </p>
          </div>
        ) : (
          <p className="truncate text-xs text-muted-foreground">
            {t("queue.singer", { name: item.singerNickname })}
          </p>
        )}
      </div>
      {isOwn && (
        <Badge
          variant="outline"
          data-testid="room-queue-own-marker"
          className={cn(
            "shrink-0",
            // See the queue-count Badge above for why this is composed
            // from plain Tailwind utilities rather than `tv-label`.
            isTv && "px-3 py-1 text-2xl font-semibold uppercase tracking-[0.04em]"
          )}
        >
          {t("queue.you")}
        </Badge>
      )}
      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size={isTv ? "icon-lg" : "icon"}
          data-testid="room-queue-remove"
          aria-label={t("queue.remove")}
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove?.(item.id)}
        >
          <IconX className={isTv ? "size-6" : "size-4"} />
        </Button>
      )}
    </li>
  );
}

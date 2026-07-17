import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IconArrowBarUp,
  IconArrowUp,
  IconGripVertical,
  IconMusic,
  IconPlaylist,
  IconX,
} from "@tabler/icons-react";
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
import { moveToTopIndex, moveUpIndex } from "@/lib/room-state";
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

  // Entrance animation (TV screen only, see `isTv` gate in `QueueRow`) for
  // genuinely NEW rows — a song just added to the queue — as opposed to the
  // initial mount (every id is "new" to the DOM on first render, but that's
  // not a delight moment) or a reorder (same ids, different order).
  //
  // Can't seed `knownQueueIdsRef` from the mount-time `queue` prop: this
  // component mounts before the room socket delivers its first `room.state`
  // snapshot, so `queue` at mount is always the empty initial socket state
  // — seeding from it is a no-op, and every pre-lobby song would incorrectly
  // animate in the moment the party starts (the playing-state grid flips
  // from `hidden` to visible). Instead, `hasSeededRef` gates `isNew` itself:
  // false for every row until the first commit where `displayQueue` is
  // non-empty (the room's actual initial load, whatever it contains), so
  // that whole batch renders as already-known. Only rows that appear in a
  // LATER commit — genuinely added while this screen is already showing
  // data — read as new. The effect is keyed on `displayQueue` (what actually
  // renders), NOT the `queue` prop: effects flush after the commit, so on
  // the first render where a new row appears the ref still lacks its id
  // (`isNew` true), and only then does the ref catch up. Keying on `queue`
  // would add the id one render early — before `setDisplayQueue` applies —
  // and the animation would never fire.
  const knownQueueIdsRef = useRef<Set<string>>(new Set());
  const hasSeededRef = useRef(false);
  useEffect(() => {
    const ids = displayQueue.map((item) => item.id);
    if (!hasSeededRef.current) {
      // Still on the empty pre-connect placeholder — nothing real to seed
      // against yet, so don't flip the gate until real data shows up.
      if (ids.length === 0) return;
      hasSeededRef.current = true;
    }
    knownQueueIdsRef.current = new Set(ids);
  }, [displayQueue]);

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

  // Tap-based reorder (alongside the existing drag handle above) — reuses
  // the SAME `queue.reorder` wire message the drag path sends (single
  // writer stays the room DO; no new protocol message). `moveUpIndex`/
  // `moveToTopIndex` are the pure helpers next to the rest of the reducers
  // in `app/lib/room-state.ts`.
  const handleMoveUp = (queueItemId: string) => {
    const newIndex = moveUpIndex(displayQueue, queueItemId);
    if (newIndex === null) return;
    const oldIndex = displayQueue.findIndex((q) => q.id === queueItemId);
    if (oldIndex === -1) return;
    setDisplayQueue((prev) => arrayMove([...prev], oldIndex, newIndex));
    onReorder?.(queueItemId, newIndex);
  };

  const handleMoveToTop = (queueItemId: string) => {
    const newIndex = moveToTopIndex(displayQueue, queueItemId);
    if (newIndex === null) return;
    const oldIndex = displayQueue.findIndex((q) => q.id === queueItemId);
    if (oldIndex === -1) return;
    setDisplayQueue((prev) => arrayMove([...prev], oldIndex, newIndex));
    onReorder?.(queueItemId, newIndex);
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
              ? "tv-title-sm gap-2 normal-case text-foreground"
              : "gap-1.5 text-sm font-medium uppercase tracking-wider"
          )}
        >
          <IconPlaylist className={isTv ? "size-6 text-primary" : "size-4"} />
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
              ? "px-3 py-1 text-xl font-semibold uppercase tracking-[0.04em]"
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
              {displayQueue.map((item, index) => {
                const isOwn =
                  ownUserId != null && item.addedByUserId === ownUserId;
                const canRemove =
                  Boolean(onRemove) && (viewerRole === "host" || isOwn);
                return (
                  <QueueRow
                    key={item.id}
                    item={item}
                    isOwn={isOwn}
                    isFirst={index === 0}
                    reorderable={reorderable}
                    canRemove={canRemove}
                    onRemove={onRemove}
                    onMoveUp={handleMoveUp}
                    onMoveToTop={handleMoveToTop}
                    isTv={isTv}
                    isNew={hasSeededRef.current && !knownQueueIdsRef.current.has(item.id)}
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
  /** Already at the front of the queue — hides/disables the tap-reorder
   * buttons since there's nowhere further up to move. */
  readonly isFirst: boolean;
  readonly reorderable: boolean;
  readonly canRemove: boolean;
  readonly onRemove?: (queueItemId: string) => void;
  /** Tap-based reorder alongside the drag handle — compact (phone) rows
   * only, see `isTv` guard below. Omit to hide the buttons entirely. */
  readonly onMoveUp?: (queueItemId: string) => void;
  readonly onMoveToTop?: (queueItemId: string) => void;
  /** TV type scale + added-by chip (see `QueueRailProps.size`). */
  readonly isTv?: boolean;
  /** True for a row whose id `QueueRail` has never seen before — plays the
   * slide-up + fade entrance. Only applied on the TV screen (`isTv`); the
   * guest/host phone tabs don't get this delight-pass animation. */
  readonly isNew?: boolean;
}

function QueueRow({
  item,
  isOwn,
  isFirst,
  reorderable,
  canRemove,
  onRemove,
  onMoveUp,
  onMoveToTop,
  isTv = false,
  isNew = false,
}: QueueRowProps) {
  const { t } = useTranslation("room");
  // Latch the mount-time value: `isNew` flips false one render after the
  // row appears (once QueueRail's known-ids ref catches up), and dropping
  // the class mid-flight would cancel the ~250ms CSS animation. Rows are
  // keyed by item id, so this state lives exactly as long as the row.
  const [entered] = useState(isNew);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: !reorderable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Tap-based move-up/move-to-top buttons are a phone-only affordance
  // (drag is awkward with one thumb) — the TV screen keeps drag-only.
  // Gated by the SAME `reorderable` flag the drag handle uses (host
  // always; guest only when `allowGuestReorder`), plus `isFirst` since
  // there's nothing to do at the front of the queue.
  const showMoveButtons = reorderable && !isTv && !isFirst;

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
        isDragging && "z-10 opacity-70 shadow-md",
        isTv && entered && "animate-queue-row-in"
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
      {showMoveButtons && (
        <div className="flex shrink-0 flex-col gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            data-testid="room-queue-move-up"
            aria-label={t("queue.move_up")}
            title={t("queue.move_up")}
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onMoveUp?.(item.id)}
          >
            <IconArrowUp className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            data-testid="room-queue-move-top"
            aria-label={t("queue.move_to_top")}
            title={t("queue.move_to_top")}
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onMoveToTop?.(item.id)}
          >
            <IconArrowBarUp className="size-3.5" />
          </Button>
        </div>
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
          <div className="mt-1 flex items-center gap-1.5">
            <InitialsAvatar name={item.singerNickname} size="sm" className="size-5 text-[0.6rem]" />
            <p className="truncate text-xs text-muted-foreground">
              {t("queue.singer", { name: item.singerNickname })}
            </p>
          </div>
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

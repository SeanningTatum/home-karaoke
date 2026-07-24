import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
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
import { cleanSongTitle } from "@/lib/song-title";
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
  /**
   * Marks the first row as NEXT UP (feat-014) so the singer after the current
   * one gets a warning from across the room. TV rail only — the phone tabs
   * show the same queue without the callout.
   */
  readonly highlightNext?: boolean;
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
  highlightNext = false,
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
              ? "tv-eyebrow gap-2"
              : "gap-1.5 text-sm font-medium uppercase tracking-wider"
          )}
        >
          <IconPlaylist className={isTv ? "size-5 text-primary" : "size-4"} />
          {/* "Up next" on the TV (the current song is already the hero above
              it, so this list is literally what comes next); the phone tab
              keeps calling it the Queue, which is what its own tab is named. */}
          {isTv ? t("queue.up_next") : t("queue.title")}
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
              ? "px-2.5 py-0.5 text-sm font-semibold uppercase tracking-[0.04em]"
              : undefined
          }
        >
          {t("queue.count", { count: queue.length })}
        </Badge>
      </div>

      {queue.length === 0 ? (
        // Anchored under the label, not centered in the leftover space
        // (feat-014): when the rail was ~390px tall and this text floated in
        // the middle of it, the result read as ~250px of accidental void.
        <p
          className={cn(
            "text-muted-foreground",
            isTv ? "text-xl leading-snug" : "mt-6 text-center text-sm"
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
            <ul className="flex flex-col gap-2 overflow-y-auto">
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
                    isNextUp={highlightNext && index === 0}
                    reorderable={reorderable}
                    canRemove={canRemove}
                    onRemove={onRemove}
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
  /** First row of the TV rail — carries the NEXT UP callout (feat-014). */
  readonly isNextUp?: boolean;
  readonly reorderable: boolean;
  readonly canRemove: boolean;
  readonly onRemove?: (queueItemId: string) => void;
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
  isNextUp = false,
  reorderable,
  canRemove,
  onRemove,
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

  const dragHandle = reorderable ? (
    <button
      type="button"
      data-testid="room-queue-drag-handle"
      aria-label={t("queue.drag_handle")}
      className={cn(
        "flex shrink-0 touch-none items-center justify-center rounded text-muted-foreground hover:text-foreground active:cursor-grabbing",
        isTv ? "p-1" : "p-1"
      )}
      {...attributes}
      {...listeners}
    >
      <IconGripVertical className={isTv ? "size-5" : "size-4"} />
    </button>
  ) : null;

  // 56px on the TV rail (feat-014) so a row reads from the couch; the phone
  // tabs keep the original 48px.
  const thumbSize = isTv ? "size-14" : "size-12";
  const thumbnail = item.thumbnailUrl ? (
    <img
      src={item.thumbnailUrl}
      alt=""
      className={cn("shrink-0 rounded-lg object-cover", thumbSize)}
    />
  ) : (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-muted",
        thumbSize
      )}
    >
      <IconMusic className={isTv ? "size-6 text-muted-foreground" : "size-5 text-muted-foreground"} />
    </span>
  );

  // TV rows show the cleaned song name (feat-014) — the same helper the
  // now-playing bar uses, so "Queen – Bohemian Rhapsody (Official Video)"
  // reads as "Bohemian Rhapsody" in a 300px rail instead of clipping mid-cruft.
  // The phone tabs deliberately keep the raw title: they're outside this
  // feature's scope and have the width to show it.
  const displayTitle = isTv
    ? cleanSongTitle(item.title, item.channel).song
    : item.title;

  const title = (
    <p
      title={item.title}
      className={cn(
        "font-semibold leading-tight",
        // Narrow (~280px) TV rail: `tv-body` (28px) truncated a real title
        // down to a couple of glyphs. A 16px 2-line clamp shows meaningful
        // text instead — beta feedback overrides the 10-foot "nothing under
        // 24px" rule for this cramped rail specifically.
        isTv ? "line-clamp-2 text-base" : "truncate text-sm"
      )}
    >
      {displayTitle}
    </p>
  );

  // Added-by chip — `item.singerNickname` is server-set from the adding
  // guest's own WS identity (see `applyClientMessage` / `karaoke-room.ts`'s
  // `x-nickname` header), never client-reported, so it already IS "who
  // added this" data end-to-end.
  const singer = (
    <div className="flex min-w-0 items-center gap-1.5">
      <InitialsAvatar
        name={item.singerNickname}
        size="sm"
        className={isTv ? "size-6 text-[0.65rem]" : "size-5 text-[0.6rem]"}
        src={item.singerAvatarUrl}
      />
      <p
        className={cn(
          "truncate text-muted-foreground",
          isTv ? "text-sm font-medium" : "text-xs"
        )}
      >
        {t("queue.singer", { name: item.singerNickname })}
      </p>
    </div>
  );

  const ownBadge = isOwn ? (
    <Badge
      variant="outline"
      data-testid="room-queue-own-marker"
      className={cn(
        "shrink-0",
        // See the queue-count Badge above for why this is composed from
        // plain Tailwind utilities rather than `tv-label`.
        isTv && "px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.04em]"
      )}
    >
      {t("queue.you")}
    </Badge>
  ) : null;

  const removeButton = canRemove ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      data-testid="room-queue-remove"
      aria-label={t("queue.remove")}
      className="shrink-0 text-muted-foreground hover:text-destructive"
      onClick={() => onRemove?.(item.id)}
    >
      <IconX className={isTv ? "size-5" : "size-4"} />
    </Button>
  ) : null;

  // TV rail (~336px): two COLUMNS — the drag handle lives alone in a
  // left column (vertically centered against the full card height), and a
  // right column stacks the video preview + title INLINE on one row over
  // the meta row (added-by + own marker + remove) beneath. Beta feedback:
  // isolating the drag handle keeps the reorder affordance from crowding
  // the thumbnail/title, and the thumbnail reads as part of the title line.
  if (isTv) {
    return (
      <li
        ref={setNodeRef}
        style={style}
        data-testid="room-queue-item"
        data-own={isOwn ? "true" : undefined}
        data-next-up={isNextUp ? "true" : undefined}
        className={cn(
          "flex flex-col gap-2 rounded-xl border border-border bg-card p-3",
          isOwn && "border-primary/50 bg-primary/5",
          // The next singer's row is the one thing in the rail worth calling
          // out — brass, so it reads as punctuation rather than a control.
          isNextUp && "border-brass/60",
          isDragging && "z-10 opacity-70 shadow-md",
          entered && "animate-queue-row-in"
        )}
      >
        {isNextUp && (
          <span
            data-testid="room-queue-next-up"
            className="tv-eyebrow text-brass"
          >
            {t("queue.next_up")}
          </span>
        )}
        <div className="flex items-center gap-2">
          {dragHandle}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              {thumbnail}
              <div className="min-w-0 flex-1">{title}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">{singer}</div>
              {ownBadge}
              {removeButton}
            </div>
          </div>
        </div>
      </li>
    );
  }

  // Compact (phone Search/Queue/Controls tabs): the original horizontal row.
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
      {dragHandle}
      {thumbnail}
      <div className="min-w-0 flex-1">
        {title}
        <div className="mt-1">{singer}</div>
      </div>
      {ownBadge}
      {removeButton}
    </li>
  );
}

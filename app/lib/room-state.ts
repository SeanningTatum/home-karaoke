// Pure state-transition logic for a live karaoke room. Every function here
// is a deterministic `(state, ...) => state` (or `=> boolean` / `=> message`)
// value transform — no I/O, no randomness, no clock reads except through
// explicitly-passed arguments. This is where the Phase-2 unit-test coverage
// lives; `app/durable-objects/karaoke-room.ts` is a thin, mostly-untested
// shell that resolves side effects (ids, timestamps, storage, broadcast) and
// calls straight into these.
import type {
  ClientMessage,
  PlaybackState,
  QueueItem,
  ReactionEmoji,
  Role,
  RoomSettings,
  RosterEntry,
  ServerMessage,
} from "@/lib/schemas/room-ws";
import {
  applyReactionTally,
  clampReactionCount,
  EMPTY_TALLY,
  tallyBreakdown,
  tallyTotal,
  type ReactionTally,
} from "@/lib/reactions";

export interface RoomLiveState {
  readonly queue: readonly QueueItem[];
  readonly playback: PlaybackState;
  readonly roster: readonly RosterEntry[];
  readonly settings: RoomSettings;
  /**
   * Per-emoji reaction counts for the currently-playing song. Ephemeral by
   * design — reset on every advance (`advanceToNext`) and deliberately NOT
   * persisted to DO storage (see `karaoke-room.ts`).
   */
  readonly reactions: ReactionTally;
}

const DEFAULT_VOLUME = 80;

/**
 * Hard cap on queue length. Any authenticated client (anonymous guests
 * included) can send `queue.add`, so without a ceiling one client could
 * flood the queue — every item is persisted to DO storage and re-broadcast
 * to all sockets on each update. 200 is far beyond a realistic party queue.
 */
export const MAX_QUEUE_SIZE = 200;

export const createInitialRoomState = (
  settings: RoomSettings
): RoomLiveState => ({
  queue: [],
  playback: { status: "idle", currentItem: null, volume: DEFAULT_VOLUME },
  roster: [],
  settings,
  reactions: EMPTY_TALLY,
});

// --- Permissions -------------------------------------------------------------

export interface PermissionContext {
  readonly userId: string;
  readonly role: Role;
  readonly state: RoomLiveState;
}

/**
 * Pure authorization check for a single client message. Playback transport
 * controls (play/pause/skip/setVolume/videoEnded) are host-only by design —
 * only the host's client actually drives video playback; guests view a
 * synced read-only state. Queue mutations are open to anyone except
 * `queue.remove` (own item or host) and `queue.reorder` (host, or guest when
 * `allowGuestReorder` is on).
 */
export const canPerform = (
  message: ClientMessage,
  ctx: PermissionContext
): boolean => {
  switch (message.type) {
    case "queue.add":
      return ctx.state.queue.length < MAX_QUEUE_SIZE;
    case "queue.remove": {
      if (ctx.role === "host") return true;
      const item = ctx.state.queue.find((q) => q.id === message.queueItemId);
      return item !== undefined && item.addedByUserId === ctx.userId;
    }
    case "queue.reorder":
      return (
        ctx.role === "host" ||
        (ctx.role === "guest" && ctx.state.settings.allowGuestReorder)
      );
    case "playback.play":
    case "playback.pause":
    case "playback.skip":
    case "playback.setVolume":
    case "playback.videoEnded":
      return ctx.role === "host";
    case "room.setGuestReorder":
      return ctx.role === "host";
    case "reaction.send":
      // Host AND guest — anyone can cheer, but only while a song is actually
      // playing (no reactions in the lobby, on pause, or between songs).
      return ctx.state.playback.status === "playing";
    default:
      return false;
  }
};

// --- Queue transitions -------------------------------------------------------

export interface AddToQueueInput {
  readonly id: string;
  readonly videoId: string;
  readonly title: string;
  readonly channel: string;
  readonly thumbnailUrl: string;
  readonly singerNickname: string;
  readonly addedByUserId: string | null;
  readonly addedAt: number;
}

export const addToQueue = (
  state: RoomLiveState,
  input: AddToQueueInput
): RoomLiveState =>
  // Defense-in-depth alongside the `canPerform` gate — a full queue is
  // returned unchanged rather than silently growing past the cap.
  state.queue.length >= MAX_QUEUE_SIZE
    ? state
    : {
        ...state,
        queue: [...state.queue, { ...input }],
      };

export const removeFromQueue = (
  state: RoomLiveState,
  queueItemId: string
): RoomLiveState => ({
  ...state,
  queue: state.queue.filter((item) => item.id !== queueItemId),
});

export const reorderQueue = (
  state: RoomLiveState,
  queueItemId: string,
  toIndex: number
): RoomLiveState => {
  const fromIndex = state.queue.findIndex((item) => item.id === queueItemId);
  if (fromIndex === -1) return state;

  const clampedIndex = Math.max(
    0,
    Math.min(toIndex, state.queue.length - 1)
  );
  if (clampedIndex === fromIndex) return state;

  const next = [...state.queue];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(clampedIndex, 0, moved);
  return { ...state, queue: next };
};

/**
 * Destination index for a "move up one position" tap action — one slot
 * earlier than the item's current index. Returns `null` when the item is
 * unknown or already at the front (nothing to do), so callers can skip
 * sending a no-op `queue.reorder`. Pure — takes the queue array the caller
 * is currently displaying (server `queue` prop or a component's own
 * optimistic copy) rather than reading `RoomLiveState` directly, so it works
 * identically on the client (`QueueRail`) and if ever needed server-side.
 */
export const moveUpIndex = (
  queue: readonly QueueItem[],
  queueItemId: string
): number | null => {
  const index = queue.findIndex((item) => item.id === queueItemId);
  if (index <= 0) return null;
  return index - 1;
};

/**
 * Destination index for a "move to top" tap action — always the front of
 * the queue. Returns `null` when the item is unknown or already first, same
 * no-op convention as `moveUpIndex`.
 */
export const moveToTopIndex = (
  queue: readonly QueueItem[],
  queueItemId: string
): number | null => {
  const index = queue.findIndex((item) => item.id === queueItemId);
  if (index <= 0) return null;
  return 0;
};

// --- Playback transitions ----------------------------------------------------

/**
 * Pops the queue head into `currentItem`; `idle` when the queue is empty.
 * Also resets the reaction tally — reactions belong to the song that just
 * finished, so the next singer starts from an empty crowd.
 */
export const advanceToNext = (state: RoomLiveState): RoomLiveState => {
  const [next, ...rest] = state.queue;
  return {
    ...state,
    queue: rest,
    playback: {
      ...state.playback,
      currentItem: next ?? null,
      status: next ? "playing" : "idle",
    },
    reactions: EMPTY_TALLY,
  };
};

export const applyPlay = (state: RoomLiveState): RoomLiveState => ({
  ...state,
  playback: {
    ...state.playback,
    status: state.playback.currentItem ? "playing" : "idle",
  },
});

export const applyPause = (state: RoomLiveState): RoomLiveState => ({
  ...state,
  playback: {
    ...state.playback,
    status: state.playback.currentItem ? "paused" : "idle",
  },
});

export const setVolume = (
  state: RoomLiveState,
  volume: number
): RoomLiveState => ({
  ...state,
  playback: { ...state.playback, volume },
});

// --- Guest standing (position bar) --------------------------------------------

export interface OwnQueueStanding {
  /** How many songs in the live queue were added by this viewer. */
  readonly count: number;
  /** 1-based position (from the front of the queue) of the viewer's
   * earliest-queued song still waiting — `null` when `count` is 0. The
   * currently-playing item already lives in `playback.currentItem`, not in
   * `queue`, so a position of `1` means "sings right after whoever's up
   * now." */
  readonly nextPosition: number | null;
}

/**
 * Pure client-side derivation for `/join/:code`'s persistent "you have N
 * songs queued" bottom bar — no new wire message, computed straight from
 * the `queue.updated`/`room.state` broadcasts the client already has plus
 * the viewer's own id (known since `NicknameForm`/the loader resolved it).
 */
export const ownQueueStanding = (
  queue: readonly QueueItem[],
  ownUserId: string | null
): OwnQueueStanding => {
  if (!ownUserId) return { count: 0, nextPosition: null };

  let count = 0;
  let nextPosition: number | null = null;
  queue.forEach((item, index) => {
    if (item.addedByUserId !== ownUserId) return;
    count += 1;
    if (nextPosition === null) nextPosition = index + 1;
  });

  return { count, nextPosition };
};

// --- Roster -------------------------------------------------------------------

export const addToRoster = (
  state: RoomLiveState,
  entry: RosterEntry
): RoomLiveState => {
  const withoutExisting = state.roster.filter(
    (r) => r.userId !== entry.userId
  );
  return { ...state, roster: [...withoutExisting, entry] };
};

export const removeFromRoster = (
  state: RoomLiveState,
  userId: string
): RoomLiveState => ({
  ...state,
  roster: state.roster.filter((r) => r.userId !== userId),
});

// --- Settings -----------------------------------------------------------------

export const setGuestReorder = (
  state: RoomLiveState,
  allowed: boolean
): RoomLiveState => ({
  ...state,
  settings: { ...state.settings, allowGuestReorder: allowed },
});

// --- Message application (dispatcher) ----------------------------------------

export interface ApplyContext {
  readonly userId: string;
  readonly nickname: string;
  readonly role: Role;
  /** Pre-generated id for `queue.add` — kept as an input to stay pure. */
  readonly newQueueItemId: string;
  /** Pre-resolved clock read — kept as an input to stay pure. */
  readonly now: number;
}

/**
 * Applies an already permission-checked `ClientMessage` to `state`,
 * returning the next state. Callers (the Durable Object) are responsible
 * for calling `canPerform` first — this function does not re-check.
 */
export const applyClientMessage = (
  state: RoomLiveState,
  message: ClientMessage,
  ctx: ApplyContext
): RoomLiveState => {
  switch (message.type) {
    case "queue.add":
      return addToQueue(state, {
        id: ctx.newQueueItemId,
        videoId: message.videoId,
        title: message.title,
        channel: message.channel,
        thumbnailUrl: message.thumbnailUrl,
        singerNickname: ctx.nickname,
        addedByUserId: ctx.userId,
        addedAt: ctx.now,
      });
    case "queue.remove":
      return removeFromQueue(state, message.queueItemId);
    case "queue.reorder":
      return reorderQueue(state, message.queueItemId, message.toIndex);
    case "playback.play":
      return state.playback.currentItem
        ? applyPlay(state)
        : advanceToNext(state);
    case "playback.pause":
      return applyPause(state);
    case "playback.skip":
    case "playback.videoEnded":
      // Idempotency guard: if the sender named the item it thought was
      // playing and the queue has already advanced past it (e.g. a second
      // dual-screen skip/videoEnded for the same song), ignore — advancing
      // again would silently drop the next song without recording it.
      if (
        message.currentItemId != null &&
        message.currentItemId !== state.playback.currentItem?.id
      ) {
        return state;
      }
      return advanceToNext(state);
    case "playback.setVolume":
      return setVolume(state, message.volume);
    case "room.setGuestReorder":
      return setGuestReorder(state, message.allowed);
    case "reaction.send":
      return {
        ...state,
        reactions: applyReactionTally(
          state.reactions,
          message.emoji,
          message.count
        ),
      };
    default:
      return state;
  }
};

// --- Broadcast selection -------------------------------------------------------

const queueUpdated = (state: RoomLiveState): ServerMessage => ({
  type: "queue.updated",
  queue: [...state.queue],
});

const playbackUpdated = (state: RoomLiveState): ServerMessage => ({
  type: "playback.updated",
  playback: state.playback,
});

export const rosterUpdated = (state: RoomLiveState): ServerMessage => ({
  type: "roster.updated",
  roster: [...state.roster],
});

export const roomClosed = (): ServerMessage => ({
  type: "room.closed",
});

export const roomStateSnapshot = (state: RoomLiveState): ServerMessage => ({
  type: "room.state",
  queue: [...state.queue],
  playback: state.playback,
  roster: [...state.roster],
  settings: state.settings,
});

const reactionBurst = (emoji: ReactionEmoji, count: number): ServerMessage => ({
  type: "reaction.burst",
  emoji,
  count,
});

/**
 * End-of-song recap built from the tally of the song that just finished
 * (`prevState`). Callers only invoke this when an advance actually occurred,
 * so `currentItem` is non-null in practice; the `?? ""` is a type-level
 * safety net rather than an expected path.
 */
const reactionRecap = (prevState: RoomLiveState): ServerMessage => ({
  type: "reaction.recap",
  singerNickname: prevState.playback.currentItem?.singerNickname ?? "",
  total: tallyTotal(prevState.reactions),
  breakdown: tallyBreakdown(prevState.reactions),
});

/**
 * Did this message actually advance to a new song? True when the previously-
 * playing item is gone — either replaced by a different item or cleared to
 * `null` at the end of the queue. An idempotent no-op (stale `currentItemId`
 * guard) leaves `currentItem` unchanged, so this is false and no recap fires.
 */
const advanceOccurred = (
  prevState: RoomLiveState,
  nextState: RoomLiveState
): boolean =>
  prevState.playback.currentItem !== null &&
  nextState.playback.currentItem?.id !== prevState.playback.currentItem.id;

/**
 * Which server->client broadcast(s) follow a successfully-applied client
 * message. Pure and testable so the Durable Object doesn't need its own
 * branching logic beyond "apply, persist, broadcast these". Takes both the
 * pre- and post-apply state: the pre-apply (`prevState`) reactions/currentItem
 * drive the end-of-song recap, which must be derived from the song that just
 * finished, not the one being advanced to.
 */
export const broadcastsForMessage = (
  message: ClientMessage,
  prevState: RoomLiveState,
  nextState: RoomLiveState
): readonly ServerMessage[] => {
  switch (message.type) {
    case "queue.add":
    case "queue.remove":
    case "queue.reorder":
      return [queueUpdated(nextState)];
    case "reaction.send":
      // Ephemeral fan-out only — the tally isn't persisted, so no
      // queue/playback snapshot rides along.
      return [reactionBurst(message.emoji, clampReactionCount(message.count))];
    case "playback.play":
    case "playback.skip":
    case "playback.videoEnded": {
      // These may have advanced the queue (popped the head into
      // currentItem) — broadcast both so clients never see a stale queue
      // alongside a fresh currentItem.
      const updates = [queueUpdated(nextState), playbackUpdated(nextState)];
      // Ordering is load-bearing: PREPEND the recap so it arrives before the
      // `playback.updated` that swaps in the next singer — the TV defers its
      // "You're up" card until the recap has shown.
      return advanceOccurred(prevState, nextState) &&
        tallyTotal(prevState.reactions) > 0
        ? [reactionRecap(prevState), ...updates]
        : updates;
    }
    case "playback.pause":
    case "playback.setVolume":
      return [playbackUpdated(nextState)];
    case "room.setGuestReorder":
      // No dedicated `settings.updated` message in the wire protocol — a
      // settings change is rare enough that a full snapshot is simplest.
      return [roomStateSnapshot(nextState)];
    default:
      return [];
  }
};

export const forbiddenError = (message: ClientMessage): ServerMessage => ({
  type: "error",
  code: "FORBIDDEN",
  message: `Not allowed: ${message.type}`,
});

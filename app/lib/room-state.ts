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
  Role,
  RoomSettings,
  RosterEntry,
  ServerMessage,
} from "@/lib/schemas/room-ws";

export interface RoomLiveState {
  readonly queue: readonly QueueItem[];
  readonly playback: PlaybackState;
  readonly roster: readonly RosterEntry[];
  readonly settings: RoomSettings;
}

const DEFAULT_VOLUME = 80;

export const createInitialRoomState = (
  settings: RoomSettings
): RoomLiveState => ({
  queue: [],
  playback: { status: "idle", currentItem: null, volume: DEFAULT_VOLUME },
  roster: [],
  settings,
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
      return true;
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
): RoomLiveState => ({
  ...state,
  queue: [...state.queue, { ...input }],
});

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

// --- Playback transitions ----------------------------------------------------

/** Pops the queue head into `currentItem`; `idle` when the queue is empty. */
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
      return advanceToNext(state);
    case "playback.setVolume":
      return setVolume(state, message.volume);
    case "room.setGuestReorder":
      return setGuestReorder(state, message.allowed);
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

export const roomStateSnapshot = (state: RoomLiveState): ServerMessage => ({
  type: "room.state",
  queue: [...state.queue],
  playback: state.playback,
  roster: [...state.roster],
  settings: state.settings,
});

/**
 * Which server->client broadcast(s) follow a successfully-applied client
 * message. Pure and testable so the Durable Object doesn't need its own
 * branching logic beyond "apply, persist, broadcast these".
 */
export const broadcastsForMessage = (
  message: ClientMessage,
  next: RoomLiveState
): readonly ServerMessage[] => {
  switch (message.type) {
    case "queue.add":
    case "queue.remove":
    case "queue.reorder":
      return [queueUpdated(next)];
    case "playback.play":
    case "playback.skip":
    case "playback.videoEnded":
      // These may have advanced the queue (popped the head into
      // currentItem) — broadcast both so clients never see a stale queue
      // alongside a fresh currentItem.
      return [queueUpdated(next), playbackUpdated(next)];
    case "playback.pause":
    case "playback.setVolume":
      return [playbackUpdated(next)];
    case "room.setGuestReorder":
      // No dedicated `settings.updated` message in the wire protocol — a
      // settings change is rare enough that a full snapshot is simplest.
      return [roomStateSnapshot(next)];
    default:
      return [];
  }
};

export const forbiddenError = (message: ClientMessage): ServerMessage => ({
  type: "error",
  code: "FORBIDDEN",
  message: `Not allowed: ${message.type}`,
});

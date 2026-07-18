import { describe, it, expect } from "vitest";
import {
  createInitialRoomState,
  canPerform,
  addToQueue,
  MAX_QUEUE_SIZE,
  removeFromQueue,
  reorderQueue,
  moveUpIndex,
  moveToTopIndex,
  ownQueueStanding,
  advanceToNext,
  applyPlay,
  applyPause,
  setVolume,
  addToRoster,
  removeFromRoster,
  setGuestReorder,
  applyClientMessage,
  broadcastsForMessage,
  forbiddenError,
  roomClosed,
  roomStateSnapshot,
  rosterUpdated,
  type RoomLiveState,
} from "../room-state";
import type { ClientMessage, QueueItem } from "@/lib/schemas/room-ws";

const item = (overrides: Partial<QueueItem> = {}): QueueItem => ({
  id: "q1",
  videoId: "v1",
  title: "Song",
  channel: "Channel",
  thumbnailUrl: "https://example.com/t.jpg",
  singerNickname: "Alice",
  singerAvatarUrl: null,
  addedByUserId: "u1",
  addedAt: 1000,
  ...overrides,
});

const baseState = (
  overrides: Partial<RoomLiveState> = {}
): RoomLiveState => ({
  ...createInitialRoomState({ allowGuestReorder: false }),
  ...overrides,
});

describe("createInitialRoomState", () => {
  it("starts empty, idle, at default volume", () => {
    const state = createInitialRoomState({ allowGuestReorder: true });
    expect(state.queue).toEqual([]);
    expect(state.playback).toEqual({
      status: "idle",
      currentItem: null,
      volume: 80,
    });
    expect(state.roster).toEqual([]);
    expect(state.settings).toEqual({ allowGuestReorder: true });
  });
});

describe("canPerform", () => {
  const state = baseState({ queue: [item({ id: "q1", addedByUserId: "u1" })] });

  it("allows anyone to add to the queue", () => {
    expect(
      canPerform(
        { type: "queue.add", videoId: "v", title: "t", channel: "c", thumbnailUrl: "u" },
        { userId: "u2", role: "guest", state }
      )
    ).toBe(true);
  });

  it("rejects queue.add once the queue is at MAX_QUEUE_SIZE — even for the host", () => {
    const full = baseState({
      queue: Array.from({ length: MAX_QUEUE_SIZE }, (_, i) =>
        item({ id: `q${i}` })
      ),
    });
    const add = {
      type: "queue.add",
      videoId: "v",
      title: "t",
      channel: "c",
      thumbnailUrl: "u",
    } as const;
    expect(canPerform(add, { userId: "u2", role: "guest", state: full })).toBe(
      false
    );
    expect(
      canPerform(add, { userId: "host-1", role: "host", state: full })
    ).toBe(false);
  });

  it("allows the host to remove any item", () => {
    expect(
      canPerform(
        { type: "queue.remove", queueItemId: "q1" },
        { userId: "host-1", role: "host", state }
      )
    ).toBe(true);
  });

  it("allows a guest to remove their own item", () => {
    expect(
      canPerform(
        { type: "queue.remove", queueItemId: "q1" },
        { userId: "u1", role: "guest", state }
      )
    ).toBe(true);
  });

  it("denies a guest removing someone else's item", () => {
    expect(
      canPerform(
        { type: "queue.remove", queueItemId: "q1" },
        { userId: "u2", role: "guest", state }
      )
    ).toBe(false);
  });

  it("denies guest reorder when allowGuestReorder is off", () => {
    expect(
      canPerform(
        { type: "queue.reorder", queueItemId: "q1", toIndex: 0 },
        { userId: "u1", role: "guest", state }
      )
    ).toBe(false);
  });

  it("allows guest reorder when allowGuestReorder is on", () => {
    const openState = baseState({
      queue: state.queue,
      settings: { allowGuestReorder: true },
    });
    expect(
      canPerform(
        { type: "queue.reorder", queueItemId: "q1", toIndex: 0 },
        { userId: "u1", role: "guest", state: openState }
      )
    ).toBe(true);
  });

  it("always allows host reorder", () => {
    expect(
      canPerform(
        { type: "queue.reorder", queueItemId: "q1", toIndex: 0 },
        { userId: "host-1", role: "host", state }
      )
    ).toBe(true);
  });

  it.each<ClientMessage["type"]>([
    "playback.play",
    "playback.pause",
    "playback.skip",
    "playback.setVolume",
    "playback.videoEnded",
    "room.setGuestReorder",
  ])("denies guests %s", (type) => {
    const message = { type, volume: 50, allowed: true } as ClientMessage;
    expect(canPerform(message, { userId: "u2", role: "guest", state })).toBe(
      false
    );
  });

  it("allows the host playback.play", () => {
    expect(
      canPerform(
        { type: "playback.play" },
        { userId: "host-1", role: "host", state }
      )
    ).toBe(true);
  });
});

describe("queue transitions", () => {
  it("addToQueue appends an item built from the given input", () => {
    const state = baseState();
    const next = addToQueue(state, {
      id: "q1",
      videoId: "v1",
      title: "Song",
      channel: "Channel",
      thumbnailUrl: "https://example.com/t.jpg",
      singerNickname: "Alice",
      singerAvatarUrl: null,
      addedByUserId: "u1",
      addedAt: 1000,
    });
    expect(next.queue).toHaveLength(1);
    expect(next.queue[0]).toEqual(item());
    // original state untouched
    expect(state.queue).toHaveLength(0);
  });

  it("addToQueue returns the state unchanged once the queue is full", () => {
    const full = baseState({
      queue: Array.from({ length: MAX_QUEUE_SIZE }, (_, i) =>
        item({ id: `q${i}` })
      ),
    });
    const next = addToQueue(full, {
      id: "overflow",
      videoId: "v",
      title: "t",
      channel: "c",
      thumbnailUrl: "u",
      singerNickname: "Mallory",
      singerAvatarUrl: null,
      addedByUserId: "u9",
      addedAt: 2000,
    });
    expect(next).toBe(full);
    expect(next.queue).toHaveLength(MAX_QUEUE_SIZE);
  });

  it("removeFromQueue drops the matching item only", () => {
    const state = baseState({
      queue: [item({ id: "q1" }), item({ id: "q2" })],
    });
    const next = removeFromQueue(state, "q1");
    expect(next.queue.map((q) => q.id)).toEqual(["q2"]);
  });

  it("removeFromQueue is a no-op for an unknown id", () => {
    const state = baseState({ queue: [item({ id: "q1" })] });
    const next = removeFromQueue(state, "missing");
    expect(next.queue).toHaveLength(1);
  });

  it("reorderQueue moves an item to the target index", () => {
    const state = baseState({
      queue: [item({ id: "q1" }), item({ id: "q2" }), item({ id: "q3" })],
    });
    const next = reorderQueue(state, "q1", 2);
    expect(next.queue.map((q) => q.id)).toEqual(["q2", "q3", "q1"]);
  });

  it("reorderQueue clamps an out-of-range index", () => {
    const state = baseState({
      queue: [item({ id: "q1" }), item({ id: "q2" })],
    });
    const next = reorderQueue(state, "q1", 99);
    expect(next.queue.map((q) => q.id)).toEqual(["q2", "q1"]);
  });

  it("reorderQueue is a no-op for an unknown id", () => {
    const state = baseState({ queue: [item({ id: "q1" })] });
    const next = reorderQueue(state, "missing", 0);
    expect(next).toBe(state);
  });
});

describe("moveUpIndex", () => {
  const queue = [item({ id: "q1" }), item({ id: "q2" }), item({ id: "q3" })];

  it("returns the index one slot earlier", () => {
    expect(moveUpIndex(queue, "q2")).toBe(0);
    expect(moveUpIndex(queue, "q3")).toBe(1);
  });

  it("returns null when the item is already first", () => {
    expect(moveUpIndex(queue, "q1")).toBeNull();
  });

  it("returns null for an unknown id", () => {
    expect(moveUpIndex(queue, "missing")).toBeNull();
  });
});

describe("moveToTopIndex", () => {
  const queue = [item({ id: "q1" }), item({ id: "q2" }), item({ id: "q3" })];

  it("returns 0 for any non-first item", () => {
    expect(moveToTopIndex(queue, "q2")).toBe(0);
    expect(moveToTopIndex(queue, "q3")).toBe(0);
  });

  it("returns null when the item is already first", () => {
    expect(moveToTopIndex(queue, "q1")).toBeNull();
  });

  it("returns null for an unknown id", () => {
    expect(moveToTopIndex(queue, "missing")).toBeNull();
  });
});

describe("ownQueueStanding", () => {
  const queue = [
    item({ id: "q1", addedByUserId: "u2" }),
    item({ id: "q2", addedByUserId: "u1" }),
    item({ id: "q3", addedByUserId: "u1" }),
    item({ id: "q4", addedByUserId: "u3" }),
  ];

  it("counts the viewer's own items and finds the earliest position (1-based)", () => {
    expect(ownQueueStanding(queue, "u1")).toEqual({ count: 2, nextPosition: 2 });
  });

  it("returns count 0 / nextPosition null when the viewer has nothing queued", () => {
    expect(ownQueueStanding(queue, "u4")).toEqual({ count: 0, nextPosition: null });
  });

  it("returns count 0 / nextPosition null for a null ownUserId (no session yet)", () => {
    expect(ownQueueStanding(queue, null)).toEqual({ count: 0, nextPosition: null });
  });

  it("returns count 0 / nextPosition null for an empty queue", () => {
    expect(ownQueueStanding([], "u1")).toEqual({ count: 0, nextPosition: null });
  });
});

describe("playback transitions", () => {
  it("advanceToNext pops the queue head into currentItem", () => {
    const state = baseState({
      queue: [item({ id: "q1" }), item({ id: "q2" })],
    });
    const next = advanceToNext(state);
    expect(next.playback.currentItem?.id).toBe("q1");
    expect(next.playback.status).toBe("playing");
    expect(next.queue.map((q) => q.id)).toEqual(["q2"]);
  });

  it("advanceToNext goes idle when the queue is empty", () => {
    const state = baseState();
    const next = advanceToNext(state);
    expect(next.playback.currentItem).toBeNull();
    expect(next.playback.status).toBe("idle");
  });

  it("applyPlay sets playing only when a currentItem exists", () => {
    const withItem = baseState({
      playback: { status: "paused", currentItem: item(), volume: 80 },
    });
    expect(applyPlay(withItem).playback.status).toBe("playing");

    const withoutItem = baseState();
    expect(applyPlay(withoutItem).playback.status).toBe("idle");
  });

  it("applyPause sets paused only when a currentItem exists", () => {
    const withItem = baseState({
      playback: { status: "playing", currentItem: item(), volume: 80 },
    });
    expect(applyPause(withItem).playback.status).toBe("paused");

    const withoutItem = baseState();
    expect(applyPause(withoutItem).playback.status).toBe("idle");
  });

  it("setVolume updates volume only", () => {
    const state = baseState();
    const next = setVolume(state, 33);
    expect(next.playback.volume).toBe(33);
    expect(next.playback.status).toBe(state.playback.status);
  });
});

describe("roster", () => {
  it("addToRoster appends a new entry carrying its avatarUrl", () => {
    const state = baseState();
    const next = addToRoster(state, {
      userId: "u1",
      nickname: "Alice",
      avatarUrl: "https://cdn.example.com/a.png",
      role: "guest",
    });
    expect(next.roster).toHaveLength(1);
    expect(next.roster[0].avatarUrl).toBe("https://cdn.example.com/a.png");
  });

  it("addToRoster carries a null avatarUrl", () => {
    const state = baseState();
    const next = addToRoster(state, {
      userId: "u1",
      nickname: "Alice",
      avatarUrl: null,
      role: "guest",
    });
    expect(next.roster[0].avatarUrl).toBeNull();
  });

  it("addToRoster replaces an existing entry for the same userId (reconnect)", () => {
    const state = baseState({
      roster: [
        { userId: "u1", nickname: "Old", avatarUrl: null, role: "guest" },
      ],
    });
    const next = addToRoster(state, {
      userId: "u1",
      nickname: "New",
      avatarUrl: "https://cdn.example.com/new.png",
      role: "host",
    });
    expect(next.roster).toEqual([
      {
        userId: "u1",
        nickname: "New",
        avatarUrl: "https://cdn.example.com/new.png",
        role: "host",
      },
    ]);
  });

  it("removeFromRoster drops the matching userId", () => {
    const state = baseState({
      roster: [
        { userId: "u1", nickname: "Alice", avatarUrl: null, role: "guest" },
        { userId: "u2", nickname: "Bob", avatarUrl: null, role: "host" },
      ],
    });
    const next = removeFromRoster(state, "u1");
    expect(next.roster.map((r) => r.userId)).toEqual(["u2"]);
  });
});

describe("setGuestReorder", () => {
  it("flips the settings flag", () => {
    const state = baseState();
    expect(setGuestReorder(state, true).settings.allowGuestReorder).toBe(
      true
    );
  });
});

describe("applyClientMessage", () => {
  const ctx = {
    userId: "u1",
    nickname: "Alice",
    avatarUrl: "https://cdn.example.com/a.png",
    role: "guest" as const,
    newQueueItemId: "generated-id",
    now: 555,
  };

  it("queue.add uses ctx for id/nickname/avatarUrl/userId/now", () => {
    const state = baseState();
    const next = applyClientMessage(
      state,
      { type: "queue.add", videoId: "v", title: "t", channel: "c", thumbnailUrl: "u" },
      ctx
    );
    expect(next.queue[0]).toEqual({
      id: "generated-id",
      videoId: "v",
      title: "t",
      channel: "c",
      thumbnailUrl: "u",
      singerNickname: "Alice",
      singerAvatarUrl: "https://cdn.example.com/a.png",
      addedByUserId: "u1",
      addedAt: 555,
    });
  });

  it("queue.add carries a null singerAvatarUrl when ctx has none", () => {
    const state = baseState();
    const next = applyClientMessage(
      state,
      { type: "queue.add", videoId: "v", title: "t", channel: "c", thumbnailUrl: "u" },
      { ...ctx, avatarUrl: null }
    );
    expect(next.queue[0].singerAvatarUrl).toBeNull();
  });

  it("playback.play advances when no currentItem", () => {
    const state = baseState({ queue: [item({ id: "q1" })] });
    const next = applyClientMessage(state, { type: "playback.play" }, ctx);
    expect(next.playback.currentItem?.id).toBe("q1");
    expect(next.playback.status).toBe("playing");
  });

  it("playback.play resumes when currentItem already set", () => {
    const state = baseState({
      playback: { status: "paused", currentItem: item(), volume: 80 },
    });
    const next = applyClientMessage(state, { type: "playback.play" }, ctx);
    expect(next.playback.status).toBe("playing");
    expect(next.queue).toEqual(state.queue);
  });

  it("playback.skip and playback.videoEnded both advance", () => {
    const state = baseState({ queue: [item({ id: "q1" }), item({ id: "q2" })] });
    const skipped = applyClientMessage(state, { type: "playback.skip" }, ctx);
    expect(skipped.playback.currentItem?.id).toBe("q1");

    const ended = applyClientMessage(
      state,
      { type: "playback.videoEnded" },
      ctx
    );
    expect(ended.playback.currentItem?.id).toBe("q1");
  });

  it("playback.skip/videoEnded advance when currentItemId matches the playing item", () => {
    const state = baseState({
      queue: [item({ id: "q2" })],
      playback: { status: "playing", currentItem: item({ id: "q1" }), volume: 80 },
    });
    const next = applyClientMessage(
      state,
      { type: "playback.skip", currentItemId: "q1" },
      ctx
    );
    expect(next.playback.currentItem?.id).toBe("q2");
  });

  it("playback.skip/videoEnded is a no-op when currentItemId no longer matches (dual-screen double-advance guard)", () => {
    // Queue already advanced to q2; a stale second skip for q1 must not pop q2.
    const state = baseState({
      queue: [item({ id: "q3" })],
      playback: { status: "playing", currentItem: item({ id: "q2" }), volume: 80 },
    });
    const skip = applyClientMessage(
      state,
      { type: "playback.skip", currentItemId: "q1" },
      ctx
    );
    expect(skip).toBe(state);

    const ended = applyClientMessage(
      state,
      { type: "playback.videoEnded", currentItemId: "q1" },
      ctx
    );
    expect(ended).toBe(state);
  });
});

describe("broadcastsForMessage", () => {
  it("queue mutations broadcast queue.updated", () => {
    const next = baseState({ queue: [item()] });
    expect(broadcastsForMessage({ type: "queue.add", videoId: "v", title: "t", channel: "c", thumbnailUrl: "u" }, next, next)).toEqual([
      { type: "queue.updated", queue: next.queue },
    ]);
  });

  it("playback.play/skip/videoEnded broadcast both queue and playback", () => {
    const next = advanceToNext(baseState({ queue: [item({ id: "q1" })] }));
    const messages = broadcastsForMessage({ type: "playback.skip" }, next, next);
    expect(messages).toHaveLength(2);
    expect(messages[0].type).toBe("queue.updated");
    expect(messages[1].type).toBe("playback.updated");
  });

  it("playback.pause and setVolume broadcast playback only", () => {
    const next = baseState();
    expect(broadcastsForMessage({ type: "playback.pause" }, next, next)).toEqual([
      { type: "playback.updated", playback: next.playback },
    ]);
    expect(
      broadcastsForMessage({ type: "playback.setVolume", volume: 10 }, next, next)
    ).toEqual([{ type: "playback.updated", playback: next.playback }]);
  });

  it("room.setGuestReorder broadcasts a full snapshot", () => {
    const next = setGuestReorder(baseState(), true);
    expect(broadcastsForMessage({ type: "room.setGuestReorder", allowed: true }, next, next)).toEqual([
      roomStateSnapshot(next),
    ]);
  });
});

describe("reactions", () => {
  const reactionCtx = {
    userId: "u1",
    nickname: "Alice",
    avatarUrl: null,
    role: "guest" as const,
    newQueueItemId: "generated-id",
    now: 555,
  };

  const playingState = (reactions: RoomLiveState["reactions"] = {}) =>
    baseState({
      playback: {
        status: "playing",
        currentItem: item({ id: "q1", singerNickname: "Alice" }),
        volume: 80,
      },
      reactions,
    });

  it("createInitialRoomState starts with an empty tally", () => {
    expect(createInitialRoomState({ allowGuestReorder: false }).reactions).toEqual(
      {}
    );
  });

  it("canPerform allows host AND guest to react only while playing", () => {
    const playing = playingState();
    const send = { type: "reaction.send", emoji: "🔥" } as const;
    expect(
      canPerform(send, { userId: "u1", role: "guest", state: playing })
    ).toBe(true);
    expect(
      canPerform(send, { userId: "host-1", role: "host", state: playing })
    ).toBe(true);

    const paused = baseState({
      playback: { status: "paused", currentItem: item(), volume: 80 },
    });
    expect(
      canPerform(send, { userId: "u1", role: "guest", state: paused })
    ).toBe(false);
    expect(
      canPerform(send, { userId: "host-1", role: "host", state: paused })
    ).toBe(false);

    const idle = baseState();
    expect(
      canPerform(send, { userId: "host-1", role: "host", state: idle })
    ).toBe(false);
  });

  it("reaction.send increments the tally with a clamped count", () => {
    const state = playingState({ "🔥": 2 });
    const next = applyClientMessage(
      state,
      { type: "reaction.send", emoji: "🔥", count: 999 },
      reactionCtx
    );
    expect(next.reactions["🔥"]).toBe(22); // 2 + clamp(999) = 2 + 20
  });

  it("reaction.send broadcasts a burst with the clamped count", () => {
    const state = playingState();
    expect(
      broadcastsForMessage(
        { type: "reaction.send", emoji: "🔥", count: 999 },
        state,
        state
      )
    ).toEqual([{ type: "reaction.burst", emoji: "🔥", count: 20 }]);
  });

  it("advanceToNext resets the reaction tally", () => {
    const state = playingState({ "🔥": 5, "❤️": 3 });
    expect(advanceToNext(state).reactions).toEqual({});
  });

  it("videoEnded with a non-zero tally prepends a recap before queue/playback updates", () => {
    const prev = baseState({
      queue: [item({ id: "q2", singerNickname: "Bob" })],
      playback: {
        status: "playing",
        currentItem: item({ id: "q1", singerNickname: "Alice" }),
        volume: 80,
      },
      reactions: { "🔥": 3, "❤️": 1 },
    });
    const next = advanceToNext(prev);
    const messages = broadcastsForMessage(
      { type: "playback.videoEnded", currentItemId: "q1" },
      prev,
      next
    );
    expect(messages).toHaveLength(3);
    expect(messages[0]).toEqual({
      type: "reaction.recap",
      singerNickname: "Alice",
      total: 4,
      breakdown: [
        { emoji: "🔥", count: 3 },
        { emoji: "❤️", count: 1 },
      ],
    });
    expect(messages[1].type).toBe("queue.updated");
    expect(messages[2].type).toBe("playback.updated");
  });

  it("videoEnded with a zero tally emits no recap", () => {
    const prev = baseState({
      queue: [item({ id: "q2" })],
      playback: {
        status: "playing",
        currentItem: item({ id: "q1" }),
        volume: 80,
      },
    });
    const next = advanceToNext(prev);
    const messages = broadcastsForMessage(
      { type: "playback.videoEnded", currentItemId: "q1" },
      prev,
      next
    );
    expect(messages).toHaveLength(2);
    expect(messages.some((m) => m.type === "reaction.recap")).toBe(false);
  });

  it("an idempotent stale-id skip/videoEnded emits no recap", () => {
    // Queue already advanced to q2; a stale second skip for q1 is a no-op.
    const prev = baseState({
      queue: [item({ id: "q3" })],
      playback: {
        status: "playing",
        currentItem: item({ id: "q2" }),
        volume: 80,
      },
      reactions: { "🔥": 5 },
    });
    const skipNext = applyClientMessage(
      prev,
      { type: "playback.skip", currentItemId: "q1" },
      reactionCtx
    );
    expect(skipNext).toBe(prev); // unchanged
    expect(
      broadcastsForMessage(
        { type: "playback.skip", currentItemId: "q1" },
        prev,
        skipNext
      ).some((m) => m.type === "reaction.recap")
    ).toBe(false);

    const endedNext = applyClientMessage(
      prev,
      { type: "playback.videoEnded", currentItemId: "q1" },
      reactionCtx
    );
    expect(
      broadcastsForMessage(
        { type: "playback.videoEnded", currentItemId: "q1" },
        prev,
        endedNext
      ).some((m) => m.type === "reaction.recap")
    ).toBe(false);
  });

  it("advancing past the last song (advance-to-null) still emits a recap", () => {
    const prev = baseState({
      queue: [],
      playback: {
        status: "playing",
        currentItem: item({ id: "q1", singerNickname: "Alice" }),
        volume: 80,
      },
      reactions: { "🎉": 2 },
    });
    const next = advanceToNext(prev);
    expect(next.playback.currentItem).toBeNull();
    const messages = broadcastsForMessage(
      { type: "playback.videoEnded", currentItemId: "q1" },
      prev,
      next
    );
    expect(messages[0]).toEqual({
      type: "reaction.recap",
      singerNickname: "Alice",
      total: 2,
      breakdown: [{ emoji: "🎉", count: 2 }],
    });
  });
});

describe("forbiddenError", () => {
  it("carries the rejected message type", () => {
    const err = forbiddenError({ type: "playback.play" });
    expect(err).toEqual({
      type: "error",
      code: "FORBIDDEN",
      message: "Not allowed: playback.play",
    });
  });
});

describe("rosterUpdated / roomStateSnapshot", () => {
  it("rosterUpdated reflects current roster", () => {
    const state = baseState({
      roster: [
        { userId: "u1", nickname: "Alice", avatarUrl: null, role: "host" },
      ],
    });
    expect(rosterUpdated(state)).toEqual({
      type: "roster.updated",
      roster: state.roster,
    });
  });

  it("roomStateSnapshot carries the full state", () => {
    const state = baseState({ queue: [item()] });
    expect(roomStateSnapshot(state)).toEqual({
      type: "room.state",
      queue: state.queue,
      playback: state.playback,
      roster: state.roster,
      settings: state.settings,
    });
  });

  it("roomClosed builds the terminal close broadcast", () => {
    expect(roomClosed()).toEqual({ type: "room.closed" });
  });
});

import { describe, it, expect } from "vitest";
import {
  createInitialRoomState,
  canPerform,
  addToQueue,
  MAX_QUEUE_SIZE,
  removeFromQueue,
  reorderQueue,
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
  it("addToRoster appends a new entry", () => {
    const state = baseState();
    const next = addToRoster(state, {
      userId: "u1",
      nickname: "Alice",
      role: "guest",
    });
    expect(next.roster).toHaveLength(1);
  });

  it("addToRoster replaces an existing entry for the same userId (reconnect)", () => {
    const state = baseState({
      roster: [{ userId: "u1", nickname: "Old", role: "guest" }],
    });
    const next = addToRoster(state, {
      userId: "u1",
      nickname: "New",
      role: "host",
    });
    expect(next.roster).toEqual([
      { userId: "u1", nickname: "New", role: "host" },
    ]);
  });

  it("removeFromRoster drops the matching userId", () => {
    const state = baseState({
      roster: [
        { userId: "u1", nickname: "Alice", role: "guest" },
        { userId: "u2", nickname: "Bob", role: "host" },
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
    role: "guest" as const,
    newQueueItemId: "generated-id",
    now: 555,
  };

  it("queue.add uses ctx for id/nickname/userId/now", () => {
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
      addedByUserId: "u1",
      addedAt: 555,
    });
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
});

describe("broadcastsForMessage", () => {
  it("queue mutations broadcast queue.updated", () => {
    const next = baseState({ queue: [item()] });
    expect(broadcastsForMessage({ type: "queue.add", videoId: "v", title: "t", channel: "c", thumbnailUrl: "u" }, next)).toEqual([
      { type: "queue.updated", queue: next.queue },
    ]);
  });

  it("playback.play/skip/videoEnded broadcast both queue and playback", () => {
    const next = advanceToNext(baseState({ queue: [item({ id: "q1" })] }));
    const messages = broadcastsForMessage({ type: "playback.skip" }, next);
    expect(messages).toHaveLength(2);
    expect(messages[0].type).toBe("queue.updated");
    expect(messages[1].type).toBe("playback.updated");
  });

  it("playback.pause and setVolume broadcast playback only", () => {
    const next = baseState();
    expect(broadcastsForMessage({ type: "playback.pause" }, next)).toEqual([
      { type: "playback.updated", playback: next.playback },
    ]);
    expect(
      broadcastsForMessage({ type: "playback.setVolume", volume: 10 }, next)
    ).toEqual([{ type: "playback.updated", playback: next.playback }]);
  });

  it("room.setGuestReorder broadcasts a full snapshot", () => {
    const next = setGuestReorder(baseState(), true);
    expect(broadcastsForMessage({ type: "room.setGuestReorder", allowed: true }, next)).toEqual([
      roomStateSnapshot(next),
    ]);
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
      roster: [{ userId: "u1", nickname: "Alice", role: "host" }],
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
});

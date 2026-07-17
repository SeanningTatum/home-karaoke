import { describe, it, expect } from "vitest";
import { Either, Schema } from "effect";
import {
  decodeClientMessage,
  decodeServerMessage,
  encodeClientMessage,
  encodeServerMessage,
  QueueItem,
  RosterEntry,
  type ClientMessage,
  type ServerMessage,
} from "../room-ws";

const decodeQueueItem = Schema.decodeUnknownEither(QueueItem);
const decodeRosterEntry = Schema.decodeUnknownEither(RosterEntry);

describe("decodeClientMessage", () => {
  it("decodes queue.add", () => {
    const raw = JSON.stringify({
      type: "queue.add",
      videoId: "abc123",
      title: "Song",
      channel: "Channel",
      thumbnailUrl: "https://example.com/thumb.jpg",
    });
    const result = decodeClientMessage(raw);
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right.type).toBe("queue.add");
    }
  });

  it("decodes queue.remove", () => {
    const raw = JSON.stringify({ type: "queue.remove", queueItemId: "q1" });
    const result = decodeClientMessage(raw);
    expect(Either.isRight(result)).toBe(true);
  });

  it("decodes queue.reorder", () => {
    const raw = JSON.stringify({
      type: "queue.reorder",
      queueItemId: "q1",
      toIndex: 2,
    });
    expect(Either.isRight(decodeClientMessage(raw))).toBe(true);
  });

  it("rejects queue.reorder with a negative toIndex", () => {
    const raw = JSON.stringify({
      type: "queue.reorder",
      queueItemId: "q1",
      toIndex: -1,
    });
    const result = decodeClientMessage(raw);
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("SchemaParseError");
    }
  });

  it.each([
    ["playback.play"],
    ["playback.pause"],
    ["playback.skip"],
    ["playback.videoEnded"],
  ])("decodes bare %s", (type) => {
    const raw = JSON.stringify({ type });
    expect(Either.isRight(decodeClientMessage(raw))).toBe(true);
  });

  it("decodes playback.setVolume", () => {
    const raw = JSON.stringify({ type: "playback.setVolume", volume: 50 });
    expect(Either.isRight(decodeClientMessage(raw))).toBe(true);
  });

  it("rejects playback.setVolume out of range", () => {
    const raw = JSON.stringify({ type: "playback.setVolume", volume: 101 });
    const result = decodeClientMessage(raw);
    expect(Either.isLeft(result)).toBe(true);
  });

  it("decodes room.setGuestReorder", () => {
    const raw = JSON.stringify({ type: "room.setGuestReorder", allowed: true });
    expect(Either.isRight(decodeClientMessage(raw))).toBe(true);
  });

  it("returns a JsonParseError (not a throw) for malformed JSON", () => {
    const result = decodeClientMessage("{not json");
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("JsonParseError");
    }
  });

  it("returns a SchemaParseError for an unknown message type", () => {
    const raw = JSON.stringify({ type: "not.a.real.type" });
    const result = decodeClientMessage(raw);
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("SchemaParseError");
    }
  });

  it("returns a SchemaParseError for missing required fields", () => {
    const raw = JSON.stringify({ type: "queue.add" });
    const result = decodeClientMessage(raw);
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("SchemaParseError");
    }
  });
});

describe("decodeServerMessage", () => {
  it("decodes a full room.state snapshot", () => {
    const raw = JSON.stringify({
      type: "room.state",
      queue: [],
      playback: { status: "idle", currentItem: null, volume: 80 },
      roster: [],
      settings: { allowGuestReorder: false },
    });
    expect(Either.isRight(decodeServerMessage(raw))).toBe(true);
  });

  it("decodes queue.updated", () => {
    const raw = JSON.stringify({
      type: "queue.updated",
      queue: [
        {
          id: "q1",
          videoId: "v1",
          title: "t",
          channel: "c",
          thumbnailUrl: "u",
          singerNickname: "Alice",
          addedByUserId: "u1",
          addedAt: 123,
        },
      ],
    });
    expect(Either.isRight(decodeServerMessage(raw))).toBe(true);
  });

  it("decodes an error message", () => {
    const raw = JSON.stringify({
      type: "error",
      code: "FORBIDDEN",
      message: "nope",
    });
    expect(Either.isRight(decodeServerMessage(raw))).toBe(true);
  });

  it("decodes room.closed", () => {
    const raw = JSON.stringify({ type: "room.closed" });
    const result = decodeServerMessage(raw);
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right.type).toBe("room.closed");
    }
  });

  it("returns a JsonParseError for malformed JSON", () => {
    const result = decodeServerMessage("}}}");
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("JsonParseError");
    }
  });
});

describe("QueueItem avatar field", () => {
  const base = {
    id: "q1",
    videoId: "v1",
    title: "t",
    channel: "c",
    thumbnailUrl: "u",
    singerNickname: "Alice",
    addedByUserId: "u1",
    addedAt: 123,
  };

  it("decodes a present singerAvatarUrl", () => {
    const result = decodeQueueItem({
      ...base,
      singerAvatarUrl: "https://cdn.example.com/a.png",
    });
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right.singerAvatarUrl).toBe("https://cdn.example.com/a.png");
    }
  });

  it("decodes an explicit null singerAvatarUrl", () => {
    const result = decodeQueueItem({ ...base, singerAvatarUrl: null });
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right.singerAvatarUrl).toBeNull();
    }
  });

  it("decodes an ABSENT singerAvatarUrl to null (hibernation / old-client compat)", () => {
    const result = decodeQueueItem(base);
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right.singerAvatarUrl).toBeNull();
    }
  });
});

describe("RosterEntry avatar field", () => {
  const base = { userId: "u1", nickname: "Alice", role: "guest" as const };

  it("decodes a present avatarUrl", () => {
    const result = decodeRosterEntry({
      ...base,
      avatarUrl: "https://cdn.example.com/a.png",
    });
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right.avatarUrl).toBe("https://cdn.example.com/a.png");
    }
  });

  it("decodes an explicit null avatarUrl", () => {
    const result = decodeRosterEntry({ ...base, avatarUrl: null });
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right.avatarUrl).toBeNull();
    }
  });

  it("decodes an ABSENT avatarUrl to null (hibernation / old-client compat)", () => {
    const result = decodeRosterEntry(base);
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right.avatarUrl).toBeNull();
    }
  });
});

describe("encode / decode roundtrip", () => {
  it("roundtrips a client message", () => {
    const message: ClientMessage = { type: "queue.remove", queueItemId: "q1" };
    const decoded = decodeClientMessage(encodeClientMessage(message));
    expect(Either.isRight(decoded)).toBe(true);
    if (Either.isRight(decoded)) {
      expect(decoded.right).toEqual(message);
    }
  });

  it("roundtrips a server message", () => {
    const message: ServerMessage = {
      type: "playback.updated",
      playback: { status: "playing", currentItem: null, volume: 42 },
    };
    const decoded = decodeServerMessage(encodeServerMessage(message));
    expect(Either.isRight(decoded)).toBe(true);
    if (Either.isRight(decoded)) {
      expect(decoded.right).toEqual(message);
    }
  });
});

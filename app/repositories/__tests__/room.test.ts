import { describe, it as itVitest, expect } from "vitest";
import { it } from "@effect/vitest";
import { Effect, Layer, Exit, Cause } from "effect";
import { RoomRepository, failIfClosed } from "../room";
import { chainable, makeTestDatabase } from "@/services/database.test-layer";
import { RoomNotFoundError, RoomClosedError } from "@/models/errors/room";
import { CreationError } from "@/models/errors/repository";

const provideStub = (stub: unknown) =>
  RoomRepository.Default.pipe(Layer.provide(makeTestDatabase(stub)));

describe("failIfClosed", () => {
  itVitest("succeeds with the room when open", async () => {
    const room = { id: "r1", status: "open" as const };
    const result = await Effect.runPromise(failIfClosed(room));
    expect(result).toEqual(room);
  });

  itVitest("fails with RoomClosedError when closed", async () => {
    const room = { id: "r1", status: "closed" as const };
    const exit = await Effect.runPromiseExit(failIfClosed(room));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(failure._tag).toBe("Some");
      if (failure._tag === "Some") {
        expect(failure.value).toBeInstanceOf(RoomClosedError);
        expect(failure.value.roomId).toBe("r1");
      }
    }
  });
});

describe("RoomRepository.getRoomByCode", () => {
  it.effect("fails with RoomNotFoundError when missing", () => {
    const stub = { select: () => chainable([]) };
    return Effect.gen(function* () {
      const repo = yield* RoomRepository;
      const exit = yield* Effect.exit(repo.getRoomByCode({ code: "AAA-AAA" }));
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.failureOption(exit.cause);
        if (failure._tag === "Some") {
          expect(failure.value).toBeInstanceOf(RoomNotFoundError);
        }
      }
    }).pipe(Effect.provide(provideStub(stub)));
  });

  it.effect("returns the room when found", () => {
    const found = { id: "r1", code: "AAA-AAA", status: "open" };
    const stub = { select: () => chainable([found]) };
    return Effect.gen(function* () {
      const repo = yield* RoomRepository;
      const result = yield* repo.getRoomByCode({ code: "AAA-AAA" });
      expect(result).toEqual(found);
    }).pipe(Effect.provide(provideStub(stub)));
  });
});

describe("RoomRepository.getRoomById", () => {
  it.effect("fails with RoomNotFoundError when missing", () => {
    const stub = { select: () => chainable([]) };
    return Effect.gen(function* () {
      const repo = yield* RoomRepository;
      const exit = yield* Effect.exit(repo.getRoomById({ roomId: "missing" }));
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.failureOption(exit.cause);
        if (failure._tag === "Some") {
          expect(failure.value).toBeInstanceOf(RoomNotFoundError);
        }
      }
    }).pipe(Effect.provide(provideStub(stub)));
  });

  it.effect("returns the room when found", () => {
    const found = { id: "r1", status: "open" };
    const stub = { select: () => chainable([found]) };
    return Effect.gen(function* () {
      const repo = yield* RoomRepository;
      const result = yield* repo.getRoomById({ roomId: "r1" });
      expect(result).toEqual(found);
    }).pipe(Effect.provide(provideStub(stub)));
  });
});

describe("RoomRepository.createRoom", () => {
  it.effect("generates a code, inserts, and returns the created room", () => {
    // First select (code-collision check) → empty (code free).
    // Insert → succeeds.
    // Final select (getRoomById) → the newly created row.
    let selectCall = 0;
    const created = { id: "generated", code: "will-be-overwritten", status: "open" };
    const stub = {
      select: () => chainable(selectCall++ === 0 ? [] : [created]),
      insert: () => chainable(undefined),
    };
    return Effect.gen(function* () {
      const repo = yield* RoomRepository;
      const result = yield* repo.createRoom({
        hostUserId: "host-1",
        allowGuestReorder: true,
      });
      expect(result).toEqual(created);
    }).pipe(Effect.provide(provideStub(stub)));
  });

  it.effect("retries code generation on collision then succeeds", () => {
    // First select (collision) → non-empty. Second select (free) → empty.
    // Insert succeeds. Final select → created row.
    let selectCall = 0;
    const collisionResponses = [
      [{ id: "existing", code: "collides", status: "open" }],
      [],
      [{ id: "generated", code: "final", status: "open" }],
    ];
    const stub = {
      select: () => chainable(collisionResponses[selectCall++] ?? []),
      insert: () => chainable(undefined),
    };
    return Effect.gen(function* () {
      const repo = yield* RoomRepository;
      const result = yield* repo.createRoom({ hostUserId: "host-1" });
      expect(result).toEqual(collisionResponses[2][0]);
    }).pipe(Effect.provide(provideStub(stub)));
  });

  it.effect("fails with CreationError when the insert throws", () => {
    const stub = {
      select: () => chainable([]),
      insert: () => {
        throw new Error("insert boom");
      },
    };
    return Effect.gen(function* () {
      const repo = yield* RoomRepository;
      const exit = yield* Effect.exit(
        repo.createRoom({ hostUserId: "host-1" })
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.failureOption(exit.cause);
        if (failure._tag === "Some") {
          expect(failure.value).toBeInstanceOf(CreationError);
        }
      }
    }).pipe(Effect.provide(provideStub(stub)));
  });
});

describe("RoomRepository.listRoomsByHost", () => {
  it.effect("returns rooms with numeric song counts", () => {
    // The grouped-join select yields { room, songCount } rows; the repo
    // flattens them and coerces songCount (SQLite count() can surface as a
    // string through the driver) to a number.
    const rows = [
      { room: { id: "r2", code: "BBB-BBB", status: "closed" }, songCount: "14" },
      { room: { id: "r1", code: "AAA-AAA", status: "closed" }, songCount: 0 },
    ];
    const stub = { select: () => chainable(rows) };
    return Effect.gen(function* () {
      const repo = yield* RoomRepository;
      const result = yield* repo.listRoomsByHost({ hostUserId: "host-1" });
      expect(result).toEqual([
        { id: "r2", code: "BBB-BBB", status: "closed", songCount: 14 },
        { id: "r1", code: "AAA-AAA", status: "closed", songCount: 0 },
      ]);
    }).pipe(Effect.provide(provideStub(stub)));
  });

  it.effect("returns an empty list for a host with no rooms", () => {
    const stub = { select: () => chainable([]) };
    return Effect.gen(function* () {
      const repo = yield* RoomRepository;
      const result = yield* repo.listRoomsByHost({ hostUserId: "host-none" });
      expect(result).toEqual([]);
    }).pipe(Effect.provide(provideStub(stub)));
  });
});

describe("RoomRepository.closeRoom", () => {
  it.effect("fails with RoomNotFoundError when missing", () => {
    const stub = { select: () => chainable([]) };
    return Effect.gen(function* () {
      const repo = yield* RoomRepository;
      const exit = yield* Effect.exit(repo.closeRoom({ roomId: "missing" }));
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.failureOption(exit.cause);
        if (failure._tag === "Some") {
          expect(failure.value).toBeInstanceOf(RoomNotFoundError);
        }
      }
    }).pipe(Effect.provide(provideStub(stub)));
  });

  it.effect("is idempotent when the room is already closed", () => {
    const closed = { id: "r1", status: "closed" };
    const stub = { select: () => chainable([closed]) };
    return Effect.gen(function* () {
      const repo = yield* RoomRepository;
      const result = yield* repo.closeRoom({ roomId: "r1" });
      expect(result).toEqual(closed);
    }).pipe(Effect.provide(provideStub(stub)));
  });

  it.effect("closes an open room and returns the updated row", () => {
    let selectCall = 0;
    const responses = [
      [{ id: "r1", status: "open" }],
      [{ id: "r1", status: "closed" }],
    ];
    const stub = {
      select: () => chainable(responses[selectCall++]),
      update: () => chainable(undefined),
    };
    return Effect.gen(function* () {
      const repo = yield* RoomRepository;
      const result = yield* repo.closeRoom({ roomId: "r1" });
      expect(result).toEqual(responses[1][0]);
    }).pipe(Effect.provide(provideStub(stub)));
  });
});

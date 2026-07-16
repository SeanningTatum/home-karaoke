import { describe, expect } from "vitest";
import { it } from "@effect/vitest";
import { Effect, Layer, Exit, Cause } from "effect";
import { SongRepository } from "../song";
import { chainable, chainableSpy, makeTestDatabase } from "@/services/database.test-layer";
import {
  NotFoundError,
  CreationError,
  UpdateError,
  QueryError,
} from "@/models/errors/repository";

const provideStub = (stub: unknown) =>
  SongRepository.Default.pipe(Layer.provide(makeTestDatabase(stub)));

describe("SongRepository.upsertSong", () => {
  it.effect("inserts/updates and succeeds", () => {
    const insertSpy = chainableSpy(undefined);
    const stub = { insert: insertSpy };
    return Effect.gen(function* () {
      const repo = yield* SongRepository;
      yield* repo.upsertSong({
        videoId: "v1",
        title: "Song",
        channel: "Channel",
        thumbnailUrl: "https://example.com/thumb.jpg",
        embeddable: true,
        durationSeconds: 180,
      });
      expect(insertSpy).toHaveBeenCalledTimes(1);
    }).pipe(Effect.provide(provideStub(stub)));
  });

  it.effect("fails with CreationError when the insert throws", () => {
    const stub = {
      insert: () => {
        throw new Error("insert boom");
      },
    };
    return Effect.gen(function* () {
      const repo = yield* SongRepository;
      const exit = yield* Effect.exit(
        repo.upsertSong({
          videoId: "v1",
          title: "Song",
          channel: "Channel",
          thumbnailUrl: "https://example.com/thumb.jpg",
          embeddable: true,
        })
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

describe("SongRepository.getSong", () => {
  it.effect("fails with NotFoundError when missing", () => {
    const stub = { select: () => chainable([]) };
    return Effect.gen(function* () {
      const repo = yield* SongRepository;
      const exit = yield* Effect.exit(repo.getSong({ videoId: "missing" }));
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.failureOption(exit.cause);
        if (failure._tag === "Some") {
          expect(failure.value).toBeInstanceOf(NotFoundError);
        }
      }
    }).pipe(Effect.provide(provideStub(stub)));
  });

  it.effect("returns the song when found", () => {
    const found = { videoId: "v1", title: "Song" };
    const stub = { select: () => chainable([found]) };
    return Effect.gen(function* () {
      const repo = yield* SongRepository;
      const result = yield* repo.getSong({ videoId: "v1" });
      expect(result).toEqual(found);
    }).pipe(Effect.provide(provideStub(stub)));
  });
});

describe("SongRepository.logSearch", () => {
  it.effect("inserts a search_log row and returns its id", () => {
    const insertSpy = chainableSpy(undefined);
    const stub = { insert: insertSpy };
    return Effect.gen(function* () {
      const repo = yield* SongRepository;
      const result = yield* repo.logSearch({
        query: "never gonna",
        normalizedQuery: "never gonna",
      });
      expect(typeof result.id).toBe("string");
      expect(insertSpy).toHaveBeenCalledTimes(1);
    }).pipe(Effect.provide(provideStub(stub)));
  });
});

describe("SongRepository.markSearchPicked", () => {
  it.effect("updates pickedVideoId on the search_log row", () => {
    const updateSpy = chainableSpy(undefined);
    const stub = { update: updateSpy };
    return Effect.gen(function* () {
      const repo = yield* SongRepository;
      yield* repo.markSearchPicked({ searchLogId: "sl1", videoId: "v1" });
      expect(updateSpy).toHaveBeenCalledTimes(1);
    }).pipe(Effect.provide(provideStub(stub)));
  });

  it.effect("fails with UpdateError when the update throws", () => {
    const stub = {
      update: () => {
        throw new Error("update boom");
      },
    };
    return Effect.gen(function* () {
      const repo = yield* SongRepository;
      const exit = yield* Effect.exit(
        repo.markSearchPicked({ searchLogId: "sl1", videoId: "v1" })
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.failureOption(exit.cause);
        if (failure._tag === "Some") {
          expect(failure.value).toBeInstanceOf(UpdateError);
        }
      }
    }).pipe(Effect.provide(provideStub(stub)));
  });
});

describe("SongRepository.recordRoomSong", () => {
  it.effect("inserts a room_song row and returns its id", () => {
    const insertSpy = chainableSpy(undefined);
    const stub = { insert: insertSpy };
    return Effect.gen(function* () {
      const repo = yield* SongRepository;
      const result = yield* repo.recordRoomSong({
        roomId: "r1",
        videoId: "v1",
        singerNickname: "Alice",
      });
      expect(typeof result.id).toBe("string");
      expect(insertSpy).toHaveBeenCalledTimes(1);
    }).pipe(Effect.provide(provideStub(stub)));
  });
});

describe("SongRepository.getCachedPicks", () => {
  it.effect("returns joined song rows for the normalized query", () => {
    const found = [
      {
        videoId: "v1",
        title: "Song",
        channel: "Channel",
        thumbnailUrl: "https://example.com/thumb.jpg",
        embeddable: true,
        durationSeconds: 180,
      },
    ];
    const stub = { select: () => chainable(found) };
    return Effect.gen(function* () {
      const repo = yield* SongRepository;
      const result = yield* repo.getCachedPicks({
        normalizedQuery: "never gonna give you up",
        since: new Date("2026-01-01"),
      });
      expect(result).toEqual(found);
    }).pipe(Effect.provide(provideStub(stub)));
  });

  it.effect("returns an empty array when nothing is cached", () => {
    const stub = { select: () => chainable([]) };
    return Effect.gen(function* () {
      const repo = yield* SongRepository;
      const result = yield* repo.getCachedPicks({
        normalizedQuery: "no matches",
        since: new Date("2026-01-01"),
      });
      expect(result).toEqual([]);
    }).pipe(Effect.provide(provideStub(stub)));
  });

  it.effect("fails with QueryError when the select throws", () => {
    const stub = {
      select: () => {
        throw new Error("select boom");
      },
    };
    return Effect.gen(function* () {
      const repo = yield* SongRepository;
      const exit = yield* Effect.exit(
        repo.getCachedPicks({
          normalizedQuery: "anything",
          since: new Date("2026-01-01"),
        })
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.failureOption(exit.cause);
        if (failure._tag === "Some") {
          expect(failure.value).toBeInstanceOf(QueryError);
        }
      }
    }).pipe(Effect.provide(provideStub(stub)));
  });
});

describe("SongRepository.markPlayed", () => {
  it.effect("updates playedAt on the room_song row", () => {
    const updateSpy = chainableSpy(undefined);
    const stub = { update: updateSpy };
    return Effect.gen(function* () {
      const repo = yield* SongRepository;
      yield* repo.markPlayed({ roomSongId: "rs1" });
      expect(updateSpy).toHaveBeenCalledTimes(1);
    }).pipe(Effect.provide(provideStub(stub)));
  });
});

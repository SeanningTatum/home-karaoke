import { describe, expect } from "vitest";
import { it } from "@effect/vitest";
import { Effect, Exit, Cause, Layer } from "effect";

import { resolveVideoProgram } from "../youtube";
import { YouTube, type YouTubeVideoMetadata } from "@/services/youtube";
import { makeTestYouTube } from "@/services/youtube.test-layer";
import { SongRepository } from "@/repositories/song";
import { ValidationError } from "@/models/errors/repository";
import {
  VideoNotFoundError,
  VideoNotEmbeddableError,
} from "@/models/errors/youtube";

// The exact video the group-karaoke feature-verifier hit on the real YouTube
// Data API: "ABBA - Dancing Queen (Karaoke Version)" by Sing King reports
// `status.embeddable: false`. Verified empirically (IFrame error 150) that its
// owner disabled embedding, so it can NEVER play in the embedded player —
// `resolveVideo` must reject it so an unplayable song can't reach the queue.
// See .brain/features/group-karaoke.
const SING_KING: YouTubeVideoMetadata = {
  videoId: "singking123",
  title: "ABBA - Dancing Queen (Karaoke Version)",
  channel: "Sing King",
  thumbnailUrl: "https://i.ytimg.com/vi/singking123/mqdefault.jpg",
  embeddable: false,
  durationSeconds: 240,
};

// Stub SongRepository, capturing the calls resolveVideoProgram makes so we can
// assert it persisted the song rather than short-circuiting. Only the two
// methods the program touches are implemented.
const makeSongRepoStub = () => {
  const upserts: Array<{ videoId: string; embeddable: boolean }> = [];
  const picks: Array<{ searchLogId: string; videoId: string; userId: string }> =
    [];
  const layer = Layer.succeed(SongRepository, {
    upsertSong: (input: { videoId: string; embeddable: boolean }) =>
      Effect.sync(() => {
        upserts.push(input);
      }),
    markSearchPicked: (input: {
      searchLogId: string;
      videoId: string;
      userId: string;
    }) =>
      Effect.sync(() => {
        picks.push(input);
      }),
  } as unknown as SongRepository);
  return { layer, upserts, picks };
};

const failure = <E>(exit: Exit.Exit<unknown, E>): E | undefined => {
  if (!Exit.isFailure(exit)) return undefined;
  const f = Cause.failureOption(exit.cause);
  return f._tag === "Some" ? f.value : undefined;
};

describe("resolveVideoProgram", () => {
  it("rejects a video whose owner disabled embedding (Sing King regression)", async () => {
    const repo = makeSongRepoStub();
    const exit = await Effect.runPromiseExit(
      resolveVideoProgram(
        { videoId: "singking123", searchLogId: "log-1", roomId: "room-1" },
        "user-1"
      ).pipe(
        Effect.provide(
          Layer.merge(
            makeTestYouTube({ getVideo: () => Effect.succeed(SING_KING) }),
            repo.layer
          )
        )
      )
    );

    // embeddable:false can never play in the embedded player (IFrame error
    // 150), so it must be rejected — not queued to then auto-skip.
    expect(failure(exit)).toBeInstanceOf(VideoNotEmbeddableError);
    // ...and nothing was persisted / no pick was marked.
    expect(repo.upserts).toHaveLength(0);
    expect(repo.picks).toHaveLength(0);
  });

  it("does not mark a search pick when no searchLogId is provided", async () => {
    const repo = makeSongRepoStub();
    const exit = await Effect.runPromiseExit(
      resolveVideoProgram({ videoId: "abc", roomId: "room-1" }, "user-1").pipe(
        Effect.provide(
          Layer.merge(
            makeTestYouTube({
              getVideo: () =>
                Effect.succeed({ ...SING_KING, videoId: "abc", embeddable: true }),
            }),
            repo.layer
          )
        )
      )
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(repo.upserts).toHaveLength(1);
    expect(repo.picks).toHaveLength(0);
  });

  it("resolves a pasted URL into a videoId", async () => {
    const repo = makeSongRepoStub();
    const exit = await Effect.runPromiseExit(
      resolveVideoProgram(
        { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", roomId: "room-1" },
        "user-1"
      ).pipe(
        Effect.provide(
          Layer.merge(
            makeTestYouTube({
              getVideo: (videoId) =>
                Effect.succeed({ ...SING_KING, videoId, embeddable: true }),
            }),
            repo.layer
          )
        )
      )
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(repo.upserts[0]?.videoId).toBe("dQw4w9WgXcQ");
  });

  it("fails with ValidationError on an unparseable URL", async () => {
    const repo = makeSongRepoStub();
    const exit = await Effect.runPromiseExit(
      resolveVideoProgram({ url: "not a youtube link", roomId: "room-1" }, "user-1").pipe(
        Effect.provide(
          Layer.merge(
            makeTestYouTube({ getVideo: () => Effect.succeed(SING_KING) }),
            repo.layer
          )
        )
      )
    );

    expect(failure(exit)).toBeInstanceOf(ValidationError);
    expect(repo.upserts).toHaveLength(0);
  });

  it("propagates VideoNotFoundError from the YouTube service", async () => {
    const repo = makeSongRepoStub();
    const exit = await Effect.runPromiseExit(
      resolveVideoProgram({ videoId: "gone", roomId: "room-1" }, "user-1").pipe(
        Effect.provide(
          Layer.merge(
            makeTestYouTube({
              getVideo: (videoId) =>
                Effect.fail(new VideoNotFoundError({ videoId })),
            }),
            repo.layer
          )
        )
      )
    );

    expect(failure(exit)).toBeInstanceOf(VideoNotFoundError);
    expect(repo.upserts).toHaveLength(0);
  });
});

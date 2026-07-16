import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import { it } from "@effect/vitest";
import { Effect, Exit, Cause, Layer } from "effect";
import { YouTube, YouTubeLive } from "../youtube";
import { CloudflareEnv } from "../cloudflare";
import { ConfigurationError } from "@/models/errors/repository";
import {
  YouTubeQuotaExceededError,
  YouTubeUnavailableError,
  VideoNotFoundError,
} from "@/models/errors/youtube";

const envLayer = (env: Partial<Env>) =>
  Layer.succeed(CloudflareEnv, env as Env);

const provideYouTube = (env: Partial<Env>) =>
  YouTubeLive.pipe(Layer.provide(envLayer(env)));

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
});

const failureValue = <E>(exit: Exit.Exit<unknown, E>): E | undefined => {
  if (!Exit.isFailure(exit)) return undefined;
  const failure = Cause.failureOption(exit.cause);
  return failure._tag === "Some" ? failure.value : undefined;
};

describe("YouTubeLive.search", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.effect("fails with ConfigurationError when no API key is configured", () =>
    Effect.gen(function* () {
      const yt = yield* YouTube;
      const exit = yield* Effect.exit(yt.search("never gonna give you up"));
      expect(Exit.isFailure(exit)).toBe(true);
      expect(failureValue(exit)).toBeInstanceOf(ConfigurationError);
    }).pipe(Effect.provide(provideYouTube({})))
  );

  it.effect("maps a successful response and appends 'karaoke' to the query", () =>
    Effect.gen(function* () {
      const fetchSpy = vi.mocked(fetch);
      fetchSpy.mockResolvedValueOnce(
        jsonResponse(200, {
          items: [
            {
              id: { videoId: "v1" },
              snippet: {
                title: "Song A",
                channelTitle: "Channel A",
                thumbnails: { medium: { url: "https://img/a.jpg" } },
              },
            },
          ],
        }) as unknown as Response
      );

      const yt = yield* YouTube;
      const results = yield* yt.search("never gonna give you up");

      expect(results).toEqual([
        {
          videoId: "v1",
          title: "Song A",
          channel: "Channel A",
          thumbnailUrl: "https://img/a.jpg",
        },
      ]);
      const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
      expect(calledUrl).toContain(encodeURIComponent("never gonna give you up karaoke"));
      expect(calledUrl).toContain("key=test-key");
    }).pipe(Effect.provide(provideYouTube({ YOUTUBE_API_KEY: "test-key" } as Partial<Env>)))
  );

  it.effect("does not duplicate 'karaoke' when already present in the query", () =>
    Effect.gen(function* () {
      const fetchSpy = vi.mocked(fetch);
      fetchSpy.mockResolvedValueOnce(jsonResponse(200, { items: [] }) as unknown as Response);

      const yt = yield* YouTube;
      yield* yt.search("some song karaoke version");

      const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
      expect(calledUrl).toContain(encodeURIComponent("some song karaoke version"));
    }).pipe(Effect.provide(provideYouTube({ YOUTUBE_API_KEY: "test-key" } as Partial<Env>)))
  );

  it.effect("fails with YouTubeQuotaExceededError on a 403 quotaExceeded response", () =>
    Effect.gen(function* () {
      const fetchSpy = vi.mocked(fetch);
      fetchSpy.mockResolvedValueOnce(
        jsonResponse(403, {
          error: { errors: [{ reason: "quotaExceeded" }] },
        }) as unknown as Response
      );

      const yt = yield* YouTube;
      const exit = yield* Effect.exit(yt.search("anything"));
      expect(Exit.isFailure(exit)).toBe(true);
      expect(failureValue(exit)).toBeInstanceOf(YouTubeQuotaExceededError);
    }).pipe(Effect.provide(provideYouTube({ YOUTUBE_API_KEY: "test-key" } as Partial<Env>)))
  );

  it.effect("fails with YouTubeUnavailableError on other non-2xx responses", () =>
    Effect.gen(function* () {
      const fetchSpy = vi.mocked(fetch);
      fetchSpy.mockResolvedValueOnce(jsonResponse(500, {}) as unknown as Response);

      const yt = yield* YouTube;
      const exit = yield* Effect.exit(yt.search("anything"));
      expect(Exit.isFailure(exit)).toBe(true);
      expect(failureValue(exit)).toBeInstanceOf(YouTubeUnavailableError);
    }).pipe(Effect.provide(provideYouTube({ YOUTUBE_API_KEY: "test-key" } as Partial<Env>)))
  );

  it.effect("fails with YouTubeUnavailableError on a network error", () =>
    Effect.gen(function* () {
      const fetchSpy = vi.mocked(fetch);
      fetchSpy.mockRejectedValueOnce(new Error("network down"));

      const yt = yield* YouTube;
      const exit = yield* Effect.exit(yt.search("anything"));
      expect(Exit.isFailure(exit)).toBe(true);
      expect(failureValue(exit)).toBeInstanceOf(YouTubeUnavailableError);
    }).pipe(Effect.provide(provideYouTube({ YOUTUBE_API_KEY: "test-key" } as Partial<Env>)))
  );
});

describe("YouTubeLive.getVideo (with API key)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.effect("maps metadata including parsed duration", () =>
    Effect.gen(function* () {
      const fetchSpy = vi.mocked(fetch);
      fetchSpy.mockResolvedValueOnce(
        jsonResponse(200, {
          items: [
            {
              snippet: {
                title: "Song A",
                channelTitle: "Channel A",
                thumbnails: { high: { url: "https://img/a.jpg" } },
              },
              status: { embeddable: true },
              contentDetails: { duration: "PT4M13S" },
            },
          ],
        }) as unknown as Response
      );

      const yt = yield* YouTube;
      const video = yield* yt.getVideo("v1");

      expect(video).toEqual({
        videoId: "v1",
        title: "Song A",
        channel: "Channel A",
        thumbnailUrl: "https://img/a.jpg",
        embeddable: true,
        durationSeconds: 253,
      });
    }).pipe(Effect.provide(provideYouTube({ YOUTUBE_API_KEY: "test-key" } as Partial<Env>)))
  );

  it.effect("reports embeddable: false when the API says so", () =>
    Effect.gen(function* () {
      const fetchSpy = vi.mocked(fetch);
      fetchSpy.mockResolvedValueOnce(
        jsonResponse(200, {
          items: [
            {
              snippet: { title: "Song A", channelTitle: "Channel A" },
              status: { embeddable: false },
              contentDetails: { duration: "PT1M" },
            },
          ],
        }) as unknown as Response
      );

      const yt = yield* YouTube;
      const video = yield* yt.getVideo("v1");
      expect(video.embeddable).toBe(false);
    }).pipe(Effect.provide(provideYouTube({ YOUTUBE_API_KEY: "test-key" } as Partial<Env>)))
  );

  it.effect("fails with VideoNotFoundError when items is empty", () =>
    Effect.gen(function* () {
      const fetchSpy = vi.mocked(fetch);
      fetchSpy.mockResolvedValueOnce(jsonResponse(200, { items: [] }) as unknown as Response);

      const yt = yield* YouTube;
      const exit = yield* Effect.exit(yt.getVideo("missing"));
      expect(Exit.isFailure(exit)).toBe(true);
      expect(failureValue(exit)).toBeInstanceOf(VideoNotFoundError);
    }).pipe(Effect.provide(provideYouTube({ YOUTUBE_API_KEY: "test-key" } as Partial<Env>)))
  );

  it.effect("fails with YouTubeQuotaExceededError on a 403 quotaExceeded response", () =>
    Effect.gen(function* () {
      const fetchSpy = vi.mocked(fetch);
      fetchSpy.mockResolvedValueOnce(
        jsonResponse(403, {
          error: { errors: [{ reason: "quotaExceeded" }] },
        }) as unknown as Response
      );

      const yt = yield* YouTube;
      const exit = yield* Effect.exit(yt.getVideo("v1"));
      expect(Exit.isFailure(exit)).toBe(true);
      expect(failureValue(exit)).toBeInstanceOf(YouTubeQuotaExceededError);
    }).pipe(Effect.provide(provideYouTube({ YOUTUBE_API_KEY: "test-key" } as Partial<Env>)))
  );
});

describe("YouTubeLive.getVideo (no API key — oEmbed fallback)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.effect("maps oEmbed metadata with embeddable defaulted to true and no duration", () =>
    Effect.gen(function* () {
      const fetchSpy = vi.mocked(fetch);
      fetchSpy.mockResolvedValueOnce(
        jsonResponse(200, {
          title: "Song A",
          author_name: "Channel A",
          thumbnail_url: "https://img/a.jpg",
        }) as unknown as Response
      );

      const yt = yield* YouTube;
      const video = yield* yt.getVideo("v1");

      expect(video).toEqual({
        videoId: "v1",
        title: "Song A",
        channel: "Channel A",
        thumbnailUrl: "https://img/a.jpg",
        embeddable: true,
        durationSeconds: null,
      });
      const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
      expect(calledUrl).toContain("oembed");
    }).pipe(Effect.provide(provideYouTube({})))
  );

  it.effect("fails with VideoNotFoundError on an oEmbed 404", () =>
    Effect.gen(function* () {
      const fetchSpy = vi.mocked(fetch);
      fetchSpy.mockResolvedValueOnce(jsonResponse(404, {}) as unknown as Response);

      const yt = yield* YouTube;
      const exit = yield* Effect.exit(yt.getVideo("missing"));
      expect(Exit.isFailure(exit)).toBe(true);
      expect(failureValue(exit)).toBeInstanceOf(VideoNotFoundError);
    }).pipe(Effect.provide(provideYouTube({})))
  );

  it.effect("fails with YouTubeUnavailableError on an oEmbed network error", () =>
    Effect.gen(function* () {
      const fetchSpy = vi.mocked(fetch);
      fetchSpy.mockRejectedValueOnce(new Error("network down"));

      const yt = yield* YouTube;
      const exit = yield* Effect.exit(yt.getVideo("v1"));
      expect(Exit.isFailure(exit)).toBe(true);
      expect(failureValue(exit)).toBeInstanceOf(YouTubeUnavailableError);
    }).pipe(Effect.provide(provideYouTube({})))
  );
});

import { Context, Effect, Layer } from "effect";
import { CloudflareEnv } from "./cloudflare";
import { ConfigurationError } from "@/models/errors/repository";
import {
  YouTubeQuotaExceededError,
  YouTubeUnavailableError,
  VideoNotFoundError,
} from "@/models/errors/youtube";
import { withKaraokeBias, parseIsoDuration } from "@/lib/youtube";

const SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
const VIDEOS_ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";
const OEMBED_ENDPOINT = "https://www.youtube.com/oembed";
const MAX_SEARCH_RESULTS = 12;

export interface YouTubeSearchResult {
  readonly videoId: string;
  readonly title: string;
  readonly channel: string;
  readonly thumbnailUrl: string;
}

export interface YouTubeVideoMetadata {
  readonly videoId: string;
  readonly title: string;
  readonly channel: string;
  readonly thumbnailUrl: string;
  // `null` when unknown — the keyless oEmbed fallback (used when
  // YOUTUBE_API_KEY is unset) doesn't report embeddability at all, so
  // callers should treat `true` as "assumed playable" and lean on the
  // player's own `onError` handler rather than trusting this as gospel.
  readonly embeddable: boolean;
  readonly durationSeconds: number | null;
}

export interface YouTubeShape {
  readonly search: (
    query: string
  ) => Effect.Effect<
    readonly YouTubeSearchResult[],
    ConfigurationError | YouTubeQuotaExceededError | YouTubeUnavailableError
  >;
  readonly getVideo: (
    videoId: string
  ) => Effect.Effect<
    YouTubeVideoMetadata,
    YouTubeQuotaExceededError | YouTubeUnavailableError | VideoNotFoundError
  >;
}

export class YouTube extends Context.Tag("app/YouTube")<
  YouTube,
  YouTubeShape
>() {}

// --- wire shapes (subset of the YouTube Data API v3 response we read) ----

interface YouTubeApiErrorBody {
  readonly error?: {
    readonly errors?: ReadonlyArray<{ readonly reason?: string }>;
  };
}

interface YouTubeThumbnails {
  readonly default?: { readonly url?: string };
  readonly medium?: { readonly url?: string };
  readonly high?: { readonly url?: string };
}

interface YouTubeSearchApiResponse {
  readonly items?: ReadonlyArray<{
    readonly id?: { readonly videoId?: string };
    readonly snippet?: {
      readonly title?: string;
      readonly channelTitle?: string;
      readonly thumbnails?: YouTubeThumbnails;
    };
  }>;
}

interface YouTubeVideosApiResponse {
  readonly items?: ReadonlyArray<{
    readonly snippet?: {
      readonly title?: string;
      readonly channelTitle?: string;
      readonly thumbnails?: YouTubeThumbnails;
    };
    readonly status?: { readonly embeddable?: boolean };
    readonly contentDetails?: { readonly duration?: string };
  }>;
}

interface OEmbedResponse {
  readonly title?: string;
  readonly author_name?: string;
  readonly thumbnail_url?: string;
}

const isQuotaExceeded = (body: unknown): boolean => {
  const errors = (body as YouTubeApiErrorBody | undefined)?.error?.errors;
  return (
    Array.isArray(errors) &&
    errors.some((e) => e.reason === "quotaExceeded")
  );
};

/** Best-effort JSON parse — never fails the enclosing Effect. */
const safeJson = (response: Response): Effect.Effect<unknown, never> =>
  Effect.tryPromise({
    try: () => response.json(),
    catch: () => null,
  }).pipe(Effect.catchAll(() => Effect.succeed(null)));

/**
 * Shared fetch + status handling for keyed YouTube Data API calls (search,
 * videos.list). A non-2xx response with `errors[].reason === "quotaExceeded"`
 * becomes `YouTubeQuotaExceededError`; any other failure (network error,
 * other 4xx/5xx, malformed body) becomes `YouTubeUnavailableError`.
 */
const fetchYouTubeApi = (
  url: string
): Effect.Effect<unknown, YouTubeQuotaExceededError | YouTubeUnavailableError> =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () => fetch(url),
      catch: (cause) => new YouTubeUnavailableError({ cause }),
    });

    if (!response.ok) {
      const body = yield* safeJson(response);
      if (response.status === 403 && isQuotaExceeded(body)) {
        return yield* Effect.fail(
          new YouTubeQuotaExceededError({ cause: body })
        );
      }
      return yield* Effect.fail(
        new YouTubeUnavailableError({
          cause: { status: response.status, body },
        })
      );
    }

    return yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (cause) => new YouTubeUnavailableError({ cause }),
    });
  });

const mapSearchResponse = (
  body: unknown
): readonly YouTubeSearchResult[] => {
  const items = (body as YouTubeSearchApiResponse | undefined)?.items ?? [];
  const results: YouTubeSearchResult[] = [];
  for (const item of items) {
    const videoId = item.id?.videoId;
    if (typeof videoId !== "string") continue;
    results.push({
      videoId,
      title: item.snippet?.title ?? "",
      channel: item.snippet?.channelTitle ?? "",
      thumbnailUrl:
        item.snippet?.thumbnails?.medium?.url ??
        item.snippet?.thumbnails?.default?.url ??
        "",
    });
  }
  return results;
};

/**
 * `search.list` returns no embeddability info, so a second `videos.list`
 * (part=status) resolves it for the whole result set at once. That's 1 quota
 * unit for up to 50 ids — cheap next to search.list's 100 — and lets us drop
 * videos whose owner disabled embedding (e.g. Sing King) before the user can
 * pick one: they'd only fail with IFrame error 150 at playback and auto-skip.
 * Returns the set of ids that are NOT embeddable.
 */
const fetchNonEmbeddableIds = (
  apiKey: string,
  ids: readonly string[]
): Effect.Effect<
  ReadonlySet<string>,
  YouTubeQuotaExceededError | YouTubeUnavailableError
> =>
  Effect.gen(function* () {
    if (ids.length === 0) return new Set<string>();
    const url =
      `${VIDEOS_ENDPOINT}?part=status` +
      `&id=${encodeURIComponent(ids.join(","))}&key=${encodeURIComponent(apiKey)}`;
    const body = yield* fetchYouTubeApi(url);
    const items =
      (
        body as {
          items?: ReadonlyArray<{
            id?: string;
            status?: { embeddable?: boolean };
          }>;
        }
      )?.items ?? [];
    const blocked = new Set<string>();
    for (const item of items) {
      if (item.id && item.status?.embeddable === false) blocked.add(item.id);
    }
    return blocked;
  });

const searchWithKey =
  (apiKey: string) =>
  (
    query: string
  ): Effect.Effect<
    readonly YouTubeSearchResult[],
    YouTubeQuotaExceededError | YouTubeUnavailableError
  > => {
    const q = withKaraokeBias(query);
    const url =
      `${SEARCH_ENDPOINT}?part=snippet&type=video` +
      `&maxResults=${MAX_SEARCH_RESULTS}` +
      `&q=${encodeURIComponent(q)}&key=${encodeURIComponent(apiKey)}`;
    return fetchYouTubeApi(url).pipe(
      Effect.map(mapSearchResponse),
      Effect.flatMap((results) =>
        fetchNonEmbeddableIds(
          apiKey,
          results.map((r) => r.videoId)
        ).pipe(
          Effect.map((blocked) =>
            results.filter((r) => !blocked.has(r.videoId))
          ),
          // Never let the embeddability pass sink an otherwise-good search: if
          // videos.list fails for any reason (quota/network/malformed), fall
          // back to the unfiltered results. catchAllCause (not catchAll) so a
          // defect degrades too. The resolveVideo guard + the player's onError
          // still catch a non-embeddable pick downstream.
          Effect.catchAllCause(() => Effect.succeed(results))
        )
      )
    );
  };

const getVideoWithKey =
  (apiKey: string) =>
  (
    videoId: string
  ): Effect.Effect<
    YouTubeVideoMetadata,
    YouTubeQuotaExceededError | YouTubeUnavailableError | VideoNotFoundError
  > =>
    Effect.gen(function* () {
      const url =
        `${VIDEOS_ENDPOINT}?part=snippet,status,contentDetails` +
        `&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`;
      const body = yield* fetchYouTubeApi(url);
      const item = (body as YouTubeVideosApiResponse | undefined)?.items?.[0];
      if (!item) {
        return yield* Effect.fail(new VideoNotFoundError({ videoId }));
      }
      return {
        videoId,
        title: item.snippet?.title ?? "",
        channel: item.snippet?.channelTitle ?? "",
        thumbnailUrl:
          item.snippet?.thumbnails?.high?.url ??
          item.snippet?.thumbnails?.default?.url ??
          "",
        embeddable: item.status?.embeddable ?? true,
        durationSeconds: item.contentDetails?.duration
          ? parseIsoDuration(item.contentDetails.duration)
          : null,
      };
    });

/**
 * Keyless fallback used when `YOUTUBE_API_KEY` is unset — the public
 * oEmbed endpoint needs no key and returns title/author/thumbnail, but no
 * embeddability or duration. `embeddable` is reported as `true` (unknown,
 * assumed playable) so the caller relies on the player's own `onError`.
 */
const getVideoViaOEmbed = (
  videoId: string
): Effect.Effect<
  YouTubeVideoMetadata,
  YouTubeUnavailableError | VideoNotFoundError
> =>
  Effect.gen(function* () {
    const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    const url = `${OEMBED_ENDPOINT}?url=${encodeURIComponent(watchUrl)}&format=json`;

    const response = yield* Effect.tryPromise({
      try: () => fetch(url),
      catch: (cause) => new YouTubeUnavailableError({ cause }),
    });

    if (response.status === 404) {
      return yield* Effect.fail(new VideoNotFoundError({ videoId }));
    }
    if (!response.ok) {
      return yield* Effect.fail(
        new YouTubeUnavailableError({ cause: { status: response.status } })
      );
    }

    const body = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (cause) => new YouTubeUnavailableError({ cause }),
    });
    const data = body as OEmbedResponse | undefined;

    return {
      videoId,
      title: data?.title ?? "",
      channel: data?.author_name ?? "",
      thumbnailUrl: data?.thumbnail_url ?? "",
      embeddable: true,
      durationSeconds: null,
    };
  });

export const YouTubeLive = Layer.effect(
  YouTube,
  Effect.gen(function* () {
    const env = yield* CloudflareEnv;
    const apiKey = env.YOUTUBE_API_KEY;

    return YouTube.of({
      search: apiKey
        ? searchWithKey(apiKey)
        : () =>
            Effect.fail(
              new ConfigurationError({
                service: "YouTube",
                field: "YOUTUBE_API_KEY",
              })
            ),
      // A key that is set but broken (revoked, malformed, quota-dead) must
      // not be worse than no key at all: if the keyed videos.list call fails
      // for any reason other than "video genuinely doesn't exist", degrade to
      // the keyless oEmbed lookup so paste-a-link keeps working.
      getVideo: apiKey
        ? (videoId) =>
            getVideoWithKey(apiKey)(videoId).pipe(
              Effect.catchTags({
                YouTubeQuotaExceededError: (e) =>
                  Effect.logWarning(
                    "keyed videos.list failed; falling back to oEmbed",
                    e
                  ).pipe(Effect.zipRight(getVideoViaOEmbed(videoId))),
                YouTubeUnavailableError: (e) =>
                  Effect.logWarning(
                    "keyed videos.list failed; falling back to oEmbed",
                    e
                  ).pipe(Effect.zipRight(getVideoViaOEmbed(videoId))),
              })
            )
        : getVideoViaOEmbed,
    });
  })
);

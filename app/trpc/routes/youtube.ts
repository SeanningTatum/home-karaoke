import { Effect, Schema } from "effect";
import { protectedProcedure, createTRPCRouter } from "..";
import { runProcedure } from "@/lib/effect-trpc";
import { YouTube } from "@/services/youtube";
import { SongRepository } from "@/repositories/song";
import {
  YouTubeSearchInput,
  YouTubeResolveVideoInput,
} from "@/lib/schemas/youtube";
import { normalizeSearchQuery, parseYouTubeUrl } from "@/lib/youtube";
import { ValidationError } from "@/models/errors/repository";
import { VideoNotEmbeddableError } from "@/models/errors/youtube";
import type { YouTubeResolveVideoInput as ResolveVideoInput } from "@/lib/schemas/youtube";

// D1 cache freshness window for `search` — a repeat query with at least one
// prior pick inside this window skips the YouTube Data API call entirely
// (search.list costs 100 quota units against a 10k/day default budget, so
// conserving calls matters). Older picks fall through to a fresh API call.
const CACHE_FRESHNESS_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Extracted from the `resolveVideo` procedure so the resolve logic is unit
// testable (see app/trpc/routes/__tests__/youtube.test.ts) with the composable
// `makeTestYouTube` + a stubbed `SongRepository`, without standing up a full
// tRPC caller/runtime. Resolves a picked `videoId` or a pasted `url` into full
// metadata and persists it to the song cache.
//
// Rejects a video whose owner disabled embedding (`embeddable === false`):
// YouTube blocks it in any third-party iframe (IFrame error 150/101), so it
// can never play in our embedded player. `youtube.search` already filters
// these out of results, so this guard mainly protects the paste-a-link path,
// where a user can paste a non-embeddable URL directly. Only the keyed
// `getVideo` reports embeddability; the keyless oEmbed fallback can't, so a
// pasted link resolved via oEmbed is assumed playable and the player's
// `onError` (toast + auto-skip) is the last line of defense.
export const resolveVideoProgram = (input: ResolveVideoInput, userId: string) =>
  Effect.gen(function* () {
    const videoId = input.videoId ?? parseYouTubeUrl(input.url ?? "");
    if (!videoId) {
      return yield* Effect.fail(
        new ValidationError({
          entity: "video",
          field: "url",
          message: "Not a recognizable YouTube URL",
        })
      );
    }

    const yt = yield* YouTube;
    const metadata = yield* yt.getVideo(videoId);

    if (metadata.embeddable === false) {
      return yield* Effect.fail(new VideoNotEmbeddableError({ videoId }));
    }

    const songs = yield* SongRepository;
    yield* songs.upsertSong({
      videoId: metadata.videoId,
      title: metadata.title,
      channel: metadata.channel,
      thumbnailUrl: metadata.thumbnailUrl,
      embeddable: metadata.embeddable,
      durationSeconds: metadata.durationSeconds,
    });

    if (input.searchLogId) {
      yield* songs.markSearchPicked({
        searchLogId: input.searchLogId,
        videoId: metadata.videoId,
        // Scope to the caller — a no-op if the search_log row belongs to a
        // different user, so a pick can't be attributed to someone else's
        // search.
        userId,
      });
    }

    return metadata;
  });

export const youtubeRouter = createTRPCRouter({
  // Anonymous (guest) sessions still satisfy `protectedProcedure` — Better
  // Auth's `anonymous()` plugin creates a real session/user row (just
  // `isAnonymous: true`), so `ctx.auth.user` is non-null exactly like a
  // real account. See app/auth/server.ts.
  search: protectedProcedure
    .input(Schema.standardSchemaV1(YouTubeSearchInput))
    .mutation(({ ctx, input }) =>
      runProcedure(
        ctx.runtime,
        Effect.gen(function* () {
          const songs = yield* SongRepository;
          const normalizedQuery = normalizeSearchQuery(input.query);

          // Cache check first — if this normalized query already produced
          // at least one picked song recently, reuse it instead of
          // spending API quota.
          const cached = yield* songs.getCachedPicks({
            normalizedQuery,
            since: new Date(Date.now() - CACHE_FRESHNESS_DAYS * MS_PER_DAY),
          });

          if (cached.length > 0) {
            return {
              source: "cache" as const,
              results: cached.map((row) => ({
                videoId: row.videoId,
                title: row.title,
                channel: row.channel,
                thumbnailUrl: row.thumbnailUrl,
              })),
            };
          }

          const yt = yield* YouTube;
          const results = yield* yt.search(input.query);

          // The YouTube API call above already spent its quota — a
          // transient D1 write error on the log insert must not turn a
          // successful search into a 500 the client retries (spending
          // another 100-unit quota call for nothing). Degrade gracefully:
          // log the failure and omit `searchLogId` (same optional shape
          // `resolveVideo` already handles for the cache-hit branch).
          const logResult = yield* Effect.either(
            songs.logSearch({
              query: input.query,
              normalizedQuery,
              userId: ctx.auth.user.id,
              roomId: input.roomId,
            })
          );

          if (logResult._tag === "Left") {
            yield* Effect.logError(
              "search_log insert failed after YouTube API call succeeded",
              logResult.left
            );
          }

          // YouTubeQuotaExceededError / YouTubeUnavailableError /
          // ConfigurationError (no key configured) all fall through
          // unhandled here — `tagToTRPC` maps them, and the client reacts
          // by switching to the always-available paste-a-link flow.
          return {
            source: "api" as const,
            results,
            searchLogId:
              logResult._tag === "Right" ? logResult.right.id : undefined,
          };
        })
      )
    ),

  // Called right before the client sends `queue.add` over the room
  // WebSocket — resolves either a picked search result (`videoId`) or a
  // pasted link (`url`) into full metadata, persists it to the `song`
  // cache table, and (when a search produced this pick) marks the
  // `search_log` row so future identical searches hit the D1 cache above.
  resolveVideo: protectedProcedure
    .input(Schema.standardSchemaV1(YouTubeResolveVideoInput))
    .mutation(({ ctx, input }) =>
      runProcedure(ctx.runtime, resolveVideoProgram(input, ctx.auth.user.id))
    ),
});

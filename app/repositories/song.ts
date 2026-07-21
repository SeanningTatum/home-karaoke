import { Effect } from "effect";
import { and, eq, gte, isNotNull } from "drizzle-orm";
import { song, searchLog, roomSong } from "@/db/schema";
import { Database } from "@/services/database";
import {
  tryQuery,
  tryCreate,
  tryUpdate,
  requireFound,
} from "@/lib/effect-utils";

// No tRPC boundary consumes these yet (YouTube search lands in a later
// phase), so these are plain repo-internal input shapes rather than Effect
// Schema — mirrors `FilterProtectedInput` in app/repositories/user.ts.
export interface UpsertSongInput {
  readonly videoId: string;
  readonly title: string;
  readonly channel: string;
  readonly thumbnailUrl: string;
  readonly embeddable: boolean;
  readonly durationSeconds?: number | null;
}

export interface GetSongInput {
  readonly videoId: string;
}

export interface LogSearchInput {
  readonly query: string;
  readonly normalizedQuery: string;
  readonly userId?: string | null;
  readonly roomId?: string | null;
}

export interface MarkSearchPickedInput {
  readonly searchLogId: string;
  readonly videoId: string;
  // Ownership guard: the pick may only mark a search_log row the same user
  // created. Prevents an authenticated caller from attributing a pick to
  // someone else's search (analytics/cache poisoning).
  readonly userId: string;
}

export interface RecordRoomSongInput {
  readonly roomId: string;
  readonly videoId: string;
  readonly singerNickname: string;
  readonly addedByUserId?: string | null;
  // Optional idempotency key reused as the row id. When two dual-screen
  // clients record the same performance they pass the same queue-item id;
  // the second insert collides on the PK and no-ops. Omit for a fresh id.
  readonly id?: string;
}

export interface MarkPlayedInput {
  readonly roomSongId: string;
}

export interface GetCachedPicksInput {
  readonly normalizedQuery: string;
  /** Only consider picks logged on/after this date (search cache freshness window). */
  readonly since: Date;
}

export class SongRepository extends Effect.Service<SongRepository>()(
  "app/SongRepository",
  {
    effect: Effect.gen(function* () {
      const { db } = yield* Database;

      const upsertSong = (input: UpsertSongInput) =>
        tryCreate("song", () =>
          db
            .insert(song)
            .values({
              videoId: input.videoId,
              title: input.title,
              channel: input.channel,
              thumbnailUrl: input.thumbnailUrl,
              embeddable: input.embeddable,
              durationSeconds: input.durationSeconds ?? null,
            })
            .onConflictDoUpdate({
              target: song.videoId,
              set: {
                title: input.title,
                channel: input.channel,
                thumbnailUrl: input.thumbnailUrl,
                embeddable: input.embeddable,
                durationSeconds: input.durationSeconds ?? null,
              },
            })
        );

      const getSong = (input: GetSongInput) =>
        Effect.gen(function* () {
          const rows = yield* tryQuery("song", () =>
            db
              .select()
              .from(song)
              .where(eq(song.videoId, input.videoId))
              .limit(1)
          );
          return yield* requireFound("song", input.videoId, rows[0]);
        });

      const logSearch = (input: LogSearchInput) =>
        Effect.gen(function* () {
          const id = crypto.randomUUID();
          yield* tryCreate("search_log", () =>
            db.insert(searchLog).values({
              id,
              query: input.query,
              normalizedQuery: input.normalizedQuery,
              userId: input.userId ?? null,
              roomId: input.roomId ?? null,
            })
          );
          return { id } as const;
        });

      const markSearchPicked = (input: MarkSearchPickedInput) =>
        tryUpdate("search_log", () =>
          db
            .update(searchLog)
            .set({ pickedVideoId: input.videoId })
            .where(
              and(
                eq(searchLog.id, input.searchLogId),
                eq(searchLog.userId, input.userId)
              )
            )
        );

      const recordRoomSong = (input: RecordRoomSongInput) =>
        Effect.gen(function* () {
          const id = input.id ?? crypto.randomUUID();
          yield* tryCreate("room_song", () =>
            db
              .insert(roomSong)
              .values({
                id,
                roomId: input.roomId,
                videoId: input.videoId,
                singerNickname: input.singerNickname,
                addedByUserId: input.addedByUserId ?? null,
              })
              // Idempotent: a second dual-screen record for the same
              // performance (same queue-item id) is a no-op rather than a
              // duplicate history row.
              .onConflictDoNothing({ target: roomSong.id })
          );
          return { id } as const;
        });

      const markPlayed = (input: MarkPlayedInput) =>
        tryUpdate("room_song", () =>
          db
            .update(roomSong)
            .set({ playedAt: new Date() })
            .where(eq(roomSong.id, input.roomSongId))
        );

      // Cache-hit check for `youtube.search` — songs previously picked for
      // the same normalized query within the freshness window, so a repeat
      // search can skip the YouTube Data API call entirely (quota
      // conservation). Deduped by `groupBy` since multiple search_log rows
      // can point at the same picked video.
      const getCachedPicks = (input: GetCachedPicksInput) =>
        tryQuery("song", () =>
          db
            .select({
              videoId: song.videoId,
              title: song.title,
              channel: song.channel,
              thumbnailUrl: song.thumbnailUrl,
              embeddable: song.embeddable,
              durationSeconds: song.durationSeconds,
            })
            .from(searchLog)
            .innerJoin(song, eq(searchLog.pickedVideoId, song.videoId))
            .where(
              and(
                eq(searchLog.normalizedQuery, input.normalizedQuery),
                isNotNull(searchLog.pickedVideoId),
                gte(searchLog.createdAt, input.since),
                // Never surface a non-embeddable pick from the cache: it can't
                // play in the embedded player (IFrame error 150), same as the
                // live-search filter in app/services/youtube.ts.
                eq(song.embeddable, true)
              )
            )
            .groupBy(song.videoId)
        );

      return {
        upsertSong,
        getSong,
        logSearch,
        markSearchPicked,
        recordRoomSong,
        markPlayed,
        getCachedPicks,
      } as const;
    }),
  }
) {}

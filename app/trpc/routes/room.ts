import { Effect, Schema } from "effect";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, createTRPCRouter } from "..";
import { runProcedure } from "@/lib/effect-trpc";
import { RoomRepository } from "@/repositories/room";
import { SongRepository } from "@/repositories/song";
import {
  CreateRoomInput,
  GetRoomByCodeInput,
  CloseRoomInput,
  RecordPlayedInput,
} from "@/lib/schemas/room";

export const roomRouter = createTRPCRouter({
  // Host must be a real account — anonymous guest sessions (Better Auth
  // `anonymous` plugin) pass `protectedProcedure` like any session, so this
  // explicitly rejects them: a guest who scanned a QR should never be able
  // to spin up rooms of their own.
  create: protectedProcedure
    .input(Schema.standardSchemaV1(CreateRoomInput))
    .mutation(({ ctx, input }) =>
      runProcedure(
        ctx.runtime,
        Effect.gen(function* () {
          if (ctx.auth.user.isAnonymous) {
            return yield* Effect.fail(
              new TRPCError({
                code: "FORBIDDEN",
                message: "Sign up for an account to host a room",
              })
            );
          }
          const repo = yield* RoomRepository;
          return yield* repo.createRoom({
            ...input,
            hostUserId: ctx.auth.user.id,
          });
        })
      )
    ),

  // Public — guests need to resolve a room by code before they're
  // authenticated at all.
  get: publicProcedure
    .input(Schema.standardSchemaV1(GetRoomByCodeInput))
    .query(({ ctx, input }) =>
      runProcedure(
        ctx.runtime,
        Effect.gen(function* () {
          const repo = yield* RoomRepository;
          const { hostUserId, ...room } = yield* repo.getRoomByCode(input);
          // `room.get` is public (guests resolve a room before they auth),
          // so never leak the host's internal user id to callers. Derive
          // the only thing the client needs — whether the caller is the
          // host — from the session server-side.
          return { ...room, isHost: ctx.auth?.user.id === hostUserId };
        })
      )
    ),

  // Only the host may close their own room. This is procedure-specific
  // authorization control flow (not a domain/repo-level tagged error), so
  // per `.brain/rules/errors.md`'s stated exception it fails with a
  // TRPCError directly — `Effect.fail`, never `throw`, and `toTRPC` passes
  // pre-existing TRPCErrors straight through.
  close: protectedProcedure
    .input(Schema.standardSchemaV1(CloseRoomInput))
    .mutation(({ ctx, input }) =>
      runProcedure(
        ctx.runtime,
        Effect.gen(function* () {
          const repo = yield* RoomRepository;
          const existing = yield* repo.getRoomById({ roomId: input.roomId });
          if (existing.hostUserId !== ctx.auth.user.id) {
            return yield* Effect.fail(
              new TRPCError({
                code: "FORBIDDEN",
                message: "Only the host can close this room",
              })
            );
          }
          return yield* repo.closeRoom(input);
        })
      )
    ),

  // Host-only. Called by the host client right before it sends
  // `playback.videoEnded` / `playback.skip` over the room WebSocket —
  // records the song that just finished/was skipped into `room_song`
  // history via `SongRepository.recordRoomSong` + `markPlayed`. Kept in
  // the Effect/repo layer (rather than a DO-side D1 write) so history
  // writes go through the same tested repository path as every other
  // mutation.
  recordPlayed: protectedProcedure
    .input(Schema.standardSchemaV1(RecordPlayedInput))
    .mutation(({ ctx, input }) =>
      runProcedure(
        ctx.runtime,
        Effect.gen(function* () {
          const rooms = yield* RoomRepository;
          const existing = yield* rooms.getRoomById({ roomId: input.roomId });
          if (existing.hostUserId !== ctx.auth.user.id) {
            return yield* Effect.fail(
              new TRPCError({
                code: "FORBIDDEN",
                message: "Only the host can record play history",
              })
            );
          }

          const songs = yield* SongRepository;
          const { id } = yield* songs.recordRoomSong({
            roomId: input.roomId,
            videoId: input.videoId,
            singerNickname: input.singerNickname,
            addedByUserId: input.addedByUserId ?? null,
            // Reuse the queue-item id so two dual-screen record calls for
            // the same performance collide on the PK — the second no-ops.
            id: input.queueItemId,
          });
          yield* songs.markPlayed({ roomSongId: id });
          return { success: true } as const;
        })
      )
    ),
});

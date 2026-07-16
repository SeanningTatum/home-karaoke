import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { room, type Room } from "@/db/schema";
import { Database } from "@/services/database";
import { tryQuery, tryCreate, tryUpdate, requireFoundOrFail } from "@/lib/effect-utils";
import { RoomNotFoundError, RoomClosedError } from "@/models/errors/room";
import { generateRoomCode } from "@/lib/room-code";
import type {
  CreateRoomInput,
  CloseRoomInput,
  UpdateGuestReorderInput,
} from "@/lib/schemas/room";

const MAX_CODE_COLLISION_RETRIES = 3;

/**
 * Guard for mutations that must not run against a closed room (e.g.
 * queueing a song). Not wired into any Phase-1 repo method yet — closing a
 * room itself is idempotent (see `closeRoom` below) — but exported as a
 * pure, directly-testable helper for callers that need the fail-fast
 * behavior (Phase 2 queue mutations).
 */
export const failIfClosed = <T extends Pick<Room, "id" | "status">>(
  target: T
): Effect.Effect<T, RoomClosedError> =>
  target.status === "closed"
    ? Effect.fail(new RoomClosedError({ roomId: target.id }))
    : Effect.succeed(target);

export class RoomRepository extends Effect.Service<RoomRepository>()(
  "app/RoomRepository",
  {
    effect: Effect.gen(function* () {
      const { db } = yield* Database;

      const findRoomByCode = (code: string) =>
        Effect.gen(function* () {
          const rows = yield* tryQuery("room", () =>
            db.select().from(room).where(eq(room.code, code)).limit(1)
          );
          return rows[0];
        });

      const getRoomByCode = (input: { code: string }) =>
        Effect.gen(function* () {
          const found = yield* findRoomByCode(input.code);
          return yield* requireFoundOrFail(
            found,
            () => new RoomNotFoundError({ identifier: input.code })
          );
        });

      const getRoomById = (input: { roomId: string }) =>
        Effect.gen(function* () {
          const rows = yield* tryQuery("room", () =>
            db.select().from(room).where(eq(room.id, input.roomId)).limit(1)
          );
          return yield* requireFoundOrFail(
            rows[0],
            () => new RoomNotFoundError({ identifier: input.roomId })
          );
        });

      const generateUniqueCode = () =>
        Effect.gen(function* () {
          for (let attempt = 0; attempt <= MAX_CODE_COLLISION_RETRIES; attempt++) {
            const candidate = generateRoomCode();
            const existing = yield* findRoomByCode(candidate);
            if (!existing) return candidate;
          }
          // Exhausted retries — astronomically unlikely given the 31^6
          // keyspace. Return one more candidate rather than blocking room
          // creation; a genuine collision would surface as a CreationError
          // from the unique index violation on insert.
          return generateRoomCode();
        });

      const createRoom = (input: CreateRoomInput & { hostUserId: string }) =>
        Effect.gen(function* () {
          const code = yield* generateUniqueCode();
          const id = crypto.randomUUID();
          yield* tryCreate("room", () =>
            db.insert(room).values({
              id,
              code,
              hostUserId: input.hostUserId,
              allowGuestReorder: input.allowGuestReorder ?? false,
            })
          );
          return yield* getRoomById({ roomId: id });
        });

      const closeRoom = (input: CloseRoomInput) =>
        Effect.gen(function* () {
          const found = yield* getRoomById({ roomId: input.roomId });
          if (found.status === "closed") {
            // Idempotent — closing an already-closed room is a no-op
            // success rather than a RoomClosedError, matching the
            // `unbanUser`-style idempotency used elsewhere in the repo
            // layer.
            return found;
          }
          yield* tryUpdate("room", () =>
            db
              .update(room)
              .set({ status: "closed", closedAt: new Date() })
              .where(eq(room.id, input.roomId))
          );
          return yield* getRoomById({ roomId: input.roomId });
        });

      const updateGuestReorder = (input: UpdateGuestReorderInput) =>
        Effect.gen(function* () {
          yield* getRoomById({ roomId: input.roomId });
          yield* tryUpdate("room", () =>
            db
              .update(room)
              .set({ allowGuestReorder: input.allowGuestReorder })
              .where(eq(room.id, input.roomId))
          );
          return yield* getRoomById({ roomId: input.roomId });
        });

      return {
        createRoom,
        getRoomByCode,
        getRoomById,
        closeRoom,
        updateGuestReorder,
      } as const;
    }),
  }
) {}

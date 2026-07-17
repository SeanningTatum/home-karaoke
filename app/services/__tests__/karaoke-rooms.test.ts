import { describe, expect, vi } from "vitest";
import { it } from "@effect/vitest";
import { Effect, Exit, Cause, Layer } from "effect";
import { KaraokeRooms, KaraokeRoomsLive } from "../karaoke-rooms";
import { CloudflareEnv } from "../cloudflare";
import {
  ConfigurationError,
  ExternalServiceError,
} from "@/models/errors/repository";

type KaraokeRoomNamespace = Env["KARAOKE_ROOM"];

const envLayer = (namespace: Partial<KaraokeRoomNamespace>) =>
  Layer.succeed(CloudflareEnv, {
    KARAOKE_ROOM: namespace as KaraokeRoomNamespace,
  } as Env);

describe("KaraokeRoomsLive.notifyRoomClosed", () => {
  it.effect("resolves the stub by room id and calls closeRoom", () =>
    Effect.gen(function* () {
      const closeRoom = vi.fn(async () => {});
      const idFromName = vi.fn((name: string) => name as unknown);
      const get = vi.fn(() => ({ closeRoom }));

      const rooms = yield* KaraokeRooms.pipe(
        Effect.provide(
          KaraokeRoomsLive.pipe(
            Layer.provide(
              envLayer({
                idFromName: idFromName as KaraokeRoomNamespace["idFromName"],
                get: get as unknown as KaraokeRoomNamespace["get"],
              })
            )
          )
        )
      );
      yield* rooms.notifyRoomClosed("room-1");

      expect(idFromName).toHaveBeenCalledWith("room-1");
      expect(get).toHaveBeenCalledTimes(1);
      expect(closeRoom).toHaveBeenCalledTimes(1);
    })
  );

  it.effect("fails with ExternalServiceError when the DO call rejects", () =>
    Effect.gen(function* () {
      const rooms = yield* KaraokeRooms.pipe(
        Effect.provide(
          KaraokeRoomsLive.pipe(
            Layer.provide(
              envLayer({
                idFromName: ((name: string) =>
                  name) as unknown as KaraokeRoomNamespace["idFromName"],
                get: (() => ({
                  closeRoom: async () => {
                    throw new Error("boom");
                  },
                })) as unknown as KaraokeRoomNamespace["get"],
              })
            )
          )
        )
      );
      const exit = yield* Effect.exit(rooms.notifyRoomClosed("room-1"));
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.failureOption(exit.cause);
        if (failure._tag === "Some") {
          expect(failure.value).toBeInstanceOf(ExternalServiceError);
          expect((failure.value as ExternalServiceError).service).toBe(
            "KaraokeRoomDO"
          );
        }
      }
    })
  );

  it.effect("fails with ConfigurationError when KARAOKE_ROOM binding is missing", () =>
    Effect.gen(function* () {
      const program = KaraokeRooms.pipe(
        Effect.provide(
          KaraokeRoomsLive.pipe(
            Layer.provide(Layer.succeed(CloudflareEnv, {} as Env))
          )
        )
      );
      const exit = yield* Effect.exit(program);
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.failureOption(exit.cause);
        if (failure._tag === "Some") {
          expect(failure.value).toBeInstanceOf(ConfigurationError);
          expect((failure.value as ConfigurationError).service).toBe(
            "KaraokeRooms"
          );
          expect((failure.value as ConfigurationError).field).toBe(
            "KARAOKE_ROOM"
          );
        }
      }
    })
  );
});

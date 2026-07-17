import { Context, Effect, Layer } from "effect";
import { CloudflareEnv } from "./cloudflare";
import {
  ConfigurationError,
  ExternalServiceError,
} from "@/models/errors/repository";

// Wraps the `KARAOKE_ROOM` Durable Object namespace so Effect code (tRPC
// procedures) can reach a room's live DO without touching the raw binding.
// The WS upgrade path (`app/routes/api/room.$code.ws.ts`) still forwards the
// raw Request itself — WebSocket upgrades can't round-trip through RPC — so
// this service only carries the non-upgrade calls. DOs are addressed by the
// D1 `room.id` via `idFromName`, same as the upgrade route.

export interface KaraokeRoomsShape {
  /**
   * Tell the room's DO the room is closed: it broadcasts `room.closed` to
   * every connected socket, hangs them up, and resets its live state. The
   * D1 row is closed by the caller through `RoomRepository` first — this is
   * the live-notify half only.
   */
  readonly notifyRoomClosed: (
    roomId: string
  ) => Effect.Effect<void, ExternalServiceError>;
}

export class KaraokeRooms extends Context.Tag("app/KaraokeRooms")<
  KaraokeRooms,
  KaraokeRoomsShape
>() {}

export const KaraokeRoomsLive = Layer.effect(
  KaraokeRooms,
  Effect.gen(function* () {
    const env = yield* CloudflareEnv;
    // Declared non-optional in the generated Env type, but (like BUCKET /
    // EXAMPLE_WORKFLOW) the binding can be absent from an actual deployment
    // — fail fast with a typed ConfigurationError.
    if (!env.KARAOKE_ROOM) {
      return yield* Effect.fail(
        new ConfigurationError({ service: "KaraokeRooms", field: "KARAOKE_ROOM" })
      );
    }
    return {
      notifyRoomClosed: (roomId) =>
        Effect.tryPromise({
          try: () =>
            env.KARAOKE_ROOM.get(
              env.KARAOKE_ROOM.idFromName(roomId)
            ).closeRoom(),
          catch: (cause) =>
            new ExternalServiceError({ service: "KaraokeRoomDO", cause }),
        }),
    };
  })
);

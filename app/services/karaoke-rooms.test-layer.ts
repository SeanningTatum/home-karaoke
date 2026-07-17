import { Layer } from "effect";
import { KaraokeRooms, type KaraokeRoomsShape } from "./karaoke-rooms";

/**
 * Test layer mirror (see `database.test-layer.ts`) — lets callers (tRPC
 * route tests, future consumers) swap in a stub `KaraokeRooms` shape without
 * going through `KaraokeRoomsLive`'s `CloudflareEnv` + DO-namespace plumbing.
 */
export const makeTestKaraokeRooms = (
  stub: Partial<KaraokeRoomsShape>
): Layer.Layer<KaraokeRooms> =>
  Layer.succeed(KaraokeRooms, stub as KaraokeRoomsShape);

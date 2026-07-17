import { Layer, ManagedRuntime } from "effect";
import { CloudflareEnvLive } from "@/services/cloudflare";
import { DatabaseLive, type Database } from "@/services/database";
import { BucketLive, type Bucket } from "@/services/bucket";
import { AuthApiLive, type AuthApi as AuthApiTag } from "@/services/auth";
import { WorkflowsLive, type Workflows } from "@/services/workflows";
import { YouTubeLive, type YouTube } from "@/services/youtube";
import { KaraokeRoomsLive, type KaraokeRooms } from "@/services/karaoke-rooms";
import { LoggerLive, MinLogLevelLive } from "@/services/logger";
import { UserRepository } from "@/repositories/user";
import { BucketRepository } from "@/repositories/bucket";
import { RoomRepository } from "@/repositories/room";
import { SongRepository } from "@/repositories/song";

export type AppServices =
  | Database
  | Bucket
  | AuthApiTag
  | Workflows
  | YouTube
  | KaraokeRooms
  | UserRepository
  | BucketRepository
  | RoomRepository
  | SongRepository;

// `baseURL` is the request's own origin — threaded through to Better Auth
// via `AuthApiLive(baseURL)` so the single construction path (Effect.try →
// ExternalServiceError, unit-tested in services/__tests__/auth.test.ts) is
// used in production too. No more raw `createAuth(...)` call outside Effect.
export const makeAppRuntime = (env: Env, baseURL?: string) => {
  const baseLayer = Layer.mergeAll(
    DatabaseLive,
    BucketLive,
    AuthApiLive(baseURL),
    WorkflowsLive,
    YouTubeLive,
    KaraokeRoomsLive
  );
  const reposLayer = Layer.mergeAll(
    UserRepository.Default,
    BucketRepository.Default,
    RoomRepository.Default,
    SongRepository.Default
  );
  const layer = reposLayer
    .pipe(Layer.provideMerge(baseLayer))
    .pipe(Layer.provide(CloudflareEnvLive(env)))
    .pipe(Layer.provideMerge(Layer.merge(LoggerLive, MinLogLevelLive)));
  return ManagedRuntime.make(layer);
};

export type AppRuntime = ReturnType<typeof makeAppRuntime>;

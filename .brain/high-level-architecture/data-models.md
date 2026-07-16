# Data Models

## Schema location

**Source of truth:** [`app/db/schema.ts`](../../app/db/schema.ts). Always read it directly for current column lists.

## Tables

| Table | Purpose | Key relations |
|-------|---------|---------------|
| `user` | Core user with role + ban fields, plus `isAnonymous` (nullable boolean, no default) — set by Better Auth's `anonymous` plugin when a guest joins via `signIn.anonymous()` | Referenced by `session.userId`, `account.userId` |
| `session` | Active sessions (Better Auth) | `userId → user.id` (cascade), `impersonatedBy` (admin user id, no FK) |
| `account` | Credential / OAuth accounts | `userId → user.id` (cascade) |
| `verification` | Email verification tokens | Linked logically by `identifier` (email) |
| `room` | Group-karaoke room (feat-007) — `code` (unique join code), `hostUserId`, `status`, `allowGuestReorder`, `createdAt`/`closedAt` | `hostUserId → user.id`; referenced by `search_log.roomId`, `room_song.roomId` |
| `song` | Growing YouTube metadata cache, one row per distinct video ever searched/queued across all rooms — `videoId` (PK), `title`, `channel`, `thumbnailUrl`, `embeddable`, `durationSeconds` | Referenced by `search_log.pickedVideoId`, `room_song.videoId` |
| `search_log` | One row per YouTube search — `query`, `normalizedQuery` (indexed, backs the 7-day cache join), `userId`, `roomId`, `pickedVideoId` | `roomId → room.id` (set null), `pickedVideoId → song.videoId` (set null) |
| `room_song` | Per-room queue/play history — `roomId`, `videoId`, `singerNickname`, `addedByUserId`, `playedAt`, `createdAt` | `roomId → room.id` (cascade), `videoId → song.videoId` (cascade), `addedByUserId → user.id` |

Better Auth's drizzle adapter owns `user`/`session`/`account`/`verification`. `room`/`song`/`search_log`/`room_song` are the first app-specific business tables, added for the group-karaoke feature (feat-007) — see [`../features/group-karaoke/group-karaoke.md`](../features/group-karaoke/group-karaoke.md).

## Entity relationships

```
user ◄─────┬───── session   (userId, impersonatedBy)
           │
           ├───── account   (userId)
           │
           ├─ ─ ─ verification (by identifier=email, no FK)
           │
           └───── room       (hostUserId)
                    │
                    ├───── search_log (roomId, set null)
                    │           │
                    │           └───── song (pickedVideoId, set null)
                    │
                    └───── room_song  (roomId, cascade)
                                │
                                └───── song (videoId, cascade)
```

## Durable Object live state vs D1 (group-karaoke)

`KaraokeRoom` (a raw Durable Object, `KARAOKE_ROOM` binding, SQLite storage) holds the **live** state for an open room — queue, playback (play/pause/current position), and roster (connected guests) — as an in-memory `RoomLiveState` object (`app/lib/room-state.ts`) persisted to the DO's own SQLite storage (not D1) so it survives hibernation/eviction. This state is **ephemeral**: it exists only while the room is open and is discarded when the room closes (idle timeout or host-initiated close).

D1 is the **durable** record: the `room` row (status/`allowGuestReorder`/timestamps) and `room_song` history (who sang what, when) persist across room lifetimes and are what `RoomRepository`/`SongRepository` read and write. The DO never talks to D1 directly for live-state mutations — it seeds its initial `allowGuestReorder` from an `x-allow-guest-reorder` header set by the WS upgrade route (`app/routes/api/room.$code.ws.ts`) reading the D1 row, and it calls back into D1 only to close the room row on idle timeout (`alarm()` → `closeRoomInD1`). Play-history writes (`room_song` insert + `markPlayed`) go through the tRPC `room.recordPlayed` procedure → `SongRepository`, not through the DO.

## SQLite / Drizzle conventions

- **Booleans**: `integer("col", { mode: "boolean" })` (stored as 0/1)
- **Timestamps**: `integer("col", { mode: "timestamp_ms" })` — Date ↔ ms-since-epoch. Default via `sql\`(cast(unixepoch('subsecond') * 1000 as integer))\`` for `createdAt` / `updatedAt`. `$onUpdate(() => new Date())` for `updatedAt`.
- **Enums**: `text("col", { enum: [...] })` — e.g. `user.role: "user" | "admin"`
- **JSON**: `text("col", { mode: "json" }).$type<T>()`
- **Foreign keys**: `references(() => parent.id, { onDelete: "cascade" })`. Always specify `onDelete`.
- **SQL identifiers**: `snake_case`. **TypeScript variables**: `camelCase`.

## Inferred types

```typescript
export type User = typeof user.$inferSelect;
export type UpdateUserInput = typeof user.$inferInsert;
```

Repository input types use Effect Schema in `app/lib/schemas/{domain}.ts` — those are the **canonical** input shapes for procedures and repos. Inferred Drizzle types are for raw row shape only.

## Migrations

- **Location**: `drizzle/`
- **Generate**: `bun run db:generate`
- **Apply locally**: `bun run db:migrate:local` (auto-runs on `bun run dev`)
- **Apply remote**: `bun run db:migrate:remote`
- **Studio**: `bun run db:studio`

See [`../rules/repository.md`](../rules/repository.md) for the full Drizzle pattern.

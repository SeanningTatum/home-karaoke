# Feature: Guest Avatars

_Last updated: 2026-07-17_

_Status: in-progress (design in flight) — see `.brain/runs/2026-07-17-guest-avatars.md`_

## Purpose

Guests upload a profile picture on `/join/:code`; the avatar renders in the host TV lobby roster, compact roster strip, queue rail, lobby queue summary, and now-up overlay, falling back to a gradient `InitialsAvatar` when no photo is set. Stored in R2 (existing `BUCKET` binding + `BucketRepository`), the serving URL is persisted on the Better Auth `user.image` column, and threaded live into the `KaraokeRoom` Durable Object via an `x-avatar-url` WS header into `RosterEntry.avatarUrl` / `QueueItem.singerAvatarUrl`.

## When It's Used

- Guest sets a photo at the nickname step on `/join/:code` (alongside anonymous sign-in + nickname entry).
- Host TV (`/room/:code`) and all room surfaces display it: lobby roster tiles, compact roster strip, queue rail singer chips, lobby queue summary, and the "you're up" now-up overlay.

## How It Works

TODO — fill in once the architecture pass (opus code-architect) and build phases land. Expected shape per exploration in the run note: guest upload → new non-tRPC HTTP route (formData → `BucketRepository.upload`, R2 key under `avatars/` prefix) → serving URL written to `user.image` → `room.$code.ws.ts` reads `session.user.image` and forwards `x-avatar-url` header to the DO → `SessionAttachment`/`RosterEntry`/`QueueItem` carry `avatarUrl` → UI components swap `InitialsAvatar` for `AvatarImage` when present.

### Persistence details

- **R2**: object stored under an `avatars/` prefix via the existing `BUCKET` binding (`wrangler.jsonc`) + `BucketRepository` (`app/repositories/bucket.ts`) — repo layer already exists and is unit-tested; upload HTTP route + serve/GET route do not exist yet (deleted with feat-003 file-upload, need to be re-added for this feature per `.brain/rules/routes.md` non-tRPC route convention).
- **D1**: serving URL stored on the existing `user.image` column (`app/db/schema.ts`) — nullable, already read (unused) by admin `AvatarImage`; no write path exists yet.
- **Live state (ephemeral)**: `avatarUrl` rides in the `KaraokeRoom` DO's in-memory roster/queue state — `RosterEntry.avatarUrl`, `QueueItem.singerAvatarUrl` — sourced from the `x-avatar-url` WS header on room join, not independently persisted by the DO. Lost on DO restart aside from what's re-derived from `user.image` on reconnect.

### Testability

TODO — unit tests for repo/service/route once built; feature-verifier browser walk before ship. Link verification doc here once written: `.brain/features/guest-avatars/verifications/<date>.md`.

## Key Files

TODO — fill in as build phases land. Known-relevant files from exploration (see run note for file:line detail):

| File | Role |
|------|------|
| `app/repositories/bucket.ts` | R2 upload/get/remove/list — exists, unchanged |
| `app/services/bucket.ts` | `Bucket` Effect Tag + Live layer — exists, unchanged |
| `app/db/schema.ts` | `user.image` column — exists, needs a write path |
| `app/routes/api/room.$code.ws.ts` | WS upgrade route — needs `x-avatar-url` header forward |
| `app/durable-objects/karaoke-room.ts` | DO — needs `avatarUrl` on `SessionAttachment` + roster |
| `app/lib/room-ws.ts` | `QueueItem` / `RosterEntry` schemas — need `avatarUrl` fields |
| `app/lib/room-state.ts` | Pure reducers — need avatar passthrough on add/roster |
| `app/routes/join/$code.tsx`, `app/components/nickname-form.tsx` | Guest nickname step — needs upload UI |
| `app/components/initials-avatar.tsx`, `app/components/ui/avatar.tsx` | Fallback + `AvatarImage` (unused today) |
| `app/components/roster-strip.tsx`, `queue-rail.tsx`, `now-up-overlay.tsx` | Render targets |

## Dependencies

- Effect services consumed: `Bucket`, likely `Database` (for `user.image` write), `Session`.
- Other repositories: `BucketRepository`; a user/auth repository for the `image` write.
- External SDKs / CF bindings: R2 `BUCKET` binding.
- UI primitives: `Avatar` / `AvatarImage` (shadcn, currently unused), `InitialsAvatar`.

## Tagged Errors

TODO — likely reuses `app/models/errors/bucket.ts` (7 existing tagged errors, already in `tagToTRPC`) plus any new upload-route-specific errors.

| Error | Where raised | tRPC code |
|-------|--------------|-----------|
| TODO | TODO | TODO |

## Changelog

| Date | Type | Description |
|------|------|--------------|
| 2026-07-17 | feature | Scoped feat-010; design in flight — exploration complete (R2/upload infra + identity/roster path mapped), opus architecture pass next. |

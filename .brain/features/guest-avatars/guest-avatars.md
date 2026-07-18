# Feature: Guest Avatars

_Last updated: 2026-07-17_

_Status: implementation complete (Phases 1-4), enforcer clean, browser-walk verified — [`verifications/2026-07-17.md`](verifications/2026-07-17.md) **PASS** (12/12 golden-path steps + error path). See `.brain/runs/2026-07-17-guest-avatars.md` and plan `plans/guest-avatars.html` (reviewed round 1, 5/5 decisions on recommended options)._

## Purpose

Guests upload a profile picture on `/join/:code`; the avatar renders in the host TV lobby roster, compact roster strip, queue rail, lobby queue summary, and now-up overlay, falling back to a gradient `InitialsAvatar` when no photo is set. Stored in R2 (existing `BUCKET` binding + `BucketRepository`), the serving URL is persisted on the Better Auth `user.image` column, and threaded live into the `KaraokeRoom` Durable Object via an `x-avatar-url` WS header into `RosterEntry.avatarUrl` / `QueueItem.singerAvatarUrl`.

## When It's Used

- Guest sets a photo at the nickname step on `/join/:code` (alongside anonymous sign-in + nickname entry). Optional and skippable; join never blocks on a failed upload.
- Host TV (`/room/:code`) and all room surfaces display it: lobby roster tiles, compact roster strip, queue rail singer chips, lobby queue summary, and the "you're up" now-up overlay.

## How It Works

- **Capture (client)**: the nickname form's avatar preview is a button that opens a hidden `<input type="file" accept="image/jpeg,image/png,image/webp">` (no `capture` attr — OS sheet offers camera or gallery, per plan decision 5). The selected file is downscaled client-side to a 512px center-cropped square JPEG (q0.85) via `downscaleAvatar` (`createImageBitmap` + canvas + pure `computeCoverCrop`), previewed via object URL (revoked on replace/remove/unmount). Pre-downscale type/size guards reuse `isAllowedAvatarType`/`isWithinAvatarSize`.
- **Upload**: on submit, after the existing session flow (`signIn.anonymous()` when needed + `updateUser({ name })`), the Blob is POSTed to `/api/avatar` (multipart, field `file`) **best-effort** — failure shows an inline i18n error but still calls `onJoined`.
- **Upload route** (`POST /api/avatar`, non-tRPC HTTP boundary per `.brain/rules/routes.md`): Better Auth session resolved outside the Effect (401 without one); the Effect program validates `File` instance / content type / ≤2MB (`ValidationError`, `BucketValidationError` → 400 via `Effect.catchTags`), uploads to the **stable key** `avatars/${userId}` (re-upload overwrites atomically — zero orphans), then writes the **versioned relative URL** `/api/avatar/${userId}?v=${Date.now()}` to `user.image` via `UserRepository.setUserImage` — atomic with the put, and the key is derived from the authenticated `session.user.id` so a guest can only overwrite their own photo. `runPromiseExit` + `Exit.match` → generic 500 on unhandled failures (incl. `BucketBindingError`, which is a layer-construction failure outside the E channel).
- **Serve route** (`GET /api/avatar/:userId`, public): streams the R2 body with `Content-Type` from `httpMetadata`, `Cache-Control: public, max-age=31536000, immutable` (safe because every emitted URL carries `?v=`; the loader ignores the query and reads the stable key), `ETag` from `httpEtag`; `BucketNotFoundError` → 404 (Radix `Avatar` auto-falls-back to initials). Public is safe — `userId` is already broadcast in room state.
- **Live threading**: the WS upgrade route forwards `x-avatar-url: session.user.image ?? ""`; the DO stores `avatarUrl` on `SessionAttachment` (hibernation-serialized) and passes it into `addToRoster` (→ `RosterEntry.avatarUrl`) and the `applyClientMessage` ctx (`queue.add` → `QueueItem.singerAvatarUrl`). `use-room-socket` needs zero changes — decoded fields flow through verbatim.
- **Backward compatibility (hibernation safety)**: wire fields are `Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null })` — an **absent** key (old hibernated DO state, old clients) decodes to `null`; `isSessionAttachment` does not require `avatarUrl` and reads coalesce `?? null`, so old attachments never fail the guard.
- **Mid-room photo change is out of scope** (plan decision 4): avatar is captured into roster/queue entries at connect/add time; changing it applies on the next connect. No re-broadcast path.
- **Anon-avatar cleanup deferred** (plan review): R2 cleanup for anonymous users who never upgrade rides with the planned future "create an account at session end to save your session/name" feature, not this one.

### Persistence details

- **R2**: one object per user at stable key `avatars/${userId}` via the existing `BUCKET` binding + `BucketRepository.upload` (caller-supplied key + contentType).
- **D1**: versioned relative serving URL on the existing `user.image` column (no migration needed) — written only by `UserRepository.setUserImage` from the upload action.
- **Live state (ephemeral)**: `avatarUrl` rides in the DO's roster/queue state, sourced from the `x-avatar-url` header at WS connect; re-derived from `user.image` on reconnect.
- **Seed data**: fixtures intentionally stay photo-less (plan review round 1) — initials is a valid seeded state; the photo path is covered by the live feature-verifier walk.

### Testability

- Unit (458 tests total after Phase 4, from 429 baseline): `avatar.ts` helpers (type allow/deny, size boundary at MAX/MAX+1, key + URL format — 13 tests), `computeCoverCrop` (landscape/portrait/square/centering — 5 tests), `UserRepository.setUserImage` (set / null-clear / UpdateError), room-state reducers carry `singerAvatarUrl`/`avatarUrl` (string + null), room-ws decode with the avatar field **present / null / absent→null** (the hibernation-compat guard).
- `downscale.ts` is a documented untested browser boundary (vitest runs in node — no canvas), kept deliberately thin.
- effect-ts-enforcer sweep of the full diff: 0 critical / 0 major / 0 minor.
- Feature-verifier browser walk: **PASS** — [`verifications/2026-07-17.md`](verifications/2026-07-17.md). 12/12 golden-path steps (host create → guest photo upload w/ live preview → join → photo in lobby roster over WS → paste-link song add → photo chip in queue summary → playback via phone Controls tab → photo in playing-state compact strip → photo-less second guest shows initials fallback side-by-side → `GET /api/avatar/:userId` 200 with immutable Cache-Control). Error path: `.txt` upload → inline type error, join proceeds photo-less. Zero app-origin network errors across 3 runs; one recurring `caret-color` hydration warning confirmed as browser/OS artifact (not app code). Known verifier notes: dev-only Vite lazy-chunk reload race (not an app defect); TV screen has no direct play control — playback starts from the phone Controls tab.

## Key Files

| File | Role |
|------|------|
| `app/lib/avatar.ts` (+ test) | Pure helpers — `MAX_AVATAR_BYTES` (2MB), `ALLOWED_AVATAR_TYPES` (jpeg/png/webp), `isAllowedAvatarType`, `isWithinAvatarSize`, `avatarKey`, `avatarImageUrl` |
| `app/lib/image/crop.ts` (+ test) | Pure `computeCoverCrop` center-crop-to-square math |
| `app/lib/image/downscale.ts` | Client-only canvas wrapper `downscaleAvatar(file, 512, 0.85)` — untested browser boundary |
| `app/routes/api/avatar.ts` | POST upload action (session-gated, validate, R2 put, `setUserImage`) |
| `app/routes/api/avatar.$userId.ts` | Public GET loader — streams R2 object, immutable cache, ETag, 404 fallback |
| `app/routes.ts` | Both routes registered flat next to `/api/room/:code/ws` |
| `app/lib/schemas/user.ts` | `SetUserImageInput` Effect Schema |
| `app/repositories/user.ts` (+ test) | `setUserImage` via `tryUpdate`/Drizzle |
| `app/lib/schemas/room-ws.ts` | `QueueItem.singerAvatarUrl` + `RosterEntry.avatarUrl` (`optionalWith` null default) |
| `app/lib/room-state.ts` | `AddToQueueInput.singerAvatarUrl`, `ApplyContext.avatarUrl`, `queue.add` threading |
| `app/durable-objects/karaoke-room.ts` | `SessionAttachment.avatarUrl` (guard unchanged), `x-avatar-url` header read, roster/ctx threading |
| `app/routes/api/room.$code.ws.ts` | Forwards `x-avatar-url` from `session.user.image` |
| `app/components/room/initials-avatar.tsx` | Optional `src` prop — `AvatarImage` before gradient `AvatarFallback` |
| `app/components/join/nickname-form.tsx` | Photo picker, preview, best-effort upload, i18n errors |
| `app/components/room/roster-strip.tsx`, `queue-rail.tsx`, `now-up-overlay.tsx`, `app/routes/room/$code.tsx` | Display wiring (5 surfaces) |
| `app/lib/now-up-overlay-state.ts` | `NowUpSinger.avatarUrl` (shared overlay state type) |
| `app/locales/en/room.json`, `app/locales/zh/room.json` | `join.avatar.*` keys |

## Dependencies

- Effect services consumed: `Bucket` (via `BucketRepository`), `Database` (via `UserRepository`), Better Auth (`context.auth` session resolution in routes).
- Repositories: `BucketRepository` (unchanged), `UserRepository` (+`setUserImage`).
- External SDKs / CF bindings: R2 `BUCKET` binding (pre-existing, no wrangler change).
- UI primitives: shadcn/Radix `Avatar`/`AvatarImage`/`AvatarFallback`, `InitialsAvatar`.
- Cross-feature: feat-001 authentication (anonymous sessions own the `user.image` row), feat-007 group-karaoke (WS protocol, DO, room surfaces).

## Tagged Errors

**No new tagged errors** — the feature deliberately reuses already-mapped ones (`tagToTRPC` untouched; `assertNever` exhaustiveness intact):

| Error | Where raised | HTTP in avatar routes |
|-------|--------------|-----------------------|
| `ValidationError` | upload action — form field is not a `File` | 400 |
| `BucketValidationError` | upload action — bad content type / >2MB | 400 |
| `BucketUploadError` | `BucketRepository.upload` failure | 500 |
| `UpdateError` | `UserRepository.setUserImage` failure | 500 |
| `BucketNotFoundError` | serve loader — no object for user | 404 |
| `BucketGetError` | serve loader — R2 get failure | 500 |
| `BucketBindingError` | layer construction (BUCKET unbound) | 500 via `Exit.match` (not in E channel) |

## Changelog

| Date | Type | Description |
|------|------|--------------|
| 2026-07-17 | feature | Phases 1-4 built (opus phase 1, sonnet 2/3/4): server data plane (WS schema fields w/ hibernation-safe defaults, DO threading, avatar helpers, `setUserImage`), upload+serve routes, client capture UI (512px downscale, best-effort upload, en+zh i18n), display wiring on all 5 surfaces. 458 unit tests (from 429). Enforcer sweep clean. Plan `plans/guest-avatars.html` reviewed round 1 — 5/5 decisions on recommended options; seeds stay initials-only; anon-avatar R2 cleanup deferred to future account-upgrade-at-session-end feature. |
| 2026-07-17 | feature | Scoped feat-011; design in flight — exploration complete (R2/upload infra + identity/roster path mapped), opus architecture pass next. |

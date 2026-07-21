# Feature: Group Karaoke Rooms

_Last updated: 2026-07-16_

## Purpose
Host creates a karaoke room with a big-screen YouTube player, a live shared queue, and a join QR code. Guests scan the QR on their phones, get an anonymous Better Auth session plus a nickname, search YouTube (Data API v3, "karaoke"-biased) for songs, and add them to the shared queue. The host controls playback (play/pause/skip/volume/reorder); guest reorder rights are gated per-room by an `allowGuestReorder` toggle. Rooms auto-close after 1h idle.

**Status: implementation complete (Phases 1-5) and browser-walk verified — [`verifications/2026-07-16.md`](verifications/2026-07-16.md) PASS.** Phase 1 (D1 tables + anonymous auth + room tRPC), Phase 2 (KaraokeRoom Durable Object + WS protocol + `useRoomSocket`), Phase 3 (host `/room/:code` screen), Phase 4 (guest `/join/:code` flow + YouTube search/resolve), and Phase 5 (host/guest drag-reorder via dnd-kit gated by `allowGuestReorder`, the toggle's tRPC wiring, the 1h-idle auto-close alarm, and `room_song` play-history wiring via `room.recordPlayed`) are all built and tested — see `runs/2026-07-16-group-karaoke-phase-1.md` for the phase-by-phase log. 
## When It's Used
- **Host**: dashboard → create room → `/room/:code` (big screen — QR code, queue with drag-reorder, player, playback controls, `allowGuestReorder` toggle, end-party button)
- **Guest**: scans QR (or opens the link) → `/join/:code` → nickname step (anonymous session if needed) → Search tab (query or paste-a-link) / Queue tab (live state, own items highlighted, drag-reorder if the host has enabled `allowGuestReorder`); a guest whose session happens to be the room's host (e.g. the host's own phone) also sees a host-only Controls tab
- Cross-feature: depends on `feat-001` Authentication (Better Auth) — guests use the Better Auth **anonymous plugin** layered on top of the existing session/user model; `protectedProcedure` accepts anonymous sessions unmodified since `signIn.anonymous()` provisions a real `session`/`user` row

## How It Works
- **Worker (React Router SSR + tRPC)** owns room CRUD (create/close/get-by-code, `setGuestReorder` toggle, `recordPlayed` history write) and the YouTube search/resolve flow (Data API v3, query biased toward "karaoke" via `withKaraokeBias`, results persisted to D1, 7-day D1 cache checked before spending API quota on a repeat query).
- **KaraokeRoom** — a **raw Durable Object** (SQLite storage, WS Hibernation API) is the live-state source of truth while a room is open: queue, playback state (play/pause/current position), and roster (connected guests). `@cloudflare/actors` was spiked and rejected in Phase 2 (immature — 0.0.1-beta.6, opaque persistence model); raw-DO was the plan's recorded fallback. All state transitions are pure functions in `app/lib/room-state.ts` (unit-tested independently); the DO class only resolves side effects (WS accept/send, storage, ids, clock).
- A **1h sliding-window idle alarm** (`ctx.storage.setAlarm`, re-armed on every WS connect/message) auto-closes the room: if it fires with no sockets connected, the DO writes `room.status = "closed"` directly to D1 (drizzle over `env.DATABASE` — the DO has no Effect runtime to yield `RoomRepository` from) and clears its in-memory live state; if sockets are still connected, it's simply re-armed.
- **D1** persists durable room records and played-song history for cross-session/history use (top songs, recommendations later); the DO's SQLite state is ephemeral and only authoritative while the room is open.
- **Host-only mutations** (play/pause/skip/volume, and reorder unless the room's `allowGuestReorder` is on) are gated in the DO via the pure `canPerform` check in `room-state.ts` — the client UI additionally disables controls it knows will be rejected, but the DO is the actual enforcement point. Guest drag-reorder is `@dnd-kit/{core,sortable,modifiers,utilities}` on the queue rail, wired the same way on both the host screen and the guest Queue tab. `room.setGuestReorder` (host-only tRPC procedure) persists the toggle to D1; the DO seeds its initial in-memory setting from D1 via the `x-allow-guest-reorder` WS-upgrade header so a reconnected/reopened room's live state matches the last-persisted toggle.
- **Host-initiated close is live**: `room.close` (host-only tRPC) marks the D1 row closed via `RoomRepository`, then best-effort notifies the room's DO through the `KaraokeRooms` service (`notifyRoomClosed` → DO RPC `closeRoom()`): the DO broadcasts a terminal `room.closed` message, hangs up every socket, and resets its live state (same cleanup as the idle alarm). Connected clients' `useRoomSocket` exposes a `roomClosed` flag, stops reconnecting, and both room pages revalidate their loader to render the closed state — no reload needed. A DO notify failure is logged, never fails the mutation (D1 is durability; the WS upgrade route rejects closed rooms with 409 anyway).
- **Play history**: the host client calls `room.recordPlayed` (host-only tRPC procedure) right before sending `playback.videoEnded`/`playback.skip` over the WebSocket — it writes a `room_song` row via `SongRepository.recordRoomSong` + `markPlayed`, kept in the Effect/repo layer rather than as a DO-side D1 write so history goes through the same tested repository path as every other mutation.
- **YouTube search degrades gracefully without a key**: `YOUTUBE_API_KEY` is an optional Cloudflare secret (`workers/env.d.ts` ambient declaration, same pattern as `BETTER_AUTH_SECRET` — works on a fresh clone/CI with no local `.dev.vars`). Unset → `search` fails fast (`ConfigurationError`) and the guest UI falls back to the always-available "paste a link" input, which resolves via the keyless YouTube oEmbed endpoint (title/author/thumbnail only — no `embeddable`/`duration`, treated as playable-until-proven-otherwise).

### Persistence details
D1 tables (Drizzle):
- `room` — `id`, `code`, `hostUserId`, `status`, `allowGuestReorder`, `createdAt`, `closedAt`
- `song` — `videoId` (PK), `title`, `channel`, `thumbnailUrl`, `embeddable`, `durationSeconds`
- `search_log` — `id`, `query`, `normalizedQuery`, `userId`, `roomId`, `pickedVideoId`, `createdAt` (indexed on `normalizedQuery` for the search cache join)
- `room_song` — `id`, `roomId`, `videoId`, `singerNickname`, `addedByUserId`, `playedAt`, `createdAt`

Durable Object SQLite holds the **live** queue/playback/roster state — ephemeral, source of truth only while the room is open. D1 is the durable record; the DO's state is rebuilt/discarded on room close (host-initiated `room.close` or the 1h-idle alarm's `closeRoomInD1`, both setting `room.status = "closed"` + `closedAt`).

### Testability
Unit tests exist for `RoomRepository` / `SongRepository` (Drizzle, incl. `getCachedPicks` D1 cache join and `recordRoomSong`/`markPlayed`), the room-ws protocol schemas + pure `room-state` reducers (incl. `canPerform`, `setGuestReorder`), the YouTube service (search/getVideo/oEmbed fallback against a mocked `fetch`) + its pure helpers (`parseYouTubeUrl`, `parseIsoDuration`, `normalizeSearchQuery`, `withKaraokeBias`), and the `tagToTRPC` mapping for every tagged error below. **400 unit tests total** (33 files, `bun run test`). Feature-verifier browser walk: **PASS** — [`verifications/2026-07-16.md`](verifications/2026-07-16.md) (11/11 golden-path steps: host create room → guest QR join → paste-link add → live WS queue sync → play → skip → end party → closed-state reload; error path `/join/ZZZ-ZZZ` friendly; zero app-origin js/network errors; screenshots in `screenshots/`). Untested in that walk: drag-reorder (headless limitation) and API-key search (no `YOUTUBE_API_KEY` set — paste-link path verified instead); real YouTube playback can't decode in headless Chromium, but the graceful-degradation path (error toast + auto-skip) fired correctly.

## Key Files

| File | Role |
|------|------|
| `app/db/schema.ts` | Drizzle schema: `room`, `song`, `search_log`, `room_song` |
| `app/repositories/room.ts` | Repository — Effect.Service wrapping room D1 access |
| `app/repositories/song.ts` | Repository — Effect.Service wrapping song/search_log/room_song D1 access, incl. `getCachedPicks` (7-day search cache join) |
| `app/services/youtube.ts` | Effect service — YouTube Data API v3 `search`/`getVideo`, keyless oEmbed fallback when `YOUTUBE_API_KEY` is unset (+ `youtube.test-layer.ts`) |
| `app/services/karaoke-rooms.ts` | Effect service — wraps the `KARAOKE_ROOM` DO namespace; `notifyRoomClosed(roomId)` → DO RPC `closeRoom()` (live close broadcast) |
| `app/lib/youtube.ts` | Pure helpers — `normalizeSearchQuery`, `withKaraokeBias`, `parseYouTubeUrl`, `parseIsoDuration` |
| `app/trpc/routes/room.ts` | tRPC router — `create`, `get` (public), `close` (host-only), `setGuestReorder` (host-only), `recordPlayed` (host-only) |
| `app/trpc/routes/youtube.ts` | tRPC router — `search` (D1 cache check → API call → logSearch) + `resolveVideo` (parse url/videoId → getVideo → upsertSong → markSearchPicked) |
| `app/lib/schemas/room.ts` | Effect Schema — room inputs, `Nickname`, `JoinNicknameInput`, `UpdateGuestReorderInput`, `RecordPlayedInput` |
| `app/lib/schemas/youtube.ts` | Effect Schema — `YouTubeSearchInput`, `YouTubeResolveVideoInput` |
| `app/lib/schemas/room-ws.ts` | Effect Schema — WS `ClientMessage`/`ServerMessage` protocol, `decodeClientMessage`/`encodeServerMessage` |
| `app/lib/room-state.ts` | Pure reducers — `RoomLiveState` (queue/playback/roster), `applyClientMessage`, `canPerform` (host/guest + `allowGuestReorder` gate), `setGuestReorder`, roster helpers. Unit-tested independent of the DO class |
| `app/durable-objects/karaoke-room.ts` | Raw Durable Object (not `@cloudflare/actors` — spike rejected, see Phase 2 run note) — live queue/playback/roster, WS Hibernation API, 1h sliding idle alarm (`closeRoomInD1` on fire with no sockets connected) |
| `app/routes/api/room.$code.ws.ts` | WS upgrade boundary (non-tRPC HTTP pattern) — resolves session/room/role, forwards identity headers to the `KARAOKE_ROOM` DO stub |
| `app/routes/room/$code.tsx` | Host UI — big-screen room view (player, queue rail w/ dnd-kit reorder, QR panel, controls, `allowGuestReorder` toggle, end-party) |
| `app/routes/join/$code.tsx` | Guest UI — public loader, nickname step, Search/Queue/(host-only Controls) tabs |
| `app/components/room/*` | Shared UI — queue rail (dnd-kit drag-reorder, own-item highlight via optional `ownUserId`), now-singing banner, connection pill, player, host controls, join panel (`QRCodeSVG`) |
| `app/components/join/*` | Guest-only UI — nickname form, search tab (submit-triggered search + paste-a-link fallback), queue tab, controls tab (host-only, rendered when the guest's own session is the room's host) |
| `app/hooks/use-room-socket.ts` | Client hook — WS connection to the room DO |
| `drizzle/0001_wealthy_purple_man.sql` | Migration — `room`, `song`, `search_log`, `room_song` tables + `user.is_anonymous` column |

## Dependencies
- Effect services consumed: `Database`, `AuthApi` (Better Auth anonymous plugin), `CloudflareEnv` (`YOUTUBE_API_KEY` optional secret, `KARAOKE_ROOM` DO binding), `YouTube`
- Repositories: `RoomRepository`, `SongRepository`
- External SDKs / CF bindings: YouTube Data API v3 (`search.list`, `videos.list`) + public oEmbed endpoint (keyless fallback), raw Durable Objects (SQLite storage, WS Hibernation API), D1
- UI primitives: shadcn `Tabs`/`Card`/`Form`/`Badge`, `qrcode.react`, native `<iframe>` YouTube embed player

## Tagged Errors

| Error | Where raised | tRPC code |
|-------|--------------|-----------|
| `RoomNotFoundError` | room repo getByCode | NOT_FOUND |
| `RoomClosedError` | room repo / route guards | CONFLICT |
| `YouTubeQuotaExceededError` | youtube service — 403 `quotaExceeded` from search.list/videos.list | TOO_MANY_REQUESTS |
| `YouTubeUnavailableError` | youtube service — any other API/network failure | BAD_GATEWAY |
| `VideoNotFoundError` | youtube service — empty `videos.list`/oEmbed 404 | NOT_FOUND |

> **Embeddability is NOT enforced server-side.** `resolveVideo` used to reject `status.embeddable === false` with a `VideoNotEmbeddableError` (removed 2026-07-21). The Data API flag is unreliable/over-conservative — Sing King and other karaoke channels report `false` yet embed fine, so the check made them un-queueable. The IFrame player's `onError` (codes 101/150) is the ground truth: genuinely non-embeddable videos are toasted + auto-skipped at playback without being recorded as sung (`app/components/room/youtube-player.tsx`). `metadata.embeddable` is still persisted on `song` as informational only.

All implemented and mapped in `app/lib/effect-trpc.ts`'s `tagToTRPC`, each with a passing mapping test in `app/lib/__tests__/effect-trpc.test.ts`. Missing `YOUTUBE_API_KEY` degrades `youtube.search` to a `ConfigurationError` (existing generic repository error, `INTERNAL_SERVER_ERROR`) rather than a YouTube-specific tag — see Phase 4 run note for rationale — while `getVideo`/`resolveVideo` fall back to the keyless oEmbed endpoint regardless of key presence.

## Changelog

| Date | Type | Description |
|------|------|-------------|
| 2026-07-21 | fix | Sing King (and other karaoke channels) were un-queueable — `youtube.resolveVideo` hard-rejected `status.embeddable === false` with `VideoNotEmbeddableError`, but the Data API flag is unreliable and those videos embed fine. Removed the server-side check (+ the now-dead `VideoNotEmbeddableError`, its `tagToTRPC` mapping, `VIDEO_NOT_EMBEDDABLE_MESSAGE_PREFIX`, client branch, and `not_embeddable` i18n key). Player `onError` remains the runtime ground truth (toast + auto-skip). 513 tests. |
| 2026-07-16 | fix | Host-initiated `room.close` now live-notifies the room DO (was: D1-only, guests saw a stale room until reload — Finding #2 of the ui-overhaul verification / PR #3 comment). New `room.closed` ServerMessage + pure `roomClosed()` helper, DO RPC `closeRoom()` (broadcast + socket close + `clearRoom()` shared with `alarm()`), `KaraokeRooms` service (`notifyRoomClosed`, best-effort from the `close` mutation), `useRoomSocket` `roomClosed` flag (stops reconnect), loader revalidate on both room pages. 406 tests; live browser walk PASS — [`verifications/2026-07-16-room-close-live.md`](verifications/2026-07-16-room-close-live.md). |
| 2026-07-16 | feature | Phase 5: host/guest drag-reorder (`@dnd-kit/{core,sortable,modifiers,utilities}` on the queue rail, gated by `canPerform` + `allowGuestReorder`), `room.setGuestReorder` + `room.recordPlayed` host-only tRPC procedures, 1h sliding-window idle alarm (`KaraokeRoom.alarm()` → `closeRoomInD1` when no sockets connected), guest-side host-only Controls tab on `/join/:code`. Implementation now covers all 5 planned phases. 400 tests total. Feature-verifier browser walk still outstanding before ship — see Testability. |
| 2026-07-16 | feature | Phase 4: `/join/:code` guest flow (nickname step, Search/Queue tabs), YouTube service (search + getVideo + oEmbed fallback), `youtube.search`/`resolveVideo` tRPC router, D1 search cache (`SongRepository.getCachedPicks`), 4 new tagged errors. 392 tests total. |
| 2026-07-16 | feature | Phase 3: host `/room/:code` screen (player, queue rail, QR join panel, playback controls). |
| 2026-07-16 | feature | Phase 2: `KaraokeRoom` raw Durable Object (WS Hibernation API) + room-ws protocol + `useRoomSocket` — `@cloudflare/actors` spike rejected (immature, opaque persistence model). |
| 2026-07-16 | feature | Plan reviewed (`plans/group-karaoke.html`); Phase 1 (D1 tables + anonymous auth + room tRPC) started |

# Run: group-karaoke-phase-1

_Started: 2026-07-16_
_Status: shipped_

## Task

Implement Phase 1 of the reviewed group-karaoke plan (plans/group-karaoke.html): Better Auth anonymous plugin, D1 tables (room, song, search_log, room_song), repositories, tagged errors, room-code helper, and room.create/get/close tRPC procedures.

## Domain

mixed (repository + services + routes + errors + cloudflare)

## Plan

Coordinator (Fable) delegates to Sonnet sub-agents; enforcer reviews each phase.

1. Phase 1 — anon auth plugin + 4 D1 tables + migration + repos + errors + schemas + room-code helper + room tRPC router + seed fixtures (this run)
2. Phase 2 — @cloudflare/actors spike → KaraokeRoom actor + WS + useRoomSocket
3. Phase 3 — host screen (/room/:code: player, queue rail, QR panel)
4. Phase 4 — participant flow (/join/:code, search w/ "karaoke" bias + D1 cache + logging)
5. Phase 5 — host controls, allowGuestReorder toggle, 1h-idle auto-close, room_song history
6. Phase 6 — verify + ship

Decisions (from plan review round 1, 2026-07-15):
- Guests: Better Auth anonymous plugin (not ephemeral tokens)
- Realtime: @cloudflare/actors over DO; fallback raw DO + Hibernation API
- Search: YT Data API v3 + paste-URL fallback; persist searches/songs to D1 (own search DB later)
- State: DO SQLite = live truth; D1 = durable room record + history

## Baseline

```
$ ./init.sh --baseline  (2026-07-16)
typecheck:     PASS
test:          PASS (23 files, 228 tests)
harness-check: PASS (11/11)
```

State of the tree before any of my changes: clean, all features shipped, no in-progress.

---

## Step 1 — Phase 1 implementation (delegated to Sonnet builder agent)

_2026-07-16 ~20:00_

What I did: delegated full Phase 1 to a Sonnet general-purpose agent (recipes add-db-table / add-tagged-error / add-trpc-endpoint). feature-tracker registered feat-007 in-progress beforehand.

What I observed (verbatim from builder report):

```
Migration: drizzle/0001_wealthy_purple_man.sql (generated + applied local, seeded rows verified)
typecheck: EXIT CODE: 0
 Test Files  27 passed (27)
      Tests  274 passed (274)   # baseline was 228
```

Created: app/models/errors/room.ts; app/lib/schemas/room.ts (+tests); app/lib/room-code.ts (+tests); app/repositories/room.ts, song.ts (+tests); app/trpc/routes/room.ts; migration 0001.
Edited: app/auth/server.ts + client.ts (anonymous plugin), app/db/schema.ts (user.isAnonymous + room/song/search_log/room_song), app/models/errors/index.ts, app/lib/effect-trpc.ts (+mapping tests), app/lib/schemas/index.ts, app/runtime.ts, app/trpc/router.ts, scripts/seed-preview.ts.

Deviations (accepted): closeRoom idempotent + exported failIfClosed guard for Phase 2 queue writes; room.close host-only check = Effect.fail(TRPCError FORBIDDEN) per errors.md carve-out; SongRepository inputs plain TS (no tRPC boundary yet); room_song.videoId cascade; code-collision retry ≤3 then unique-index CreationError backstop.

What I learned: Better Auth anonymous plugin needs user.isAnonymous column; anonymousClient() on client side.

Next: effect-ts-enforcer review → fix any violations → Phase 2 (@cloudflare/actors spike + KaraokeRoom actor).

---

## Step 2 — effect-ts-enforcer review

_2026-07-16 ~20:05_

What I did: spawned effect-ts-enforcer over all Phase 1 files.

What I observed:

```
0 critical, 0 major, 0 minor — all 5 non-negotiables satisfied.
Notes: throws in runProcedure .then() are pre-existing documented tRPC boundary;
seed-preview.ts process.env is Bun tooling outside Workers runtime (allowed per cloudflare.md).
```

What I learned: nothing to fix; Phase 1 closed.

Next: Phase 2 — @cloudflare/actors spike + KaraokeRoom actor + WS upgrade + useRoomSocket.

---

## Step 3 — Phase 2 realtime core (delegated to Sonnet builder)

_2026-07-16 ~20:30_

What I did: delegated Phase 2. **Spike verdict: @cloudflare/actors REJECTED** (~15 min spike: 0.0.1-beta.6, no published examples, decorator-based opaque persistence model conflicts with explicit apply-pure-fn→persist→broadcast flow, breaking-change risk). Fell back to raw DO + Hibernation API per the plan's recorded fallback clause.

What I observed (verbatim from builder report):

```
$ bun run typecheck   → exit 0
$ bun run test        → Test Files 29 passed (29) | Tests 335 passed (335)
$ bun run build       → ✓ built in 5.78s (client + ssr), exit 0
CLOUDFLARE_ENV=preview build → KARAOKE_ROOM binding + migration flattened correctly
```

Created: app/lib/schemas/room-ws.ts (+20 tests), app/lib/room-state.ts pure reducers (+41 tests), app/durable-objects/karaoke-room.ts, app/routes/api/room.$code.ws.ts, app/hooks/use-room-socket.ts.
Edited: wrangler.jsonc (KARAOKE_ROOM prod+preview, v1 new_sqlite_classes top-level), workers/app.ts (export), app/routes.ts.

Notes: migrations are top-level-only in wrangler (bindings per-env); setGuestReorder broadcasts full room.state snapshot (no settings.updated msg in protocol); use-room-socket untested (no jsdom harness, precedent use-mobile.ts; protocol logic covered in room-ws tests); playback transport messages host-only in canPerform.

Next: enforcer review of Phase 2 (parallel) + Phase 3 host screen builder (launched).

---

## Step 4 — Phase 2 enforcer + fix; Phase 3 host screen

_2026-07-16 ~20:55_

Phase 2 enforcer: 0 critical, 0 major, 1 minor — WS route used raw params.code without schema decode. Fixed by coordinator (RoomCode decode → ValidationError 400 in app/routes/api/room.$code.ws.ts). Re-verified: typecheck clean, 335 pass.

Phase 3 builder report (verbatim):

```
typecheck → exit 0; test → 30 files, 339 passed; build → exit 0
dev-boot curls: unauth → 302 /login; host+open room → 200 with all room-* testids
+ correct joinUrl; non-host → 302 /join/KQ7-3FP; bogus code → friendly room-unavailable
```

Created: room-urls helper (+4 tests), youtube.d.ts ambient types, components/room/* (player, banner, controls, pill, queue-rail, join-panel), routes/room/$code.tsx, locales room.json (en+zh).
Edited: routes.ts, dashboard _index (host-room card), i18n(.d).ts, dashboard.json, root.tsx.
Notable: builder found+fixed pre-existing gap — sonner toasts fired but <Toaster/> never mounted; mounted in root.tsx.

Next: Phase 3 enforcer + Phase 4 builder (join flow + YouTube service) running in parallel.

---

## Step 6 (inserted by coordinator, chronologically after Step 5) — Phase 3/4 enforcer fixes + Phase 5

_2026-07-16 ~22:50_

Phase 3 enforcer: 0 critical, 2 major, 2 minor. Coordinator fixed: room loader try/catch → runtime.runPromise + Effect.catchTags (ParseError/RoomNotFoundError → friendly state); dashboard.json registered in i18n.d.ts CustomTypeOptions; bg-white (QR quiet zone) + bg-black (video letterbox) documented as deliberate non-token constraints.

Phase 4 enforcer: 0 critical, 0 major, 3 minor. Coordinator fixed: youtube schemas re-exported from schemas/index.ts; redundant Env cast dropped in services/youtube.ts; fragile error.message.includes("embed") replaced with shared VIDEO_NOT_EMBEDDABLE_MESSAGE_PREFIX constant (models/errors/youtube.ts) imported by both appErrorToTRPC and search-tab. Verified: typecheck clean, 392 pass.

Phase 5 (Sonnet builder) COMPLETE — verbatim:

```
typecheck: no errors; test: 33 files / 400 passed; build: ✓ 5.80s
Live Playwright walk: host screen, guest join, drag handle, remove, controls tab,
guest-reorder toggle → drag appears on guest tab, skip → recordPlayed 200, end-party
confirm → close → dashboard → reopened room shows closed screen.
```

Created controls-tab.tsx; edited room schemas/repo/router (setGuestReorder, recordPlayed), DO (1h sliding idle alarm + D1 close via drizzle-over-env.DATABASE — documented runtime-boundary deviation; settings seed via x-allow-guest-reorder; x-room-id persisted), WS route headers, queue-rail dnd-kit rewrite, join/room routes, locales.
Deviations accepted: no room.closed protocol msg (guests get 409 on reconnect); Controls-tab skip also records history.

Next: Phase 5 enforcer → Phase 6 (feature-verifier walk, verify-done, brain docs, ship).

---

## Step 5 — Phase 4 participant flow + YouTube search

_2026-07-16 ~21:30_

What I did: implemented Phase 4 directly — YouTube service (search + getVideo + oEmbed fallback), 4 new tagged errors, D1 search cache (`SongRepository.getCachedPicks`), `youtube` tRPC router (`search` + `resolveVideo`), and the `/join/:code` guest flow (public loader, nickname step, Search/Queue tabs). Session was interrupted once by a transient API error mid-build; resumed by re-checking the working tree (all backend pieces — errors/service/schemas/repo/router — had already landed and typechecked/tested clean) and finishing only the remaining frontend pieces (`/join/:code` route + 3 components) before re-running full verification.

What I observed (verbatim):

```
$ bun run typecheck   → exit 0 (cf-typegen + react-router typegen + tsc -b clean)
$ bun run test        → Test Files 33 passed (33) | Tests 392 passed (392)   # baseline was 339
$ bun run build       → ✓ built in 6.77s (client), ✓ built in 6.08s (ssr)
dev-boot curls:
  GET /join/KQ7-3FP        → 200, testids join-nickname-card/form/input/submit present (SSR, no session)
  GET /join/ZZZ-ZZZ        → 200, testids join-unavailable/join-back-to-home (bad code, friendly state)
  GET /room/KQ7-3FP        → 302 (no session — requireSession redirect, unchanged regression check)
  GET /dashboard           → 302 (no session, unchanged regression check)
  POST /api/trpc/youtube.search → 401 UNAUTHORIZED (protectedProcedure gate confirmed live)
```

protectedProcedure-with-anonymous verification: confirmed TRUE by reading `better-auth/dist/plugins/anonymous/index.mjs` — `signInAnonymous` calls `ctx.context.internalAdapter.createSession(newUser.id)` and `setSessionCookie`, i.e. it provisions a real `session`/`user` row exactly like a normal sign-in. `createTRPCContext` resolves `ctx.auth` from that same session/user pair, so `protectedProcedure`'s `if (!ctx.auth) throw UNAUTHORIZED` guard is satisfied for anonymous guests with no special-casing needed.

Created: `app/models/errors/youtube.ts`; `app/services/youtube.ts` (+`.test-layer.ts` +tests); `app/lib/youtube.ts` (pure helpers: `normalizeSearchQuery`, `withKaraokeBias`, `parseYouTubeUrl`, `parseIsoDuration`) +tests; `app/lib/schemas/youtube.ts` +tests; `app/trpc/routes/youtube.ts`; `app/routes/join/$code.tsx`; `app/components/join/{nickname-form,search-tab,queue-tab}.tsx`.
Edited: `app/models/errors/index.ts`, `app/lib/effect-trpc.ts` (+4 mapping tests), `app/runtime.ts` (YouTube tag + Live layer), `app/trpc/router.ts` (youtube router), `app/repositories/song.ts` (+`getCachedPicks`, +3 tests), `app/lib/schemas/room.ts` (+`JoinNicknameInput`, +3 tests), `app/components/room/queue-rail.tsx` (optional `ownUserId` prop, backward-compatible), `app/routes.ts` (`/join/:code`), `workers/env.d.ts` (+`YOUTUBE_API_KEY?`), `.dev.vars.example`, `app/locales/{en,zh}/room.json` (`join.nickname.*`, `join.tabs.*`, `join.search.*`, `queue.you`, `state.back_to_home`).

Deviations (accepted, rationale inline in code comments):
- Missing `YOUTUBE_API_KEY` → `search` fails with `ConfigurationError` (existing repository error, `INTERNAL_SERVER_ERROR`) rather than `YouTubeQuotaExceededError` — the spec's "quota/config tagged error" phrasing read as either being acceptable; `ConfigurationError` is the more honest tag since it's not actually a quota condition. Paste-a-link stays available regardless (always-visible toggle + auto-opened on `TOO_MANY_REQUESTS`), and `resolveVideo`/`getVideo` fall back to the keyless oEmbed endpoint either way, so the degrade-gracefully requirement is met either way.
- `youtube.search` and `youtube.resolveVideo` are both `.mutation`, not `.query` — both write to D1 (search_log / song) even on the "search" path, so mutation semantics fit React Query's caching model better (no accidental refetch-on-mount reusing stale cached picks).
- Nickname step is unconditional on first paint (never auto-skipped via a client-only localStorage check) — the task's SSR curl requirement plus "prefill from localStorage" (not "skip via localStorage") both pointed at always rendering the form, just pre-filled once mounted.
- `QueueRail` gained an optional `ownUserId` prop instead of forking a parallel component — backward compatible (host route passes nothing, no behavior change) and avoids duplicating the queue-item markup.
- `anonymous.signIn()`'s response `user.id` is threaded through `NicknameForm`'s `onJoined` callback (rather than a second `getSession`/whoami round-trip) since the endpoint's own response body already includes the freshly-created user — confirmed by reading the plugin source.

Not done (explicitly out of scope per task): Controls tab, drag-reorder, idle-alarm (all Phase 5). Brain docs (`services.md`, `errors.md`, `codebase/api.md`, `group-karaoke.md`, `CHANGELOG.md`, `feature_list.json` evidence) updated in the same pass — feature stays `in-progress` (Phase 5 remains).

Next: Phase 5 — host controls (play/pause/skip/volume already wired in Phase 3; reorder + `allowGuestReorder` toggle remain), 1h-idle auto-close alarm, `room_song` play history wiring, then final ship verification.

---

## Final

_Closed: 2026-07-16_

- Shipped: working tree (repo has no git history yet — first commit pending; flagged to user)
- Brain docs updated: architecture, data-models, integrations, security, user-journeys, rules/{cloudflare,routes,services,errors}, codebase/api, features/group-karaoke (as-built + PASS verification linked), CHANGELOG, feature_list.json
- Verification: verifications/2026-07-16.md PASS (11/11 golden steps + friendly error path, 0 app-origin errors)
- Verify-done: typecheck/test(400)/e2e-smoke(2)/build/harness(11/11) all PASS
- Left undone: YOUTUBE_API_KEY not set (search degrades to paste-link until user creates key); drag-reorder not headless-verifiable (unit-tested via room-state reducers + built-in dnd-kit); anonymous-user cleanup job (open question from plan); Safari/smart-TV auto-advance empirical check
- Surprises worth remembering: @cloudflare/actors rejected at spike (0.0.1-beta.6, opaque persistence) → raw DO + Hibernation; Toaster was never mounted pre-feature (fixed); Better Auth anonymous plugin sessions pass protectedProcedure (verified in plugin source) — room.create now explicitly rejects isAnonymous; StrictMode double-connect causes dev-only WS reconnect hop ~1-4s after mount (send() no-ops silently while CONNECTING)

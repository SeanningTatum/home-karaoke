# Run: room-close-do-notify

_Started: 2026-07-16_
_Status: shipped_

## Task

Fix the live-UX gap flagged on PR #3: tRPC `room.close` only updates D1 — the KaraokeRoom DO is never notified, so guests with an open tab keep seeing live UI until they reload. Host-initiated close must broadcast a `room.closed` event to connected sockets and clean up the DO.

## Domain

mixed (routes + cloudflare DO + library schema + frontend hook)

## Plan

1. `app/lib/schemas/room-ws.ts` — add `RoomClosedMessage` (`type: "room.closed"`) to the `ServerMessage` union.
2. `app/lib/room-state.ts` — pure `roomClosed()` message helper (mirrors `rosterUpdated`).
3. `app/durable-objects/karaoke-room.ts` — public RPC method `closeRoom()`: broadcast `room.closed`, close all sockets, delete alarm + storage, reset in-memory state. Extract shared cleanup used by `alarm()`.
4. `app/trpc/routes/room.ts` — `close` mutation: after `repo.closeRoom` (D1 stays the tested durability path), best-effort `stub.closeRoom()` via `CloudflareEnv` + `KARAOKE_ROOM.idFromName(roomId)`; failures logged, never fail the mutation.
5. `app/hooks/use-room-socket.ts` — handle `room.closed`: expose `roomClosed` flag, suppress reconnect loop, status → "closed".
6. `app/routes/room/$code.tsx` + `app/routes/join/$code.tsx` — on `roomClosed`, revalidate the loader → existing closed-state UI renders.
7. Unit tests: `room-ws.test.ts` decode/encode `room.closed`; `room-state.test.ts` for the helper.
8. Brain: group-karaoke.md changelog + How It Works, progress.md, close run note.

## Baseline

```
$ ./init.sh --baseline
typecheck:     PASS
test:          PASS
harness-check: PASS
Baseline green. Proceed to task.
```

(First run failed with `vitest: command not found` — fresh worktree, fixed by `bun install`.)

## Key findings (investigation)

- Gap documented as Finding #2 in `feat/ui-overhaul` branch's `.brain/features/ui-overhaul/ui-overhaul.md` (not on main). Pre-exists on main; PR #3 unmerged — fix branches from main tip (2854960).
- `close` mutation (`app/trpc/routes/room.ts:66`) calls only `repo.closeRoom`. DO closes itself only via idle `alarm()` → `closeRoomInD1`.
- DO stub pattern: `env.KARAOKE_ROOM.get(env.KARAOKE_ROOM.idFromName(room.id))` — addressed by D1 `room.id`, binding typed `DurableObjectNamespace<KaraokeRoom>` so RPC methods typecheck.
- No `room.closed` type in `ServerMessage` union; no client handler; reconnect loop would otherwise retry a closed room forever (upgrade route returns 409 via `failIfClosed`).
- D1 write stays in the tRPC/repo layer (same rationale as `recordPlayed`); DO call is best-effort live-notify only — same "D1 is durability" comment pattern as `closeRoomInD1`.

---

## Step 1 — implementation complete

_2026-07-16_

What I did:
- `room-ws.ts`: `RoomClosedMessage` (`type: "room.closed"`) added to `ServerMessage` union.
- `room-state.ts`: pure `roomClosed()` broadcast helper.
- `karaoke-room.ts` (DO): public RPC `closeRoom()` — broadcast `room.closed`, close every socket (1000), shared `clearRoom()` (deleteAlarm + deleteAll + reset) also used by `alarm()`.
- New `app/services/karaoke-rooms.ts` (`KaraokeRooms` Tag + `KaraokeRoomsLive`): wraps `KARAOKE_ROOM` namespace, `notifyRoomClosed(roomId)` → `stub.closeRoom()` via `Effect.tryPromise` → `ExternalServiceError`; `ConfigurationError` on missing binding. Added to `AppServices` + `baseLayer`. (First attempt yielded `CloudflareEnv` directly in the procedure — typecheck failed because `CloudflareEnv` is `Layer.provide`d, not merged, into the runtime. Service wrapper is the documented pattern anyway.)
- `room.ts` close mutation: after `repo.closeRoom`, best-effort `rooms.notifyRoomClosed(input.roomId)` — `tapErrorCause` → `Effect.logWarning("room.close_notify_failed")` + annotations, `catchAll` → `Effect.void`.
- `use-room-socket.ts`: `roomClosed` state + ref (close handler needs sync read); on `room.closed` stop reconnecting, status → "closed"; reset per `code` change.
- `room/$code.tsx` + `join/$code.tsx`: `useRevalidator` effect on `roomClosed` → loader re-resolves → existing closed-state UI.
- Tests: room-ws decode `room.closed`, room-state `roomClosed()`, 3 `KaraokeRoomsLive` tests (stub call path, ExternalServiceError, ConfigurationError). 406 total, green. Typecheck green.
- Brain: group-karaoke.md (How It Works + Key Files + changelog), rules/services.md (table + union).

---

## Step 2 — verification + reviews

_2026-07-16_

- effect-ts-enforcer: clean, 0 findings. Awareness flag (DO teardown race: late `webSocketClose` → `disconnect()` re-persisting after `clearRoom()`) fixed by nulling the attachment (`ws.serializeAttachment(null)`) before `ws.close()` in `closeRoom()`.
- verify-done: typecheck PASS / 406 tests PASS / e2e smoke PASS (first-run auth flake, clean rerun) / build PASS / brain coherence OK / harness-check 11/11.
- feature-verifier: **PASS** — `verifications/2026-07-16-room-close-live.md`, 6/6 golden path + 1/1 error path, no js/network errors. Guest tab flips to closed state live (screenshot `room-close-04-guest-closed-no-reload.png`), second host tab too, reload path unchanged.

_Status: shipped (pending PR)_

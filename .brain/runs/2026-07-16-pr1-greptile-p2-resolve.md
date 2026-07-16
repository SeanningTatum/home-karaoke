# PR #1 — resolve Greptile P2 review threads

**Date:** 2026-07-16
**Branch:** feat/group-karaoke
**PR:** https://github.com/SeanningTatum/home-karaoke/pull/1

## Scope
Resolve 4 open Greptile P2 threads (1 already fixed in 7c88866). User-approved options:

- **T2** (room.ts:56 — `hostUserId` leaked by public `room.get`): project response, derive `isHost` server-side; also fix real leak path in `/join/:code` loader (ships hostUserId to client). → drop `hostUserId`, ship `isHost`.
- **T3** (youtube.ts:124 — `searchLogId` no ownership check): scope `markSearchPicked` UPDATE with `WHERE userId = ctx.auth.user.id`.
- **T4** (room-state / $code.tsx:183 — dual-screen double-record/advance): idempotent DO advance guarded by `currentItemId`; reuse queue-item UUID as `room_song` PK + `onConflictDoNothing` → double-record no-ops. No migration.
- **T5** (controls-tab.tsx:74 — silent setGuestReorder rollback when WS closed): `send()` returns boolean (was socket OPEN); on failed revert show distinct "not saved / reconnecting" toast.

## Status: in progress

## Status: DONE (79060c5)
All 5 threads resolved on GitHub. Greptile re-review triggered. typecheck 0 / 406 tests / build ok.

## Follow-up P1 (r3593261839) — T5-B: single-writer guest-reorder

Greptile re-review surfaced a new P1: the T5-A fix (desync toast in `onError`) didn't cover the case where the WS socket is already closed — `send()` silently no-ops, but `setGuestReorder.mutate` still writes D1, leaving D1 permanently ahead of the DO (DO only re-seeds from the `x-allow-guest-reorder` header on a truly fresh instance).

**Chosen fix: Option B (single write path).** The room DO is now the *only* writer of `allow_guest_reorder`:
- `karaoke-room.ts` — new `persistGuestReorderInD1` (raw drizzle, best-effort, mirrors `closeRoomInD1`); called on the `room.setGuestReorder` WS message after applying live state.
- `controls-tab.tsx` — dropped the client `api.room.setGuestReorder` mutation; handler sends WS only + offline toast if `send()` returns false. A dropped message now changes nothing anywhere → no divergence possible.
- Removed dead code: tRPC `setGuestReorder` procedure, repo `updateGuestReorder`, `UpdateGuestReorderInput` schema + all their unit tests. i18n: two stale keys → one `guest_reorder_offline` (en+zh).

Verify: typecheck 0 / 401 tests / build (prod) ok / effect-ts-enforcer 0 findings.

## Feature timing — group-karaoke
Wall-clock from first feature commit (`fb24f09` 2026-07-15 23:26) to PR #1 merge (`2026-07-16 01:21`): **~1h 55m** across 9 branch commits (feature build → pre-PR Greptile fixes → verification walks → P2 resolution → this P1). Prior plan-review session (plans/group-karaoke.html, 4 decisions) not counted.

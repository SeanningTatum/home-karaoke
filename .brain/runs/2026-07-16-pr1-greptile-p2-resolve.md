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

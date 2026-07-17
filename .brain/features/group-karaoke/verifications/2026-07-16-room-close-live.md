# Verification: Group Karaoke — Host-Initiated Room-Close Live Broadcast

- **Slug**: `group-karaoke` (feature memo: `.brain/features/group-karaoke/group-karaoke.md`)
- **Date**: 2026-07-16
- **Verified by**: feature-verifier (Playwright CLI — headless script via `bun`)
- **Base URL**: http://localhost:5173 _(dev server: started by agent)_
- **Role**: host = seeded non-anonymous user `admin@preview.local` (created by `bun run db:seed`); guest = anonymous Better Auth session provisioned in-flow
- **Verdict**: ✅ PASS — `room.closed` WS broadcast flips both the guest tab and a second host tab to the friendly closed state with zero reload, and the socket stops reconnecting afterward; D1-path reload of `/join/:code` also shows the closed state.

## Scope

Verifies the 2026-07-16 fix (see `group-karaoke.md` Changelog: "Host-initiated `room.close` now live-notifies the room DO") — `room.close` (host-only tRPC) now best-effort notifies the `KaraokeRoom` Durable Object via `KaraokeRooms.notifyRoomClosed`, which broadcasts a terminal `room.closed` ServerMessage, hangs up every socket, and resets DO live state. `useRoomSocket` exposes a `roomClosed` flag (stops reconnect attempts), and both `/room/:code` and `/join/:code` revalidate their loader on `roomClosed` to render the closed state — no reload needed.

## Golden path

Two browser contexts against the same dev server (`bun run dev`); admin/user fixtures seeded via `bun run db:seed` (`admin@preview.local` / `Password123!`).

| # | Step | Expected | Observed | Screenshot | Result |
|---|------|----------|----------|------------|--------|
| 01 | Context A (host, 1920×1080): log in as `admin@preview.local`, create a room from `/dashboard` (`dashboard-host-room-button`) | Lands on `/room/:code` | Room created (code varies per run, e.g. `5HA-YM3`), host on `/room/:code` with `room-end-party-button` visible | [`room-close-01-host-room-created.png`](../screenshots/room-close-01-host-room-created.png) | ✅ |
| 02 | Context B (guest, 390×844): open `/join/:code`, enter nickname `VerifierGuest`, reach Search/Queue tabs | Anonymous session provisioned, `join-tabs` visible, WS connects | Guest reached Search tab then Queue tab (`join-queue-tab` visible), room code shown in header; `room-reconnecting-pill` **not** visible (socket already at steady "open" — pill only renders during `connecting`/`reconnecting`, per `connection-status-pill.tsx`, so its absence here is the *expected* connected state, not a bug) | [`room-close-02-guest-joined-live.png`](../screenshots/room-close-02-guest-joined-live.png) | ✅ |
| 03 | Context A: click `room-end-party-button`, confirm `room-end-party-confirm` in the dialog | Host navigates to `/dashboard` | Confirmed dialog, host mutation succeeded, navigated to `/dashboard` | [`room-close-03-host-back-on-dashboard.png`](../screenshots/room-close-03-host-back-on-dashboard.png) | ✅ |
| 04 | **Fix under test**: Context B, no reload/navigation — observe transition to closed state | `join-unavailable` renders with `state.closed_title`/`state.closed_description`, URL unchanged (still `/join/:code`) | Guest flipped to "This room has closed" / "The host ended this karaoke session. Start a new one from the dashboard." within the loader-revalidate window, URL still `/join/:code` — confirmed no navigation/reload occurred | [`room-close-04-guest-closed-no-reload.png`](../screenshots/room-close-04-guest-closed-no-reload.png) | ✅ |
| 05 | Context B: wait 4s post-close, check for a reconnect loop | `room-reconnecting-pill` never reappears (hook stops reconnecting on `roomClosed`) | Pill not visible after 4s wait — no reconnect loop | (covered by same closed-state screenshot above) | ✅ |
| 06 | Host second tab: open a **fresh page in Context A's context** on `/room/:code` | Loader resolves room as closed (D1 already updated), renders `room-unavailable` closed state | Second host tab rendered "This room has closed" immediately via SSR loader | [`room-close-05-host-second-tab-closed.png`](../screenshots/room-close-05-host-second-tab-closed.png) | ✅ |

## Error path

| # | Step | Expected failure surface | Observed | Screenshot | Result |
|---|------|--------------------------|----------|------------|--------|
| E1 | Fresh unauthenticated context (no cookies) loads `/join/:code` directly after close (D1 path, no WS involved — pre-existing behavior) | `join-unavailable` closed state, no crash | "This room has closed" rendered correctly on a cold load with zero session/WS state | [`room-close-E1-reload-still-closed.png`](../screenshots/room-close-E1-reload-still-closed.png) | ✅ |

## Console

Collected by the script's `console` + `pageerror` + `response` listeners across all 8 steps (golden + error path), final clean run:

- **jsErrors**: none
- **networkErrors**: none

## Script-authoring notes (environment quirks encountered, not app defects)

Two transient issues surfaced while stabilizing the throwaway script — both are dev-tooling/timing artifacts, not regressions in the fix under test, and did not reoccur in the final clean run recorded above:

1. **Vite dev-server cold-start dependency optimization.** The very first client-side navigation to `/room/:code` (then, on a later run, the first navigation to `/join/:code`) in a freshly started `bun run dev` process triggered `✨ new dependencies optimized... optimized dependencies changed. reloading` (visible in the dev server log for `@radix-ui/react-alert-dialog`, `qrcode.react`, `@dnd-kit/*`, then `@radix-ui/react-tabs`/`react-switch`/`react-slider`). This raced the in-flight SPA navigation and briefly surfaced a `TypeError: Failed to fetch dynamically imported module` / transient 504s on `node_modules/.vite/deps/*`. Re-running once the dev server had visited both routes once (deps warm) eliminated it entirely. Confirmed as a harness/tooling artifact, not app code, by checking the dev server log directly.
2. **Hydration timing race in the throwaway script itself (not the app).** Calling `page.fill()` on the nickname input immediately after `page.goto()` — before the client bundle finished hydrating and attaching React's controlled-input listeners — let Playwright set the DOM value, which React's hydration reconciliation then silently reset back to `""`, so the form submitted empty and validation blocked progression (`join-tabs` never appeared). Fixed by adding `await page.waitForLoadState("networkidle")` before interacting with the nickname form. This is an artifact of test-script timing, not a hydration bug in `nickname-form.tsx` — the component has no branch-on-`typeof window`, random values, or locale-dependent formatting; grepped `app/components/join/nickname-form.tsx` and `app/components/ui/input.tsx` for `style={{`/`caret-color`/`caretColor` and found none, so the one incidental hydration-mismatch console warning observed during exploration (an extra `style={{}}` attribute diff on the `<input>`, not present in app source) is a browser/timing artifact per the `feature-verifier` environment-artifact carve-out, and it did not appear at all in the final clean run recorded above.

## Findings for main thread

- None — no missing `data-testid`s blocked verification; every selector used (`dashboard-host-room-button`, `room-end-party-button`/`-dialog`/`-confirm`, `join-nickname-input`/`-submit`, `join-tabs`/`join-tab-queue`/`join-queue-tab`, `room-reconnecting-pill`, `join-unavailable`, `room-unavailable`) existed already.
- Note for anyone re-running this script against a cold dev server: expect the Vite "optimized dependencies changed, reloading" hiccup on first navigation to `/room/:code` and `/join/:code`; a warm-up pass (or accepting one throwaway failed run) resolves it. Not a code change to make.

## Verdict rationale

All 6 golden-path assertions and 1 error-path assertion passed in the final run, with zero `jsErrors` and zero `networkErrors` across the whole script. The core fix — `room.close` live-notifying the `KaraokeRoom` DO, which broadcasts `room.closed`, and both `useRoomSocket` consumers (`/room/:code`, `/join/:code`) revalidating their loader on that flag — was directly observed: the guest tab flipped to the closed state with no reload/navigation (URL unchanged), the reconnect pill never reappeared afterward (no infinite reconnect loop), and a second host tab opened post-close also rendered the closed state via the now-updated D1 record. The pre-existing D1-path behavior (direct load of `/join/:code` after close, no WS) also still works correctly. PASS.

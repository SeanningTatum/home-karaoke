# Verification: Group Karaoke — remote-start TV player, End-party removal, mic-icon removal

- **Slug**: `group-karaoke` (feature memo: `.brain/features/group-karaoke/group-karaoke.md`)
- **Date**: 2026-07-17
- **Verified by**: feature-verifier (Playwright CLI — headless script via `bun`)
- **Base URL**: http://localhost:5173 _(dev server: started by agent)_
- **Role**: admin (`admin@preview.local` / `Password123!`, from `scripts/seed-preview.ts` fixtures)
- **Verdict**: ✅ PASS — all three changes confirmed via DOM assertions; two console errors observed but attributed to the embedded YouTube iframe's own ad-tracking script hitting CORS in a headless env, not app code (see Console section)

## Scope

Three specific changes to `/room/:code` (TV screen):

1. `YoutubePlayer` no longer gates playback behind a mandatory "Start the party" click — a shared `playback.status === "playing"` calls `loadVideoById`/`playVideo` directly. The overlay (`room-start-party-button`) now only appears on `onAutoplayBlocked`. Launched Chromium with `--autoplay-policy=no-user-gesture-required` so autoplay is allowed and the overlay must never appear.
2. `room-end-party-button` is fully removed from `/room/:code` (both lobby and playing states). The phone Controls tab (`/join/:code`) keeps its own `controls-end-party` flow, unchanged.
3. `room-now-singing` at `size="tv"` renders title + "sung by X" with **no** `<svg>` icon (the phone `size="compact"` banner keeps its `IconMicrophone`, out of scope here).

## Golden path

Host signs in → creates a room from `/dashboard` → confirms no end-party button + lobby renders → a guest (separate browser context, anonymous session) joins via `/join/:code` and adds a song via the paste-a-link fallback (`https://www.youtube.com/watch?v=dQw4w9WgXcQ`) → the **host's own phone** (`/join/:code` in the same authenticated context as the TV, a second page — the Controls tab is host-gated by `session.user.id === room.hostUserId`) presses `controls-start-party` → back on the TV, confirm the overlay never appeared, the iframe loaded, and the now-singing banner has no icon.

| # | Step | Expected | Observed | Screenshot | Result |
|---|------|----------|----------|------------|--------|
| 01 | Sign in as `admin@preview.local` | Lands on `/dashboard` | Landed on `/dashboard` | [`01-login.png`](../screenshots/01-login.png) | ✅ |
| 02 | Click `dashboard-host-room-button` | New room created, navigates to `/room/:code`, lobby renders, **no** `room-end-party-button` anywhere | Room `2G4-9PT`/etc. created each run, lobby rendered, `room-end-party-button` count = 0 | [`02-room-lobby.png`](../screenshots/02-room-lobby.png) | ✅ |
| 03 | Guest (fresh context) opens `/join/:code`, submits nickname form | Anonymous session created, `join-tabs` renders | Tabs visible after nickname submit | [`03-guest-joined.png`](../screenshots/03-guest-joined.png) | ✅ |
| 04 | Guest opens paste-a-link fallback, submits YouTube URL | `resolveVideo` → `queue.add` sent over WS | Song added, no errors | [`04-song-added.png`](../screenshots/04-song-added.png) | ✅ |
| 05 | TV lobby | Queued song appears in `room-lobby-queue-summary` | Song shown in lobby queue list | [`05-tv-lobby-queued.png`](../screenshots/05-tv-lobby-queued.png) | ✅ |
| 06 | Host opens `/join/:code` on a second page in their own (authenticated) context, submits the per-page nickname form once, switches to Controls tab, presses `controls-start-party` | Host-only `join-controls-tab` renders (host session matches `room.hostUserId`); `playback.play` sent | Controls tab rendered, button clicked | [`06-controls-start-party.png`](../screenshots/06-controls-start-party.png) | ✅ |
| 07 | Back on TV (`/room/:code`) | **`room-start-party-button` absent** (0 count) — no mandatory user-gesture gate; iframe present inside `room-player-container` | `room-start-party-button` count = 0, iframe present = true | [`07-tv-playing.png`](../screenshots/07-tv-playing.png) | ✅ |
| 08 | TV now-singing banner | `room-now-singing` (tv size) shows title + "sung by VerifierGuest", **no `<svg>` child** | Text = `"Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)sung by VerifierGuest"`, svg count = 0 | [`08-now-singing-banner.png`](../screenshots/08-now-singing-banner.png) | ✅ |
| 09 | TV in playing state | `room-end-party-button` still absent (0 count) — change #2 also holds outside the lobby | count = 0 | [`09-tv-playing-no-end-party.png`](../screenshots/09-tv-playing-no-end-party.png) | ✅ |

## Error path

Bad login credentials — confirms auth still fails gracefully (not part of the three TV changes, but the required one error path for this doc), plus a quick unchanged-flow check that the phone Controls tab still has its own end-party button.

| # | Step | Expected failure surface | Observed | Screenshot | Result |
|---|------|--------------------------|----------|------------|--------|
| E1 | Fresh unauthenticated context, submit `/login` with wrong password | Inline `login-error`, stays on `/login` | `login-error` visible, URL still `/login` | [`E1-bad-login.png`](../screenshots/E1-bad-login.png) | ✅ |
| E2 | Confirm `controls-end-party` still renders on host's phone Controls tab | `controls-end-party` present (unchanged flow, per task scope — not deep-verified) | count = 1 | (covered by 06 screenshot) | ✅ |

## Console

- **jsErrors**:
  - `[host] Access to fetch at 'https://googleads.g.doubleclick.net/pagead/viewthroughconversion/...' (redirected from 'https://www.youtube.com/pagead/viewthroughconversion/...') from origin 'https://www.youtube.com' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.`
  - `[host] Failed to load resource: net::ERR_FAILED`
  - **Attribution**: both fired during step 07 (the 4s settle window after `playVideo()`), from *inside* the embedded YouTube iframe's own ad-conversion tracking script (`googleads.g.doubleclick.net`), not from `app/` code — grepped `app/` for any reference to doubleclick/googleads/pagead and found none. This is the "headless player errors (known env limitation)" the task called out explicitly (a real Chrome UA with cookies/referrer context would let this ping succeed or silently fail without a console entry; a bare headless profile with `--disable-extensions` does not). No React/hydration warning occurred anywhere across the run. Not counted as a FAIL per the task's acceptance bar (DOM-level assertions).
- **networkErrors**:
  - `401@E1` — `POST /api/auth/sign-in/email` — expected, this is the intentional bad-login error-path step.
  - No network errors on any golden-path step (01–09).

## Findings for main thread

- None. All three changes (remote-start playback with no mandatory gesture gate, `room-end-party-button` fully removed from `/room/:code`, mic icon removed from the TV `room-now-singing` banner) verified against the live app with existing `data-testid`s — no missing testids encountered.
- Minor process note (not a product bug): the Controls tab on `/join/:code` is host-gated by session identity, and the `NicknameForm` still gates the room view for every fresh page load regardless of `hasSession` (it just skips the anonymous `signIn()` call server-side) — worth keeping in mind for future test/verification scripts against this route.

## Verdict rationale

All nine golden-path assertions and both error-path checks passed against the live dev server: the TV's start-party overlay never appeared while autoplay was permitted (`--autoplay-policy=no-user-gesture-required`) and the shared `playback.status === "playing"` drove the player directly; `room-end-party-button` was absent with count 0 in both the lobby and playing states; and the TV `room-now-singing` banner rendered with zero `<svg>` children while still showing title + singer text. The only console errors were a third-party CORS failure and a `net::ERR_FAILED` originating from the embedded YouTube iframe's own ad-tracking script — not from any app code path (confirmed absent from `app/` via grep) — consistent with the known headless-environment limitation called out in the task brief. No React/hydration warnings occurred. PASS.

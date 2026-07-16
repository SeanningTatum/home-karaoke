# Feature: Karaoke UI/UX Overhaul

_Last updated: 2026-07-16_

## Purpose
Strip every remaining SaaS-boilerplate surface and reskin the app around a karaoke-first "dark night-club stage" design system — pink→gold gradient accent, a Google Fonts display face, and a 10-foot TV type scale on `/room` — so the product reads as a dedicated karaoke app rather than the cf-saas-starter it was forked from.

Plan: `plans/karaoke-ui-overhaul.html` (reviewed 2026-07-16, round 1, all 5 decisions answered).

## Decisions (round 1, 2026-07-16)
1. Direction: dark night-club stage theme (both light/dark themes kept, dark is default).
2. Scope: keep `/admin/users` and the kitchen-sink route; strip everything else boilerplate-flavored.
3. Landing: playful hero + enter-room-code field + host CTA (not a generic SaaS marketing page).
4. Delight: reskin + quick wins — join/add pop sounds behind a host mute toggle; explicitly **no** singer rotation, **no** audio normalization.
5. Typography: Google Fonts display face for headings, driven by a new `design.md` token doc.

## When It's Used
- Every user-visible surface: `/` (landing), auth screens, dashboard/host-hub, `/room/:code` (host TV screen), `/join/:code` (guest phone flow).
- Cross-feature: builds directly on feat-007 (Group Karaoke Rooms) — same room/queue/session runtime, UI-only change.

## How It Works
Six-phase rollout, each phase its own checkpoint (baseline → builder → enforcer → next phase). **Phases 1–6a complete; feature-verifier browser walk PASSED 2026-07-16.** Status line stays `in-progress` pending the separate ship flip (`/ship-feature`).

1. **Design foundation** (done) — `design.md` (repo root) + rewritten `app/app.css` tokens: dark "night-club stage" default theme (light theme kept, togglable), pink→gold gradient accent, Bricolage Grotesque (headings) + Inter (body) self-hosted via fontsource (no Google Fonts CDN dependency), 10-foot TV type scale (`tv-*` utilities), AA-contrast-tuned. Committed `f44c013`.
2. **Strip boilerplate** (done) — File Upload (feat-003) and Analytics (feat-004) chains deleted (14 files total, confirmed no other consumers); `/admin` now redirects to `/admin/users`; `/admin/users` + kitchen-sink kept per plan decision 2; home stubbed; dashboard slimmed; "Acme" branding → "Home Karaoke" (en+zh). Committed `4b1998e`. See tombstones: `.brain/features/file-upload/file-upload.md`, `.brain/features/analytics/analytics.md`.
3. **Landing + auth + dashboard rebuild** (done) — playful landing (hero, `JoinRoomCard` XXX-XXX room-code input → `/join/<code>`, how-it-works strip), reskinned `AuthShell` with karaoke copy, dashboard host-hub with gradient "Host a room" CTA. New `room-code` helpers + 11 unit tests. Committed `21ed65c`.
4. **Host TV screen reskin** (done) — `/room/:code`: lobby + playing states, roster avatar chips, added-by chips on queue rows, one-shot lobby→playing confetti (reduced-motion gated), persistent corner QR, `tv-*` 10-foot scale + safe margins. Enforcer found 3 minors (all fixed inline: compact queue-row markup, contrast token fix, `JoinPanel` root element).
5. **Guest phone reskin + quick wins** (done) — `/join/:code`: nickname/search/queue tab reskin, random-name spinner, tap-based reorder (`moveUp`/`moveToTop`, reusing the existing `queue.reorder` WS message — no protocol/DO change), position-in-queue bar, queue-almost-full warning, host Controls-tab gradient retheme. +15 unit tests (party-names + room-state reorder/standing helpers). Enforcer clean (0 findings) — single-writer reorder path verified identical for drag and tap.
6a. **Delight pass** (done) — join/add pop sounds behind a host mute toggle (`sounds.mute_label`/`unmute_label` in `room.json`); explicitly **no** singer rotation, **no** audio normalization (plan decision 4). Enforcer found 1 major (entrance animation firing one render early) — fixed inline, `isNew` now latched against mid-flight cancel in `QueueRow`.

### Verification + regression fix (2026-07-16)
`feature-verifier` ran the golden path (11 steps, TV 1920×1080 + phone 390×844) + 2 error paths → **PASS**, `.brain/features/ui-overhaul/verifications/2026-07-16.md`. It surfaced a real bug (Finding #1): the TV screen had **no way to start a party from a cold lobby** — `HostControls`' play button and `QueueRail` both lived inside a grid gated `hidden` while `!hasCurrentItem`, and `hasCurrentItem` only flips true *after* the very `playback.play` message that button sends. Fixed same-day in `app/routes/room/$code.tsx` (lobby block, ~line 480-600): once `queue.length > 0`, the lobby now renders a compact queue summary + a big gradient "Start the party" button (`room-lobby-start-party`) that sends the identical `playback.play` message; also fixed a `min-h-0`/overflow bug (Finding #3) so the lobby never overflows a TV viewport. Re-verified live via a throwaway Playwright script — confirmed no scroll overflow and the start-party flow works; screenshot `screenshots/14-lobby-start-party.png`. `bun run typecheck`/`test` (401/401)/`build` all green after the fix.

**Known gap carried forward, not fixed (Finding #2, out of feat-008's assigned scope):** ending a room (`room.close`) only updates D1 — it never notifies the room's Durable Object to broadcast a close event, so a guest with an already-open tab keeps seeing live UI until they refresh/reload (loader then correctly shows the closed state). Flagged for a future fix; does not affect data integrity, only live-UX latency on room close.

### Persistence details
No new persistence — this is a UI/UX-only overhaul over the existing feat-007 data model (room/song/search_log/room_song tables, KaraokeRoom DO). No schema changes landed. Client-only additions: mute-toggle preference, room-code parsing helpers — no new server-side state.

### Testability
401 unit tests (was 388 pre-delight-pass; +13 net across phases 3-6a, offset by the 14-file boilerplate deletion in Phase 2 which also removed tests). `feature-verifier` browser walk (`verifications/2026-07-16.md`, PASS) covers landing → login → dashboard → room creation → guest join → search/paste-add → tap-reorder (phone + TV) → 2 error paths, across TV and phone viewports, plus the post-fix live re-check. Both themes exercised visually during builder passes (dark default is what verification ran against); no separate light-theme browser walk recorded.

## Key Files

| File | Role |
|------|------|
| `design.md` (repo root) | Token system: colors, pink→gold gradient, font stack, TV type scale, spacing |
| `app/app.css` | Tailwind theme tokens (`:root`, `.dark`, `@theme inline`) implementing `design.md` |
| `app/routes/home.tsx` + landing components | Playful hero, `JoinRoomCard` (room-code entry), host CTA |
| `app/routes/authentication/*` | Reskinned `AuthShell` |
| `app/routes/dashboard/_index.tsx` | Slimmed host-hub dashboard |
| `app/routes/room/$code.tsx` | Host TV screen — lobby/playing states, `HostControls`, `QueueRail`, lobby start-party fix |
| `app/routes/join/$code.tsx` + `app/components/join/*` | Guest phone flow — nickname, search/paste-add, tap-reorder, position bar |
| `app/lib/room-state.ts` | `applyClientMessage` — shared reducer incl. `moveUp`/`moveToTop` |
| `app/locales/{en,zh}/room.json` | All `/room` + `/join` copy (see `codebase/i18n.md`) |
| `.brain/features/file-upload/file-upload.md`, `.brain/features/analytics/analytics.md` | Tombstones for the two features cut in Phase 2 |

## Dependencies
- feat-007 (Group Karaoke Rooms) — same room/session/queue runtime; this feature only changes presentation.
- Effect services / repos: none new — Phase 2 removed `AnalyticsRepository` + its tRPC router; `BucketRepository` retained but now unconsumed.
- UI primitives: shadcn components, Tailwind theme tokens, Bricolage Grotesque + Inter (self-hosted via fontsource, not a Google Fonts CDN link).

## Tagged Errors
None introduced — UI-only feature.

| Error | Where raised | tRPC code |
|-------|--------------|-----------|
| — | — | — |

## Changelog

| Date | Type | Description |
|------|------|--------------|
| 2026-07-16 | feature | Phases 1-6a complete; feature-verifier PASS; lobby start-party + overflow regression found and fixed same-day (see "Verification + regression fix" above). Room-close→guest-broadcast gap (Finding #2) flagged, not fixed — carried forward. Status remains `in-progress` pending `/ship-feature`. |
| 2026-07-16 | feature | feat-008 scoped and started (in-progress). Plan reviewed, 6 phases defined. |

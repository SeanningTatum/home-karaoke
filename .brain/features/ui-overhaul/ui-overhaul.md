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

## How It Works (planned — fill in as phases land)
Six-phase rollout, each phase its own checkpoint (baseline → enforcer → next phase):

1. **Design foundation** — write `.brain/.../design.md` (or repo `design.md`) capturing the token system (colors, gradient, font stack, TV type scale, spacing) + wire Tailwind/theme foundation for both light and dark night-club themes.
2. **Strip boilerplate** — remove generic SaaS marketing/demo surfaces; keep `/admin/users` and the kitchen-sink route intact; audit for dead links/copy referencing the old starter.
3. **Landing + auth + dashboard rebuild** — new playful landing (hero, room-code entry, host CTA), reskinned auth screens, slimmed-down host-hub dashboard.
4. **Host TV screen reskin** — `/room/:code`: lobby state, persistent join QR, added-by queue chips, celebration moments, 10-foot type scale.
5. **Guest phone reskin + quick wins** — `/join/:code`: nickname spinner, Verse-style search/add UI, tap-based move-up/move-to-top reorder, position-in-queue bar.
6. **Delight pass + verification + ship** — join/add pop sounds behind host mute toggle, final polish pass, feature-verifier browser walk (both themes), `/verify-done`, ship.

### Persistence details
No new persistence — this is a UI/UX-only overhaul over the existing feat-007 data model (room/song/search_log/room_song tables, KaraokeRoom DO). No schema changes expected. If a phase needs new client-only state (e.g. mute toggle preference), note it here when it lands.

### Testability
To be filled in per phase. Expect: unit tests for any new pure helpers (e.g. type-scale/token utilities), feature-verifier browser walks per major surface (landing, auth, dashboard, host TV, guest phone) in both light and dark themes, `verifications/<date>.md` + `screenshots/` per walk.

## Key Files

| File | Role |
|------|------|
| TBD — filled in as phases land | |

## Dependencies
- feat-007 (Group Karaoke Rooms) — same room/session/queue runtime; this feature only changes presentation.
- Effect services / repos: none new expected (UI-only).
- UI primitives: shadcn components, Tailwind theme tokens, Google Fonts.

## Tagged Errors
None expected — UI-only feature. Update if a phase introduces new client-side error states.

| Error | Where raised | tRPC code |
|-------|--------------|-----------|
| — | — | — |

## Changelog

| Date | Type | Description |
|------|------|--------------|
| 2026-07-16 | feature | feat-008 scoped and started (in-progress). Plan reviewed, 6 phases defined. |

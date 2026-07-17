# Feature: TV Beta Feedback Polish

_Last updated: 2026-07-16_

## Purpose
Polish pass on the host TV screen (`/room/:code`) driven by the first real beta session. Seven complaints, all TV-side: the lobby scrolled instead of fitting the screen, the playing layout wasted video space, the "you're up" overlay was translucent and too short, TV play/skip duplicated the phone host controls, the title/queue type was oversized, and the sounds were too timid.

Plan: `plans/tv-beta-feedback.html` (reviewed 2026-07-16, round 1, all 3 decisions answered).

## Decisions (round 1, 2026-07-16)
1. **TV play/skip removed entirely** — the phone Controls tab (`app/components/join/controls-tab.tsx`, host-gated) is the only playback surface. Lobby gets a "control from your phone" hint.
2. **Sounds: richer multi-note synth jingles** (arpeggios, louder gain) + a new "your turn" fanfare synced to the overlay — no audio assets; keep injectable-ctx test pattern.
3. **Builders: opus on phase 2** (playing layout, widest blast radius), sonnet on phases 1/3/4.
- Annotation: the feat-008 persistent corner QR **stays for the lobby state only**; in the playing state the QR lives in the right rail.
- Noted (not yet in scope): host phone re-auth friction — host-first control QR proposed as follow-up.

## Scope (the 7 feedback items)
1. Lobby → horizontal two-column: QR hero left, joined-guest roster right; zero page scroll at 1920×1080; roster scrolls internally past ~20 guests.
2. Playing state maximizes video: left column = video player at max size + title; right rail (~300–320px) = participants top, queue middle, QR bottom.
3. "You're up" overlay: backdrop 100% opaque, dismiss timer 2.5s → 5s, animated exit (fade/scale-out); reduced-motion gate stays.
4. TV play/skip hidden (removed) — phone-only host controls.
5. Title (now-singing banner): 56px → ~36px, wraps up to 2 lines with clamp.
6. Queue heading: 36px → ~22px; queue rail narrower.
7. Sounds gamified per decision 2.

## When It's Used
- Host opens `/room/:code` on the TV — both lobby and playing states.
- Guests join via QR → roster/queue updates animate on the TV.
- Host drives playback exclusively from the phone Controls tab.

## How It Works
Pure presentation-layer feature: no Durable Object, WebSocket protocol, D1 schema, or tRPC changes. All edits live in `app/routes/room/$code.tsx`, `app/components/room/*`, `app/lib/party-sounds.ts`, and `app/app.css`.

### Testability
- `app/lib/party-sounds.ts` unit tests (injectable AudioContext) extended for jingles + fanfare — 28 tests; `app/lib/now-up-overlay-state.ts` pure transition helper — 8 tests. Suite total 424.
- Verification: [`verifications/2026-07-17.md`](verifications/2026-07-17.md) — **PASS** 7/7 golden steps (TV 1920×1080 + phone 390×844 contexts) + zero-guest empty state + 91-char title clamp edge; overlay measured opacity 1 full-viewport ~5s; right rail measured 320px; zero jsErrors/networkErrors; 12 screenshots.

## Key Files

| File | Role |
|------|------|
| `app/routes/room/$code.tsx` | TV route — lobby + playing grids, overlay timer, sound triggers |
| `app/components/room/join-panel.tsx` | QR panel (lobby hero + right-rail variant) |
| `app/components/room/roster-strip.tsx` | Participant list (right-rail variant) |
| `app/components/room/now-up-overlay.tsx` | "You're up" announcement overlay |
| `app/components/room/now-singing-banner.tsx` | Song title banner |
| `app/components/room/queue-rail.tsx` | Queue list + heading |
| `app/components/room/host-controls.tsx` | TV play/skip — removed per decision 1 |
| `app/lib/party-sounds.ts` | WebAudio synth engine + tests |
| `app/app.css` | tv-* type scale, animations, exit keyframes |

## Dependencies
- feat-008 (ui-overhaul) — design system + TV scale this polishes.
- feat-007 (group-karaoke) — room DO/WS protocol (read-only consumer).

## Status
Shipped 2026-07-17. Phases 1–4 (commits eb5aa63, 6b4b29b, + overlay & sounds commits) + enforcer clean + verify-done all gates PASS (typecheck 0 / 424 tests / e2e smoke 2/2 / build / harness 11/11) + verification PASS 2026-07-17.

Known follow-up (out of scope, needs owner decision): host phone re-auth friction — beta host had to authenticate again on the phone to reach the Controls tab. Proposed: host-first control QR (one-time host-claim token) shown on TV before the guest-join QR flow.

# Feature: Layout Evolution

_Last updated: 2026-07-24_

## Purpose
Give the Velvet Stage skin (feat-012) the right page bones on three surfaces: the landing page becomes a full single-scroll marketing site, the dashboard is re-imagined as a host hub (previous sessions on real data + a featured-playlists coming-soon rail), and the party screen (`/room/:code`) gets a measured spacing/rhythm pass. Plan: `plans/layout-evolution.html` (reviewed 2026-07-24, round 1, 5/5 decisions on recommended options).

## When It's Used
- Anonymous visitor lands on `/` — marketing page with join-code entry.
- Host signs in → `/dashboard` — stage hero (Start a party), previous-sessions rail, featured-playlists rail.
- Host runs a party on `/room/:code` — lobby + playing layouts with the unified TV spacing scale.

## How It Works
UI-layer work over existing data flows, plus one new read path:

- `RoomRepository.listRoomsByHost({ hostUserId, limit })` — rooms by host, newest first, each with a played-song count (grouped join on `roomSong`). No schema changes.
- `room.listMine` tRPC query — auth-gated (non-anonymous), `runProcedure`, Effect Schema output. Dashboard renders the rail from it; failures degrade to the rail's quiet empty state and never block the Start-a-party hero.
- Featured playlists are static curated cards with a coming-soon badge — no backend, non-interactive by design (decision 4). Removing the badge later is the launch.
- Previous-session cards are summary-only (code, date, songs sung) — no detail view in this feature (review answer).

### Persistence details
- Reads only: `room` (code, hostUserId, status, createdAt, closedAt) + `roomSong` (playedAt) in D1. No new tables, no migrations.

### Testability
- Unit: `listRoomsByHost` ordering/counts/host-isolation; `room.listMine` auth gating.
- feature-verifier walk at 1920×1080 + 390×844: landing sections, dashboard rails with real seeded session data, lobby + playing spacing. Verification doc under `verifications/`.

## Key Files

| File | Role |
|------|------|
| `app/routes/home.tsx` | Landing marketing page (nav, hero, features, CTA band, footer) |
| `app/routes/dashboard/_index.tsx` | Host hub (top bar, stage hero, sessions + playlists rails) |
| `app/routes/room/$code.tsx` | Party screen spacing pass (lobby + playing) |
| `app/repositories/room.ts` | `listRoomsByHost` |
| `app/trpc/routes/room.ts` | `room.listMine` query |
| `app/locales/{en,zh}/{home,dashboard}.json` | New copy, both locales |
| `scripts/seed-preview.ts` | Closed-room + roomSong fixtures for the rail |

## Dependencies
- feat-012 Velvet Stage tokens (`bg-stagelight`, `code-marquee`, brass, Fraunces TV scale)
- `Database` service, `RoomRepository`, Better Auth session (host gating)
- Frozen: all existing data-testids, i18n keys, TV ≥24px + tv-safe rules, no gradient controls

## Tagged Errors
None new — `room.listMine` reuses existing auth/session errors already mapped in `tagToTRPC`.

## Changelog

| Date | Type | Description |
|------|------|-------------|
| 2026-07-24 | feature | Plan approved (5 decisions); feat-013 in-progress |

# Feature: Party Screen Cinema

_Last updated: 2026-07-24_

## Purpose
Rethink the **playing state** of `/room/:code` as a cinema: the video is the only hero, everything else is instrumentation. Fixes what feat-013's spacing pass left behind — a 128px two-line raw-YouTube-title block, a ~250px void in the rail when the queue is empty, and a hard-black video box on cream paper in the light theme. Plan: `plans/party-screen-cinema.html` (reviewed 2026-07-24, round 1, 4/4 decisions on recommended options; both open questions approved to explore).

## Measured baseline (before)
| Metric | Before |
|---|---|
| Now-playing block | 112px + 16px gap (36px Fraunces, title wraps) |
| Video height | 76% of viewport @1512×900, 79% @1920×1080 |
| Empty queue panel | 389px tall, text top-anchored → ~250px visible void |
| Participants strip | 64px for a single 24px avatar |
| Rail inset vs page left margin | 4px vs 80px |

## When It's Used
Whenever a song is playing on the host TV screen (`playback.currentItem != null`). The lobby state is untouched structurally, but inherits the shared rail children's type/label changes.

## How It Works
- **Always-dark theater surface** — the playing container carries the `dark` class. `next-themes` runs `attribute="class"` and `app.css` defines `.dark { --background: … }`, so every token inside resolves to Velvet Stage values even when the app theme is Matinee. Nothing else in the app changes theme behavior.
- **`cleanSongTitle(title, channel)`** (`app/lib/song-title.ts`, pure + unit-tested) — strips karaoke/version/quality noise (`| Karaoke Version`, `(HD Karaoke)`, `(Official Video)`, `(4K Remaster)`, `[HD]`, `M/V`, channel tails), collapses whitespace, then splits on the first spaced hyphen. Direction comes from data, not a guess: if the left segment matches the `channel` (normalized: lowercased, non-alphanumerics and `official`/`vevo`/`karaoke`/`channel`/`topic` removed) the left side is the artist; otherwise the karaoke convention (`Song - Artist`) applies. Any cleaning that would leave an empty song falls back to the raw title. **Display-only** — the raw `title` remains the stored/queue/history value.
- **Now-playing bar** — `NowSingingBanner`'s `tv` variant is a single row: `NOW SINGING` eyebrow, cleaned song title, artist after a middot, singer avatar chip, and the remaining-time value.
- **Rail as one panel** — a single bordered panel with hairline dividers and three zones: guest avatar cluster band → `UP NEXT` list filling the middle (empty state anchored under the label, not centered in the void) → QR ticket stub attached at the bottom.
- **NEXT UP callout** — the first queued row is marked so the next singer can get ready.
- **Progress indicator** — `YoutubePlayer` polls its own `getCurrentTime()`/`getDuration()` and reports upward; the TV renders a quiet progress line plus a remaining-time value. Local to the host screen — no extra WebSocket traffic.

### Testability
- Unit: `cleanSongTitle` against real D1 strings (KaraFun/Atomic/official channels, CJK titles, medleys, no-hyphen titles, empty-after-cleaning fallback) and the remaining-time formatter.
- Measured re-capture at 1512×900 and 1920×1080 in both themes: video ≥85% of viewport, now-playing bar ≤72px, no rail gap >32px, title on one line.
- feature-verifier walk of the playing state with a multi-song queue and a long title, plus the lobby to prove no regression.

## Key Files
| File | Role |
|------|------|
| `app/lib/song-title.ts` | `cleanSongTitle` helper (pure) |
| `app/lib/__tests__/song-title.test.ts` | Unit tests |
| `app/components/room/now-singing-banner.tsx` | Single-line now-playing bar (tv variant) |
| `app/components/room/queue-rail.tsx` | UP NEXT zone, NEXT UP callout, anchored empty state |
| `app/components/room/roster-strip.tsx` | Guest avatar cluster band |
| `app/components/room/join-panel.tsx` | Ticket stub variant |
| `app/components/room/youtube-player.tsx` | Progress reporting |
| `app/routes/room/$code.tsx` | Theater surface, rail panel composition, framing |
| `app/app.css` | New TV type utilities |

## Dependencies
feat-013 layout spacing scale · feat-012 Velvet Stage tokens (`bg-stagelight`, brass, Fraunces, `code-marquee`) · YouTube IFrame API · room WebSocket state (`playback.currentItem`, `queue`, `roster`).

## Tagged Errors
None new.

## Changelog
| Date | Type | Description |
|------|------|-------------|
| 2026-07-24 | feature | Plan approved (4 decisions + 2 explorations); feat-014 in-progress |

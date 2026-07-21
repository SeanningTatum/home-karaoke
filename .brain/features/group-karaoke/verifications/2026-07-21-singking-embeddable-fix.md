# Verification — non-embeddable videos (Sing King) can't play; filter them from search

**Date:** 2026-07-21
**Change:** `youtube.search` now filters out videos whose owner disabled
embedding; `resolveVideo` rejects them as a paste-a-link safety net (PR #10).
**Verdict:** ✅ PASS

## The real problem (empirically confirmed)

Sing King videos report `status.embeddable: false` on the YouTube Data API
because **their owner disabled embedding**. This is not a false flag — YouTube
blocks such videos in any third-party iframe. Proven with the IFrame API on the
preview origin, same page/config for both:

| Video | `embeddable` | IFrame `onError` |
|-------|--------------|------------------|
| Sing King — Dancing Queen `WHayJZ3eMcE` | `false` | **150** (embedding disabled by owner) |
| control — Rick Astley `dQw4w9WgXcQ` | `true` | plays (state 1) |

So they can NEVER play in the embedded player. The earlier approach (let them
queue, rely on the player to skip) just produced a song that instantly
auto-skips. The correct fix is to keep them out of the pickable results and
steer users to the many embeddable karaoke versions.

## Environment

Playwright against the live preview Worker
`https://home-karaoke-preview.royal-snowflake-2464.workers.dev` (fix branch,
real `YOUTUBE_API_KEY`). The bug only reproduces with a real Data API key —
local dev has none and falls back to oEmbed, which can't report embeddability.

## Walked

1. **Before** (`screenshots/singking-01-before-singking-in-results.png`): a
   "dancing queen" search used to surface "ABBA - Dancing Queen (Karaoke
   Version)" by **Sing King** as the top hit.
2. **After** (`screenshots/singking-04-filtered-results.png`): the same search
   now returns only embeddable channels — Atomic Karaoke, **KaraFun**, Zoom
   Karaoke, Musisi, KaraokeyTV, … — **no Sing King**. The `videos.list`
   embeddability pass dropped it.
3. Added the KaraFun version → queued → started playback from the guest
   Controls tab → **it plays on the host big screen with live karaoke lyrics**
   (`screenshots/singking-05-host-playing.png`). The only host console errors
   are YouTube's own ad-tracking pings (googleads/doubleclick) blocked by CORS
   from inside the YT iframe — not app errors.

## Regression coverage

- `app/services/__tests__/youtube.test.ts` — search filters out
  `embeddable:false` results (via the videos.list batch), and degrades to
  unfiltered results if that lookup fails.
- `app/trpc/routes/__tests__/youtube.test.ts` — `resolveVideoProgram` rejects
  `embeddable:false` with `VideoNotEmbeddableError` (paste-a-link safety net).
- `app/lib/__tests__/effect-trpc.test.ts` — `VideoNotEmbeddableError` →
  `BAD_REQUEST` mapping.
- `SongRepository.getCachedPicks` also filters `embeddable = true` so a
  previously-cached non-embeddable pick can't resurface. 521 unit tests pass.

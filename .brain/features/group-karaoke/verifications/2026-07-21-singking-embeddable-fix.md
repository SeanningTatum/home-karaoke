# Verification — Sing King (non-embeddable) queueing fix

**Date:** 2026-07-21
**Change:** removed the server-side `embeddable === false` rejection in `youtube.resolveVideo` (see feature changelog / PR #10).
**Verdict:** ✅ PASS

## Environment

Driven with Playwright against the **live preview Worker**
`https://home-karaoke-preview.royal-snowflake-2464.workers.dev` — deployed from
the fix branch with the real `YOUTUBE_API_KEY` secret set. This matters: the
bug only reproduces with a real Data API key (the keyless oEmbed fallback
always reports `embeddable: true`), so local dev can't exercise it. The preview
Worker uses the real `videos.list`, which returns `status.embeddable: false`
for Sing King videos.

## Golden path walked

1. Host signs up → dashboard → **Host a karaoke room** → `/room/PX4-E87`.
2. Guest joins `/join/PX4-E87`, picks nickname "Verifier".
3. Search **"dancing queen"** → results list. Top hit is
   **"ABBA - Dancing Queen (Karaoke Version)" by Sing King** — the exact video
   the real Data API flags `embeddable: false`
   (`screenshots/singking-01-search-results.png`).
4. Tap **Add** on the Sing King result → **it queues successfully**: the tab
   switches to Queue, "1 song", item shown with its real thumbnail, "next one
   is #1". No "That video can't be played here" error toast
   (`screenshots/singking-02-queued-success.png`).
5. Host big screen picks up the same song live over the WebSocket — "1 song",
   "ABBA - Dancing Queen (Karaoke Version)" by Verifier
   (`screenshots/singking-03-host-synced.png`). Console: 0 errors.

**Before the fix** this exact video returned `VideoNotEmbeddableError` → 400 and
never queued. **After the fix** it queues; genuinely broken embeds are still
handled at playback by the player's `onError` (toast + auto-skip).

## Regression coverage added

- `app/trpc/routes/__tests__/youtube.test.ts` — deterministic (no network) unit
  test of the extracted `resolveVideoProgram`: a video the API flags
  `embeddable: false` resolves and is persisted rather than rejected, plus
  URL-parse / not-found paths. 5 tests.
- `e2e/group-karaoke-queue.spec.ts` — Playwright e2e of the full add-to-queue
  golden path (host create → guest join → paste-link add → queue + WS sync),
  passing locally.

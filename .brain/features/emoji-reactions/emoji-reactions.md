# Feature: Emoji Reactions

_Last updated: 2026-07-17_

## Purpose
Guests on their phones send live emoji reactions while someone is singing; the emojis fly up the host TV screen Google-Meet-style (and, smaller, on every phone). When the song ends, the TV shows a ~3.5s recap card ("<name> got the crowd going!" + total + per-emoji breakdown) for the singer who just finished, sequenced *before* the existing "You're up" card. Fixed 6-emoji palette: 👏 🔥 ❤️ 😭 🤩 🎉 (human-chosen in plan review).

**Status: built + verified.** Plan `plans/emoji-reactions.html` (reviewed round 1, 4 decisions answered 2026-07-17). Verification [`verifications/2026-07-17.md`](verifications/2026-07-17.md) PASS — 11/11 golden steps + error path, 0 app-origin console errors.

## When It's Used
- **Guest phone** (`/join/:code`): persistent `ReactionBar` strip (6 emoji buttons) stacked above `PositionBar`, visible on every tab; enabled only while `playback.status === "playing"`. Taps batch per-emoji over 300ms → one `reaction.send {emoji, count}` per touched emoji.
- **Host TV** (`/room/:code`): `ReactionOverlay` (fly-up particles over the video, pop sound throttled ≤1/700ms) + `ReactionRecap` card at song end (recap sting sound), which defers the "You're up" announcement by `RECAP_MS` (3.5s).
- **All phones**: same `ReactionOverlay` with `variant="phone"` (smaller emoji) — reactors get shared feedback. Recap is TV-only.
- Host reacts via their own phone (`/join/:code`); TV remains a passive display (feat-009 rule).

## How It Works
- **Transient events, not snapshot state**: `reaction.burst` / `reaction.recap` bypass the `RoomSocketState` snapshot switch in `use-room-socket.ts` — handled as early-returns (like `room.closed`) and delivered via `onReactionBurst` / `onReactionRecap` callback options (ref-stashed). Keeps the exhaustive switch compiling with zero new cases.
- **Wire protocol** (`room-ws.ts`): `ReactionSendMessage` (client; `emoji` is a `Schema.Literal` union of `REACTION_EMOJIS`, optional `count` int 1..`MAX_REACTION_BATCH`=20), `ReactionBurstMessage` (server fan-out), `ReactionRecapMessage` (server; `singerNickname`, `total`, `breakdown[]`).
- **Tally** lives in `RoomLiveState.reactions` (`ReactionTally`, pure helpers in `app/lib/reactions.ts`), mutated by the `reaction.send` reducer case, reset to `EMPTY_TALLY` inside `advanceToNext`. **Ephemeral by design**: the DO **skips `persist()` for `reaction.send`** (no SQLite write per reaction); a mid-song DO eviction undercounts that one recap — accepted.
- **Recap emission**: `broadcastsForMessage` changed to 3-arg `(message, prevState, nextState)`. On skip/videoEnded/play, when an advance actually occurred (incl. advance-to-null at queue end) AND `tallyTotal(prev.reactions) > 0`, a `reaction.recap` built from **prev** state is **prepended before** `queue.updated`/`playback.updated`. Ordering is load-bearing: the TV's `onReactionRecap` sets `recapActiveRef` before the currentItem-change effect fires, so the "You're up" card + fanfare defer by `RECAP_MS`. Idempotent stale-id skips emit no recap; zero-reaction songs behave exactly as before.
- **Gating**: `canPerform` allows `reaction.send` for host AND guest, only while `playback.status === "playing"` (also blocks lobby reactions). Rate limiting v1 (human decision): client 300ms batching + schema/reducer clamp ≤20 + `MAX_PARTICLES_PER_BURST` 12 + `MAX_ACTIVE_PARTICLES` 40 DOM cap — **no DO-side throttle** (escape hatch specced in plan if abuse appears).
- **Fly-up**: `ReactionOverlay` (forwardRef, `burst(emoji, count)` imperative handle, `variant="tv"|"phone"`), particles via pure `makeParticle` (injected rng, deterministic tests), CSS `animate-reaction-float` (drift/rotate via custom props, 2.5–4s duration), reduced-motion skips spawning entirely; recap card + aria-live regions still render.
- **Sounds**: `REACTION_POP_SOUND` (single note, TV, throttled) + `REACTION_RECAP_SOUND` (3-note sting) in `party-sounds.ts`, both behind the existing mute.
- **Recap card**: own pure display-state module `app/lib/reaction-recap-state.ts` (parallel to `now-up-overlay-state.ts` — shape differs: the card owns its 3.5s visible timer, the parent doesn't). Reuses `animate-now-up`/`-out` keyframes; animationend-bubbling guard; sr-only `aria-live` region.

### Persistence details
None new — no D1 tables, no bindings, no tRPC procedures. Live tally in DO memory only (see above). **Follow-up (user-confirmed in plan review): a future party-end recap feature ("most-cheered singer of the night") will need reaction totals persisted to D1.**

### Testability
Unit: `reactions.test.ts` (19), `reaction-recap-state.test.ts` (10), room-ws round-trips + invalid-emoji/count rejections, room-state reaction/recap/ordering/gating cases, party-sounds new jingles + mute — **482 tests total (35 files)**. Browser walk: [`verifications/2026-07-17.md`](verifications/2026-07-17.md) PASS (11/11 golden: react → TV+phone fly-up → skip → recap → deferred You're-up; zero-reaction song → no recap; error path: bar disabled while nothing playing). Recap-translucency finding withdrawn — capture-timing artifact (opacity 0.49 at 89ms into the 0.3s entrance; opacity 1 at steady state, `09b-tv-recap-steady.png`).

## Key Files

| File | Role |
|------|------|
| `app/lib/schemas/room-ws.ts` | `REACTION_EMOJIS`, `ReactionSendMessage`/`ReactionBurstMessage`/`ReactionRecapMessage` |
| `app/lib/reactions.ts` | Pure tally + particle helpers (clamp, apply, total, breakdown, makeParticle, caps) |
| `app/lib/room-state.ts` | `reactions` in `RoomLiveState`, reducer case, `canPerform` gate, 3-arg `broadcastsForMessage` + recap prepend |
| `app/durable-objects/karaoke-room.ts` | prev/next capture, selective persist (skip for reaction.send) |
| `app/hooks/use-room-socket.ts` | `onReactionBurst`/`onReactionRecap` early-return callbacks |
| `app/components/room/reaction-overlay.tsx` | Shared fly-up layer (tv/phone variants) |
| `app/components/room/reaction-recap.tsx` | TV recap card (`RECAP_MS` 3.5s, `data-testid="reaction-recap"`) |
| `app/lib/reaction-recap-state.ts` | Pure display-state for the recap card |
| `app/components/join/reaction-bar.tsx` | Phone emoji row (300ms batching, `data-testid="join-reaction-bar"`) |
| `app/routes/room/$code.tsx` | TV wiring: overlay ref, throttled pop, recap → deferred "You're up" |
| `app/routes/join/$code.tsx` | Phone wiring: bar + phone overlay, sticky stack with PositionBar |
| `app/lib/party-sounds.ts` | `REACTION_POP_SOUND`, `REACTION_RECAP_SOUND`, `playReactionPop`/`playRecap` |
| `app/locales/{en,zh}/room.json` | `reactions.*` strings (zh has `_other` plural only — CLDR) |

## Dependencies
- feat-007 group-karaoke (WS protocol, DO, room-state reducers), feat-008 ui-overhaul (TV type scale, overlay look), feat-009 tv-beta-polish (NowUpOverlay pattern, PartySounds, phones-are-the-input rule)
- No new external SDKs or CF bindings

## Tagged Errors
None — WS-only feature; invalid messages drop through the existing `decodeClientMessage` Either path.

## Changelog

| Date | Type | Description |
|------|------|-------------|
| 2026-07-17 | feature | Built + verified via coordinated multi-agent run (opus architect/Phase-1, parallel sonnet TV/phone, enforcer clean 0 findings). Plan `plans/emoji-reactions.html` reviewed round 1 (4 decisions: sequenced recap 3.5s→You're-up 5s; no DO throttle v1; palette 👏🔥❤️😭🤩🎉; phone fly-up yes, recap TV-only). Commits ea569f4 (protocol/reducers/DO/hook/overlay) + 78d54c3 (TV recap + phone bar). |

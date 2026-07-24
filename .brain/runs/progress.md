# Progress — Rolling session log

> Single rolling log of "where am I right now". Append-only. Newest entry on top. **Per-task deep state lives in `<YYYY-MM-DD>-<task-slug>.md`** — this file is the index/state cursor.

## How to use

- **Start of session**: read the top entry to recover state.
- **During session**: append one bullet per meaningful checkpoint (decision, blocker, branch switch, test failure, scope change).
- **End of session**: add a `## Session end` block with: branch, last commit SHA, what's running/incomplete, what to do next.
- **Multi-day task**: link to the run note (`runs/<date>-<slug>.md`) for full detail. Keep entries here under ~5 lines each.

## Format per entry

```
## YYYY-MM-DD HH:MM (UTC) — <one-line summary>
- branch: <branch-name>
- in-progress feature: <feat-id> | none
- run note: <path or none>
- next: <one sentence>
```

---

## 2026-07-24 — feat-012 visual-redesign shipped + PR #12 opened (feat/visual-redesign → main, 2 commits). Velvet Stage: wine-black stagelight tokens, Fraunces+JetBrains Mono, gradient retirement (13 sites), marquee room-code signature, per-page passes (landing w/ real product shots, auth vignette, dashboard, TV, phone). Verification PASS 10/10 + error path, 521 unit, e2e 3/3, build green, brain check 11/11.
- branch: `feat/visual-redesign`
- in-progress feature: none
- run note: none
- next: PR #12 review/merge; future: wordmark refresh, matinee art-direction if needed

---

## 2026-07-24 — PR opened for visual-redesign: https://github.com/SeanningTatum/home-karaoke/pull/12
- branch: `feat/visual-redesign`
- in-progress feature: none
- run note: none

---

## 2026-07-24 — shipped visual-redesign: Verification .brain/features/visual-redesign/verifications/2026-07-23.md PASS 10/10 golden + 1/1 error path, zero consol
- branch: `feat/visual-redesign`
- in-progress feature: none
- run note: none

---

## 2026-07-23 — started feat-012 visual-redesign (Velvet Stage design system)
- branch: `docs/readme-marketing-rewrite`
- in-progress feature: feat-012
- run note: none
- next: Phase 1 — tokens + type (Fraunces display serif, JetBrains Mono, wine-black/spotlight-pink/brass tokens); plan `plans/visual-redesign.html` reviewed round 1, 5/5 decisions

---

## 2026-07-18 — merged origin/main into feat/guest-avatars; emoji-reactions keeps feat-010, guest-avatars renumbered feat-010 → feat-011
- branch: `feat/guest-avatars`
- in-progress feature: none
- run note: none
- next: verify-done (typecheck/test/build/harness-check), then PR #9 review/merge

---

## 2026-07-17 — PR #9 opened for feat-011 guest-avatars (feat/guest-avatars → main, 6 commits): annotation fix pass (3 pins: centered camera preview, flush-left lobby chips, avatar-only compact roster) + pre-PR Greptile (P1 Content-Length pre-check user-approved, P2 no-throw downscale) — both fixed, 458 tests green
- branch: `feat/guest-avatars`
- in-progress feature: none
- run note: none
- next: Watch PR #9 CI + human review; merge when green

---

## 2026-07-17 — PR opened for guest-avatars: https://github.com/SeanningTatum/home-karaoke/pull/9
- branch: `feat/guest-avatars`
- in-progress feature: none
- run note: none

---

## 2026-07-17 — feat-010 emoji-reactions PR #8 opened (feat/emoji-reactions → main, 6 commits ea569f4..613d3d5). Beta annotation pass (4 pins: fixed bottom bar, opacity-100 fly-ups, canvas-confetti — all superseded after live re-verify). Greptile pre-PR review: 3 findings all auto-fixed 613d3d5 (RECAP_TOTAL_MS deferral so You're-up entrance isn't hidden behind recap exit; EXIT_FALLBACK_MS export; sendRef in reaction-bar flush). 482 tests green.
- branch: `feat/emoji-reactions`
- in-progress feature: none
- run note: none
- next: Await human review/merge of PR #8. Follow-up candidate: party-end recap feature (D1-persisted reaction totals).

---

## 2026-07-17 — PR opened for emoji-reactions: https://github.com/SeanningTatum/home-karaoke/pull/8
- branch: `feat/emoji-reactions`
- in-progress feature: none
- run note: none

---

## 2026-07-17 — shipped guest-avatars: verifications/2026-07-17.md PASS 12/12 golden + error path; 458 unit tests; e2e smoke 2/2; build green; enforcer 0 findi
- branch: `beaver/08399871`
- in-progress feature: none
- run note: none

---

## 2026-07-17 — shipped emoji-reactions: Shipped 2026-07-17. Plan plans/emoji-reactions.html (reviewed round 1, 4 decisions). 2 build commits ea569f4+78d54c3 (op
- branch: `feat/emoji-reactions`
- in-progress feature: none
- run note: none

---

## 2026-07-17 — guest-avatars plan reviewed round 1: 5/5 decisions on recommended (stable R2 key+?v=, server setUserImage, 512px downscale, mid-room change out-of-scope, plain file input); open Qs resolved (seeds stay initials; anon-avatar cleanup deferred to future account-upgrade-at-session-end feature)
- branch: `beaver/08399871`
- in-progress feature: none
- run note: none
- next: Phase 1 build (server data plane) via opus builder

---

## 2026-07-17 — guest-avatars (feat-011) registered in feature_list.json, in-progress
- branch: `beaver/08399871`
- in-progress feature: feat-011 (guest-avatars)
- run note: runs/2026-07-17-guest-avatars.md
- next: feature memo stub created at features/guest-avatars/guest-avatars.md (design + key files TODO); proceed to opus architecture pass + phased build

---

## 2026-07-17 — guest-avatars started: guest profile-picture upload, avatar in lobby + room
- branch: `beaver/08399871`
- in-progress feature: feat-011 (guest-avatars — entry to be added to feature_list.json after design)
- run note: runs/2026-07-17-guest-avatars.md
- next: explore sub-agents (upload infra + roster path) → opus architecture design → phased build

---

## 2026-07-17 — feat-010 plan reviewed round 1 (plans/emoji-reactions.html, session ended by user): all 4 decisions answered — (1) sequence recap 3.5s then You're-up 5s, (2) v1 no DO throttle (client 300ms batch + count<=20 clamp + 40-particle cap), (3) palette 👏🔥❤️😭🤩🎉, (4) phone fly-up yes / recap TV-only. Party-end recap confirmed future feature. Build starting: Phase 1 opus (protocol+reducers+DO+hook+overlay), then parallel sonnet TV/phone.
- branch: `feat/emoji-reactions`
- in-progress feature: none
- run note: none
- next: Phase 1 opus builder: room-ws messages, reactions.ts, room-state reducers, DO selective persist, hook callbacks, ReactionOverlay, i18n keys

---

## 2026-07-17 — feat-010 emoji-reactions started (coordinator + opus/sonnet subagents)
- branch: `feat/emoji-reactions`
- in-progress feature: feat-010
- run note: .brain/runs/2026-07-17-emoji-reactions.md
- next: Explore agents map room-ws/room-state/DO/TV/phone extension points, then opus architect blueprint.

---

## 2026-07-17 — PR opened for TV remote-start + End-party/mic cleanup: https://github.com/SeanningTatum/home-karaoke/pull/7
- branch: `beaver/5cf4b14b`
- in-progress feature: none (group-karaoke beta polish)
- run note: none — verification doc at `features/group-karaoke/verifications/2026-07-17-remote-start-tv-cleanup.md`
- changes: removed YoutubePlayer `started` gate (phone play now drives TV directly, `onAutoplayBlocked` one-tap fallback kept), removed TV End-party button + closeRoom mutation (phone Controls tab flow unchanged), removed mic icon from TV now-singing banner, locale keys cleaned (`player.resume`/`player.start_party` dropped, `player.tap_to_play` added)
- pre-PR Greptile review: 1 P2 (overlay label) auto-fixed in `87453d1`
- next: merge PR #7 after human review

---

## 2026-07-17 — PR opened for tv-beta-polish: https://github.com/SeanningTatum/home-karaoke/pull/6
- branch: `fix/tv-rail-annotations`
- in-progress feature: none
- run note: none

---

## 2026-07-17 — PR #5 SQUASH-MERGED to main (f03313a): feat-009 tv-beta-polish complete end-to-end. Post-open cycle: overlay animationend bubbling guard (bcebf47), main merged back in (room.closed #4 wiring intact, conflict in progress.md unioned), PR body screenshot tables (SHA-pinned raw URLs), 9 user pin-annotations fixed via opus (lobby participants-1/3 + always-visible queue, full-height QR card, navbar title, TV mute button removed, phone Controls PARTY start/end section + confirm dialog, tap-reorder arrows dropped, rail 280px full-height, vertical queue cards) — all superseded by re-captured shots. CI green all 5 checks pre-merge, 429 tests. Branch deleted.
- branch: `main`
- in-progress feature: none
- run note: none
- next: Prod deploy still pending (remote migrations + bun run deploy + YOUTUBE_API_KEY). Follow-up candidates: host-first control QR (re-auth friction), fun app name swap.

---

## 2026-07-17 — feat-009 tv-beta-polish PR #5 opened (feat/tv-beta-polish → main, 8 commits). Full cycle: plan reviewed round 1 (3 decisions) → 4 builder phases (sonnet 1/3/4, opus 2) → enforcer clean → verify-done all gates → shipped → user beta-screenshot fix pass (opus: lobby alignment, queue-on-right, readable 320px-rail queue rows) → screenshots refreshed + verification addendum → Greptile pre-PR review (2 P2: 1 auto-fixed 291f3c5 overlay animationend functional updater, 1 verified-no-change) → PR #5.
- branch: `feat/tv-beta-polish`
- in-progress feature: none
- run note: none
- next: Merge PR #5 after human review. Follow-ups logged: host-first control QR (re-auth friction, own feature), feat-007 room.close DO broadcast gap.

---

## 2026-07-17 — PR opened for tv-beta-polish: https://github.com/SeanningTatum/home-karaoke/pull/5
- branch: `feat/tv-beta-polish`
- in-progress feature: none
- run note: none

---

## 2026-07-17 — shipped tv-beta-polish: Shipped 2026-07-17. Plan plans/tv-beta-feedback.html (reviewed 2026-07-16 round 1, 3 decisions). 4 build commits on feat
- branch: `feat/tv-beta-polish`
- in-progress feature: none
- run note: none

---

## 2026-07-16 — PR #4 SQUASH-MERGED to main (346c253): room-close live broadcast fix complete. Rebase onto post-PR-#3 main (2 conflicts: progress.md log union, room/$code.tsx reskin vs roomClosed wiring — resolved, 409 tests). resolve-comments: 1 Greptile P2 fixed bd96562 (best-effort catchAll now covers the `yield* KaraokeRooms` lookup, not just the call), 0 P1s; thread replied, re-review clean. Remote branch deleted.
- branch: `fix/room-close-live-notify` → merged `main`
- in-progress feature: none
- run note: `.brain/runs/2026-07-16-room-close-do-notify.md` (closed, shipped)
- next: prod deploy path — remote D1 migrations + `bun run deploy` + confirm YOUTUBE_API_KEY prod secret; optional fun app name swap

---

## 2026-07-16 — Started room-close DO-notify fix (PR #3 comment, feat-007 post-ship bugfix). tRPC `room.close` updates D1 only — DO never broadcasts, guests see stale live UI until reload. Plan: `room.closed` ServerMessage + DO RPC `closeRoom()` (broadcast + socket close + cleanup) + best-effort stub call from the close mutation + hook `roomClosed` flag → loader revalidate on both pages. Baseline green (after `bun install` in fresh worktree).
- branch: `fix/room-close-live-notify` (renamed from beaver/171a03d2, off main 2854960)
- in-progress feature: none (bugfix on shipped feat-007)
- run note: `.brain/runs/2026-07-16-room-close-do-notify.md` (closed, shipped)
- next: PR #4 open (https://github.com/SeanningTatum/home-karaoke/pull/4) — pre-PR Greptile ran (2 findings auto-fixed in 08756fa: clearRoom sessions.clear() ordering, karaoke-rooms.test-layer.ts); await human review/merge. Cross-linked from PR #3 comment.
- checkpoint: implementation done — `room.closed` ServerMessage + `roomClosed()` helper, DO RPC `closeRoom()` (+ shared `clearRoom()`), new `KaraokeRooms` service (AppServices + baseLayer; CloudflareEnv not directly yieldable in procedures — it's `Layer.provide`d, not merged), best-effort notify in close mutation, hook `roomClosed` flag + no-reconnect, revalidate on both pages. typecheck ✓, 406 tests ✓ (+3 new files' cases)

---

## 2026-07-16 — PR #3 SQUASH-MERGED to main (cb1ee80): feat-008 ui-overhaul complete end-to-end. All checks green pre-merge (baseline, build, e2e, non-negotiables sweep, preview deploy, Greptile re-review pass). Feature wall-clock: plan review → merge same day 2026-07-16.
- branch: `feat/ui-overhaul`
- in-progress feature: none
- run note: none
- next: Optional: fun app name swap (common.json), room.close→DO broadcast fix, prod deploy (bun run deploy + remote migrations + YOUTUBE_API_KEY secret)

---

## 2026-07-16 — PR #3 review cycle: preview worker fully deployed (preview_urls applied, D1 0001 migrated — base URL live; pr-3 alias re-mints on this push). resolve-comments (sonnet): 2 Greptile P2s fixed a13808f (entrance-anim seeding gate vs empty pre-connect state; PartySounds dispose + 3 tests → 404 total), 0 P1s. Threads replied, Greptile re-review triggered.
- branch: `feat/ui-overhaul`
- in-progress feature: none
- run note: none
- next: Watch Greptile re-review + preview CI on PR #3; merge when green

---

## 2026-07-16 — feat-008 SHIPPED + PR #3 opened (feat/ui-overhaul → main): 9 commits f44c013..HEAD. Pre-PR Greptile: 1 P1 a11y (persistent sr-only live region, user-approved fix) + 1 P2 (onDone ref) — both fixed, 401 tests green. verify-done all gates PASS after brain-coherence cleanup (harness 11/11). Verification 11/11 + 16 screenshots. PR: https://github.com/SeanningTatum/home-karaoke/pull/3
- branch: `feat/ui-overhaul`
- in-progress feature: none
- run note: none
- next: Merge PR #3; then: pick fun app name (one-file common.json swap), fix room.close→DO broadcast gap, prod deploy path

---

## 2026-07-16 — PR opened for ui-overhaul: https://github.com/SeanningTatum/home-karaoke/pull/3
- branch: `feat/ui-overhaul`
- in-progress feature: none
- run note: none

---

## 2026-07-16 — shipped ui-overhaul: Shipped 2026-07-16. Phases 1-6a complete (7 commits f44c013..915e2fd + this ship). Plan plans/karaoke-ui-overhaul.html (
- branch: `beaver/6f474634`
- in-progress feature: none
- run note: none

---

## 2026-07-16 — feat-008 verification: feature-verifier PASS 11/11 golden (TV+phone contexts, tap-reorder cross-device confirmed) + 2 error paths, 15 screenshots, 0 app-origin console errors. Found 1 regression (TV lobby hides play button+queue → can't cold-start party from TV; fixer agent running) + pre-existing feat-007 gap (tRPC room.close doesn't notify DO — guests see stale room until reload; follow-up, not blocking).
- branch: `beaver/6f474634`
- in-progress feature: none
- run note: none
- next: Regression fix lands → verify-done runner → ship feat-008 → /create-pr-with-review

---

## 2026-07-16 — feat-008 Phase 6a COMPLETE (sonnet builder): delight pass — 'You're up, {name}!' TV overlay (ref-latched, skips first-play edge + reload), TV queue-row entrance anim, WebAudio join/add pops (synth, no assets, 13 tests, injectable ctx) behind persisted host mute toggle, hero fade-up. Builder caught INITIAL_STATE seeding bug (sounds gated on settings!==null). typecheck 0 / 401 tests / build PASS / live smoke (room-sounds-toggle SSR verified).
- branch: `beaver/6f474634`
- in-progress feature: none
- run note: none
- next: Enforcer 6a → commit → feature-verifier walks (TV+phone) → verify-done → ship → /create-pr-with-review

---

## 2026-07-16 — feat-008 Phase 5 COMPLETE (sonnet builder): guest phone reskin — nickname step w/ live avatar + random party-name spinner (24x24 combos, seedable helper +5 tests), gradient + add button w/ position toast + queue-almost-full warning (reuses MAX_QUEUE_SIZE), queue tab added-by chips + tap move-up/move-to-top via existing queue.reorder message (moveUpIndex/moveToTopIndex/ownQueueStanding +10 tests), sticky position bar. typecheck 0 / 388 tests / build PASS / live-room smoke.
- branch: `beaver/6f474634`
- in-progress feature: none
- run note: none
- next: Enforcer Phase 5 → commit → Phase 6: delight pass + feature-verifier + verify-done + ship + /create-pr-with-review

---

## 2026-07-16 — feat-008 Phase 4 COMPLETE (sonnet builder): host TV reskin — lobby/playing states, roster avatar chips, added-by attribution rendered (already single-writer in feat-007 protocol, no schema change), one-shot lobby→playing confetti (ref-latched, reduced-motion gated), persistent corner QR, tv-* scale. Fixed tailwind-merge vs custom tv-* utility conflict. typecheck 0 / 373 tests / build PASS / live authed smoke (room created, lobby SSR verified, closed).
- branch: `beaver/6f474634`
- in-progress feature: none
- run note: none
- next: Enforcer Phase 4 → commit → Phase 5 guest phone reskin + quick wins

---

## 2026-07-16 — feat-008 Phase 3 COMPLETE (sonnet builder): landing rebuilt (hero + JoinRoomCard 6-char XXX-XXX code input + how-it-works), AuthShell karaoke reskin (StackBadge deleted), dashboard host-hub polish. room-code helpers extended +11 tests. typecheck 0 / 373 tests / build PASS / SSR smoke pass. Phases 1-2 committed f44c013 + 4b1998e; per-phase commits authorized. After ship: /create-pr-with-review to main (user directive).
- branch: `beaver/6f474634`
- in-progress feature: none
- run note: none
- next: Enforcer Phase 3 → commit → Phase 4 host TV screen reskin

---

## 2026-07-16 — feat-008 Phase 2 COMPLETE (sonnet builder): file-upload feature + analytics chain deleted (14 files; AnalyticsRepository had no other consumer), home stubbed dark-minimal, dashboard slimmed, /admin redirects to users, Acme→Home Karaoke (en+zh), feat-003/feat-004 flipped to cut. Purge greps clean. typecheck 0 / 362 tests / build PASS.
- branch: `beaver/6f474634`
- in-progress feature: none
- run note: none
- next: Enforcer review Phase 2, then Phase 3: landing + auth + dashboard rebuild

---

## 2026-07-16 — feat-008 Phase 1 COMPLETE: design.md + app.css tokens (dark night-club default, Bricolage Grotesque via fontsource, TV type scale, AA contrast tuning), dark default theme, design-system.md replaced. typecheck 0 / 401 tests / build PASS. Enforcer clean (1 intentional minor).
- branch: `beaver/6f474634`
- in-progress feature: none
- run note: none
- next: Phase 2: strip boilerplate (sonnet builder) — file-upload UI+api+ns, admin analytics demo, home marketing stub, brand strings; keep kitchen-sink+admin/users; flip feat-003/feat-004 to cut

---

## 2026-07-16 — start-task feat-008 ui-overhaul Phase 1: baseline PASS (typecheck/test/harness 11/11). feature-tracker (sonnet) registering feat-008 in-progress; run note .brain/features/ui-overhaul/runs/2026-07-16-ui-overhaul-phase-1.md opened. Coordinator delegating design.md + tokens to sonnet builder; brain watch dashboard next.
- branch: `beaver/6f474634`
- in-progress feature: none
- run note: none
- next: Sonnet builder authors design.md then derives app.css tokens per rules/frontend.md

---

## 2026-07-16 — feat-008 ui-overhaul registered in feature_list.json (in-progress)
- branch: `beaver/6f474634`
- in-progress feature: feat-008 (ui-overhaul)
- run note: `.brain/features/ui-overhaul/runs/2026-07-16-ui-overhaul-phase-1.md`
- next: Phase 1 — design.md + theme foundation (pink→gold gradient, Google Fonts display face, 10-foot TV type scale on /room)

---

## 2026-07-16 — UI/UX overhaul plan researched (Refero + web UX + codebase inventory via Sonnet agents) and reviewed in plans/karaoke-ui-overhaul.html — round 1, all 5 decisions answered: dark night-club direction, keep /admin/users + kitchen-sink, playful landing w/ code entry, reskin + quick wins (pop sounds in, no singer rotation), Google Fonts display face; design.md drives Phase 1; both themes kept; fun app name TBD
- branch: `beaver/6f474634`
- in-progress feature: none
- run note: none
- next: Propose fun app names to user; then /start-task feat-008 ui-overhaul Phase 1 (design.md + tokens)

---

## 2026-07-16 — PR #1 P1 (r3593261839) resolved via Option B + merged. Guest-reorder now single-writer: DO owns both live toggle + D1 persist (persistGuestReorderInD1, raw drizzle like closeRoomInD1); client sends WS only. Removed dead tRPC setGuestReorder / repo updateGuestReorder / UpdateGuestReorderInput + tests; i18n 2 stale keys → guest_reorder_offline. typecheck 0 / 401 tests / build ok / enforcer 0. Thread replied+resolved, PR #1 merged to main. Feature wall-clock: ~1h 55m (fb24f09 → merge, 9 commits).
- branch: `feat/group-karaoke` → merged `main`
- in-progress feature: none
- run note: `.brain/runs/2026-07-16-pr1-greptile-p2-resolve.md` (P1 follow-up appended)
- next: prod deploy path — remote D1 migrations + `bun run deploy` + confirm YOUTUBE_API_KEY prod secret

---

## 2026-07-16 — Live-search re-walk PASS 8/8 w/ valid key (real search, cache hit source:cache, paste-URL; doc 2026-07-16-live-search-rerun.md, evidence pushed 88c078d). Parallel Opus session fixed the 4 escalated P1s (79060c5) + CI preview deploy (fc79589); all 5 Greptile threads now resolved. PR #1 body: screenshots in 3-per-row tables per flow + new live-search section; verification flipped to PASS; 406 tests green.
- branch: `feat/group-karaoke`
- in-progress feature: none
- run note: none
- next: User: confirm prod YOUTUBE_API_KEY secret re-put; then merge path — remote migrations + deploy

---

## 2026-07-16 — PR #1 finalized: resolve-comments (1 P2 fixed 7c88866, 4 P1s escalated w/ thread replies, Greptile re-review triggered); verifier findings fixed 5224bc6 (getVideo oEmbed fallback on keyed failure +2 tests, honest paste toast — 404 tests); brain evidence committed 82d77c8; PR body updated w/ screenshots-by-path (blob links, private repo). BLOCKED: live-search re-walk needs real AIza key (current = cfut_ Cloudflare token, local + secret both wrong).
- branch: `feat/group-karaoke`
- in-progress feature: none
- run note: none
- next: User: provide valid YouTube API key + decide 4 escalated P1s; then re-run live-search walk

---

## 2026-07-16 — Repo published + PR opened: github.com/SeanningTatum/home-karaoke (private). 3 commits: 005640f boilerplate baseline, fb24f09 group-karaoke feature (101 files), efd877d Greptile fixes + controls verification. Greptile pre-PR review: 3 P2 (history pollution on errored videos, queue cap 200, WS reconnect race) all fixed, 402 tests. Supplementary controls walk PASS (10/10, screenshots 09-14+E2). PR #1: https://github.com/SeanningTatum/home-karaoke/pull/1
- branch: `feat/group-karaoke`
- in-progress feature: none
- run note: none
- next: Merge PR #1; add YOUTUBE_API_KEY secret; run remote/preview migrations; deploy

---

## 2026-07-16 — shipped group-karaoke: Phases 1-6 complete 2026-07-16. Plan plans/group-karaoke.html (reviewed, 4 decisions). Verification .brain/features/grou
- branch: `unknown`
- in-progress feature: none
- run note: none

---

## 2026-07-16 — group-karaoke Phase 5 COMPLETE: dnd-kit drag-reorder (host rail + guest tab, touch sensors + handles), host Controls tab on /join (play/pause/skip/volume/remove/guest-reorder switch), setGuestReorder + recordPlayed tRPC (host-only), DO 1h sliding idle alarm closing room in D1 (drizzle-over-env.DATABASE runtime-boundary deviation, documented), settings seeded via x-allow-guest-reorder header, end-party AlertDialog flow. 400 tests, typecheck+build PASS, builder live-verified full flow in browser. Phase 4 enforcer minors (3) fixed: youtube schema re-export, Env cast dropped, embed-error prefix constant shared server+client.
- branch: `unknown`
- in-progress feature: none
- run note: none
- next: Phase 5 enforcer running; then Phase 6: feature-verifier golden+error walk, verify-done-runner, brain doc updates (data-models/api/integrations/architecture), ship

---

## 2026-07-16 — group-karaoke Phase 4 COMPLETE (builder survived one transient API-error resume): YouTube service (search+getVideo+oEmbed keyless fallback), 4 YT tagged errors, D1 7-day search cache via getCachedPicks, youtube.search/resolveVideo tRPC, /join/:code guest flow (nickname gate → Search/Queue tabs). 392 tests, build PASS, dev curls PASS, anon-session-passes-protectedProcedure confirmed. Coordinator fixed deferred Phase 3 majors: loader try/catch → Effect catchTags; dashboard ns registered in i18n.d.ts; literal-color constraints documented.
- branch: `unknown`
- in-progress feature: none
- run note: none
- next: Phase 4 enforcer + Phase 5 builder (dnd-kit reorder both screens, host Controls tab, setGuestReorder persist, 1h-idle DO alarm, room_song history, end-party flow) running in parallel

---

## 2026-07-16 — group-karaoke Phase 4 COMPLETE: /join/:code guest flow (public loader, nickname step w/ anon signIn + localStorage prefill, Search/Queue tabs), YouTube service (search + getVideo + keyless oEmbed fallback), 4 new tagged errors (YouTubeQuotaExceeded/Unavailable/VideoNotEmbeddable/NotFound), D1 search cache (SongRepository.getCachedPicks), youtube.search/resolveVideo tRPC router. 392 tests (+53), typecheck+build PASS, live SSR curl checks PASS (join form 200, bad-code 200 friendly, protectedProcedure 401 gate confirmed for anon).
- branch: `unknown`
- in-progress feature: feat-007 (group-karaoke)
- run note: `.brain/features/group-karaoke/runs/2026-07-16-group-karaoke-phase-1.md`
- next: Phase 5 — host controls reorder + allowGuestReorder toggle, 1h-idle auto-close alarm, room_song history wiring, final ship verification

---

## 2026-07-16 — group-karaoke Phase 3 COMPLETE: /room/:code host screen (YT player w/ start-party + autoplay-blocked overlays + ENDED auto-advance + error skip, queue rail, QR join panel, play/pause/skip, reconnect pill), dashboard host-room entry, room i18n (en+zh), Toaster mount fix. 339 tests, build PASS, live SSR curl checks PASS. Phase 2 enforcer minor (raw code param) fixed w/ RoomCode decode.
- branch: `unknown`
- in-progress feature: none
- run note: none
- next: Phase 3 enforcer review + Phase 4 (join flow, YouTube service+search w/ D1 cache+karaoke bias+oEmbed fallback, quota errors) both running as Sonnet agents

---

## 2026-07-16 — group-karaoke Phase 2 COMPLETE: raw DO + WS Hibernation (actors spike REJECTED — 0.0.1-beta.6, opaque persistence, recorded fallback per plan clause). room-ws protocol schemas (20 tests), pure room-state reducers (41 tests), KaraokeRoom DO, /api/room/:code/ws boundary route, use-room-socket hook, KARAOKE_ROOM binding prod+preview. 335 tests, typecheck+build PASS incl preview build.
- branch: `unknown`
- in-progress feature: none
- run note: none
- next: Phase 2 enforcer review running; Phase 3 (host screen: player + queue rail + QR panel + dashboard entry) delegated to Sonnet builder

---

## 2026-07-16 — group-karaoke Phase 1 COMPLETE: anon auth plugin, room/song/search_log/room_song tables (migration 0001), Room+Song repos, RoomNotFound/RoomClosed errors, room-code helper, room.create/get/close router, seeds. typecheck PASS, 274 tests PASS (baseline 228), enforcer 0 violations.
- branch: `unknown`
- in-progress feature: none
- run note: none
- next: Phase 2: @cloudflare/actors spike + KaraokeRoom actor + wrangler DO binding (new_sqlite_classes, prod+preview) + WS upgrade route + useRoomSocket hook — delegated to Sonnet builder

---

## 2026-07-16 — start-task: group-karaoke Phase 1 kicked off. Baseline PASS (228 tests, harness 11/11). feat-007 registration delegated to feature-tracker; run note opened at .brain/features/group-karaoke/runs/2026-07-16-group-karaoke-phase-1.md
- branch: `unknown`
- in-progress feature: none
- run note: none
- next: Delegate Phase 1 implementation (anon auth plugin + room/song/search_log/room_song tables + repos + errors + room tRPC) to Sonnet sub-agent following add-feature/add-db-table/add-trpc-endpoint recipes

---

## 2026-07-16 — feat-007 group-karaoke started (in-progress)
- branch: `unknown`
- in-progress feature: feat-007 (group-karaoke)
- run note: `.brain/features/group-karaoke/runs/2026-07-16-group-karaoke-phase-1.md`
- next: Phase 1 — D1 tables (room/song/search_log/room_song) + Better Auth anonymous plugin + room tRPC routes per plans/group-karaoke.html

---

## 2026-07-16 — group-karaoke plan reviewed (plans/group-karaoke.html, session ended by user). Decisions: Better Auth anonymous plugin for guests; @cloudflare/actors over DO (raw-DO fallback); YT Data API v3 + paste-URL + persist searches/songs to D1 (own search DB later); DO SQLite = live truth. Extras: reorder host-toggle, 1h idle auto-close, room_song history for future top-songs/recs, append 'karaoke' to queries.
- branch: `unknown`
- in-progress feature: none
- run note: none
- next: Kick off implementation: /start-task, add feat-007 group-karaoke to feature_list (in-progress), delegate Phase 1 (D1 tables + anon plugin + room tRPC) to sub-agent per plan

---

## 2026-07-15 — audit-remediation shipped
- branch: `refactor/audit-remediation` (PR opening; from main @ 8547acb)
- in-progress feature: none (cross-cutting quality task, closed)
- run note: `.brain/runs/2026-07-15-audit-remediation.md` (closed)
- shipped: 4-agent audit → 5-agent remediation (security, Effect core, DRY, i18n, +71 tests → 228), Greptile pre-PR review resolved (SVG dropped from upload allowlist, magic-byte sniffing added)
- next: merge PR; optional follow-ups — route FileUpload somewhere, feature-verifier walk of admin flow

---

## 2026-07-13 — feat-005 merged + released v1.1.0 — session end
- branch: `main` @ 4f83efc (PR #7 merged)
- in-progress feature: none
- run note: `.brain/runs/2026-07-10-preview-deployments.md` (closed)
- shipped: v1.1.0 "Every PR Gets Its Own SaaS" — per-PR preview deploys w/ isolated seeded D1, full lifecycle verified on PR #7 (open→deploy→login→close→cleanup→reopen)
- outstanding: roll CF API token (leaked to session transcript); decide keep-vs-teardown of session CF resources; run-note final edit uncommitted on main

---

## 2026-07-11 — feat-005 preview-deployments shipped
- branch: `main`
- in-progress feature: none
- run note: `.brain/runs/2026-07-10-preview-deployments.md`
- verification: per-PR D1 binding confirmed (pr-999 version upload), alias URL signup 200 with preview-D1 user row written (pr-test), prod signup 200.
- next: teardown session-provisioned resources (`bun run teardown`).

---

## 2026-07-10 — feat-005 preview-deployments added to feature_list.json (in-progress)
- branch: `main`
- in-progress feature: feat-005 (preview-deployments)
- run note: `.brain/runs/2026-07-10-preview-deployments.md`
- next: registered in `feature_list.json` + `.brain/features/preview-deployments.md` created; continue implementation per run note.

---

## 2026-07-10 — Preview deployments + DX (research → implement) — in progress
- branch: `main`
- in-progress feature: feat-005 (preview-deployments, to be added to feature_list)
- run note: `.brain/runs/2026-07-10-preview-deployments.md`
- baseline: typecheck FAIL + harness-check FAIL — both pre-existing, caused by intentionally-absent `wrangler.jsonc` (generated by `bun run setup`); tests 123/123 PASS
- blocker: wrangler OAuth expired — user must `wrangler login` before provisioning
- next: consume research-agent reports, provision CF env non-interactively, design preview-deploy pipeline

---

## 2026-05-07 — Effect-TS API audit: rules + boundary refactor + bulk ops + logging — closed
- branch: `main`
- in-progress feature: none
- run note: none (rule + targeted code edits)
- scope: surveyed API surface for Effect-TS idiom gaps, codified rules, applied where it mattered, left simple CRUD untouched.

### Rule additions
- **HTTP boundary (non-tRPC) pattern** in `rules/routes.md` — `runPromiseExit` + `Exit.match` + `Effect.catchTag(s)`, no `try`/`catch`. Recoverable in catches, defects in `onFailure`. Anti-patterns: try/catch around runPromise, duck-typing `TRPCError.code`.
- **`Effect.promise` vs `Effect.tryPromise`** table in `rules/services.md` — `tryPromise` for any fallible promise (Better Auth, fetch, drizzle, third-party); `promise` only for known-infallible.
- **Procedure-level error transformation** section in `rules/routes.md` with operator table (`catchTag(s)` / `retry` / `partition` / `tap` / `tapErrorTag` / `timeout`) + worked `deleteUser` example. Default = fall-through; only transform for complex procedures.
- **Logging — Effect logger vs imperative `loggers.X`** in `rules/services.md` — same sink (`emitLog` via `LoggerLive`); pick by context. Effect inside `Effect.gen`, imperative outside. Canonical shape `Effect.logInfo("event").pipe(Effect.annotateLogs({...}))`; never `logInfo({...}, "event")` (fields would JSON-stringify into message string).
- Cross-refs added in `codebase/effect-ts.md` "What Not To Do" + `rules/errors.md` "Using errors in tRPC procedures".
- New anti-patterns: `?.` on `ctx.auth.user` after protected/adminProcedure, `Effect.promise` for fallible work.

### Code changes
- `app/routes/api/upload-file.ts` — rewritten to `runPromiseExit` + `Exit.match` + `Effect.catchTag("ValidationError")`. Removed try/catch + duck-typed `TRPCError.code`. `app/components/file-upload.tsx` narrows `fetcher.data` with `"success" in` / `"key" in` guards.
- `app/trpc/routes/admin.ts` — `bulkBanUsers` / `bulkDeleteUsers` / `bulkUpdateUserRoles` now (1) return idempotent `{ success: true, affectedCount: 0, skippedCount }` on no-valid (was: 400 ValidationError — wrong semantics, input was valid), (2) emit structured audit log via `Effect.tap` + `Effect.logInfo("users.bulk_*").pipe(Effect.annotateLogs({ actor, targets, affectedCount, skippedCount, ... }))`.
- `app/lib/effect-trpc.ts` `runProcedure` — wraps every procedure in `Effect.annotateLogs({ layer: "trpc" })` for auto layer-tag parity with imperative `loggers.trpc`.

### Skipped (intentionally)
- Procedure refactors for simple CRUD — default `tagToTRPC` fall-through is correct.
- Helper extraction for bulk ops — defer until 4th lands.
- `Effect.partition` per-user in bulk — single bulk UPDATE keeps atomicity; partial-success UX not needed for ban.

### Still open (separate task)
- `app/trpc/index.ts:14-18` — `Effect.promise` → `Effect.tryPromise` for Better Auth `getSession`.
- `app/trpc/router.ts:43` — redundant `?.` on `ctx.auth.user`.

### Verify
- typecheck PASS, unit 123/123 PASS at every checkpoint.

---

## 2026-05-07 — Boilerplate UI polish v3 (Mandarin + live toggle + e2e cleanup) — closed
- branch: `main`
- in-progress feature: none
- run note: `.brain/runs/2026-05-07-boilerplate-ui-polish.md`
- verify: typecheck + unit (123/123) + e2e (auth.spec 2/2) PASS
- changes: added zh locale (6 ns files), `LanguageSwitcher` wired into home / auth / dashboard, new `/api/set-locale` action, replaced docs+i18n e2e specs with focused `auth.spec.ts`, fixed live-toggle race via `useFetcher` + root revalidation
- next: none — to add a locale, drop `app/locales/<lng>/*.json` + add to `supportedLngs` + add label to LanguageSwitcher.

---

## 2026-05-07 — Boilerplate UI polish v2 (harness section + v2 label) — closed
- branch: `main`
- in-progress feature: none (cross-cutting polish over feat-001, feat-002)
- run note: `.brain/runs/2026-05-07-boilerplate-ui-polish.md`
- verify: typecheck + unit PASS (123/123), e2e i18n 6/8 (same 2 pre-existing fails — no regression)
- changes: hero eyebrow → v2; new "An agent harness, not just a stack" section on `/` with 3 pillars + commands block; `meta.description` updated; new `home.harness.*` i18n keys.
- next: replace placeholder GitHub URLs with real repo on publish; pre-existing 404 i18n namespace + dead docs.spec follow-up.

---

## 2026-05-07 — Boilerplate UI polish (home / login / dashboard) — closed
- branch: `main`
- in-progress feature: none (cross-cutting polish over feat-001, feat-002)
- run note: `.brain/runs/2026-05-07-boilerplate-ui-polish.md`
- baseline: PASS; verify: typecheck + unit PASS, e2e i18n 6/8 (2 pre-existing fails unrelated), docs.spec dead (pre-existing)
- shipped: refero-synthesized `design-system.md`; redesigned home / login / sign-up / dashboard with split-pane auth + educational cards; new `StackBadge` + `AuthShell` components.
- next: replace placeholder GitHub URLs with real repo on publish; fix pre-existing 404 i18n namespace bug + dead docs.spec in a follow-up.

---

## 2026-05-07 — Harness hardening pass
- branch: `feat/effect-ts`
- in-progress feature: harness itself (no feat-id; meta)
- run note: none
- changes: type-locked `tagToTRPC` (AppError + assertNever), `harness-check.sh` brain dead-link check + wired into `init.sh --baseline`, added `.github/workflows/ci.yml` (baseline + build + e2e + non-negotiables grep), `99-verify-done.md` flipped e2e default-on, `HARNESS.md` Verification table updated, `add-tagged-error.md` recipe updated for AppError union requirement
- next: commit + push to exercise CI on first PR

---

## 2026-05-07 — Harness upgrade (5-subsystem alignment)
- branch: `feat/effect-ts`
- in-progress feature: harness itself (no feat-id; meta)
- run note: none
- changes: added `feature_list.json`, `init.sh`, this `progress.md`, `HARNESS.md`, sub-agents in `.claude/agents/`, SessionStart hook
- next: verify init.sh runs clean → commit harness upgrade

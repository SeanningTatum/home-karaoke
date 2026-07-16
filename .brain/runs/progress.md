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

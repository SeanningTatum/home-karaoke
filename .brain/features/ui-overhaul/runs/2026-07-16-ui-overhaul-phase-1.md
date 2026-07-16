# Run: ui-overhaul-phase-1

_Started: 2026-07-16_
_Status: in-progress_

## Task

Execute Phase 1 of the reviewed UI/UX overhaul plan (plans/karaoke-ui-overhaul.html): author `design.md` (karaoke design system — dark night-club stage direction), then derive Tailwind/app.css tokens and shared-component updates from it. Coordinator (Fable) delegates implementation to Sonnet sub-agents.

## Domain

frontend

## Plan

1. Register feat-008 ui-overhaul in feature_list.json (feature-tracker agent) — in-progress.
2. `brain watch ui-overhaul` — live dashboard for the user.
3. Sonnet builder: author `design.md` at repo root (palette, Google Fonts display face, type scales incl. 10-foot TV, motion/sound principles, both themes — dark default).
4. Sonnet builder: derive app.css tokens (semantic vars per rules/frontend.md — :root + .dark + @theme inline), font wiring, TV type-scale utilities; spike page check both viewports/themes.
5. Replace .brain/codebase/design-system.md content with the new system.
6. Enforcer review + typecheck/tests; checkpoint.

## Baseline

```
$ ./init.sh --baseline
typecheck:     PASS
test:          PASS
harness-check: PASS (11/11)
```

Tree clean on branch beaver/6f474634 (main @ e7004f5 merged feat-007).

## Review decisions binding this run

- Dark night-club stage direction: bg #0d0b12, surface #18151f, pink→gold gradient accent (#ff3d9a→#ffd23d), violet secondary #a238ff, mint success #2fe6b8 — as *starting* tokens, tuned in design.md.
- Google Fonts display face allowed (Bricolage Grotesque / Unbounded candidates); Inter stays workhorse.
- Both themes kept, dark default ("morning karaoke").
- Keep /admin/users AND /admin/kitchen-sink.
- Pop sounds in (host mute toggle) — later phase.
- No singer rotation, no audio normalization.
- Fun app name TBD (user picking; placeholder "home-karaoke" until then).

---

## Step: Phase 1 implementation (Sonnet builder)

_2026-07-16_

### What was done

1. **`design.md`** authored at repo root — full karaoke design system: brand personality, full dark ("night-club stage", default) + light ("morning karaoke") palette with semantic token names, hex + oklch + WCAG contrast numbers, gradient-accent usage rules (sparing: primary CTA / now-singing highlight / add-song `+`), typography (display + workhorse + full scale incl. TV roles Display 96px/Headline 56px/Title 36px/Body 28px/Label 24px), radius/shadow/glow, motion principles (`prefers-reduced-motion` always), sound principles (join/add pops behind host mute toggle — later phase, no code yet), component notes (queue rows, QR-always-on-white-tile, avatar-initials-on-gradient), accessibility (contrast table, focus states).
2. **`app/app.css`** — full token rewrite following `rules/frontend.md`'s 5-step process:
   - `:root` (light) and `.dark` (dark) semantic var *values* replaced with the new palette — **no semantic var renamed**, all existing consumers (buttons, badges, cards, sidebar, charts) pick up new values automatically.
   - New tokens added + registered in `@theme inline`: `--success`/`--success-foreground`, `--accent-start`/`--accent-end` (gradient stops), `--glow-accent`/`--glow-success` (registered under Tailwind's `--shadow-*` namespace → `shadow-glow-accent`/`shadow-glow-success` utilities for free).
   - New composed utilities via `@utility`: `.bg-gradient-accent`, `.text-gradient-accent` (gradient-on-text), and the TV type scale + safe-margin utilities: `.tv-display`/`.tv-headline`/`.tv-title`/`.tv-body`/`.tv-label`, `.tv-safe`/`.tv-safe-x`/`.tv-safe-y` (`clamp()`-based ~5% padding).
   - `--radius` bumped `0.625rem` → `1rem` (friendlier corner, fits "playful" pillar; derived `sm/md/lg/xl` still `calc()` off it, no component changes needed).
   - `html, body` base rule fixed from hardcoded `bg-white dark:bg-gray-950` to semantic `bg-background text-foreground`; added explicit `color-scheme: light` / `.dark { color-scheme: dark }` (previously only reacted to OS `prefers-color-scheme`, not the app's own theme class).
   - Global `@media (prefers-reduced-motion: reduce)` safety net added (collapses animation/transition durations app-wide).
3. **Fonts** — added `@fontsource-variable/inter` + `@fontsource-variable/bricolage-grotesque` (`bun add`), imported via `@import` at the top of `app/app.css` (bundled at build time). Removed the `fonts.googleapis.com` preconnect/stylesheet `<link>`s from `app/root.tsx`'s `links` export (was already a runtime Google Fonts CDN dependency for Inter — now fully self-hosted, matching the Cloudflare Workers deployment model). Registered `--font-display: "Bricolage Grotesque Variable", ...` in `@theme` alongside the existing `--font-sans`.
4. **Dark-as-default** — `app/root.tsx`: `<ThemeProvider defaultTheme="dark" enableSystem>` (was `defaultTheme="system"`). Toggle (`app/components/theme-toggle.tsx`) untouched — still lists light/dark/system, fully functional.
5. **`.brain/codebase/design-system.md`** replaced wholesale — now points to repo-root `design.md` as source of truth, gives the token/implementation map (where things live in `app/`), no longer scoped to "marketing surface only." Updated the two cross-references that described the old scope: `.brain/codebase/index.md` row and `.brain/rules/frontend.md`'s pointer line.

### Font choice: Bricolage Grotesque (over Unbounded)

Bricolage Grotesque has a genuine optical-size variable axis (letterforms reshape for large display sizes vs. body sizes) — exactly the "one huge word on a TV" need for `/room`'s 96px Display role. It reads as "friendly-bold" rather than Unbounded's heavier geometric-blocky weight, which fits "house party" better than "brutalist poster," and stays legible from 36px section titles up to 96px hero text without needing a second face (Unbounded gets visually heavy under ~48px). Ships as a single variable-font file via `@fontsource-variable/bricolage-grotesque`, self-hostable, no runtime CDN call. Full justification in `design.md` §4.

### Token tuning away from the plan's starting hexes (contrast-driven — see `design.md` §10 for the full table + numbers)

- `--destructive` (dark): `#ff4d4d` → `#d92e2e` — starting hex only cleared 3.27:1 with white button text (fails AA 4.5:1); tuned value clears 4.29:1.
- `--success` (light): `#2fe6b8` (same as dark) → `#087a5c` — dark-theme mint only clears 3.47:1 on a light bg; deepened to clear 5.32:1.
- `--primary` / `--accent-start` (light): `#ff3d9a` (same as dark) → `#d31d70` — starting hex only cleared 4.50:1 (borderline); deepened to 5.02:1 for headroom.
- `--accent-end` (light): `#ffd23d` (same as dark) → `#c98a00` — starting gold too light to read as a gradient stop/fill on a light bg; deepened while keeping the "gold" identity.
- `--radius`: `0.625rem` → `1rem` — not contrast-driven, a deliberate "playful, not corporate" pillar decision; derived radii still `calc()` off the base, no component changes.
- Everything else (`--background`, `--card`, dark-theme `--success`/`--accent-start`/`--accent-end`, both themes' `--secondary`) ships at (or within rounding of) the plan's starting hexes — already cleared AA.

### Verify output (verbatim tails)

```
$ bun run typecheck
[cf-typegen + react-router typegen + tsc -b — no errors]
Exit: 0
```

```
$ bun run test
 Test Files  33 passed (33)
      Tests  401 passed (401)
   Start at  09:25:07
   Duration  4.04s
Exit: 0
```

```
$ bun run build
[client build] ✓ built in 8.00s
[ssr build] ✓ 11265 modules transformed, ✓ built in 7.53s
Exit: 0
```

(Build run as an extra sanity check beyond the task's required typecheck/test, since app.css / font-import correctness isn't caught by either — fonts bundled correctly into `build/server/assets/*.woff2`, no CSS/import errors. Pre-existing sourcemap warnings and one unused-import warning in the build output are unrelated to this change — present before it too.)

### Scope notes

No page redesigns this phase (by design — Phase 1 is theme foundation only). No new persistence, no new tagged errors, no throw/try-catch, no Zod, no `process.env` touched. No unit tests added (pure CSS/docs changes only, per non-negotiable #4's own carve-out). Left uncommitted in the working tree per instruction.

_Status: Phase 1 complete — ready for enforcer review / checkpoint._

---

## Step: Phase 2 — strip boilerplate

_2026-07-16_

### What was deleted

**File upload feature** (feat-003, flipped to `cut`):
- `app/components/file-upload.tsx`, `app/routes/api/upload-file.ts` (+ its `app/routes.ts` registration)
- `app/locales/{en,zh}/upload.json` + `"upload"` removed from `app/i18n/i18n.ts` namespaces + `app/i18n/i18n.d.ts` resource typing
- `app/lib/constants/upload.ts` + `app/lib/constants/__tests__/upload.test.ts` — grepped first: solely consumed by the deleted route, not by `BucketRepository`, so safe to remove as dead code
- Dashboard/home references to upload (educational card grid) removed as part of those routes' rewrites (below)
- **Kept**: `BucketRepository` (`app/repositories/bucket.ts`) + its tests, per instruction — repo layer stays, only the user-facing feature goes. `BucketValidationError` etc. also kept (still wired into `tagToTRPC`, not upload-specific infra).

**Admin analytics demo** (feat-004, flipped to `cut`):
- `app/components/analytics/` (stat-card, time-series-chart, distribution-chart, insights-card, index.ts) — whole dir
- `app/lib/insights.ts` + `app/lib/__tests__/insights.test.ts`
- `app/lib/schemas/analytics.ts` + `app/lib/schemas/__tests__/analytics.test.ts` (+ removed the `export * from "./analytics"` line in `app/lib/schemas/index.ts`)
- `app/repositories/analytics.ts` + `app/repositories/__tests__/analytics.test.ts` — grepped: `AnalyticsRepository` had no consumer other than the deleted dashboard, so repo layer removed too (per the instruction's conditional)
- `app/trpc/routes/analytics.ts` — removed `analyticsRouter` import/mount from `app/trpc/router.ts`; removed `AnalyticsRepository` from `app/runtime.ts` (`AppServices` union + `reposLayer`)
- `app/routes/admin/_index.tsx` rewritten to a bare loader `redirect("/admin/users")` (no more analytics dashboard UI)
- `admin.json` (en+zh): removed `dashboard`/`charts`/`insights`/`site_header` keys (all analytics-dashboard-only, now unreferenced)
- `site-header.tsx`: removed the `github.com/shadcn-ui/ui` placeholder link/button (kept `SiteHeader` itself — still used by `/admin/users` and `/admin/kitchen-sink`)
- `common.json` (en+zh): `app_name` → "Home Karaoke" / "居家卡拉OK", `app_name_short` → "HK", `company_name` → "Home Karaoke" / "居家卡拉OK" (picked up automatically by `app-sidebar.tsx`, which already read `t("company_name")`); also dropped the now-unreferenced `common.analytics.total` key
- **Kept**: `/admin/users`, `/admin/kitchen-sink` fully working, untouched (locked review decision — light retheme deferred). Kitchen-sink's stale comment about `SiteHeader`'s "GitHub link text" corrected since that link is gone.

**Home page** — `app/routes/home.tsx` replaced wholesale with a minimal dark stub: centered `font-display` app name, one-line i18n'd tagline, Sign in/Sign up buttons, `LanguageSwitcher` + `ThemeToggle`. Deleted: hero marketing copy, `StackBadge`/`FeatureCard` "what's wired" grid, harness section + slash-command `<pre>`, quickstart terminal `<pre>`, footer boilerplate, all `github.com` placeholder links. `meta()` rewritten (title "Home Karaoke — sing together", karaoke tagline description). `home.json` pruned to the 4 keys the stub uses (`brand`, `tagline`, `cta_sign_up`, `cta_sign_in`) in both locales.

**Dashboard** — `app/routes/dashboard/_index.tsx` slimmed: kept the "Host a karaoke room" card (primary hero action) and the account card; deleted the boilerplate "explore" `FeatureCard` grid, the "post-auth landing page of the boilerplate" subtitle copy, and the `github.com` "View source"/"Docs" links. Account card's `StackBadge` role/session rows replaced with plain text (role only). `dashboard.json` pruned accordingly in both locales (dropped `title`, `subtitle`, `actions.docs`, `explore.*`, `account.session_active`, `account.source`).

**Now-unused shared components**:
- `app/components/feature-card.tsx` deleted — grepped first, only consumer was `home.tsx`/`dashboard/_index.tsx`, both rewritten above. `.brain/rules/frontend.md`'s "Shared components" section had its `FeatureCard` bullet removed.
- `app/components/stack-badge.tsx` **kept** — still imported by `app/routes/authentication/components/auth-shell.tsx` (auth full rebuild is Phase 3, out of this phase's scope; not touched).

### feature_list.json / index.md

- `feat-003` (File Upload) and `feat-004` (Analytics) status flipped `shipped` → `cut`, each with an `evidence` string citing this run + what was retained/removed at the repo layer.
- `.brain/features/index.md` rows updated to `cut (2026-07-16, feat-008 Phase 2)` for both.
- Left the `file-upload/file-upload.md` and `analytics/analytics.md` memo files in place (not deleted) — they're a historical record of what the cut features were; the brain-layout convention ("feature ripped out → delete the whole `<slug>/` folder") wasn't explicitly invoked by this task's instructions, so treated as a judgment call rather than assumed.

### Purge grep (verbatim)

```
$ rg -i "acme|saas starter|cloudflare saas" app/
(no matches)

$ rg 'href="https://github.com/"' app/
(no matches)
```

One residual `github.com` string remains, out of scope for this phase: `app/routes/admin/kitchen-sink.tsx` has `<AvatarImage src="https://github.com/shadcn.png" />` — a demo avatar image for the Avatar component showcase, not a boilerplate placeholder link, and kitchen-sink is explicitly kept un-retouched this phase.

### Verify output (verbatim tails)

```
$ bun run typecheck
Exit: 0
```

```
$ bun run test
 Test Files  29 passed (29)
      Tests  362 passed (362)
   Start at  09:42:49
   Duration  3.28s
Exit: 0
```
(362 vs. Phase 1's 401 — the 39 fewer are the deleted analytics repo/schema/insights tests + upload constants test, all removed alongside their source files, not regressions.)

```
$ bun run build
[client build] ✓ built in 6.60s
[ssr build] ✓ 10633 modules transformed, ✓ built in 6.39s
Exit: 0
```

### Scope notes

Touched two features per the plan's own scope (feat-003 file-upload, feat-004 analytics) plus the shared home/dashboard/admin-chrome stubs feat-008 owns directly — no unrelated surfaces touched. No new persistence, no new tagged errors, no throw/try-catch, no Zod, no `process.env`. i18n kept en/zh lockstep (verified programmatically: `common` 32 keys, `home` 4, `dashboard` 14, `admin` 61 — identical key sets both locales). Landing/dashboard/auth *full* rebuilds remain Phase 3 — this phase only stripped + stubbed so nothing references deleted code. Left uncommitted in the working tree per instruction.

_Status: Phase 2 complete — boilerplate stripped, all three verify-done gates green._

## Step: Phase 3 — landing + auth + dashboard rebuild (Sonnet builder)

### What changed

**Room-code helper reuse** — checked `app/lib/room-code.ts` first per instruction (feat-007 already builds real codes as `KQ7-3FP`: 6 chars from `ROOM_CODE_ALPHABET`, hyphen after the 3rd — **not** the 4-char format the task brief assumed). Added two pure helpers there rather than duplicating logic in the landing component:
- `ROOM_CODE_PATTERN` — same regex shape as `app/lib/schemas/room.ts`'s `RoomCode` Effect Schema, kept as a plain `RegExp` copy (not imported from the schema) so the landing page doesn't need to pull in `effect` client-side.
- `normalizeRoomCodeInput(raw)` — uppercases, strips non-alphabet chars, caps at 6, auto-inserts the group hyphen as you type.
- `isCompleteRoomCode(code)` — full-pattern match for the client-side "is this submittable" check.
- 11 new unit tests in `app/lib/__tests__/room-code.test.ts` (16 total in that file, up from 5).

**Landing `/`** (`app/routes/home.tsx`, `app/locales/{en,zh}/home.json`) — full rebuild:
- Full-viewport hero: small app-name eyebrow pill (mic icon + `common.app_name`, so a rename stays one-file), `font-display` headline "Your living room is the stage", one-line subline, a soft `bg-gradient-accent` blur glow behind the hero (decorative, `aria-hidden`, respects the global `prefers-reduced-motion` rule already in `app.css` since it's a static blur not an animation).
- `JoinRoomCard` (local component): controlled input using `normalizeRoomCodeInput` on every keystroke (auto-uppercase + auto-hyphenate), submit validates with `isCompleteRoomCode` and shows an i18n'd inline error (`join.error_incomplete`) instead of calling the server — `navigate(`/join/${code}`)` on success, so the existing `/join/:code` loader's own not-found/closed handling is the single source of truth for bad codes. `data-testid="landing-code-input"` / `"landing-join-button"`. Join button is the one CTA using `bg-gradient-accent` + `shadow-glow-accent` per design.md's "gradient is rare" rule.
- Secondary CTA "Host a party" → `/login` (simplest correct choice: `redirectIfAuthenticated` in both `/` and `/login` loaders already bounces a signed-in host straight to `/dashboard`, so `/login` doubles as the host entry point with no extra redirect logic needed).
- "How it works" 3-step strip (`IconDeviceTv` / `IconQrcode` / `IconPlaylistAdd` from `@tabler/icons-react`, all confirmed present in the installed package before use).
- `meta()` now emits title/description/og:title/og:description/og:type. Locale-prefixed `:lng` route variant untouched (`routes.ts` not touched).
- `home.json` restructured: dropped the old `brand`/`tagline`/`cta_*` keys (brand wordmark now reads from `common.app_name` instead of a home-local copy, per instruction), added `hero.*`, `join.*`, `host_cta`, `how_it_works.*` — en/zh in lockstep.

**Auth shell** (`app/routes/authentication/components/auth-shell.tsx`, `app/locales/{en,zh}/auth.json`) — reskinned:
- `shell.heading` → "The party's waiting", `shell.description` → "Hosts sign in to open a room — guests never need an account." `shell.eyebrow` → "For hosts".
- Replaced the 4 boilerplate `ContextRow`s (sessions/roles, email+password, Drizzle/D1, Workers-native) with 3 on-brand rows: Host a room / Guests join by QR / Queue together (`IconMicrophone2` / `IconQrcode` / `IconPlaylistAdd`).
- Deleted the bottom `StackBadge` row (`["Better Auth", "Drizzle", ...]`) entirely — no replacement needed, the aside now ends after the 3 rows.
- Grepped: `StackBadge` had exactly one remaining consumer (`auth-shell.tsx`, per Phase 2's note that it was "kept" pending this phase). With that import removed, `app/components/stack-badge.tsx` had zero consumers left, so **deleted the component file**. Checked `.brain/rules/frontend.md` for a `StackBadge` bullet to remove — none exists there (Phase 2 had already pulled the `FeatureCard` bullet; `StackBadge` was never listed in that doc), so no brain edit was needed on that front.
- Login/signup form fields untouched (Better Auth flow, RHF wiring, `effectResolver` all identical) — only lightly retouched the boilerplate-flavored `login.description` ("Sign in to your account to continue." → "Sign in to open your room and start the show.") and `signup.description` ("Sign up to explore the boilerplate from a logged-in perspective." → "Create a host account — you'll be ready to open a room in seconds.") since those phrases directly referenced "the boilerplate" and were the most jarring leftover off-brand copy in the auth surface.

**Dashboard** (`app/routes/dashboard/_index.tsx`, `app/locales/{en,zh}/dashboard.json`) — host hub polish, `api.room.create` mutation wiring untouched byte-for-byte:
- Host card: bigger (`bg-gradient-to-br from-card to-primary/5`, `border-primary/20`), circular gradient mic badge (`bg-gradient-accent` + `shadow-glow-accent`), `font-display` title, `size="lg"` CTA button now `bg-gradient-accent` + `shadow-glow-accent`.
- Welcome header copy → playful: `welcome` key "Welcome, {{name}}" → "Ready to host, {{name}}?" (en) / "欢迎,{{name}}" → "准备好主持了吗,{{name}}?" (zh).
- Account section left minimal/unchanged structurally per instruction.

### Copy highlights (en)

- Landing headline: "Your living room is the stage"
- Landing subline: "Open a room on the TV, share the code, and let everyone queue up songs from their phone."
- Join card label/CTA: "Got a room code?" / "Join the party"
- Auth heading/description: "The party's waiting" / "Hosts sign in to open a room — guests never need an account."
- Dashboard welcome: "Ready to host, {{name}}?"

### Deletions

- `app/components/stack-badge.tsx` (dead after auth-shell rewrite, confirmed zero remaining importers via `grep -rln`).
- `home.json`'s old `brand`/`tagline`/`cta_sign_up`/`cta_sign_in` keys (superseded by `common.app_name` + the new hero/join/how-it-works key tree).
- `auth.json`'s old `shell.points.{session,password,storage,runtime}` keys (superseded by `shell.points.{host,guests,queue}`).

### Verify (paste tails)

```
$ bun run typecheck
✨ Types written to worker-configuration.d.ts
(tsc -b — no errors, exit 0)

$ bun run test
 Test Files  29 passed (29)
      Tests  373 passed (373)

$ bun run build
[client]  ✓ built in 6.74s
[ssr]     ✓ 10632 modules transformed, ✓ built in 6.03s
```

Smoke (manual `bun run dev`, then killed):
```
$ curl -s http://localhost:5173/ | grep -o "Your living room is the stage" → match (SSR'd)
$ curl -s http://localhost:5173/ | grep -o "landing-code-input\|landing-join-button" → both present
$ curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/login → 200
$ curl -s http://localhost:5173/login | grep -o "party&#x27;s waiting" → match (SSR'd, HTML-entity-encoded apostrophe)
```

### Scope notes

Three surfaces touched (`home.tsx`, `authentication/components/auth-shell.tsx` + its two locale files, `dashboard/_index.tsx`), all owned directly by feat-008 per its own plan (no other feature's files touched) — plus the shared `room-code.ts` helper (feat-007-owned file, but instructed to reuse/extend rather than fork logic, and additive-only: no existing export changed shape). No new persistence, no new tagged errors, no `throw`/`try-catch` outside Effect, no Zod, no `process.env`, no hardcoded hex in JSX (all new color usage goes through `bg-gradient-accent` / `shadow-glow-accent` / semantic tokens). i18n kept en/zh in lockstep for every touched namespace. Left uncommitted in the working tree per instruction — nothing staged or committed.

_Status: Phase 3 complete — landing, auth, and dashboard rebuilt; all three verify-done gates green; smoke-tested against a live dev server._

## Step: Phase 4 — host TV screen reskin (Sonnet builder)

### What changed

**Added-by attribution: already shipped, not deferred.** Checked `app/lib/schemas/room-ws.ts`'s `QueueItem` and `app/lib/room-state.ts`'s `applyClientMessage` (per instruction) before touching anything: `QueueItem.singerNickname` + `addedByUserId` are already set server-side by the DO from the adding guest's own WS identity (`applyClientMessage`'s `ctx.nickname`/`ctx.userId`, sourced from the `x-nickname`/`x-user-id` upgrade headers in `app/durable-objects/karaoke-room.ts` — never client-reported per message). So "who added this song" was already single-writer, end-to-end data from feat-007 — no schema/reducer change was needed; Phase 4 only had to *render* it. No new protocol field, no reducer changes, no new unit tests required (the 373 existing tests are unchanged in count).

**`app/routes/room/$code.tsx`** — restructured into two states driven by `Boolean(playback?.currentItem)`:
- **Lobby** (`data-testid="room-lobby"`, shown whenever nothing is currently playing — including between songs after the queue drains, not just before the first song): big `tv-display` room code + large QR on the forced-white tile (`JoinPanel size="lg"`, idle `animate-pulse` glow ring gated by `motion-reduce:animate-none`), a "who's here" `RosterStrip`, and a friendly `lobby.prompt` line.
- **Playing**: `NowSingingBanner size="tv"` (gradient-accent `tv-headline`), `YoutubePlayer` + `HostControls size="tv"` + a small persistent `JoinPanel size="sm"` (corner join affordance, always visible, never gated behind an interaction), and `QueueRail size="tv"`.
- The Playing block is **kept mounted and just `hidden`** (CSS `display:none`, not conditionally unmounted) while in the lobby, specifically so the `YoutubePlayer`'s IFrame instance and its user-gesture "started" flag survive the lobby→playing transition instead of resetting and re-demanding a tap.
- **Celebration**: a `hasCelebratedRef` + `prevHasCurrentItemRef` pair detects the one true `null → non-null` edge on `playback.currentItem` (not just "is something playing" — repeated play/pause on the same song never re-fires, and a mid-session queue-drain back to idle followed by a new song does NOT re-fire either, since the ref latches permanently after the first fire). Before setting `showCelebration`, checks `window.matchMedia("(prefers-reduced-motion: reduce)").matches` and skips entirely for reduced-motion users — deliberately not relying on the app-wide duration-collapse net alone, since this component is JS-mounted, not purely CSS-driven.
- Host controls / connection pill / end-party dialog restyled to theme (gradient on the play/pause control only per design.md §3; destructive stays `--destructive`); all behavior (mutations, WS sends, disabled conditions) identical to Phase 3.

**New components** (`app/components/room/`): `initials-avatar.tsx` (shared gradient-fill initials avatar, design.md §8's "persistent gradient surface" exception), `roster-strip.tsx` ("who's here" chips — new roster `userId` gets a fresh DOM node so `animate-chip-in` only plays once per guest, existing chips never replay it), `celebration-burst.tsx` (hand-rolled confetti, no library, one-shot via `onDone` callback + `setTimeout(1500ms)`).

**Shared components extended additively** (`join-panel.tsx`, `now-singing-banner.tsx`, `queue-rail.tsx`, `host-controls.tsx` all gained an optional `size`/variant prop defaulting to the pre-Phase-4 compact behavior) — these four are also used by `/join/:code`'s guest tabs (`queue-tab.tsx`, `controls-tab.tsx`), which is Phase 5's surface; defaults were verified unchanged so this phase doesn't encroach on that scope.

**Bug found and fixed while building this**: custom `tv-*` utility classes (`tv-label`, `tv-title`, `tv-body`) are NOT recognized by `tailwind-merge`'s conflict-group config, so when combined with a shadcn/Radix component's own baked-in Tailwind text-size class (`Button`'s base `text-sm`, `Badge`'s base `text-xs`, `AlertDialogTitle`/`Description`'s base `text-lg`/`text-sm`), `twMerge` doesn't strip the component's default — both classes survive into the DOM and the winner is decided by generated-CSS source order, which (confirmed by inspecting the compiled `build/client/assets/*.css`) put the core Tailwind class LATER than my custom utility, silently overriding my override. Fixed by composing the TV-scale spec from plain recognized Tailwind utilities (`text-2xl font-semibold uppercase tracking-[0.04em]` for the tv-label spec, `text-4xl font-bold font-display` for tv-title, `text-[1.75rem] leading-[1.4] font-medium` for tv-body) everywhere a shadcn component's hidden default needed overriding, instead of the custom `tv-*` classes, which restores proper `twMerge` dedup. `AlertDialogCancel`/`AlertDialogAction` specifically render via Radix's `asChild` Slot pattern, which merges the className onto the child by plain concatenation (bypassing `tailwind-merge` entirely, even for otherwise-recognized classes) — those two use `!text-2xl !font-semibold` (Tailwind's important-modifier) so the override wins regardless of source order. Verified the fix for the count/own-marker badges and the end-party trigger button by curling the live SSR HTML and confirming `text-xs`/`text-sm` are absent from the rendered `class=` attribute (only the intended TV-scale classes remain).

**i18n** (`app/locales/{en,zh}/room.json`) — new `lobby.*` keys: `heading`, `prompt`, `roster_title` (en: `_one`/`_other`; zh: `_other` only, matching the existing `queue.count` pattern for zh's single CLDR plural category), `roster_empty`. All existing keys reused as-is (`join.hint`, `queue.singer`, `controls.*`).

**`app/app.css`** — two new one-shot keyframe utilities: `animate-confetti-fall` (celebration particles) and `animate-chip-in` (roster chip entrance). Both durations collapse under the existing global `prefers-reduced-motion` net; the idle glow ring reuses Tailwind's built-in `animate-pulse` (no new keyframe) gated additionally with `motion-reduce:animate-none`.

### Verify (paste tails)

```
$ bun run typecheck
✨ Types written to worker-configuration.d.ts
(tsc -b — no errors, exit 0)

$ bun run test
 Test Files  29 passed (29)
      Tests  373 passed (373)
(unchanged from Phase 3 — no reducer/schema changes, per the attribution finding above)

$ bun run build
✓ built in 6.47s
(exit 0)
```

Smoke (manual `bun run dev`, seeded local D1 via `bun run db:seed`, logged in as `admin@preview.local`, then killed):
```
$ curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/room/ZZZ-ZZZ (no session cookie) → 302 to /login (requireSession gate — pre-existing, confirms route alive without a 500)
$ curl -s -b cookies.txt http://localhost:5173/room/ZZZ-ZZZ → 200, contains "room-unavailable" + "Room not found" (authenticated not-found render)
$ room.create → new code (e.g. N7X-MRN); curl -s -b cookies.txt http://localhost:5173/room/<code> → 200, contains room-host-view, room-lobby, room-lobby-heading, room-join-qr, room-code-text (showing the real code), room-roster-empty, room-end-party-button
$ grep for lobby copy → "Party lobby", "Scan to join the party", "Be the first to scan and join", "End party" all present in SSR HTML
$ grep for the queue-count badge's rendered class= attribute → confirms text-xs/px-2/py-0.5 absent, text-2xl/font-semibold/uppercase/tracking-[0.04em]/px-4/py-1.5 present (verifies the tailwind-merge fix above)
$ room.close → 200; dev server killed
```

### Scope notes

Touched only feat-008's own Phase-4 surface: `app/routes/room/$code.tsx` + `app/components/room/*` (3 new files, 4 extended additively) + `app/app.css` + `app/locales/{en,zh}/room.json`. No new persistence, no new protocol/schema fields, no new tagged errors, no `throw`/`try-catch` outside Effect (client components follow existing `use-room-socket` patterns unchanged), no Zod, no `process.env`, no hardcoded hex/rgb/oklch in JSX (all new color usage goes through semantic tokens / `bg-gradient-accent` / `shadow-glow-accent`), `cn()` used for every conditional class. i18n kept en/zh in lockstep. Left uncommitted in the working tree per instruction — nothing staged or committed.

_Status: Phase 4 complete — host TV screen reskinned (lobby + playing states, persistent join affordance, one-shot celebration, added-by attribution rendered from already-existing data); all three verify-done gates green; smoke-tested against a live dev server with a real authenticated session._

## Step: Phase 5 — guest phone reskin + quick wins (Sonnet builder)

### What changed

**Nickname step** (`app/components/join/nickname-form.tsx`) — welcoming heading ("Ready to join the party?" / description "Pick a name the room will cheer for"), a live `InitialsAvatar` preview above the form that updates on every keystroke (falls back to a gradient mic chip when empty), a random-name spinner button (`IconDice5`, `data-testid="join-nickname-randomize"`, i18n'd aria-label/title only — generated names themselves are proper-noun-ish and NOT i18n'd per instruction) next to the nickname input, and the CTA restyled to `bg-gradient-accent` + `shadow-glow-accent` with copy "Join the party."

**New pure helper** (`app/lib/party-names.ts`) — `randomPartyName(random = Math.random)`: 24 adjectives × 24 nouns (576 combos, e.g. "Disco Llama", "Neon Walrus"), injectable RNG for determinism in tests. 5 unit tests in `app/lib/__tests__/party-names.test.ts` (fixed-random determinism, first/last-entry boundary, default `Math.random` path, list-length assertion).

**Search tab** (`app/components/join/search-tab.tsx`) — bigger pill-shaped search input + circular submit button; result rows get a trailing **circular gradient "+"** add button (`bg-gradient-accent` + `shadow-glow-accent`, per design.md §3's third sanctioned gradient use — `data-testid="join-search-add"` preserved exactly, now icon-only with an i18n'd aria-label/title instead of text). On successful add, toast now reads "Added! You're #N" (`join.search.added_position`) where N = `queueLength + 1` at send-time — `addToQueue` in `room-state.ts` always appends to the tail, so this is exact for the common case (best-effort under a same-instant concurrent add from another guest, which is an acceptable approximation for a toast). New `queueLength` prop threaded from the route's live WS state. Added a "queue almost full" line (`join.search.queue_almost_full`, i18next `_one`/`_other`) once fewer than 20 of the existing `MAX_QUEUE_SIZE` (200, from feat-007) slots remain — no new cap invented, reuses the existing one.

**Queue tab / shared `QueueRail`** (`app/components/room/queue-rail.tsx`) — compact (phone) rows now show an `InitialsAvatar` added-by chip next to the singer name (previously TV-only); own-item "You" badge/highlight unchanged (already shipped). Added tap-based **"move up"** (`IconArrowUp`) and **"move to top"** (`IconArrowBarUp`) icon buttons alongside the existing dnd-kit drag handle, gated by the exact same `reorderable` flag the drag handle uses (host: always; guest: only when `allowGuestReorder`) AND `!isTv` — the TV screen (`/room/:code`) keeps drag-only, phone surfaces (guest Queue tab + host Controls tab, both `size="compact"`) get both. **Reused the existing `queue.reorder` wire message verbatim — no new protocol message, no DO change.** `QueueReorderMessage` already carries `{ queueItemId, toIndex }` (a full destination index, not a delta), which is sufficient to express both "one slot up" and "to the top" client-side.

**New pure reducer helpers** (`app/lib/room-state.ts`, next to `reorderQueue`) — `moveUpIndex(queue, id)` → current index − 1 (or `null` if already first/unknown), `moveToTopIndex(queue, id)` → `0` (or `null` same conditions). `QueueRail` computes the destination index with these, optimistically reorders its local `displayQueue` (same pattern as the existing drag-end handler), then calls the same `onReorder(queueItemId, toIndex)` prop the drag path already calls. 6 new unit tests.

**Position bar** (new `app/components/join/position-bar.tsx`) — sticky bottom bar rendered under the Tabs in `app/routes/join/$code.tsx`, "You have N songs queued — next one is #K" (i18next `count`/`position`, `_one`/`_other`). Derivation is a new pure helper `ownQueueStanding(queue, ownUserId)` in `room-state.ts` (own-item count + 1-based position of the earliest still-queued own item — the currently-playing item already lives in `playback.currentItem`, not `queue`, so position `1` means "right after whoever's up now"). Purely client-derived from state the socket already has — no new wire message. 4 new unit tests. Renders `null` (nothing) once the viewer has 0 items queued.

**Controls tab retheme** (`app/components/room/host-controls.tsx`) — the compact (phone) play/pause button now also gets `bg-gradient-accent` (previously TV-only), matching the TV screen's "play/pause is the one primary transport control that earns the gradient" rule from design.md §3. No behavior change — same `onPlay`/`onPause` wiring, same disabled condition, skip button untouched.

**i18n** (`app/locales/{en,zh}/room.json`) — new keys: `queue.move_up`/`move_to_top`; `join.nickname.randomize`; `join.search.added_position`, `join.search.queue_almost_full_one`/`_other` (zh: `_other` only, matching the existing `queue.count`/`lobby.roster_title` zh convention for CLDR's single plural category); new `position.summary_one`/`_other` tree (zh: `_other` only). Reworded `join.nickname.title`/`description`/`submit` for the "welcoming heading" + "Join the party" CTA. Verified en/zh key-set parity programmatically — the only asymmetry is the pre-existing `_one`-suffix pattern (en has 4 more `_one` keys than zh, all Chinese-appropriate: `queue.count_one`, `lobby.roster_title_one`, plus my 2 new ones), same convention Phase 4 already established.

### Verify (paste tails)

```
$ bun run typecheck
✨ Types written to worker-configuration.d.ts
Exit: 0

$ bun run test
 Test Files  30 passed (30)
      Tests  388 passed (388)
(373 Phase-4 baseline + 15 new: 5 party-names + 10 room-state moveUp/moveToTop/ownQueueStanding)

$ bun run build
✓ built in 6.83s
Exit: 0
```

Smoke (manual `bun run dev`, killed after):
```
$ curl -s http://localhost:5173/join/FAKE-1 → contains "join-unavailable" + "Room not found" (friendly invalid-code state, no crash)
$ bun run db:seed; signed in as admin@preview.local; room.create → GKX-HXG
$ curl -s -b cookies http://localhost:5173/join/GKX-HXG → contains "join-nickname-card", "join-nickname-randomize", "join-nickname-submit", "Ready to join the party" (reskinned nickname step SSRs correctly for a real open room)
```

### Scope notes

Touched only feat-008's own Phase-5 surface: `app/components/join/*` (nickname-form, search-tab extended; position-bar new), `app/components/room/queue-rail.tsx` + `host-controls.tsx` (shared with `/room/:code`, extended additively — TV `size="tv"` behavior unchanged, verified move-buttons are `!isTv`-gated), `app/lib/room-state.ts` (3 new pure exports, zero changes to existing ones), `app/lib/party-names.ts` (new), `app/routes/join/$code.tsx`, `app/locales/{en,zh}/room.json`. No new wire protocol message (confirmed `queue.reorder`'s existing `{queueItemId, toIndex}` shape is sufficient — this was the task's explicit P1 gate), no DO (`karaoke-room.ts`) change, no new persistence, no new tagged errors, no `throw`/`try-catch` outside Effect, no Zod, no `process.env`, no hardcoded hex/rgb/oklch in JSX (all new color usage goes through `bg-gradient-accent`/`shadow-glow-accent`/semantic tokens), `cn()` used for every conditional class, `data-testid` on every new interactive element, `prefers-reduced-motion` unaffected (no new animation added — the app-wide `app.css` safety net from Phase 1 already covers everything here). i18n kept en/zh in lockstep modulo the pre-existing `_one`-suffix asymmetry. Unit tests added for both new pure helper modules (party-names.ts, room-state.ts's 3 new exports) per non-negotiable #4. Left uncommitted in the working tree per instruction — nothing staged or committed.

_Status: Phase 5 complete — guest phone reskin (nickname/search/queue tabs) + quick wins (random-name spinner, tap-reorder via the existing single-writer WS message, position bar, queue-almost-full warning, host Controls tab light retheme) shipped; all three verify-done gates green; smoke-tested against a live dev server including a real open room's SSR._


## Step: Phase 6a — delight pass (Sonnet builder)

### What changed

**"You're up!" name card** (new `app/components/room/now-up-overlay.tsx`, wired into `app/routes/room/$code.tsx`) — full-screen `aria-live="polite"` overlay (gradient-tinted dark scrim, `InitialsAvatar` `lg` + `shadow-glow-accent`, `tv-headline` "You're up, {{name}}!") shown on the host TV screen whenever `playback.currentItem` advances to a genuinely NEW item. Trigger logic in `$code.tsx` mirrors `CelebrationBurst`'s latching discipline: `prevNowUpItemIdRef` is seeded from whatever's current at mount (so a page reload mid-song never fires it), and a `hasSeenFirstItemRef` flag suppresses exactly the first `null -> item` edge (CelebrationBurst's own "room goes live" moment) while letting every later item-change — including a mid-party idle-then-resume — show the card. Auto-dismisses after 2.5s via a ref-tracked `setTimeout`; skips firing entirely under `prefers-reduced-motion` (JS `matchMedia` check, same as the celebration burst). New keyframe `room-now-up-in`/`animate-now-up` in `app.css` (fade+scale, 0.3s).

**Queue-row entrance animation (TV only)** (`app/components/room/queue-rail.tsx`) — new keyframe `room-queue-row-in`/`animate-queue-row-in` (slide-up + fade, 0.25s) in `app.css`. `QueueRail` tracks known item ids in a `knownQueueIdsRef` (`Set<string>`), seeded lazily from whatever's in `queue` the first time the component runs, then grown (without re-rendering) in a `useEffect([queue])` — so a `QueueRow` only gets `isNew` (and therefore the animation, gated additionally by `isTv`) the render *before* its id is added to the known set: genuinely new songs animate, the initial mount and pure reorders (same ids) never do.

**Party pop sounds** (new `app/lib/party-sounds.ts` + `app/lib/__tests__/party-sounds.test.ts`, wired into `$code.tsx`) — `createPartySounds(getMuted, createAudioContext?)` returns `{ playJoin, playAdd }`. No audio asset files: each call schedules one WebAudio oscillator (`JOIN_SOUND` = 660Hz sine/90ms, `ADD_SOUND` = 880Hz triangle/130ms) through a zero→`POP_GAIN_PEAK` (0.12)→near-zero gain envelope (linear 8ms attack, exponential decay). The `AudioContext` is a lazy singleton, created on the first *unmuted* play only (never eagerly); if it comes back `"suspended"`, `playBlip` calls `context.resume().catch(() => {})` — a rejected-promise handler, not try/catch syntax, per the non-negotiables. `createAudioContext` is injectable so 13 new unit tests exercise the envelope math and mute/lazy-init branching against a minimal `AudioContextLike` fake, without deep-mocking the whole WebAudio API.

Host header (`$code.tsx`) gets a new icon `Button` (`data-testid="room-sounds-toggle"`, `IconVolume`/`IconVolumeOff`, i18n'd `aria-label`/`title`) next to the `ConnectionStatusPill`, default unmuted, persisted to `localStorage["hk-party-sounds"]` (`"off"` = muted; absent/anything else = unmuted). Two new seed-then-diff effects (`knownGuestIdsRef`, `knownQueueSoundIdsRef`) fire `playJoin`/`playAdd` for genuinely new roster entries / queue items — gated behind a new `hasReceivedSnapshot` flag (`state.settings !== null`) so the very first live snapshot from `useRoomSocket` (which replaces the hook's empty `INITIAL_STATE` placeholder) seeds the known-id sets silently instead of misfiring a sound for every guest/song already in the room on connect. TV-only by construction — the sound engine only exists in this route, never `/join/:code`.

**Landing polish** (`app/routes/home.tsx`) — hero `<h1>` gets `animate-hero-in motion-reduce:animate-none`, a new CSS-only keyframe (`room-hero-in`, fade-up, 0.5s) in `app.css`; also rides the existing global `prefers-reduced-motion` net as a second line of defense.

**i18n** (`app/locales/{en,zh}/room.json`) — new `now_up.headline`, `sounds.mute_label`/`unmute_label`, kept in lockstep.

### Verify (paste tails)

```
$ bun run typecheck
✨ Types written to worker-configuration.d.ts
Exit: 0

$ bun run test
 Test Files  31 passed (31)
      Tests  401 passed (401)
(388 Phase-5 baseline + 13 new: party-sounds.test.ts)

$ bun run build
✓ 10639 modules transformed.
✓ built in 6.68s
Exit: 0
```

Smoke (manual `bun run dev`, killed after):
```
$ bun run db:seed → admin@preview.local / Password123!
$ curl -X POST /api/auth/sign-in/email → 200, session cookie
$ curl -X POST /api/trpc/room.create → 200, code "AR4-AD3"
$ curl /room/AR4-AD3 → 200, SSR contains data-testid="room-sounds-toggle", aria-label="Mute party sounds", room-host-view, room-lobby
$ curl / → 200, SSR contains "animate-hero-in motion-reduce:animate-none" on the hero <h1>
$ curl -X POST /api/trpc/room.close → 200 (cleanup)
```

### Scope notes

Touched only feat-008's own Phase-6a surface: `app/routes/room/$code.tsx`, `app/components/room/now-up-overlay.tsx` (new), `app/components/room/queue-rail.tsx` (extended additively, TV-only gate), `app/lib/party-sounds.ts` (new) + `app/lib/__tests__/party-sounds.test.ts` (new, 13 tests), `app/routes/home.tsx`, `app/app.css` (3 new keyframes/utilities), `app/locales/{en,zh}/room.json`. No new persistence, no new wire-protocol message, no new tagged errors, no `throw`/`try-catch` outside Effect (the one promise-rejection handler is `.catch(() => {})`, not try/catch syntax, per the task's explicit callout), no Zod, no `process.env`, no hardcoded hex/rgb/oklch in JSX, `cn()` used for every conditional class, `data-testid` on the new interactive element, every JS-driven animation gated by a `prefers-reduced-motion` `matchMedia` check and every CSS-only one motion-reduce-gated or riding the global net. Unit tests added for the one new pure-ish helper module per non-negotiable #4. i18n kept en/zh in lockstep. Left uncommitted in the working tree per instruction — nothing staged or committed.

_Status: Phase 6a complete — host TV delight pass ("you're up" name card, queue-row entrance animation, WebAudio party pop sounds behind a persisted mute toggle) + landing hero fade-up; all three verify-done gates green; smoke-tested against a live dev server with a real authenticated session and a real room._

## Step 1 — Phase 6a — delight pass (host TV screen focus)

```
Shipped: (1) "You're up, {nickname}!" full-screen name card (new now-up-overlay.tsx) triggered on playback.currentItem advancing to a genuinely new item, latched like CelebrationBurst so only the first lobby->playing edge is suppressed; (2) TV-only queue-row slide-up+fade entrance animation in queue-rail.tsx via a known-ids ref (new songs only, not initial mount/reorders); (3) WebAudio-synthesized join/add pop sounds (new app/lib/party-sounds.ts, no audio assets, lazy AudioContext singleton, resume().catch(() => {})) behind a new room-sounds-toggle icon button in the host header, default unmuted, persisted to localStorage["hk-party-sounds"], 13 new unit tests; (4) landing hero fade-up entrance (animate-hero-in, CSS-only). 3 new app.css keyframes, en/zh room.json kept in lockstep.
Verify: typecheck exit 0; test 31 files / 401 passed (388 baseline + 13 new); build exit 0 (10639 modules). Live smoke: bun run dev, signed in as admin@preview.local via /api/auth/sign-in/email, created room via room.create (code AR4-AD3), curl /room/AR4-AD3 SSR contains data-testid="room-sounds-toggle" + aria-label="Mute party sounds", curl / SSR contains animate-hero-in on the hero h1, room.close cleanup, server killed.
```

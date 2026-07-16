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


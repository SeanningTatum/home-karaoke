# Feature: Visual Redesign

_Last updated: 2026-07-23_

_Status: in-progress — kicked off 2026-07-23. Plan `plans/visual-redesign.html` (reviewed 2026-07-23, round 1, 5/5 decisions on recommended options)._

## Purpose

Replace the current flat near-black + pink-to-gold gradient look with a new "Velvet Stage" visual identity: warm wine-black stagelight backgrounds, spotlight pink as the single accent color (no more gradient), brass as a punctuation color for small details, `Fraunces` as the display serif for headings/hero moments, and `JetBrains Mono` for room codes and other monospace-shaped content. This is a design-system + per-page layout rethink, not a feature/behavior change — data-testids, i18n keys, and the TV `>=24px` + tv-safe layout rules are frozen and must not be renegotiated by this feature.

## When It's Used

- Every user-visible surface in the app: landing page, auth (sign in/up), host dashboard, room TV (lobby state + playing state), and the guest join flow on phone.
- Admin (`/admin/*`) inherits the new design tokens only (colors/type/spacing primitives) — no bespoke per-page redesign of admin screens in this feature.

## How It Works

Six phases, in order:

1. **Phase 1 — Tokens + type**: define the Velvet Stage design tokens (wine-black backgrounds, spotlight pink single accent, brass punctuation color) and typography (`Fraunces` display serif, `JetBrains Mono` for codes) at the Tailwind/theme-token layer. No page-level changes yet.
2. **Phase 2 — Shared components**: restyle shared/shadcn-based primitives (buttons, cards, inputs, badges, dialogs, etc.) on the new tokens so downstream page work has a consistent base.
3. **Phase 3 — TV surfaces**: room TV lobby state + playing state layout rethink on the new identity. Must preserve TV `>=24px` type scale and existing tv-safe rules (10-foot viewing, no page scroll at 1080p, etc.) established by feat-009.
4. **Phase 4 — Phone surface**: guest join flow (`/join/:code`) layout rethink on the new identity.
5. **Phase 5 — Desktop surfaces**: landing page, auth (sign in/up), and host dashboard layout rethink. Admin gets tokens only, not a bespoke redesign.
6. **Phase 6 — Verification + ship**: `/verify-done` full pass (typecheck/test/e2e smoke/build/harness-check), feature-verifier browser walk across all rethought surfaces (TV + phone + desktop), then `/ship-feature` to flip status and close out.

### Persistence details

No data model or persistence changes expected — this is a visual/CSS/markup layer feature. If a phase discovers a need for new persisted state (e.g. a per-room theme toggle), that would be a scope change requiring an updated plan decision, not silently folded in here.

### Testability

- No new business logic expected, so no new unit-test surface anticipated beyond incidental helper changes (if any pure layout-math helper is introduced, it must get a unit test per the repo's non-negotiables).
- Primary verification is visual: feature-verifier browser walk across landing, auth, dashboard, room TV (lobby + playing), and join phone, captured in `verifications/<date>.md` + screenshots, at Phase 6.
- Must confirm zero regressions to `data-testid` selectors used by `e2e/` smoke specs (frozen per scope) — do not rename/remove any existing testid as part of restyling.
- Must confirm i18n keys unchanged (frozen per scope) — copy changes, if any, go through existing locale files, not new keys invented ad hoc.

## Key Files

_To be filled in as phases land — this feature spans nearly every UI surface, so the Key Files table will accumulate incrementally per phase rather than being fully known at kickoff._

| File | Role |
|------|------|
| `plans/visual-redesign.html` | Reviewed plan — design tokens, per-page decisions, phase breakdown |
| (Phase 1) Tailwind theme / token files | Velvet Stage tokens: wine-black bg, spotlight pink accent, brass punctuation, Fraunces + JetBrains Mono |
| (Phase 2) shared UI primitives | shadcn-based buttons/cards/inputs/etc. restyled on new tokens |
| (Phase 3) room TV routes/components | Lobby + playing state layout rethink |
| (Phase 4) join/phone routes/components | Guest join flow layout rethink |
| (Phase 5) landing/auth/dashboard routes | Desktop surface layout rethink |

## Dependencies

- feat-007 (Group Karaoke Rooms) — owns the room TV + phone surfaces being redesigned.
- feat-008 (Karaoke UI/UX Overhaul) — established the current dark night-club stage system this feature replaces.
- feat-009 (TV Beta Feedback Polish) — established the TV `>=24px` type scale + tv-safe layout rules this feature must preserve.
- UI primitives: shadcn/Radix component library (restyled, not replaced).

## Tagged Errors

None expected — visual/layout feature, no new error paths.

| Error | Where raised | tRPC code |
|-------|--------------|-----------|
| n/a | n/a | n/a |

## Changelog

| Date | Type | Description |
|------|------|-------------|
| 2026-07-23 | feature | Scoped and started feat-012. Plan `plans/visual-redesign.html` reviewed round 1, 5/5 decisions on recommended options. 6 phases planned: tokens+type, shared components, TV surfaces, phone surface, desktop surfaces, verification+ship. Implementation not yet started. |

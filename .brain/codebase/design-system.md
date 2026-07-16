# Design System — Karaoke UI

> **Source of truth is [`design.md`](../../design.md) at the repo root.** This file is the brain-index pointer into it plus the token/implementation map for engineers working in `app/`. If the two ever disagree, `design.md` wins — update this file to match, don't fork the content.

## Direction

"Night-club stage" — dark theme is the **default**, "morning karaoke" (light) is fully maintained, not a stripped-down fallback. One signature gradient accent (pink → gold), used sparingly (primary CTA, now-singing highlight, add-song `+` — never as a default surface). One display face (Bricolage Grotesque) for hero moments; Inter stays the workhorse for everything else. Full rationale, full palette (light + dark, with hex/oklch and contrast numbers), typography scale (including the `/room` 10-foot TV scale), radius/shadow/glow, motion, sound, component notes, and accessibility are all in `design.md` — read it before touching visual surfaces, don't re-derive it here.

This supersedes the old boilerplate-era doc (refero-synthesized Cursor/Linear tokens for the marketing surface only) — the whole app now shares one karaoke-first visual language, not a split "marketing vs. internal" language.

## Where the tokens live

`app/app.css`, following [`.brain/rules/frontend.md`](../rules/frontend.md)'s 5-step process (`:root` = light, `.dark` = dark, registered into Tailwind via `@theme inline`). **Never hardcode hex/rgb/oklch in JSX** — use the semantic classes below.

Existing semantic vars (unchanged names — only values changed): `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary(-foreground)`, `--secondary(-foreground)`, `--muted(-foreground)`, `--accent(-foreground)`, `--destructive`, `--border`, `--input`, `--ring`, `--chart-{1..5}`, `--sidebar*`, `--radius`.

New tokens added this phase:

| Token | Use |
|---|---|
| `--success` / `--success-foreground` | Success/confirmation states — `bg-success text-success-foreground` |
| `--accent-start` / `--accent-end` | Gradient accent stops (pink → gold) — `bg-accent-start`, `text-accent-end`, or via the composed utilities below |
| `--glow-accent` / `--glow-success` | Colored, translucent `box-shadow` values registered under Tailwind's `shadow-*` namespace — `shadow-glow-accent`, `shadow-glow-success` |

Composed utilities (also in `app.css`, not manually re-derived per component):

```
.bg-gradient-accent    /* linear-gradient(135deg, accent-start, accent-end) */
.text-gradient-accent  /* same gradient, clipped to text */
```

## Typography

- **Workhorse**: Inter, self-hosted via `@fontsource-variable/inter` (`--font-sans`, `font-sans` — Tailwind default, no class needed for body text).
- **Display**: Bricolage Grotesque, self-hosted via `@fontsource-variable/bricolage-grotesque` (`--font-display`, `font-display` utility). Hero moments only — landing hero, page headlines, section titles, and all TV-scale roles on `/room`. Never for long/dynamic strings (singer nicknames, song titles in a list) — those stay on `font-sans`.
- Both fonts are bundled at build time (CSS `@import` in `app/app.css`) — **no runtime Google Fonts CDN request**, matching the Cloudflare Workers deployment model. `app/root.tsx`'s `links` export no longer references `fonts.googleapis.com`.

### TV type scale (`/room` only)

Nothing under 24px. Utilities: `.tv-display` (96px), `.tv-headline` (56px), `.tv-title` (36px), `.tv-body` (28px), `.tv-label` (24px, uppercase). Safe-margin utilities: `.tv-safe` / `.tv-safe-x` / `.tv-safe-y` (`clamp()`-based ~5% padding). See `design.md` §4 for the full role table.

## Theme default

Dark is the default theme (`app/root.tsx`'s `<ThemeProvider defaultTheme="dark" enableSystem>`), light stays fully available via the existing toggle (`app/components/theme-toggle.tsx`, unchanged component — `themeItems` still lists light/dark/system).

## Motion & reduced motion

`app/app.css` includes a global `@media (prefers-reduced-motion: reduce)` rule collapsing animation/transition durations app-wide — new animated components don't need to re-implement this individually, but should still design a calm default rather than relying solely on the override. Full motion/sound principles in `design.md` §6–7 (sound is a later phase — no code yet).

## Component notes (carried from `design.md` §8 — don't re-litigate per component)

- **Queue rows**: `tv-body`/`text-base` for singer+song; the now-singing row is the one place `bg-gradient-accent` + `shadow-glow-accent` apply together.
- **QR code**: always a literal `bg-white` tile regardless of theme (scanner contrast requirement, not a themed surface — intentional exception to "no hardcoded colors").
- **Avatar initials**: render on `bg-gradient-accent` with white text when there's no photo — the one persistent (non-momentary) use of the gradient, because it's small/decorative.

## Accessibility

Every shipped foreground/background pairing targets WCAG AA (≥4.5:1) for text — see `design.md` §9–10 for the full contrast table and the specific hex values tuned away from the plan's starting palette (mainly `--destructive` dark, `--success` light, and `--primary`/`--accent-start`/`--accent-end` light, all darkened for legibility on their respective backgrounds). Focus rings (`--ring`) now render in the signature pink/deep-pink rather than gray — more visible, not less.

## Changelog

| Date | Change |
|---|---|
| 2026-07-16 | Replaced boilerplate refero-synthesized (Cursor/Linear) marketing-surface doc wholesale with the karaoke "night-club stage" design system (feat-008 ui-overhaul, Phase 1). Source of truth moved to repo-root `design.md`. |

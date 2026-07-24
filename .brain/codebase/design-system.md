# Design System — Karaoke UI

> **Source of truth is [`design.md`](../../design.md) at the repo root.** This file is the brain-index pointer into it plus the token/implementation map for engineers working in `app/`. If the two ever disagree, `design.md` wins — update this file to match, don't fork the content.

## Direction

**"Velvet Stage"** (feat-012 visual-redesign) — warm wine-black stagelight dark theme is the **default**; light is **"Matinee"** (warm paper, token-level variant only — AA-safe but QA'd dark-only, art direction lives in dark). One interactive accent: spotlight pink `--primary` (`#ff3d9a` dark / `#d31d70` light). The old pink→gold gradient is **retired** — the only sanctioned gradients are the ambient `bg-stagelight` / `bg-stagelight-dim` background utilities. `--brass` is punctuation only (singer credit, marquee underline rule, now-singing avatar ring) — never a control color; violet is retired everywhere except `--chart-3`. One display face (Fraunces, serif) for marquee moments; Inter stays the workhorse; JetBrains Mono for room codes at small sizes. Full rationale, full palette (light + dark, exact oklch + contrast), typography scale (including the `/room` 10-foot TV scale), radius/shadow/glow, motion, sound, component notes, and accessibility are all in `design.md` — read it before touching visual surfaces, don't re-derive it here.

This supersedes both the boilerplate-era doc and the feat-008 "night-club stage" identity (pink→gold gradient + Bricolage Grotesque).

## Where the tokens live

`app/app.css`, following [`.brain/rules/frontend.md`](../rules/frontend.md)'s 5-step process (`:root` = light, `.dark` = dark, registered into Tailwind via `@theme inline`). **Never hardcode hex/rgb/oklch in JSX** — use the semantic classes below.

Existing semantic vars (unchanged names — only values changed): `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary(-foreground)`, `--secondary(-foreground)`, `--muted(-foreground)`, `--accent(-foreground)`, `--destructive`, `--border`, `--input`, `--ring`, `--chart-{1..5}`, `--sidebar*`, `--radius`. Note `--secondary` is now a **soft plum surface** for quiet secondary controls (dark `oklch(0.295 0.045 345)`), not a violet accent.

Karaoke tokens:

| Token | Use |
|---|---|
| `--success` / `--success-foreground` | Success/confirmation states — `bg-success text-success-foreground` |
| `--brass` / `--brass-foreground` *(feat-012)* | Brass punctuation — `text-brass`, `border-brass/60`, `ring-brass/70`. Dark `oklch(0.84 0.115 85)` ~`#e8c268`, light `oklch(0.6 0.105 85)` ~`#a37c1e` (AA-tuned for paper). **Never interactive.** |
| `--glow-accent` / `--glow-success` | Colored, translucent `box-shadow` values under Tailwind's `shadow-*` namespace — `shadow-glow-accent` (now **pink-only**, gold stop retired), `shadow-glow-success` |
| `--stage-glow` / `--stage-glow-dim` *(feat-012)* | Radial stagelight stops driving the utilities below |

**Removed (feat-012):** `--accent-start`, `--accent-end`, `.bg-gradient-accent`, `.text-gradient-accent` — do not reintroduce; no gradients on controls or text.

Composed utilities (in `app.css`, not manually re-derived per component):

```
.bg-stagelight      /* warm radial spotlight halo from top into --background — hero/lobby/overlay surfaces */
.bg-stagelight-dim  /* dimmer falloff — playing mode / secondary pages */
.code-marquee       /* room code at small sizes: JetBrains Mono, 600, 0.18em tracking, uppercase, tabular-nums */
```

## Typography

- **Workhorse**: Inter, self-hosted via `@fontsource-variable/inter` (`--font-sans` — Tailwind default, no class needed for body text).
- **Display**: Fraunces (serif), self-hosted via `@fontsource-variable/fraunces` (`--font-display`, `font-display` utility). Marquee moments only — landing hero, page headlines, room code, You're-up, recap, and all TV display roles on `/room`. Weights 560–640 with per-role `opsz` + `SOFT 40` variation settings (see the `tv-*` utilities). Never for long/dynamic strings (nicknames, song titles in a list) — those stay `font-sans`. Bricolage Grotesque is removed from `package.json`.
- **Mono**: JetBrains Mono, self-hosted via `@fontsource-variable/jetbrains-mono` (`--font-mono`) — room codes at small sizes via `code-marquee`.
- All three bundled at build time (CSS `@import` in `app/app.css`) — **no runtime Google Fonts CDN request**.

### TV type scale (`/room` only)

Nothing under 24px (exception: `tv-title-sm` 22px, scoped to the narrow playing rail). Utilities: `.tv-display` (96px), `.tv-headline` (56px), `.tv-code` (80px, 0.08em tracking — the room-code marquee over a `border-brass/60` rule in `join-panel.tsx`), `.tv-title` (36px), `.tv-title-sm` (22px), `.tv-body` (28px, Inter), `.tv-label` (24px, Inter uppercase). Safe-margin utilities: `.tv-safe` / `.tv-safe-x` / `.tv-safe-y` (`clamp()`-based ~5%, `--tv-safe-inline` is the single source of truth). See `design.md` §4 for the full role table.

## Theme default

Dark ("Velvet Stage") is the default theme (`app/root.tsx`'s `<ThemeProvider defaultTheme="dark" enableSystem>`), light ("Matinee") stays available via the existing toggle (`app/components/theme-toggle.tsx` — `themeItems` still lists light/dark/system) but is token-level only.

## Motion & reduced motion

`app/app.css` includes a global `@media (prefers-reduced-motion: reduce)` rule collapsing animation/transition durations app-wide — new animated components don't need to re-implement this individually, but should still design a calm default rather than relying solely on the override. Full motion/sound principles in `design.md` §6–7 (sound is a later phase — no code yet).

## Component notes (carried from `design.md` §8 — don't re-litigate per component)

- **Queue rows**: `tv-body`/`text-base` for singer+song; own rows tinted `border-primary/50 bg-primary/5`. Now-singing is marked by the **brass singer credit** (`text-brass` in `now-singing-banner.tsx`) + **brass avatar ring** (`ring-brass/70`) — no gradient fill.
- **Full-screen overlays** (NowUpOverlay, ReactionRecap): `bg-stagelight`, not a pink gradient wall.
- **QR code**: always a literal `bg-white` tile regardless of theme (scanner contrast requirement, not a themed surface — intentional exception to "no hardcoded colors").
- **Avatar initials**: `InitialsAvatar` fallback is `bg-secondary` + `text-primary` initials — the gradient fill is retired.
- **Confetti** (`celebration-burst.tsx` `PALETTE`): primary/brass/foreground/success per theme — violet removed.

## Accessibility

Every shipped foreground/background text pairing targets WCAG AA (≥4.5:1) for text; `--brass` never carries body text — its punctuation roles fall under the 3:1 large-text/non-text bar, which both theme values clear (the light value was darkened to `oklch(0.6 0.105 85)` ~`#a37c1e` for exactly this). See `design.md` §9–10 for the full contrast table and tuning deltas. Focus rings (`--ring`) render in spotlight pink — more visible, not less.

## Changelog

| Date | Change |
|---|---|
| 2026-07-23 | Rewritten for feat-012 visual-redesign "Velvet Stage": gradient retired (stagelight ambient-only), brass punctuation token, Fraunces display serif + JetBrains Mono, plum `--secondary`, Matinee light theme (token-level only). |
| 2026-07-16 | Replaced boilerplate refero-synthesized (Cursor/Linear) marketing-surface doc wholesale with the karaoke "night-club stage" design system (feat-008 ui-overhaul, Phase 1). Source of truth moved to repo-root `design.md`. |

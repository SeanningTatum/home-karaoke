# home-karaoke Design System

_Karaoke design system source of truth. Supersedes the old boilerplate visual language for every user-visible surface — landing, auth, dashboard, host TV screen (`/room/:code`), guest phone (`/join/:code`)._

> Tokens live in [`app/app.css`](app/app.css) as CSS custom properties (`:root` = light, `.dark` = dark), registered into Tailwind via `@theme inline` per [`.brain/rules/frontend.md`](.brain/rules/frontend.md). **Never hardcode hex/rgb/oklch in JSX** — always the semantic classes this doc names (`bg-primary`, `text-brass`, `tv-code`, etc.).

---

## 1. Brand personality

**"Velvet Stage."** home-karaoke should feel like a small velvet-draped theater the moment the house lights dim: warm wine-black dark, one spotlight, brass fittings catching the light. (feat-012 visual-redesign — this replaces the earlier "night-club stage" neon identity.) Concretely:

| Trait | What it means in the UI |
|---|---|
| **Theatrical, not neon** | One spotlight-pink accent on a warm wine-black stage; ambient stagelight halos instead of gradient-filled controls. The old pink→gold gradient is retired. |
| **Warm, not cold** | Backgrounds are wine-black (`~#1a0a13`), not pure `#000`; text is house-lights cream, not white; surfaces lift with a plum tint, not neutral gray. |
| **Brass is punctuation** | A single brass token marks *who's on stage* — the singer credit line, the marquee underline rule, the now-singing avatar ring. Never a control color, never a fill for interactive elements. |
| **Legible at a distance** | `/room` is read from a couch, not a desk — 10-foot type scale (§4) is non-negotiable. |
| **Dark-first, light-maintained** | Dark ("Velvet Stage") is the default and where the app spends most of its life (parties happen at night). Light ("Matinee") is a token-level variant only — functional, AA-safe warm paper, but art direction and QA live in the dark theme (Decision 4 of the redesign plan). |

---

## 2. Palette

All tokens below are defined in `app/app.css`: `:root` = light theme, `.dark` = dark theme (default). Values are OKLCH (quoted exactly from the CSS); the hex in parentheses is the nearest sRGB equivalent for reference in design tools. Contrast ratios are computed on those hex approximations.

### Dark theme — "Velvet Stage" (default)

| Semantic token | Value | Role |
|---|---|---|
| `--background` | `oklch(0.168 0.028 348)` (~`#1a0a13`) | App background — wine-black, warm not neutral |
| `--foreground` | `oklch(0.94 0.02 78)` (~`#f4e9d8`) | House-lights cream body text (contrast ~16:1) |
| `--card` | `oklch(0.215 0.035 346)` (~`#2a1421`) | Elevated "curtain" surface (cards, panels) |
| `--card-foreground` | `oklch(0.94 0.02 78)` | Text on card (contrast ~14.3:1) |
| `--popover` | `oklch(0.245 0.038 345)` | Popovers/dropdowns — raised curtain, one step lighter |
| `--primary` | `oklch(0.677 0.238 356.8)` (`#ff3d9a`) | Spotlight pink — the **only** interactive accent: CTA fills, focus ring, active states |
| `--primary-foreground` | `oklch(0.168 0.028 348)` | Wine-black text on primary (contrast ~5.8:1) |
| `--secondary` | `oklch(0.295 0.045 345)` | Soft plum surface — quiet secondary controls (was violet; violet is retired) |
| `--secondary-foreground` | `oklch(0.94 0.02 78)` | Cream text on secondary |
| `--muted` | `oklch(0.235 0.032 346)` (~`#2e1824`) | Low-emphasis fill |
| `--muted-foreground` | `oklch(0.73 0.03 340)` (~`#b09aa5`) | Dim mauve low-emphasis text (contrast ~7.3:1) |
| `--accent` | `oklch(0.27 0.042 345)` | Hover/highlight surface (menu items, ghost-button hover) |
| `--destructive` | `oklch(0.578 0.207 26.6)` (`#d92e2e`) | Danger actions (tuned from `#ff4d4d` — see §10 Tuning) |
| `--border` / `--input` | `oklch(0.315 0.042 345)` | Warm plum hairlines, input borders |
| `--ring` | `oklch(0.677 0.238 356.8)` | Focus ring — spotlight pink |
| `--success` | `oklch(0.827 0.154 170.5)` (`#2fe6b8`) | Mint — success/confirmation states |
| `--success-foreground` | `oklch(0.168 0.028 348)` | Wine-black text on success fill (contrast ~12:1) |
| `--brass` *(new, feat-012)* | `oklch(0.84 0.115 85)` (~`#e8c268`) | Brass punctuation — singer credit, marquee rule, now-singing ring. Never interactive. |
| `--brass-foreground` | `oklch(0.168 0.028 348)` | Wine-black on a brass fill (rare) |
| `--stage-glow` *(new)* | `oklch(0.34 0.075 345 / 62%)` | Stagelight radial stop — warm spotlight halo (§3) |
| `--stage-glow-dim` *(new)* | `oklch(0.26 0.05 345 / 50%)` | Dimmer stagelight stop for playing mode |

> **Retired (feat-012):** `--accent-start` / `--accent-end` no longer exist. The pink→gold gradient is gone from controls and text — see §3.

### Light theme — "Matinee"

Warm paper + wine ink; same structure as the dark stage with the house lights on. **Token-level variant only** — every pairing is functional and AA-safe, but the redesign was QA'd dark-only and art direction lives in the dark theme.

| Semantic token | Value | Role |
|---|---|---|
| `--background` | `oklch(0.975 0.012 80)` (~`#faf4ea`) | Warm paper, not clinical `#fff` |
| `--foreground` | `oklch(0.235 0.035 355)` (~`#31121f`) | Wine ink body text (contrast ~15.5:1) |
| `--card` | `oklch(0.993 0.005 85)` | Warm near-white elevated surface |
| `--popover` | `oklch(0.993 0.005 85)` | Popovers/dropdowns |
| `--primary` | `oklch(0.57 0.217 0.9)` (`#d31d70`) | Spotlight pink, deepened from the dark theme's `#ff3d9a` so white button text stays AA (contrast ~5.0:1) |
| `--secondary` | `oklch(0.93 0.022 350)` | Plum-tinted raised surface (quiet secondary controls — no longer a saturated violet fill) |
| `--muted` | `oklch(0.945 0.015 70)` | Warm parchment low-emphasis fill |
| `--muted-foreground` | `oklch(0.49 0.035 350)` | Dim mauve ink |
| `--accent` | `oklch(0.93 0.028 355)` | Pink-tinted hover surface |
| `--destructive` | `oklch(0.575 0.209 26.9)` (`#d92b2b`) | Danger actions (contrast ~4.85:1 with white text) |
| `--border` / `--input` | `oklch(0.89 0.02 65)` / `oklch(0.85 0.022 65)` | Warm hairlines |
| `--ring` | `oklch(0.57 0.217 0.9)` | Focus ring |
| `--success` | `oklch(0.516 0.103 167.8)` (`#087a5c`) | Deepened mint (contrast ~5.3:1 with white text — see §10 Tuning) |
| `--brass` *(new, feat-012)* | `oklch(0.6 0.105 85)` (~`#a37c1e`) | Darkened brass, tuned for AA on paper in its punctuation roles (§10) |
| `--brass-foreground` | `oklch(1 0 0)` | White on a brass fill (rare) |
| `--stage-glow` *(new)* | `oklch(0.93 0.045 60 / 75%)` | Stagelight radial stop |
| `--stage-glow-dim` *(new)* | `oklch(0.95 0.025 65 / 55%)` | Dimmer stagelight stop |

### Chart colors (both themes)

`--chart-1`…`--chart-5` = pink `oklch(0.677 0.238 356.8)`, gold `oklch(0.879 0.163 91.1)`, violet `oklch(0.596 0.27 302.8)`, mint `oklch(0.827 0.154 170.5)`, ember orange `oklch(0.727 0.176 41.2)` — same vivid hues in both themes. This is the **only place violet survives** the redesign: chart tokens are decorative marks on admin/analytics surfaces, not text or UI chrome, so neither the AA tuning nor the violet retirement applies to them.

---

## 3. Stagelight & accent discipline

The pink→gold gradient is **retired** (feat-012, Decision 3). `--accent-start`/`--accent-end`, `bg-gradient-accent`, and `text-gradient-accent` no longer exist — do not reintroduce them, and never put a gradient on a control or on text.

The only sanctioned gradients are the two **ambient stagelight surfaces** — a warm radial spotlight falling from the top of the surface into the base background, driven by `--stage-glow` / `--stage-glow-dim`:

```css
.bg-stagelight      /* radial-gradient(120% 85% at 50% -10%, var(--stage-glow) 0%, transparent 62%) over bg */
.bg-stagelight-dim  /* dimmer, tighter falloff — playing mode / secondary pages; the video is the light source */
```

Where they apply: full-page backgrounds and full-screen overlays (landing hero, lobby, auth stage panel, dashboard, `/join` shell, NowUpOverlay, ReactionRecap). Never as a button, badge, or text fill.

Accent discipline after the redesign:

1. **One interactive accent.** Spotlight pink `--primary` is the only color that means "you can press this" — CTA fills, focus ring, active tab, the add-song `+`. Secondary actions sit on the quiet plum `--secondary` surface.
2. **Brass is punctuation, never interactive.** `--brass` marks the performer and the marquee: the singer credit line under the now-playing title, the border-b rule under the room code, the ring on the now-singing avatar, the celebration/confetti palette. If an element responds to input, it is not brass.
3. **Violet is retired** everywhere in the UI — including the confetti palette (`app/components/room/celebration-burst.tsx` `PALETTE` is now primary/brass/foreground/success per theme). It survives only as `--chart-3` (§2).

**Don't**: gradient-fill buttons, gradient text, brass buttons, a second accent hue. The stage reads as special because it has one spotlight.

---

## 4. Typography

### Display face: Fraunces

**Fraunces replaces Bricolage Grotesque** (feat-012; `@fontsource-variable/bricolage-grotesque` is removed from `package.json`). A wonky old-style display **serif** is the theatrical/editorial marquee voice the Velvet Stage identity needs — playbill, not poster:

- It has a genuine **optical-size variable axis (`opsz`)** — the same file reshapes letterforms from 24px rail headings up to the 96px TV display, exactly the "one huge word on a TV" range `/room` spans. Each `tv-*` role pins its own `opsz` (144 for display/code, 72 headline, 40 title, 24 title-sm).
- Its **`SOFT` axis** (set to `40` across all display roles) rounds the terminals just enough to read warm and friendly rather than severe — the serif equivalent of stage velvet, not a law-firm masthead.
- As a serif it carries the marquee voice at **moderate weights** — the `tv-*` roles sit at **560–640**, not the 700–800 a grotesque needed to feel like a headline.
- It **pairs cleanly with Inter**: high contrast in genre (serif display vs. grotesque body) means the two never compete, and Inter keeps long/dynamic strings (nicknames, song titles) legible.
- Ships as `@fontsource-variable/fraunces` — single variable-font file, self-hosted, no runtime CDN call.

Inter (self-hosted via `@fontsource-variable/inter`) stays the UI workhorse for body copy, labels, forms, and anywhere long or dynamic strings appear — the display serif is reserved for short, static-ish hero strings.

**JetBrains Mono** (new `--font-mono`, self-hosted via `@fontsource-variable/jetbrains-mono`) is the third face, with one job: **room codes at small sizes** (see "Signature: the marquee" below).

All three are bundled at build time (CSS `@import` in `app/app.css`) — zero runtime Google Fonts CDN dependency (this is a Cloudflare Workers app).

```css
--font-sans: "Inter Variable", ...              /* workhorse */
--font-display: "Fraunces Variable", Charter, Georgia, serif  /* marquee moments only */
--font-mono: "JetBrains Mono Variable", ...     /* room codes at small sizes */
```

### Signature: the marquee

The room code is the app's signature element — treated like a theater marquee at every size:

- **TV lobby** (`app/components/room/join-panel.tsx`): the code renders in `tv-code` — Fraunces at 80px, weight 640, `letter-spacing: 0.08em`, `opsz 144` — sitting on a **brass underline rule** (`border-b-2 border-brass/60`). 80px, not the 96px `tv-display`, so a 7-char `XXX-XXX` code stays on one line inside the lobby column. The auth stage panel echoes the same treatment at 4xl.
- **Small sizes** (corner ticket while playing, phone header, dashboard session row): the `code-marquee` utility — JetBrains Mono, weight 600, `letter-spacing: 0.18em`, uppercase, `tabular-nums` — spaced like letterboard tiles.

### Scale

| Role | Class | Size | Weight | Face | Use |
|---|---|---|---|---|---|
| Display (hero) | `text-5xl`/`text-6xl` `font-display font-semibold` | 48–60px | 560–640 | Fraunces | Landing hero word, big celebratory moments |
| Headline | `text-3xl font-display font-semibold` | 30px | 600 | Fraunces | Page-level H1 |
| Title | `text-xl font-display font-semibold` | 20px | 600 | Fraunces | Section headers, card titles |
| Body | `text-base` | 16px | 400–500 | Inter | Default copy |
| Label | `text-sm font-medium` | 14px | 500 | Inter | Form labels, meta, captions |
| Code (small) | `code-marquee` | context-sized | 600 | JetBrains Mono | Room code anywhere below TV scale |

### TV type scale (`/room` only — 10-foot viewing distance)

Nothing under 24px (the 22px `tv-title-sm` is the one deliberate exception, scoped to the narrow playing-state rail). Utility classes registered in `app.css`, all display roles now Fraunces with per-role `font-variation-settings`:

| Role | Utility | Size | Weight | Variation | Face | Use |
|---|---|---|---|---|---|---|
| TV Display | `.tv-display` | 96px | 620 | `opsz 144, SOFT 40` | Fraunces | "Now Singing: \<name\>" hero |
| TV Headline | `.tv-headline` | 56px | 600 | `opsz 72, SOFT 40` | Fraunces | Big state changes ("Waiting for singers…") |
| TV Code | `.tv-code` | 80px | 640, 0.08em tracking | `opsz 144, SOFT 40` | Fraunces | The room-code marquee in the lobby QR hero |
| TV Title | `.tv-title` | 36px | 600 | `opsz 40, SOFT 40` | Fraunces | "Up Next" section header, now-playing title |
| TV Title (rail) | `.tv-title-sm` | 22px | 600 | `opsz 24, SOFT 40` | Fraunces | Queue heading in the ~320px playing-state rail |
| TV Body | `.tv-body` | 28px | 500 | — | Inter | Queue rows, singer names |
| TV Label | `.tv-label` | 24px | 600, uppercase | — | Inter | Chips, counts, meta labels |

Safe margins: `.tv-safe` (both axes), `.tv-safe-x` / `.tv-safe-y` (single axis) — `clamp()`-based ~5% padding so nothing sits flush against a TV's edge, with a sane floor for narrower/preview viewports. `--tv-safe-inline` is the single source of truth for the inline value.

---

## 5. Radius, shadows, glow

- **Radius**: base `--radius` stays **`1rem`** (16px) — a warmer, huggable corner that fits the stage. `rounded-sm/md/lg/xl` derive from it (`calc(var(--radius) ± Npx)`).
- **Shadows**: default Tailwind `shadow-sm`/`shadow-md` (black-based) stay for light theme. On the dark theme they're nearly invisible against wine-black — expected; **dark-theme elevation should read as light output (glow), not a shadow**.
- **Glow**: `--glow-accent` is now **pink-only** — the gold stop is retired with the gradient. Exact values: dark `0 0 32px oklch(0.677 0.238 356.8 / 38%)`, light `0 0 20px oklch(0.57 0.217 0.9 / 25%)`; `--glow-success` dark `0 0 24px oklch(0.827 0.154 170.5 / 40%)`, light `0 0 18px oklch(0.516 0.103 167.8 / 30%)`. Registered under Tailwind's `shadow-*` namespace — `shadow-glow-accent` / `shadow-glow-success`. The rare-moments reserve is unchanged: after the redesign `shadow-glow-accent` survives on the TV play button (`host-controls.tsx`) and the now-up avatar (`now-up-overlay.tsx`); the TV join-panel hero gets its halo from a blurred `bg-primary` pulse behind the card. Not a default card treatment.

---

## 6. Motion principles

1. **Purposeful, not decorative.** Motion communicates a state change (song added, your turn is next, room code copied) — it doesn't run just because it can.
2. **Celebration moments are rare.** A "now singing" transition or the singer finishing their song can get a bigger, more theatrical animation (scale-in, confetti burst). Routine UI (list reorders, hovers) stays quick and subtle (150–250ms, ease-out).
2. **`prefers-reduced-motion` is always honored.** `app/app.css` includes a global safety net that collapses all animation/transition durations to ~0 when the user has reduced motion set, so future phases don't have to remember to gate every keyframe individually — but still prefer designing the calm-by-default state rather than relying solely on the override.
3. **No motion should block interaction.** Never require an animation to finish before a control becomes usable.

---

## 7. Sound principles (future phase)

Tiny, non-intrusive audio pops behind an explicit **host mute toggle** (default: on/audible is the host's call, not forced on every device):

- **Join pop** — a guest joins the room.
- **Add pop** — a song is added to the queue.

No singer rotation logic, no audio normalization — explicitly out of scope per the plan review. Implementation (asset choice, toggle persistence, playback wiring) is a later phase; this doc only fixes the *principle* (subtle, opt-out via host, never on the singing audio itself).

---

## 8. Component notes (for later phases — recorded now so they're not re-litigated)

- **Queue rows** — `/join` and `/room` queue lists use `tv-body`/`text-base` for the singer+song line; your own rows are marked with a quiet `border-primary/50 bg-primary/5` tint. The *now-singing* treatment is no longer a gradient fill: the current song shows as the `tv-title` title + a **brass singer credit line** (`text-brass` on the `tv-label` credit in `now-singing-banner.tsx`), and the now-singing avatar wears a **brass ring** (`ring-brass/70`).
- **Full-screen overlays** — NowUpOverlay and ReactionRecap sit on `bg-stagelight` (the ambient spotlight wall), not a pink gradient.
- **QR code** — the join QR on `/room` always renders on a plain **white tile** (`bg-white` literal, not a semantic token — this is a hard requirement of QR scanners needing max contrast against a light quiet-zone, not a themed surface) regardless of app theme.
- **Avatar initials** — guest/host avatars with no photo render initials as `bg-secondary` (soft plum surface) with `text-primary` initials (`initials-avatar.tsx`) — the gradient fill is retired. The brass ring is reserved for the now-singing avatar, not the fallback style.

---

## 9. Accessibility

- **Contrast**: every semantic foreground/background text pairing above targets **WCAG AA (≥4.5:1)** for body text. `--brass` is the deliberate exception: it never carries body text — its roles (underline rule, avatar ring, 24px uppercase `tv-label` singer credit) fall under the 3:1 large-text/non-text bar, which both theme values clear (dark brass on wine-black ~11.3:1; light brass on paper ~3.5:1). If a later phase is tempted to set body copy in brass, don't — use `--foreground`.
- **Focus states**: every interactive element keeps a visible `--ring` outline (`focus-visible:ring-ring/50`, unchanged mechanism) — the ring color is the spotlight pink/deep-pink, so focus is more visible, not less.
- **Color is never the only signal** — success/danger states pair color with an icon or text label, not fill color alone (existing pattern via `sonner` toasts + lucide icons; carry this rule into new components).
- **`prefers-reduced-motion`**: see §6.
- **QR tile**: forcing a literal white background (§8) is itself an accessibility/functionality requirement — scanners need the fixed light/dark contrast of the printed QR spec regardless of app theme.

---

## 10. Tuning away from the plan's starting hexes

Where shipped light-theme (and dark `--destructive`) values were tuned for contrast, and what feat-012 changed:

| Token | Starting value | Shipped | Why |
|---|---|---|---|
| `--destructive` (dark) | `#ff4d4d` | `#d92e2e` (`oklch(0.578 0.207 26.6)`) | `#ff4d4d` only reaches 3.27:1 contrast with white button text (fails AA); `#d92e2e` reaches ~4.8:1 while staying clearly "danger red." |
| `--success` (light) | `#2fe6b8` (same as dark) | `#087a5c` (`oklch(0.516 0.103 167.8)`) | The dark theme's mint fails AA with white text on a light background; deepened to ~5.3:1 while keeping the hue family. |
| `--primary` (light) | `#ff3d9a` (same as dark) | `#d31d70` (`oklch(0.57 0.217 0.9)`) | The dark theme's pink is a light-on-dark accent; deepened so white button text clears ~5.0:1 on paper. |
| `--accent-end` (light) | `#c98a00` | **token deleted** (feat-012) | The gradient is retired (§3); there is no second accent stop to tune. `--accent-start` is likewise gone. |
| `--brass` (light) *(new)* | dark value `oklch(0.84 0.115 85)` (~`#e8c268`) | `oklch(0.6 0.105 85)` (~`#a37c1e`) | The dark theme's brass is nearly invisible on warm paper; darkened until its punctuation roles (rules, rings, `tv-label` credits) clear AA's 3:1 non-text/large-text bar (~3.5:1 on paper, ~3.9:1 under white text). |
| `--radius` | `0.625rem` (boilerplate default) | `1rem` | Fits the "warm, huggable" pillar; derived radii (`sm/md/lg/xl`) still calc from it, no component changes required. |

`--background`, `--card`, and the dark-theme `--primary`/`--success`/`--brass` ship at their intended identity values — they already cleared their respective bars.

---

## 11. Layout (feat-013 layout-evolution)

Per-surface layout notes — structure only; every token/type/accent rule above is unchanged.

| Surface | Layout |
|---|---|
| **Landing** (`app/routes/home.tsx`) | Single-scroll marketing page: sticky NavBar → two-column Hero (copy left, framed product screenshot right) → HowItWorks → FeatureGrid (6 shipped features) → CtaBand (marquee `KQ7-3FP` motif) → Footer with GitHub link. |
| **Dashboard** (`app/routes/dashboard/_index.tsx`) | Host hub: slim top bar (account role chip), full-width `bg-stagelight` stage hero carrying the Start-a-party CTA, then horizontal rails — Previous sessions (on `room.listMine`; live rooms get a Rejoin card + LIVE badge, errors degrade to the empty state) and Featured playlists (visible coming-soon placeholder, static and non-interactive). |
| **Party screen** (`app/routes/room/$code.tsx`) | Unified spacing scale: **24px inside panels, 32px between them** (queue panel `p-8`, queue items `p-4` with `size-14` thumbs, playing rail `p-6`/`gap-6`). The lobby top bar renders **only in the lobby** — the playing state gives that height to the video and the connection pill moves into the right-rail header row. Roster board is content-sized (`min-h` 200px / `max-h` 40%, not a fixed third), and the now-singing title reserves 2 lines via `min-h-[2lh]` so the rail doesn't jump between short and long titles. |

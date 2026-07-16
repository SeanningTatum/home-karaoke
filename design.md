# home-karaoke Design System

_Karaoke design system source of truth. Supersedes the old boilerplate visual language for every user-visible surface — landing, auth, dashboard, host TV screen (`/room/:code`), guest phone (`/join/:code`)._

> Tokens live in [`app/app.css`](app/app.css) as CSS custom properties (`:root` = light, `.dark` = dark), registered into Tailwind via `@theme inline` per [`.brain/rules/frontend.md`](.brain/rules/frontend.md). **Never hardcode hex/rgb/oklch in JSX** — always the semantic classes this doc names (`bg-primary`, `text-success`, `tv-display`, etc.).

---

## 1. Brand personality

**"Night-club stage."** home-karaoke should feel like the moment the room goes dark, a spotlight hits the mic, and the crowd leans in. Concretely:

| Trait | What it means in the UI |
|---|---|
| **Electric, not corporate** | Saturated pink→gold gradient accent, glow instead of flat drop-shadow, bold display type on hero moments. |
| **Warm, not cold** | Backgrounds are near-black eggplant, not pure `#000` — and card surfaces lift with a warm violet tint, not neutral gray. |
| **Playful, not gimmicky** | One gradient, one display face, used sparingly. No confetti-everywhere, no rainbow buttons. |
| **Legible at a distance** | `/room` is read from a couch, not a desk — 10-foot type scale (§4) is non-negotiable. |
| **Two moods, same app** | Dark ("night-club stage") is the default and where the app spends most of its life (parties happen at night). Light ("morning karaoke") is fully maintained for daytime use / accessibility preference — never a stripped-down afterthought. |

---

## 2. Palette

All tokens below are defined in `app/app.css`: `:root` = light theme, `.dark` = dark theme (default). Values are OKLCH; the hex in parentheses is the nearest sRGB equivalent for reference in design tools.

### Dark theme — "night-club stage" (default)

| Semantic token | Value (hex approx.) | Role |
|---|---|---|
| `--background` | `#0d0b12` | App background — near-black eggplant, not pure black |
| `--foreground` | `#f5f3f7` | Body text on background (contrast 17.7:1) |
| `--card` | `#18151f` | Elevated surface (cards, panels) |
| `--card-foreground` | `#f5f3f7` | Text on card |
| `--popover` | `#211d29` | Popovers/dropdowns — one step lighter than card |
| `--primary` | `#ff3d9a` | Signature pink — CTA fills, focus ring, gradient start |
| `--primary-foreground` | `#0d0b12` | Text on primary (contrast 5.95:1) |
| `--secondary` | `#a238ff` | Violet — secondary actions, badges, queue-count chip |
| `--secondary-foreground` | `#ffffff` | Text on secondary (contrast 4.62:1) |
| `--muted` | `#221e2c` | Low-emphasis fill |
| `--muted-foreground` | `#b9b3c4` | Low-emphasis text (contrast 9.6:1) |
| `--accent` | `#2a2534` | Hover/highlight surface (menu items, ghost-button hover) |
| `--destructive` | `#d92e2e` | Danger actions (tuned from the plan's starting `#ff4d4d` — see §7 Tuning) |
| `--border` / `--input` | `#3a3448` | Hairlines, input borders — visible against near-black bg |
| `--ring` | `#ff3d9a` | Focus ring — signature pink |
| `--success` *(new)* | `#2fe6b8` | Mint — success/confirmation states |
| `--success-foreground` *(new)* | `#0d0b12` | Text on success fill (contrast 12.2:1) |
| `--accent-start` *(new)* | `#ff3d9a` | Gradient accent, stop 1 (pink) |
| `--accent-end` *(new)* | `#ffd23d` | Gradient accent, stop 2 (gold) |

### Light theme — "morning karaoke"

| Semantic token | Value (hex approx.) | Role |
|---|---|---|
| `--background` | `#fdfaf6` | Warm off-white, not clinical `#fff` |
| `--foreground` | `#1a1420` | Body text (contrast 17.3:1) |
| `--card` | `#ffffff` | Elevated surface |
| `--popover` | `#ffffff` | Popovers/dropdowns |
| `--primary` | `#d31d70` | Deep pink — deepened from the dark theme's `#ff3d9a` so text stays AA-legible on a light bg (contrast 5.0:1 with white text) |
| `--secondary` | `#7b1fd6` | Deep violet (contrast 7.0:1 with white text) |
| `--muted` | `#f3eef6` | Low-emphasis fill |
| `--muted-foreground` | `#6b6478` | Low-emphasis text (contrast 5.4:1) |
| `--accent` | `#f1e9fb` | Hover/highlight surface, violet-tinted |
| `--destructive` | `#d92b2b` | Danger actions (contrast 4.85:1 with white text) |
| `--border` / `--input` | `#e5dfe8` / `#d8d0dd` | Hairlines |
| `--ring` | `#d31d70` | Focus ring |
| `--success` *(new)* | `#087a5c` | Deepened mint (contrast 5.3:1 with white text — see §7 Tuning) |
| `--accent-start` *(new)* | `#d31d70` | Gradient accent, stop 1 (deep pink, light-safe) |
| `--accent-end` *(new)* | `#c98a00` | Gradient accent, stop 2 (deep gold, light-safe) |

### Chart colors (both themes)

`--chart-1`…`--chart-5` = pink `#ff3d9a`, gold `#ffd23d`, violet `#a238ff`, mint `#2fe6b8`, ember orange `#ff7a45` — same vivid hues in both themes (used as decorative marks on admin/analytics surfaces, not as text, so theme-specific AA tuning doesn't apply).

---

## 3. Gradient accent usage rules

The pink→gold gradient (`--accent-start` → `--accent-end`) is the app's signature move. **It reads as special because it's rare.** Use it only for:

1. **Primary CTA** — the single most important action on a screen (e.g. "Create Room", "Join"). Not every button — most buttons stay solid `bg-primary`.
2. **Now-singing highlight** — the queue row / card for whoever is currently performing on `/room`.
3. **Add-song `+`** — the control that adds a song to the queue on `/join`.

Utilities (registered in `app.css`):

```css
.bg-gradient-accent   /* linear-gradient(135deg, accent-start, accent-end) as background-image */
.text-gradient-accent /* same gradient, clipped to text (background-clip: text) */
```

Or compose manually with Tailwind's own gradient utilities: `bg-linear-to-br from-accent-start to-accent-end`.

**Don't**: apply the gradient to body text, borders-everywhere, every badge, or backgrounds of large content areas — it competes with itself and stops meaning anything.

---

## 4. Typography

### Display face: Bricolage Grotesque

**Chosen over Unbounded.** Both are legitimate "expressive stage" candidates; Bricolage Grotesque wins for this app because:

- It has a genuine **optical-size variable axis** — the same variable font file reshapes letterforms for large display sizes (tighter spacing, more confident terminals) vs. body sizes, which is exactly the "one huge word on a TV" use case `/room` needs.
- It reads as **friendly-bold**, not blocky/industrial — closer to "house party" than "brutalist poster," which fits a karaoke app better than Unbounded's heavier geometric weight.
- It stays legible at both **hero display sizes** (96px "Now Singing" titles) and **mid sizes** (36px section titles) without needing a second face — Unbounded gets visually heavy at anything under ~48px.
- Ships as `@fontsource-variable/bricolage-grotesque` — single variable-font file, self-hostable, no runtime CDN call.

Inter (already wired, self-hosted via `@fontsource-variable/inter`) stays the UI workhorse for body copy, labels, forms, and anywhere long or dynamic strings appear (singer nicknames, song titles in a list) — the display face is reserved for short, static-ish hero strings.

Both are self-hosted: `@fontsource-variable/inter` + `@fontsource-variable/bricolage-grotesque`, imported in `app/app.css`, zero runtime Google Fonts CDN dependency (this is a Cloudflare Workers app — no reliance on an external font host at request time).

```css
--font-sans: "Inter Variable", ...      /* workhorse */
--font-display: "Bricolage Grotesque Variable", ...  /* hero moments only */
```

### Scale

| Role | Class | Size | Weight | Face | Use |
|---|---|---|---|---|---|
| Display (hero) | `text-5xl`/`text-6xl` `font-display font-bold` | 48–60px | 700–800 | Display | Landing hero word, big celebratory moments |
| Headline | `text-3xl font-display font-bold` | 30px | 700 | Display | Page-level H1 |
| Title | `text-xl font-display font-semibold` | 20px | 600 | Display | Section headers, card titles |
| Body | `text-base` | 16px | 400–500 | Sans | Default copy |
| Label | `text-sm font-medium` | 14px | 500 | Sans | Form labels, meta, captions |

### TV type scale (`/room` only — 10-foot viewing distance)

Nothing under 24px. Bold weights. Utility classes registered in `app.css`:

| Role | Utility | Size | Weight | Face | Use |
|---|---|---|---|---|---|
| TV Display | `.tv-display` | 96px | 800 | Display | "Now Singing: \<name\>" hero |
| TV Headline | `.tv-headline` | 56px | 700 | Display | Room code, big state changes ("Waiting for singers…") |
| TV Title | `.tv-title` | 36px | 700 | Display | "Up Next" section header |
| TV Body | `.tv-body` | 28px | 500 | Sans | Queue rows, singer names |
| TV Label | `.tv-label` | 24px | 600, uppercase | Sans | Chips, counts, meta labels |

Safe margins: `.tv-safe` (both axes), `.tv-safe-x` / `.tv-safe-y` (single axis) — `clamp()`-based ~5% padding so nothing sits flush against a TV's edge, with a sane floor for narrower/preview viewports.

---

## 5. Radius, shadows, glow

- **Radius**: base `--radius` bumped from the boilerplate's `0.625rem` (10px) to **`1rem`** (16px) — a warmer, huggable corner that fits "playful, not corporate." `rounded-sm/md/lg/xl` derive from it as before (`calc(var(--radius) ± Npx)`), no component changes needed.
- **Shadows**: default Tailwind `shadow-sm`/`shadow-md` (black-based) stay for light theme, where they still read correctly. On the dark theme they're nearly invisible against `#0d0b12` — that's expected; **dark-theme elevation should read as light output (glow), not a shadow**, see below.
- **Glow** *(new)*: `--glow-accent` and `--glow-success` are per-theme `box-shadow` value lists (soft, colored, translucent) registered as Tailwind's `shadow-*` namespace — use as `shadow-glow-accent` / `shadow-glow-success`. Reserve for the same rare moments as the gradient (§3): the now-singing card, a success toast/confirmation, a primary CTA on hover. Not a default card treatment.

---

## 6. Motion principles

1. **Purposeful, not decorative.** Motion communicates a state change (song added, your turn is next, room code copied) — it doesn't run just because it can.
2. **Celebration moments are rare.** A "now singing" transition or the singer finishing their song can get a bigger, more theatrical animation (subtle gradient shimmer, scale-in). Routine UI (list reorders, hovers) stays quick and subtle (150–250ms, ease-out).
2. **`prefers-reduced-motion` is always honored.** `app/app.css` now includes a global safety net that collapses all animation/transition durations to ~0 when the user has reduced motion set, so future phases don't have to remember to gate every keyframe individually — but still prefer designing the calm-by-default state rather than relying solely on the override.
3. **No motion should block interaction.** Never require an animation to finish before a control becomes usable.

---

## 7. Sound principles (future phase)

Tiny, non-intrusive audio pops behind an explicit **host mute toggle** (default: on/audible is the host's call, not forced on every device):

- **Join pop** — a guest joins the room.
- **Add pop** — a song is added to the queue.

No singer rotation logic, no audio normalization — explicitly out of scope per the plan review. Implementation (asset choice, toggle persistence, playback wiring) is a later phase; this doc only fixes the *principle* (subtle, opt-out via host, never on the singing audio itself).

---

## 8. Component notes (for later phases — recorded now so they're not re-litigated)

- **Queue rows** — `/join` and `/room` queue lists use `tv-body`/`text-base` for the singer+song line; the *currently singing* row is the one place the gradient (§3) and glow (§5) apply together (`bg-gradient-accent` background + `shadow-glow-accent`), everyone else stays on plain `bg-card`.
- **QR code** — the join QR on `/room` always renders on a plain **white tile** (`bg-white` literal, not a semantic token — this is a hard requirement of QR scanners needing max contrast against a light quiet-zone, not a themed surface) regardless of app theme.
- **Avatar initials** — guest/host avatars with no photo render initials on a `bg-gradient-accent` fill with white text — this is the one place the gradient is a persistent (not momentary) surface, because it's small and decorative rather than a large content area.

---

## 9. Accessibility

- **Contrast**: every semantic foreground/background text pairing above targets **WCAG AA (≥4.5:1)** for body text; a few (`--secondary-foreground` on `--secondary` in dark, `4.62:1`) are close to the floor by design because the source palette (violet `#a238ff`) is fixed by the plan — if a later phase adds long-form body text directly on `--secondary`, prefer `--secondary-foreground` at full opacity and avoid dropping to `/80` or lower.
- **Focus states**: every interactive element keeps a visible `--ring` outline (`focus-visible:ring-ring/50`, unchanged from the boilerplate's mechanism) — the ring color is now the signature pink/deep-pink rather than gray, so focus is more visible, not less.
- **Color is never the only signal** — success/danger states pair color with an icon or text label, not fill color alone (existing pattern via `sonner` toasts + lucide icons; carry this rule into new components).
- **`prefers-reduced-motion`**: see §6.
- **QR tile**: forcing a literal white background (§8) is itself an accessibility/functionality requirement — scanners need the fixed light/dark contrast of the printed QR spec regardless of app theme.

---

## 10. Tuning away from the plan's starting hexes

The plan's review locked these as **starting** tokens, to be tuned for contrast. Deltas:

| Token | Plan starting hex | Shipped hex | Why |
|---|---|---|---|
| `--destructive` (dark) | `#ff4d4d` | `#d92e2e` | `#ff4d4d` only reaches 3.27:1 contrast with white button text (fails AA 4.5:1 for normal-weight body text); `#d92e2e` reaches 4.29:1 while staying clearly "danger red." |
| `--success` (light) | `#2fe6b8` (same as dark) | `#087a5c` | The dark theme's mint at 3.47:1 with white text fails AA on a light background; deepened to `#087a5c` (5.32:1) while keeping the same hue family. |
| `--primary` / `--accent-start` (light) | `#ff3d9a` (same as dark) | `#d31d70` | The dark theme's pink is a light-on-dark accent; at face value on a white/light bg with white button text it only clears 4.50:1 (borderline). Deepened to `#d31d70` (5.02:1) for headroom. |
| `--accent-end` (light) | `#ffd23d` (same as dark) | `#c98a00` | Gold is far too light to read as a gradient stop or button fill against a light background; deepened to a legible amber while keeping the "gold" identity. |
| `--radius` | `0.625rem` (unstated in review, boilerplate default) | `1rem` | Fits "playful, not corporate" pillar; derived radii (`sm/md/lg/xl`) still calc from it, no component changes required. |

`--background`, `--card`, `--secondary`/`--secondary-foreground`, and the dark-theme `--success`/`--accent-start`/`--accent-end` ship at (or within rounding of) the plan's starting hexes — they already cleared AA.

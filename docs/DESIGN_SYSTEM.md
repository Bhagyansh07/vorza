# Design system

Written from the tokens that are actually in the code, not from a mood board.
Every value below is quoted from `frontend/src/index.css` or
`frontend/tailwind.config.ts`.

---

## The one rule

**Components reference token classes. Never a literal colour.**

```tsx
// correct
<div className="bg-surface border-line text-ink-dim rounded-stem shadow-panel" />

// wrong -- this is why the favicon once drifted from the app (see Brand assets)
<div className="bg-[#0e6ad2] text-[#575b63]" />
```

A palette change should be a one-file edit. That property was violated once
already: the Oct-2026 light pass changed every token (dark -> light, cyan ->
enterprise blue) completely inside `index.css`/`tailwind.config.ts`, and the
component tree needed **zero** class renames to follow. What would have drifted
was the fixed raster brand assets (icons still drawn with the old near-black
plate), so `scripts/make_brand_assets.py` owns those and reads the same token
constants; changing a token and then regenerating keeps every format in lockstep.

---

## System preference: light and dark

The app follows the OS theme. One token block in `index.css` defines the light
palette on `:root`; a second block under `@media (prefers-color-scheme: dark)`
flips every token. Verified, not assumed: **zero** `dark:` utilities exist in
`src/`, components reference theme classes only, so the flip is a pure token
swap in one file. `color-scheme` is `light` on `:root` and `dark` under the
media query; `index.html` carries matching `color-scheme` and `theme-color`
pairs; the `sonner` toaster is `theme="system"`; `tailwind.config.ts` sets
`darkMode: ['media']`.

Because both palettes must hold WCAG AA on their own surfaces, the dark block
does not simply lighten the tokens: the accent is lifted to 62% lightness and
carries **dark ink** (white fails AA on it), the status colours are lifted so
they read as small text on a dark surface, and `--destructive` is decoupled
from `--signal-bad` (a button fill must carry white text at ~5.9:1 while the
signal colour needs ~4.8:1 as text on a surface -- two lightnesses). Graph
fills (`healthColor` in `features/graph/lib/encoding.ts`) read their lightness
from the `--health-fill-lightness` var: 50% on the near-white canvas, 58% on
the dark canvas, evaluated at call time so no theme state threads through the
renderer.

The dark-with-cyan-accent theme this replaced was retired on 2026-10-06 along
with the light re-skin; what remains is the same enterprise identity in both
themes -- cool neutral ramp, single blue accent, Primer-style status colours,
Geist Sans + Geist Mono Variable (self-hosted via fontsource) -- plus one
70/45 health bound in `src/lib/health-thresholds.ts`.

Do not add `dark:` variants. If you need contrast that the ramps do not give
you, the answer is a new token, not a `dark:` prefix.

---

## Surface ramp

Background to foreground, four steps plus a hairline. Each step exists because
something needed it; do not add steps for one-off components.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `220 20% 98%` | `222 24% 8%` | Page backdrop, graph canvas |
| `--surface` | `0 0% 100%` | `222 20% 12%` | Panels, cards, side panels, comment bubbles |
| `--raised` | `220 16% 96%` | `222 17% 16%` | Hover/active, nested cards, tooltips |
| `--panel` | `0 0% 100%` | `222 20% 12%` | Popovers, dropdowns, floating overlays |
| `--line` | `220 13% 89%` | `222 14% 24%` | Hairline borders and separators |

> ### `--panel` is not a Tailwind colour
>
> This is a trap worth knowing about. Tailwind resolves `shadow-*` against
> `boxShadow` **and** `colors` in the same namespace, so a colour key named
> `panel` makes `shadow-panel` compile to `--tw-shadow-color` with **no
> `box-shadow` at all**. The overlay shadow silently disappears and nothing errors.
>
> That is exactly what happened: `colors.panel` was removed and `boxShadow.panel`
> kept. The `--panel` CSS variable still exists and still backs `--popover`; it is
> just not a colour utility. Use `bg-popover` for the surface and `shadow-panel`
> for the shadow.

---

## Ink ramp

| Token | Light | Dark | Use |
|---|---|---|---|
| `--foreground` | `222 25% 11%` | `220 30% 94%` | Headings, highest-emphasis text |
| `--ink` | `222 18% 15%` | `220 22% 88%` | Body text on a surface |
| `--ink-dim` | `220 10% 38%` | `220 13% 66%` | Labels, secondary copy (5.9:1 light / 6.8:1 dark) |
| `--ink-faint` | `220 7% 49%` | `220 13% 58%` | Placeholders, axis ticks (4.5:1 light / 4.7:1 dark) |

Four levels. If a piece of copy does not fit, it usually wants to be deleted
rather than promoted to a new weight.

---

## Accent

| Token | Light | Dark |
|---|---|---|
| `--primary` | `212 87% 44%` | `212 94% 62%` |
| `--primary-foreground` | `0 0% 100%` | `222 40% 8%` |
| `--primary-soft` | `213 85% 95%` | `212 80% 20%` |

Enterprise blue (≈ `#0e6ad2`), the single accent for the whole product. In
light it carries white text at 5.2:1; in dark the same blue is lifted to 62%
and carries near-black ink at ~6.4:1 (white fails AA on a lighter blue). Both
sit on a hue no status colour occupies: the health ramp is green/amber/red and
the complexity ramp is blue/amber/red, so a focus ring or a selection state can
never be mistaken for a health signal.

`--primary-soft` is a tinted chip fill. Pair it with `text-primary`; never use it
as a standalone text colour.

**The accent never carries status.** If something is bad, it is `signal-bad`, not
"a redder primary".

---

## Status

Three canonical colours. These are the only three that mean "good / at risk /
critical".

| Token | Light | Dark | Meaning | Threshold |
|---|---|---|---|---|
| `--signal-good` | `143 72% 29%` | `143 66% 46%` | healthy | `health_score >= 70` |
| `--signal-warn` | `40 100% 30%` | `40 100% 52%` | at risk | `45 <= health_score < 70` |
| `--signal-bad` | `356 72% 47%` | `356 68% 62%` | critical | `health_score < 45` |

Light values are the darker re-tunes of the original dark ramp so the status
colours hold WCAG AA on white at body size. Dark values are lifted the other
way: each must read as **text on a dark surface** (good ~7.3:1, warn ~9.1:1,
bad ~4.8:1). `--destructive` follows `--signal-bad` in light but is decoupled in
dark (`356 74% 44%`) because a button fill carries white text (~5.3:1), a
different job from small text on a surface. Node fill reads its lightness from
`--health-fill-lightness` (`healthColor` in
`features/graph/lib/encoding.ts` renders at 50% on the light canvas, 58% on
the dark one).

The thresholds are **one pair, defined once**: `HEALTH_GOOD_MIN = 70`,
`HEALTH_WARN_MIN = 45` live in `src/lib/health-thresholds.ts`, re-exported by
`features/graph/lib/encoding.ts` and used by both the dashboard's `healthTone`
and the graph's `healthLabel`/legend. Before the unification the dashboard
bucketed at 80/50, so a file could read "Medium" in a badge and "Healthy" in the
legend on the same page. Frontend assertions live in
`src/lib/health-thresholds.test.ts` and `src/lib/health.test.ts`; the backend
assertion is `backend/tests/services/test_analysis_scoring.py`.

Aliases, kept because they carry product meaning that a bare `signal-*` loses at
the call site:

```css
--health-good: var(--signal-good);
--complexity-medium: var(--signal-warn);   /* same value, different question */
```

So `bg-health-good` reads as "this file is healthy" and `bg-complexity-medium`
reads as "this file is complex". Same pixel, different claim. Use the `health.*`
family for a health score and the `complexity.*` family for a complexity score --
never `signal-*` directly in a component, because `--complexity-low` is
`214 55% 45%`, a desaturated blue that exists only in the complexity family.

---

## Radii

| Token | Value | Use |
|---|---|---|
| `--radius` | `0.5rem` | Buttons, inputs, cards (`rounded-lg`) |
| `--radius-stem` | `0.375rem` | Floating layers: tooltips, comment bubbles, legend, chart cards |

`stem` exists so overlay geometry reads as one family. Tooltips and comment
bubbles sit at different z-depths and different scales; without a shared radius
they read as unrelated objects.

---

## Elevation

`--shadow-panel` is a single token, not a scale:

```css
--shadow-panel: 0 1px 2px 0 hsl(222 25% 11% / 0.06),
  0 12px 28px -12px hsl(222 25% 11% / 0.2);
```

A 1px hairline-plus-sheen and a soft ambient drop, tinted with the ink hue rather
than pure black. On a light canvas the drop alone reads as lift; the 1px top
line is what stops a floating layer from looking like it has a raw pixel edge
against the page.

---

## Alpha on tokens

Colours are written as `hsl(var(--token))` with **no alpha placeholder**. This is
deliberate and verified: Tailwind v3 still emits the alpha modifier, so
`border-line/70` compiles to `hsl(var(--line) / .7)`. The graph's floating
layers are **solid** `bg-surface` + hairline + `shadow-panel` (see Graph view
conventions); the alpha modifiers are used where a secondary edge or fill must
recede -- `border-line/70` on side panels, `bg-raised/40` inside the review
banner, `border-primary/60` or `/50` on pins.

The trade-off: with a real placeholder (`hsl(var(--token) / <alpha-value>)`) the
`/70` modifier would be ignored. Do not "fix" the tokens to the shadcn form
without checking the alpha utilities still compile.

---

## Typography

| Role | Stack | Size |
|---|---|---|
| UI / body | `Geist Sans` (self-hosted via fontsource) | 14px base |
| Numeric | same, plus `.tabular` | see below |
| Machine output | `Geist Mono Variable` (fontsource) | 12-13px |

Mono is reserved for things the machine printed, not things a human wrote: file
paths, branch names, hashes, scores. Both fonts are self-hosted fontsource
packages (latin subsets, `@fontsource/geist-sans` + `@fontsource-variable/
geist-mono`), so there is no third-party font request at runtime; the system
stack stays in the `fontFamily` fallback so a blocked font still renders an
interface rather than a flash of unreadable default.

### `.tabular`

`font-variant-numeric: tabular-nums`, defined once as a global utility.

Used wherever numbers are compared down a column: health scores, LOC, churn,
timestamps in the history chart. Proportional digits make two columns of numbers
that should line up visibly not line up, and the eye reads that as noise.

---

## Components

Ten primitives in `src/components/ui/`, all shadcn-derived on Radix:

`badge` `button` `card` `dialog` `dropdown-menu` `input` `label` `separator`
`skeleton` `sonner`

Plus two error components in `src/components/errors/`: `ErrorState` and its
siblings for empty and loading states.

### Rules

- One `cva` variant block per primitive, at the top of the file.
- Focus is `focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background`.
  Every interactive element gets it. It is not optional and it is not `outline`.
- Every element that can be empty has a skeleton and an error state. `skeleton`
  exists for that; do not render a spinner.
- `sonner` is the only toast mechanism. Do not add a second.

---

## Layout

| Breakpoint | Container | Columns |
|---|---|---|
| `sm` | full | 1 |
| `md` | full | 2 |
| `lg` | `max-w-6xl` | 3 |
| `xl` | `max-w-6xl` | 3 |

Container is `center: true` with `2rem` padding and a `2xl` screen of `1400px`.
The landing page uses `max-w-6xl` directly rather than the `container` utility,
because it needs an exact measure and the graph view needs full bleed.

---

## Graph view conventions

The graph is the product, so it has its own rules.

- **Node colour = health, not size.** Radius is `loc`-weighted, colour is the
  health score. Two encodings, two channels, neither doing the other's job.
- **Radius floor and ceiling.** A 12-line file and a 4000-line file must both be
  visible and distinguishable. Scale, do not linear-map.
- **Coordinates are normalised 0..1.** Comment pins store `x`/`y` as fractions of
  the canvas, so a pin survives a viewport resize and a zoom level change. This
  is why the gateway validates cursor coordinates for finiteness.
- **Overlays are solid `bg-surface` + hairline + `rounded-stem` + `shadow-panel`.**
  One recipe, so every floating layer in the graph matches. No `backdrop-blur`:
  blurred glass reads as a launcher gadget, not an instrument. The only blur in
  the product is the dialog scrim (`bg-black/70`), which sits over content
  on purpose.
- **The graph never throws.** At mount, tick-lookup maps are keyed off
  `data-node-id` / `data-link-id`, never off d3-bound data (React-owned SVG has
  no `__data__`); `ForceDirectedGraph.test.tsx` locks this in.
- **`comment:new` events arrive both wrapped and bare** (`{"comment": {...}}` and
  `{...}`). The client normalises. Do not change one without the other.

---

## Brand assets

Generated, not hand-drawn, by `scripts/make_brand_assets.py` (Pillow only, no
network, no ImageMagick, no vendored fonts):

| File | Size | Purpose |
|---|---|---|
| `og-image.png` | 1200x630 | Link previews |
| `icon-192.png`, `icon-512.png` | as named | PWA manifest |
| `icon-maskable-512.png` | 512x512 | Android, art inside the inner 80% safe zone |
| `apple-touch-icon.png` | 180x180 | iOS, opaque because iOS ignores transparency |
| `favicon.svg` | 32x32 | The mark: white V on a blue plate, geometry shared with the PNG icons |

The PNG icons and `favicon.svg` are the **same drawing**: a white V (two graph
edges meeting at a vertex, a node at each end) on the brand-blue plate, rendered
by `draw_mark` in the script so an SVG and a PNG can never disagree about the
logo. The OG card runs the **same force-directed simulation the graph view
uses**, so the preview picture is an honest sample of the product's output
rather than decoration. `og:image` pointing at a file that does not exist is
worse than omitting the tag, and a stock placeholder would have been a lie about
what the product does.

```bash
backend/.venv/Scripts/python.exe scripts/make_brand_assets.py
```

---

## Adding a token

1. Add it to `:root` in `src/index.css`, as bare HSL channels with no alpha
   placeholder.
2. Expose it in `tailwind.config.ts`. Check the name does not collide with a
   `boxShadow` key.
3. Document it in the table above, with the reason it exists.
4. If it is a brand colour, update `scripts/make_brand_assets.py` and regenerate.

Three steps is the whole process. If a change takes more than that, the token
probably does not need to exist.
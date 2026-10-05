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

// wrong -- this is why the favicon drifted from the app (see Phase 4)
<div className="bg-[#161a26] text-[#a8b0be]" />
```

A palette change should be a one-file edit. That property was violated once
already: the accent was retuned from shadcn violet to cyan in the token pass,
and `favicon.svg` kept the old `#8b5cf6 → #4f46e5` gradient, so the tab icon
advertised a different brand than the running app. `scripts/make_brand_assets.py`
now owns the raster brand assets and reads the same token values, so it cannot
happen again.

---

## Dark only

There is no light theme. This was verified, not assumed: **zero** `dark:`
utilities exist in the codebase. Tokens are declared once in `:root` and
`darkMode: ['class']` is retained so a future light theme has a hook, but nothing
uses it.

Do not add `dark:` variants. If you need contrast that the ramp does not give
you, the answer is a new token, not a `dark:` prefix.

---

## Surface ramp

Background to foreground, four steps plus a hairline. Each step exists because
something needed it; do not add steps for one-off components.

| Token | Value | Use |
|---|---|---|
| `--background` | `224 32% 6%` | Page backdrop, graph canvas |
| `--surface` | `224 26% 10%` | Panels, cards, side panels, comment bubbles |
| `--raised` | `224 24% 14%` | Hover/active, nested cards, tooltips |
| `--panel` | `224 22% 18%` | Popovers, dropdowns, floating overlays |
| `--line` | `220 16% 22%` | Hairline borders and separators |

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

| Token | Value | Use |
|---|---|---|
| `--foreground` | `210 40% 96%` | Headings, highest-emphasis text |
| `--ink` | `210 38% 93%` | Body text on a surface |
| `--ink-dim` | `213 18% 72%` | Labels, secondary copy |
| `--ink-faint` | `216 15% 56%` | Placeholders, axis ticks |

Four levels. If a piece of copy does not fit, it usually wants to be deleted
rather than promoted to a new weight.

---

## Accent

| Token | Value |
|---|---|
| `--primary` | `190 72% 52%` |
| `--primary-foreground` | `200 30% 7%` |
| `--primary-soft` | `190 46% 20%` |

Cyan, retuned from the shadcn default violet (`258 90% 70%`) in the token pass.
The reason was not taste: violet sat too close to the status palette below, so
focus rings and selection states competed with health signals that carry actual
product meaning. Moving the accent to a hue no status colour occupies fixed it.

**The accent never carries status.** If something is bad, it is `signal-bad`, not
"a redder primary".

---

## Status

Three canonical colours. These are the only three that mean "good / at risk /
critical".

| Token | Value | Meaning | Threshold |
|---|---|---|---|
| `--signal-good` | `152 58% 48%` | healthy | `health_score >= 70` |
| `--signal-warn` | `38 90% 56%` | at risk | `45 <= health_score < 70` |
| `--signal-bad` | `354 72% 62%` | critical | `health_score < 45` |

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
`210 60% 60%`, a desaturated blue that exists only in the complexity family.

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
--shadow-panel: 0 1px 0 0 hsl(var(--line) / 0.55), ...
```

A 1px top hairline plus a soft drop. The hairline is the important part: on a
near-black canvas, a shadow alone is almost invisible, so the top edge needs its
own luminance step to separate a floating layer from the surface below it.

---

## Alpha on tokens

Colours are written as `hsl(var(--token))` with **no alpha placeholder**. This is
deliberate and verified: Tailwind v3 still emits the alpha modifier, so
`border-line/70` compiles to `hsl(var(--line) / .7)`. That means the translucent
overlay panels in `features/graph` work without a second token per opacity step.

The trade-off: with a real placeholder (`hsl(var(--token) / <alpha-value>)`) the
`/70` modifier would be ignored. Do not "fix" the tokens to the shadcn form
without checking the overlay panels still render.

---

## Typography

| Role | Stack | Size |
|---|---|---|
| UI / body | `ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, ...` | 14px base |
| Numeric | same, plus `.tabular` | see below |

There is no webfont. On a dark UI a downloaded font is a 100ms+ blocking cost for
a difference almost nobody sees, and it has to be subset and self-hosted to be
worth considering at all.

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
- **Overlays are `bg-*/60` + `rounded-stem` + `shadow-panel`.** One recipe, so
  every floating layer in the graph matches.
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
| `favicon.svg` | 32x32 | Hand-written, but with the token values inline and a comment saying they must match |

The OG card and the icons run the **same force-directed simulation the graph view
uses**, so the picture is an honest sample of the product's output rather than
decoration. `og:image` pointing at a file that does not exist is worse than
omitting the tag, and a stock placeholder would have been a lie about what the
product does.

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
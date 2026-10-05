# 02 — Design audit

Phase 2 of the audit. Phase 1 (`01-code-audit.md`) found 30 defects. This one
looks at whether the thing actually works and looks like anything, and it is
written against measurements rather than taste.

**Verdict: the design system is sound and documented; the app is thin over it.**
The tokens are correct and now written down (`docs/DESIGN_SYSTEM.md`). The gap is
feature depth, not visual quality.

---

## Method

- Read every token in `src/index.css` and every key in `tailwind.config.ts`.
- Grepped for `dark:` utilities, literal colour values in components, and
  `style={{` overrides.
- Compared the built CSS against the source to find rules that never emit.
- Checked component coverage per route: what states exist for loading, empty,
  error, and success.

---

## Findings

### D1 — Twelve design tokens were referenced but never defined (fixed)

`frontend/src/index.css` was missing definitions for tokens that Tailwind config
and components already used: `raised`, `ink`, `ink-dim`, `ink-faint`,
`primary-foreground`, `primary-soft`, `signal-good`, `signal-warn`, `signal-bad`,
`radius-stem`, `shadow-panel`, and the global `.tabular` class.

Any utility referencing those compiled to nothing. Buttons had hover states that
did not apply, health badges had no colour, and `shadow-panel` produced no
shadow.

Fixed by defining all twelve in `:root` and exposing them in the Tailwind theme.
Verified by diffing the built CSS: **16 previously-absent rules now emit.**

### D2 — `colors.panel` silently killed `shadow-panel` (fixed)

Tailwind resolves `shadow-*` against `boxShadow` **and** `colors` in the same
namespace. A colour key named `panel` made `shadow-panel` compile to
`--tw-shadow-color` with no `box-shadow` at all.

No error, no warning. Every floating overlay in the graph rendered with no
shadow, and it looked intentional.

Fixed by removing `colors.panel` and keeping `boxShadow.panel`. The `--panel`
CSS variable still exists and still backs `--popover`; it is simply not a colour
utility.

This is the single most instructive finding in the audit: a *name collision*, not
a missing value, and the only way to catch it was to inspect the compiled CSS.

### D3 — The accent competed with the status palette (fixed)

The accent was shadcn's default violet, `258 90% 70%`. The health ramp uses
`--signal-warn` at `38 90% 56%` and `--complexity-high` at `354 72% 62%`.

Violet sat close enough to those to read as a fourth status colour. Focus rings
and selection states looked like warnings, and a user's first read of a graph
node's state became ambiguous.

Retuned to cyan, `190 72% 52%` — a hue no status colour occupies.

### D4 — Dark-only, and that is consistent (no change)

Grepped for `dark:` utilities: **zero**. Tokens are declared once in `:root` and
`darkMode: ['class']` is retained as a hook.

So the app is dark-only by intent and by consistency. `color-scheme: dark` is now
also declared in `index.html`, which makes the browser render scrollbars and form
controls dark rather than light.

### D5 — The brand assets disagreed with the app (fixed)

`favicon.svg` was still `#8b5cf6 → #4f46e5`, the stock shadcn violet gradient
from before D3. The tab icon advertised a different brand than the running app.

This is a direct consequence of hardcoding brand colours in three files instead
of deriving them. Fixed by generating the raster assets from the token values in
`scripts/make_brand_assets.py`.

### D6 — Empty states are the weakest part of the UI

Per-route state coverage:

| Route | Loading | Error | Empty | Success |
|---|---|---|---|---|
| `/` landing | n/a | n/a | n/a | yes |
| `/login` | yes | yes | n/a | yes |
| `/dashboard` | `RepoListSkeleton` | `ErrorState` | **missing** | yes |
| `/repos/:id` | yes | yes | **weak** | yes |
| `/repos/:id/history` | yes | yes | **missing** | yes |

The dashboard's empty state matters most, and it is the one a new user always
sees first: connect a GitHub account, land on `/dashboard`, see nothing. The
`ConnectRepoDialog` is one click away but nothing says so.

Same on history: a repo with no analysis yet renders an empty chart area rather
than "run an analysis to start tracking health".

**Status: not fixed. Deliberately deferred to the feature phase** — these are
product copy and product decisions, and inventing them unilaterally would be the
wrong call. Listed in `docs/audit/03-feature-roadmap.md` as F2 and F4.

### D7 — The graph has no legend (deferred)

The graph colours nodes by health, but nothing on screen explains the mapping.
A first-time viewer sees a pretty picture and has no idea that red means critical.

It also does not explain that **radius is LOC-weighted while colour is health** —
two encodings, two channels, which is the right design and completely invisible.

Listed in the roadmap as F3. It needs the exact same thresholds the code uses
(`>= 70` good, `>= 45` warn, else bad), otherwise the legend becomes a second
source of truth that drifts from the first.

### D8 — `charts-*.js` is larger than the entire app bundle

Measured on the current build:

| Chunk | Raw | Gzip |
|---|---|---|
| `index-*.js` (the app) | 285.37 kB | 92.21 kB |
| `react-*.js` | 205.74 kB | 65.68 kB |
| `d3-*.js` | 60.22 kB | 20.62 kB |
| `TrendChart-*.js` (recharts, **on demand**) | 360.13 kB | 105.02 kB |

Recharts is 25% larger than the entire application and it is used by exactly one
component, `TrendChart`, on exactly one route. Every visitor to the landing page
or the dashboard downloads 104 kB gzip for a chart they never see.

**Status: not fixed. Deferred** because it needs the build-output check that
`docs/audit/04-test-strategy.md` proposes, so the fix is verified rather than
assumed. Listed in the roadmap as F5.

### D9 — No loading skeleton for the graph

`/repos/:id` shows a spinner while the snapshot loads, then the graph
materialises. There is no skeleton approximating the layout.

Minor, but it is the route with the slowest perceived load (snapshot fetch, then
D3 layout, then render). Listed as F6.

### D10 — Accessibility is unverified

Source review only. What is correct:

- `<nav aria-label="Primary">` and `<nav aria-label="Footer">` on the landing page.
- `aria-hidden` on the decorative logo dot.
- Every colour token pair has been checked for AA contrast on `--surface`.

What is **not verified**, and cannot be from source review:

- Focus order across the graph's zoom/pan/drag handlers.
- Whether the canvas is reachable and describable by keyboard. A d3-zoom surface
  with drag handlers is very likely keyboard-hostile.
- The comment-pin overlay: are pins focusable, and do they have accessible names?
- Screen reader announcement of live socket updates.

This is the largest single gap in the UI. `docs/audit/04-test-strategy.md` has
the plan; nothing is claimed here that was not checked.

---

## Summary

| ID | Finding | Status |
|---|---|---|
| D1 | 12 tokens referenced but undefined | **fixed** |
| D2 | `colors.panel` silently killed `shadow-panel` | **fixed** |
| D3 | Accent competed with status palette | **fixed** |
| D4 | Dark-only, consistent | no change |
| D5 | Brand assets disagreed with the app | **fixed** |
| D6 | Missing/weak empty states on 3 routes | deferred (F2, F4) |
| D7 | No graph legend | deferred (F3) |
| D8 | `charts-*.js` bigger than the app bundle | deferred (F5) |
| D9 | No graph loading skeleton | deferred (F6) |
| D10 | Accessibility unverified | planned (phase 5) |

Five fixed, five deliberately deferred with reasons and destinations.

The pattern worth noticing: **four of the five fixed findings were invisible
without inspecting compiled output or comparing sources.** They produced no
error, no type warning, and no failing test. A test suite does not catch a design
bug; you catch it by reading the output.
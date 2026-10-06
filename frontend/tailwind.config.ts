import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * Vorza design tokens — the Tailwind theme maps onto the CSS variables defined
 * in `src/index.css`. Components must reference theme classes (`bg-surface`,
 * `text-ink-dim`, `rounded-stem`, `shadow-panel`), never literal colour values,
 * so a palette change stays a one-file edit.
 *
 * Surface and ink ramps (see index.css for the full contract):
 *
 *   background  page backdrop, graph canvas
 *   surface     panels, cards, side panels, comment bubbles
 *   raised      hover/active, nested cards, tooltips
 *   panel       popovers, dropdowns, floating overlays
 *   line        hairline borders and separators
 *
 *   ink         body text on a surface
 *   ink-dim     labels, secondary copy
 *   ink-faint   placeholders, axis ticks
 *
 * Status colours are the canonical three and drive the health and complexity
 * ramps too, which are aliased onto them in index.css:
 *
 *   signal-good  healthy    health >= 70
 *   signal-warn  at risk    health >= 45
 *   signal-bad   critical   health <  45
 *
 * The `health.*` and `complexity.*` families are retained because they carry
 * product meaning (a node's health_score vs its complexity_score) that is
 * clearer at the call site than a bare signal colour.
 *
 * NOTE: colours are written as `hsl(var(--token))` with no alpha placeholder.
 * That is deliberate and verified -- Tailwind v3 still emits the alpha modifier
 * (`border-line/70` -> `hsl(var(--line) / .7)`), so the overlay panels in
 * features/graph can stay translucent without a second token per step.
 */
export default {
  // The theme flip is driven by `prefers-color-scheme` in index.css, not a
  // `.dark` class -- there is no toggle. Kept as media so the config matches
  // the mechanism; no `dark:` utility is ever used in src/.
  darkMode: ['media'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      container: {
        center: true,
        padding: '2rem',
        screens: {
          '2xl': '1400px',
        },
      },
      /*
       * Geist Sans for interface text, Geist Mono for anything the machine
       * produced (paths, branches, hashes, scores). Both are self-hosted via
       * fontsource -- no third-party font request at runtime. The system stack
       * stays as the fallback so a blocked font still renders an interface
       * rather than a flash of Times.
       */
      fontFamily: {
        sans: [
          'Geist Sans',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'Geist Mono Variable',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        // Surface ramp
        surface: 'hsl(var(--surface))',
        raised: 'hsl(var(--raised))',
        line: 'hsl(var(--line))',
        //
        // `--panel` is deliberately NOT exposed here. Tailwind resolves
        // `shadow-*` against `boxShadow` and `colors` in the same namespace, so
        // a colour key named `panel` makes `shadow-panel` compile to
        // `--tw-shadow-color` with no `box-shadow` at all -- the overlay
        // shadow silently disappears. The `--panel` CSS var still exists and
        // still backs `--popover`; it is just not a Tailwind colour utility.
        // See boxShadow.panel below.

        // Ink ramp
        ink: {
          DEFAULT: 'hsl(var(--ink))',
          dim: 'hsl(var(--ink-dim))',
          faint: 'hsl(var(--ink-faint))',
        },

        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          soft: 'hsl(var(--primary-soft))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // Status. health.* and complexity.* alias these values.
        signal: {
          good: 'hsl(var(--signal-good))',
          warn: 'hsl(var(--signal-warn))',
          bad: 'hsl(var(--signal-bad))',
        },
        health: {
          good: 'hsl(var(--health-good))',
          medium: 'hsl(var(--health-medium))',
          bad: 'hsl(var(--health-bad))',
        },
        complexity: {
          low: 'hsl(var(--complexity-low))',
          medium: 'hsl(var(--complexity-medium))',
          high: 'hsl(var(--complexity-high))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // Signature radius for floating layers (tooltips, comment bubbles,
        // legend, chart cards) so overlay geometry reads as one family.
        stem: 'var(--radius-stem)',
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        // Loading affordance only: the graph's "mapping files" illustration
        // and the history chart's loading dots. Not used decoratively, and
        // collapsed by the prefers-reduced-motion rule in index.css.
        'soft-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'soft-blink': 'soft-blink 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
} satisfies Config;

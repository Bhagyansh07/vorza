import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * CodeAtlas design tokens — single source of truth for the frontend palette.
 * Agent 4's visualization (src/features/graph) MUST reuse these colors so the
 * graph stays on-brand. Exposed extras beyond vanilla shadcn/ui:
 *
 *  - colors.health.*   — the repo/file health ramp (good → medium → bad).
 *                        FileNode.health_score is 0–100; map >= 80 → good,
 *                        >= 50 → medium, else bad.
 *  - colors.complexity.* — FileNode.complexity_score ramp (low → high).
 *  - fontFamily.sans  — the app font stack.
 *
 * Every theme color below is driven by a CSS variable defined in
 * src/index.css under :root / .dark — tweak variables, not classes.
 */
export default {
  darkMode: ['class'],
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
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
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
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
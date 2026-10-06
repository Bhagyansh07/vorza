import { HEALTH_GOOD_MIN, HEALTH_WARN_MIN } from '@/lib/health-thresholds';

export const HEALTH_MAX = 100;

/**
 * Health thresholds, in one place.
 *
 * Now defined once in `src/lib/health-thresholds.ts` and re-exported here,
 * because this module is where the graph, the legend and their tests have
 * always read them from. Before that they were retyped as bare literals in
 * three places -- `healthTone`, `healthLabel`, and
 * `snapshotHealthBreakdown` -- and the dashboard's badges carried a second,
 * disagreeing copy at 80/50. A legend that disagrees with the renderer is
 * worse than no legend, because it is the authoritative-looking thing and the
 * wrong one. F3 in `docs/audit/03-feature-roadmap.md`.
 *
 * The frontend assertions live in `lib/health-thresholds.test.ts`; the
 * backend assertion is `backend/tests/services/test_analysis_scoring.py`.
 */
export { HEALTH_GOOD_MIN, HEALTH_WARN_MIN };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Theme-aware lightness for graph fills, read from `--health-fill-lightness`
 * in index.css (50% light / 58% dark). The graph canvas and legend card both
 * sit on the theme's darkest surface, so a fixed 50% -- tuned for the
 * near-white canvas -- reads flat on the dark one. Evaluated at call time
 * (default argument) so no theme state has to thread through the renderer.
 */
export function healthFillLightness(): number {
  if (typeof document === "undefined") return 50;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--health-fill-lightness")
    .trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 50;
}

export function healthColor(health: number, lightness = 50): string {
  const h = clamp(health, 0, HEALTH_MAX);
  let hue: number;
  if (h <= 50) {
    hue = lerp(4, 38, h / 50);
  } else {
    hue = lerp(38, 152, (h - 50) / 50);
  }
  // Lightness defaults to the light-canvas value and is overridden per-theme
  // via healthFillLightness(); node fill is the only thing carrying the health
  // value in the legend's gradient, so it must hold contrast on both canvases.
  return `hsl(${hue} 62% ${lightness}%)`;
}

export function healthFill(
  health: number,
  lightness: number = healthFillLightness(),
): string {
  return healthColor(health, lightness);
}

export type HealthTone = "good" | "warn" | "bad";

export function healthTone(health: number): HealthTone {
  if (health >= HEALTH_GOOD_MIN) return "good";
  if (health >= HEALTH_WARN_MIN) return "warn";
  return "bad";
}

export function healthLabel(health: number): string {
  if (health >= HEALTH_GOOD_MIN) return "Healthy";
  if (health >= HEALTH_WARN_MIN) return "At risk";
  return "Critical";
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export interface RadiusSpec {
  min: number;
  max: number;
}

export const DEFAULT_RADIUS: RadiusSpec = { min: 3, max: 21 };

export function nodeRadius(
  complexity: number,
  loc: number,
  spec: RadiusSpec = DEFAULT_RADIUS,
): number {
  const value = Math.max(complexity, Math.sqrt(loc) * 0.55);
  const span = spec.max - spec.min;
  const root = Math.sqrt(value);
  const maxRoot = Math.sqrt(60);
  const scaled = clamp(root / maxRoot, 0, 1);
  return spec.min + span * scaled;
}

export interface LegendStop {
  health: number;
  color: string;
  label: string;
}

/**
 * Gradient stops for the legend, labelled at the real thresholds.
 *
 * The previous stops were hand-placed at 0/25/50/75/100, which put the "At
 * risk" label at 50 while the actual boundary is 45, and "Healthy" at 100 while
 * the boundary is 70. Reading the legend, a node scoring 60 looked like the
 * middle of the scale when it was actually just above the at-risk threshold,
 * and one scoring 80 looked mid-green rather than healthy.
 *
 * Labels now land on the boundaries themselves -- 0, 45, 70, 100 -- so the
 * legend states where the colour actually changes rather than implying it
 * changes evenly.
 */
export function legendStops(): LegendStop[] {
  const lightness = healthFillLightness();
  return [
    { health: 0, color: healthColor(0, lightness), label: healthLabel(0) },
    {
      health: HEALTH_WARN_MIN,
      color: healthColor(HEALTH_WARN_MIN, lightness),
      label: healthLabel(HEALTH_WARN_MIN),
    },
    {
      health: HEALTH_GOOD_MIN,
      color: healthColor(HEALTH_GOOD_MIN, lightness),
      label: healthLabel(HEALTH_GOOD_MIN),
    },
    {
      health: HEALTH_MAX,
      color: healthColor(HEALTH_MAX, lightness),
      label: healthLabel(HEALTH_MAX),
    },
  ];
}

export function radiusSamplePoints(): Array<{ complexity: number; radius: number }> {
  return [3, 12, 35, 90].map((c) => ({
    complexity: c,
    radius: nodeRadius(c, c * 8),
  }));
}
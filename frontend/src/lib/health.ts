import type { ComplexityTone, HealthTone } from '@/types';
import { HEALTH_GOOD_MIN, HEALTH_WARN_MIN } from '@/lib/health-thresholds';
import { cn } from '@/lib/utils';

/**
 * Health/complexity → design-token helpers.
 *
 * The thresholds are the shared ones (`src/lib/health-thresholds.ts`), which
 * are the same numbers the graph legend and `healthLabel` bucket on, so a
 * score cannot read one tone here and another one on the map.
 */

export function healthTone(score: number): HealthTone {
  if (score >= HEALTH_GOOD_MIN) return 'good';
  if (score >= HEALTH_WARN_MIN) return 'medium';
  return 'bad';
}

export function complexityTone(score: number): ComplexityTone {
  if (score >= 35) return 'high';
  if (score >= 15) return 'medium';
  return 'low';
}

/** Tailwind classes for a solid health badge, keyed by tone. */
export const healthBadgeClass: Record<HealthTone, string> = {
  good: 'bg-health-good/15 text-health-good border-health-good/40',
  medium: 'bg-health-medium/15 text-health-medium border-health-medium/40',
  bad: 'bg-health-bad/15 text-health-bad border-health-bad/40',
};

/** Fill color (hex-ish via theme var) for a given tone, for SVG/d3 use. */
export const healthFill: Record<HealthTone, string> = {
  good: 'hsl(var(--health-good))',
  medium: 'hsl(var(--health-medium))',
  bad: 'hsl(var(--health-bad))',
};

export function healthBadgeClasses(score: number): string {
  return cn(healthBadgeClass[healthTone(score)]);
}
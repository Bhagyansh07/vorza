import type { ComplexityTone, HealthTone } from '@/types';
import { cn } from '@/lib/utils';

/**
 * Health/complexity → design-token helpers. Agent 4's graph should reuse these
 * so node colors match the rest of the app (see tailwind.config.ts health.*).
 */

export function healthTone(score: number): HealthTone {
  if (score >= 80) return 'good';
  if (score >= 50) return 'medium';
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
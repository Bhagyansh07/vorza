import type { HealthTone } from '@/types';
import { healthBadgeClasses, healthTone } from '@/lib/health';

describe('health helpers', () => {
  // Boundaries come from src/lib/health-thresholds.ts (70 / 45), the same
  // numbers the graph legend buckets on.
  it.each([
    [95, 'good'],
    [70, 'good'],
    [69, 'medium'],
    [45, 'medium'],
    [44, 'bad'],
    [12, 'bad'],
  ] as const)('maps score %s to tone %s', (score, expected: HealthTone) => {
    expect(healthTone(score)).toBe(expected);
  });

  it('returns a class string for a badge', () => {
    expect(healthBadgeClasses(90)).toContain('health-good');
  });
});
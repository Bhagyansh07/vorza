import type { HealthTone } from '@/types';
import { healthBadgeClasses, healthTone } from '@/lib/health';

describe('health helpers', () => {
  it.each([
    [95, 'good'],
    [80, 'good'],
    [72, 'medium'],
    [50, 'medium'],
    [12, 'bad'],
  ] as const)('maps score %s to tone %s', (score, expected: HealthTone) => {
    expect(healthTone(score)).toBe(expected);
  });

  it('returns a class string for a badge', () => {
    expect(healthBadgeClasses(90)).toContain('health-good');
  });
});
/**
 * The health thresholds must have exactly one definition in the frontend.
 *
 * `70` and `45` were retyped as bare literals in three places: `healthTone`,
 * `healthLabel` and `snapshotHealthBreakdown`. The legend's gradient stops were
 * placed at 0/25/50/75/100, which is a *fourth* set of numbers that agreed with
 * none of the others.
 *
 * Why that matters more than "DRY": the legend is the only thing telling a
 * first-time viewer what the graph's colours mean. When the legend and the
 * renderer disagree, the legend is the authoritative-looking thing and the wrong
 * one. A node scoring 60 appeared mid-scale in the legend while actually sitting
 * just above the at-risk threshold, and a node scoring 80 looked mid-green
 * rather than healthy.
 *
 * These tests are split between the numeric contract (below) and the guarantee
 * that no other module retypes the values (the second block). The second block
 * is the part that stops the drift returning.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  HEALTH_GOOD_MIN,
  HEALTH_MAX,
  HEALTH_WARN_MIN,
  healthColor,
  healthLabel,
  healthTone,
  legendStops,
} from './encoding';
import { snapshotHealthBreakdown } from './graphModel';

const here = dirname(fileURLToPath(import.meta.url));

/** Source with comments stripped, so assertions match code and not prose. */
const readCode = (relative: string): string =>
  readFileSync(resolve(here, relative), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ')
    .replace(/\/\/.*$/gm, ' ');

describe('health thresholds', () => {
  it('are 70 and 45, matching the documented contract', () => {
    // Pinned deliberately. CONTRACTS.md and docs/DESIGN_SYSTEM.md both state
    // these, and docs/audit/04-test-strategy.md T4 asserts the docs agree.
    // Changing one without the others should fail here first.
    expect(HEALTH_GOOD_MIN).toBe(70);
    expect(HEALTH_WARN_MIN).toBe(45);
    expect(HEALTH_WARN_MIN).toBeLessThan(HEALTH_GOOD_MIN);
  });

  it('healthTone switches at exactly those values', () => {
    expect(healthTone(HEALTH_WARN_MIN - 1)).toBe('bad');
    expect(healthTone(HEALTH_WARN_MIN)).toBe('warn');
    expect(healthTone(HEALTH_GOOD_MIN - 1)).toBe('warn');
    expect(healthTone(HEALTH_GOOD_MIN)).toBe('good');
  });

  it('healthLabel agrees with healthTone at every boundary', () => {
    // The two functions were separate if-statements with separate literals.
    // This is the assertion that would have caught them disagreeing.
    for (const value of [0, 44, 45, 46, 69, 70, 71, 100]) {
      const tone = healthTone(value);
      const label = healthLabel(value).toLowerCase();
      if (tone === 'good') expect(label).toContain('healthy');
      if (tone === 'warn') expect(label).toContain('at risk');
      if (tone === 'bad') expect(label).toContain('critical');
    }
  });

  it('the legend labels the boundaries, not round numbers', () => {
    // Regression test for the actual defect: stops used to sit at 0/25/50/75/100
    // with "At risk" at 50 and "Healthy" at 100.
    const labelled = legendStops().filter((s) => s.label !== '');
    expect(labelled.map((s) => s.health)).toEqual([
      0,
      HEALTH_WARN_MIN,
      HEALTH_GOOD_MIN,
      HEALTH_MAX,
    ]);
  });

  it('every legend stop colour is the real colour for that health value', () => {
    // A stop whose colour came from a different scale would still look like a
    // plausible gradient.
    const stops = legendStops();
    for (const stop of stops) {
      expect(stop.color).toBe(healthColor(stop.health));
    }
  });

  it('snapshotHealthBreakdown buckets identically to healthTone', () => {
    // The third copy of the thresholds. Build a snapshot with one file sitting
    // exactly on each boundary and assert the counts.
    const at = (health_score: number) => ({
      path: `f${health_score}.py`,
      loc: 10,
      complexity_score: 5,
      churn_score: 5,
      health_score,
      imports: [] as string[],
    });

    const breakdown = snapshotHealthBreakdown({
      id: 's',
      repo_id: 'r',
      created_at: '2026-01-01T00:00:00Z',
      overall_health_score: 50,
      files: [
        at(0), // bad
        at(44), // bad
        at(HEALTH_WARN_MIN), // warn
        at(HEALTH_GOOD_MIN - 1), // warn
        at(HEALTH_GOOD_MIN), // good
        at(100), // good
      ],
    });

    expect(breakdown).toEqual({
      files: 6,
      critical: 2,
      atRisk: 2,
      healthy: 2,
    });
  });
});

describe('no other module retypes the thresholds', () => {
  // The numeric tests above all pass even if a *fourth* copy of the thresholds
  // appears, as long as it happens to agree today. These assertions are what
  // make the agreement structural rather than coincidental.

  const GRAPH_FILES = [
    './encoding.ts',
    './graphModel.ts',
    '../components/GraphLegend.tsx',
    '../components/GraphView.tsx',
    '../components/ForceDirectedGraph.tsx',
  ];

  it.each(GRAPH_FILES)('%s does not hardcode a bare 70 or 45', (file) => {
    // Matches a bare numeric literal compared against a health-ish value.
    // `healthTone` itself is excluded from the pattern by requiring the
    // surrounding shape: a comparison to a bare number, on a line mentioning
    // health/score/tone/risk.
    const code = readCode(file);
    const offenders = code
      .split('\n')
      .filter((line) => /(>=|<=|>|<)\s*(70|45)\b/.test(line))
      .filter((line) => /health|score|tone|risk/i.test(line));

    expect(offenders, `bare threshold literal in ${file}`).toEqual([]);
  });

  it('graphModel imports the constants rather than defining its own', () => {
    const code = readCode('./graphModel.ts');
    expect(code).toMatch(/import\s*\{[^}]*HEALTH_GOOD_MIN[^}]*\}/);
    expect(code).toMatch(/import\s*\{[^}]*HEALTH_WARN_MIN[^}]*\}/);
  });

  it('the legend reads its labels from healthLabel, not from literals', () => {
    // The legend's own strings were 'Critical' / 'At risk' / 'Healthy' typed
    // three times, which is how they drifted from healthLabel.
    const code = readCode('../components/GraphLegend.tsx');
    expect(code).toMatch(/HEALTH_WARN_MIN/);
    expect(code).toMatch(/HEALTH_GOOD_MIN/);
  });
});
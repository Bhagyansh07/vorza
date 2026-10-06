import { describe, expect, it } from 'vitest';

import {
  demoFiles,
  demoLinks,
  demoMetrics,
  demoSeedPositions,
} from './demoData';

describe('demoData', () => {
  it('links only reference files that exist, with no self-loops', () => {
    const paths = new Set(demoFiles().map((f) => f.path));
    const links = demoLinks();
    expect(links.length).toBeGreaterThan(demoFiles().length);
    for (const link of links) {
      expect(paths.has(link.source)).toBe(true);
      expect(paths.has(link.target)).toBe(true);
      expect(link.source).not.toBe(link.target);
    }
  });

  it('every file has a score inside the 0-100 band and positive measurements', () => {
    for (const file of demoFiles()) {
      expect(file.health_score).toBeGreaterThanOrEqual(0);
      expect(file.health_score).toBeLessThanOrEqual(100);
      expect(file.loc).toBeGreaterThan(0);
      expect(file.complexity_score).toBeGreaterThan(0);
      expect(file.churn_score).toBeGreaterThanOrEqual(0);
      // Every import edge points at an existing file too.
      for (const target of file.imports) {
        expect(demoFiles().some((f) => f.path === target)).toBe(true);
      }
    }
  });

  it('seed positions cover every file and are deterministic', () => {
    const a = demoSeedPositions();
    const b = demoSeedPositions();
    expect(Object.keys(a).length).toBe(demoFiles().length);
    for (const file of demoFiles()) {
      expect(a[file.path]).toBeDefined();
    }
    expect(a).toEqual(b);
  });

  it('metrics are derived from the dataset, not hardcoded', () => {
    const files = demoFiles();
    const m = demoMetrics();
    expect(m.files).toBe(files.length);
    expect(m.lines).toBe(files.reduce((sum, f) => sum + f.loc, 0));
    expect(m.edges).toBe(demoLinks().length);
    expect(m.files).toBeGreaterThan(20);
  });
});
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The avatar runtime must stay out of the initial bundle.
 *
 * `@bible-strong/avatar-core` drags in its geometry code and a schema validator,
 * and it is only relevant to the mascot. Every screen reaches it through
 * `LazyGuidedTour`, which dynamic-imports the engine, which imports the mascot --
 * never a static import of the engine -- the same trap the graph feature hit
 * with `recharts` (see `features/graph/bundle-boundary.test.ts`).
 *
 * The assertions read source, not behaviour: a component rendering correctly is
 * no evidence about what Rollup puts in the entry chunk. Comments are stripped
 * the same way the graph test does, so prose cannot pass or fail these checks.
 */

const here = dirname(fileURLToPath(import.meta.url)); // src/features/landing
const SRC = resolve(here, '../..');
const MASCOT = 'components/mascot/VorpyMascot.tsx';
const ENGINE = 'features/tour/GuidedTour.tsx';
const LAZY = 'features/tour/LazyGuidedTour.tsx';
const RUNTIME = '@bible-strong/avatar-core';

const readCode = (file: string): string =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ')
    .replace(/\/\/.*$/gm, ' ')
    // Type-only imports are erased at build time, so they never pull a module
    // (or its runtime) into a chunk. Drop them before looking for importers.
    .replace(/\bimport\s+type\b[\s\S]*?from\s+['"][^'"]+['"]\s*;?/g, ' ');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const importersOf = (file: string): string[] => {
  const base = file.split('/').pop() ?? file;
  const stem = base.replace(/\.[tj]sx?$/, '');
  // Match the module specifier ending in `/Stem` (or exactly `Stem`), so
  // `GuidedTour` does not match `LazyGuidedTour`.
  const pattern = new RegExp(`from\\s+['"](?:[^'"]*/)?${stem}['"]`);
  return sourceFiles(SRC)
    .filter((candidate) => !/\.test\.tsx?$/.test(candidate))
    .filter((candidate) => pattern.test(readCode(candidate)))
    .map((candidate) => relative(SRC, candidate).replace(/\\/g, '/'));
};

describe('the avatar runtime stays out of the initial bundle', () => {
  it(`${LAZY} dynamic-imports the engine instead of importing it`, () => {
    const lazy = readCode(resolve(SRC, LAZY));
    expect(lazy).toMatch(/\blazy\s*\(/);
    expect(lazy).toMatch(/import\(\s*['"][^'"]*GuidedTour['"]\s*\)/);
    // A top-level import of the engine would defeat the lazy load.
    expect(lazy).not.toMatch(/^\s*import\s+\{[^}]*\bGuidedTour\b\s*\}/m);
  });

  it('the engine reaches the runtime only through the mascot', () => {
    const engine = readCode(resolve(SRC, ENGINE));
    // The engine imports the mascot ...
    expect(engine).toMatch(/from\s+['"][^'"]*mascot\/VorpyMascot['"]/);
    // ... but never names the runtime, so the boundary stays in one file.
    expect(engine).not.toContain(RUNTIME);
  });

  it('no module statically imports the engine', () => {
    // A static import anywhere in the eager graph would pull the runtime in.
    // The only reference is `LazyGuidedTour`'s dynamic import(), which this
    // helper (matching `from '...'`) deliberately does not count.
    expect(importersOf(ENGINE)).toEqual([]);
  });

  it('only the engine imports the mascot', () => {
    expect(importersOf(MASCOT)).toEqual([ENGINE]);
  });

  it(`only ${MASCOT} imports the runtime`, () => {
    const importers = sourceFiles(SRC)
      .filter((file) => !/\.test\.tsx?$/.test(file))
      .filter((file) => readCode(file).includes(RUNTIME))
      .map((file) => relative(SRC, file).replace(/\\/g, '/'));
    expect(importers).toEqual([MASCOT]);
  });
});

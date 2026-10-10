import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The avatar runtime must stay out of the initial bundle.
 *
 * `@bible-strong/avatar-core` drags in its geometry code and a schema validator,
 * and it is only relevant to the mascot. The landing must therefore reach it
 * through `React.lazy`, never a static import -- the same trap the graph feature
 * hit with `recharts` (see `features/graph/bundle-boundary.test.ts`).
 *
 * The assertions read source, not behaviour: a component rendering correctly is
 * no evidence about what Rollup puts in the entry chunk. Comments are stripped
 * the same way the graph test does, so prose cannot pass or fail these checks.
 */

const here = dirname(fileURLToPath(import.meta.url)); // src/features/landing
const SRC = resolve(here, '../..');
const LANDING = 'routes/Landing.tsx';
const MASCOT = 'features/landing/components/VorpyMascot.tsx';
const RUNTIME = '@bible-strong/avatar-core';

const readCode = (file: string): string =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ')
    .replace(/\/\/.*$/gm, ' ');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('the avatar runtime stays out of the initial bundle', () => {
  it('the landing lazy-imports the mascot instead of importing it', () => {
    const landing = readCode(resolve(here, LANDING));
    expect(landing).toMatch(/\blazy\s*\(/);
    expect(landing).toMatch(/import\(\s*['"][^'"]*VorpyMascot['"]\s*\)/);
    // A top-level `import { VorpyMascot }` would defeat the lazy import.
    expect(landing).not.toMatch(/^\s*import\s+\{[^}]*\bVorpyMascot\b\s*\}/m);
  });

  it(`only ${MASCOT} imports the runtime`, () => {
    const importers = sourceFiles(SRC)
      .filter((file) => !/\.test\.tsx?$/.test(file))
      .filter((file) => readCode(file).includes(RUNTIME))
      .map((file) => relative(SRC, file).replace(/\\/g, '/'));
    expect(importers).toEqual([MASCOT]);
  });
});

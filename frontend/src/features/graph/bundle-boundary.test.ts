/**
 * The graph feature must not put `recharts` in the initial bundle.
 *
 * `recharts` is the largest dependency in the app: 356.24 kB raw / 103.75 kB gzip,
 * against an app bundle of 292.35 kB / 94.19 kB. Only the repository history
 * route renders a chart, so it is loaded on demand.
 *
 * These tests exist because the obvious implementation of "lazy-load the chart"
 * does not work on its own, and it fails silently.
 *
 * What happened: `RepoHistory.tsx` was changed to `lazy(() => import(...))`, the
 * build succeeded, and the charts chunk was *still* statically imported by the
 * main bundle. The reason was `features/graph/index.ts`, the barrel, which
 * re-exported `TrendChart`. `RepoDetail.tsx` -- which is on the main app route --
 * imported `GraphView` from that barrel, so `recharts` came along regardless of
 * how the history route imported it. Verified by inspecting the built output:
 * `index-*.js` contained a static `from"./charts-*.js"`.
 *
 * Nothing errored. The build was green, the type check was green, the chart
 * still rendered. The bundle was just 103.75 kB larger than it should have been,
 * paid by every visitor to the landing page and the login page.
 *
 * So these assertions are on the *source*, not on behaviour. A component
 * rendering correctly is not evidence about bundle size; the only cheap check
 * that catches a barrel re-export is reading the barrel.
 *
 * **Comments are stripped before matching.** Both fixed files explain the
 * barrel trap in prose, and the naive version of these assertions failed on
 * their own comment text -- which is exactly the failure mode a source-scanning
 * test has: it cannot tell code from documentation, so a file that explains the
 * rule badly enough gets flagged for breaking it. The assertion below is about
 * what the module *does*.
 *
 * What is NOT verified here: the actual byte sizes. Those come from `vite build`
 * and are checked in CI's bundle-budget step (docs/audit/04-test-strategy.md T6).
 * Nothing in a unit test can measure what Rollup decides to emit.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

/** Source with comments removed, so assertions match code and not prose. */
const readCode = (relative: string): string =>
  readFileSync(resolve(here, relative), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // block comments
    .replace(/^[ \t]*\/\/.*$/gm, ' ') // whole-line comments
    .replace(/\/\/.*$/gm, ' '); // trailing comments

const BARREL = 'index.ts';
const HISTORY_ROUTE = '../repos/routes/RepoHistory.tsx';
const REPO_DETAIL = '../repos/routes/RepoDetail.tsx';
const CHART = 'components/TrendChart.tsx';

describe('recharts stays out of the initial bundle', () => {
  it('the graph barrel does not re-export TrendChart', () => {
    // The exact line that undid the lazy import. A barrel re-export is an
    // invisible static edge: whoever imports GraphView from '@/features/graph'
    // gets recharts in the same bundle, forever.
    const barrel = readCode(BARREL);
    expect(barrel).not.toMatch(/export\s*\{[^}]*\bTrendChart\b/);
    expect(barrel).not.toMatch(/from\s*['"][^'"]*TrendChart['"]/);
    expect(barrel).not.toMatch(/\brecharts\b/);
  });

  it('the history route lazy-imports the chart rather than importing it', () => {
    const route = readCode(HISTORY_ROUTE);
    // A top-level `import { TrendChart }` would defeat `lazy` even though the
    // module is still referenced through the lazy loader.
    expect(route).toMatch(/\blazy\s*\(/);
    expect(route).toMatch(/import\(\s*['"][^'"]*TrendChart['"]\s*\)/);
    expect(route).not.toMatch(/^\s*import\s+\{[^}]*\bTrendChart\b\s*\}/m);
  });

  it('the history route reserves the chart height so the layout does not jump', () => {
    // Suspense with no fallback collapses the chart's box to zero height and
    // then snaps to 320px a moment later. This is the kind of regression that
    // never shows up in a screenshot taken after everything settled.
    const route = readCode(HISTORY_ROUTE);
    expect(route).toMatch(/<Suspense[\s\S]*fallback=/);
    expect(route).toMatch(/h-\[320px\]/);
  });

  it('vite does not force recharts into a manual chunk', () => {
    // This is the one that was actually wrong. `manualChunks` places the named
    // modules in a chunk *regardless* of whether anything reaches them
    // statically, which makes that chunk a static dependency of `index` -- and
    // Vite emits a `modulepreload` link for every static chunk dependency.
    //
    // So `charts: ['recharts']` meant the landing page preloaded and downloaded
    // 103.75 kB gzip of chart library that only the history route renders.
    //
    // `hoistTransitiveImports` was the obvious suspect and is NOT the cause:
    // setting it to `false` left `index-*.js` still statically importing
    // `charts-*.js`. Only removing the manual chunk moved the bytes. This test
    // exists so that re-adding the manual chunk -- a natural-looking "optimise
    // the vendor split" change -- is caught rather than silently costing every
    // visitor 103.75 kB.
    // `here` is src/features/graph, so the frontend root is three levels up.
    const viteConfig = readCode('../../../vite.config.ts');
    expect(viteConfig).not.toMatch(/charts\s*:\s*\[/);
    expect(viteConfig).not.toMatch(/recharts/);
    // Kept at Rollup's default on purpose, so a future reader does not
    // "correct" it into a fix that changes nothing.
    expect(viteConfig).not.toMatch(/hoistTransitiveImports/);
  });

  it('the chart imports recharts, so it is the only thing that may', () => {
    // Sanity check on the assumption the rest of this file rests on: if
    // recharts moved somewhere else, these assertions would be guarding
    // nothing and would keep passing.
    expect(readCode(CHART)).toMatch(/from\s*['"]recharts['"]/);
  });

  it('RepoDetail imports GraphView from the module, not the barrel', () => {
    // The import that made the barrel matter. `@/features/graph` is fine for
    // types and for components with no heavy dependency; it is a trap for
    // anything that drags in a chart library.
    const detail = readCode(REPO_DETAIL);
    expect(detail).toMatch(
      /import\s*\{\s*GraphView\s*\}\s*from\s*['"]@\/features\/graph\/components\/GraphView['"]/
    );
    expect(detail).not.toMatch(/from\s*['"]@\/features\/graph['"]/);
  });
});
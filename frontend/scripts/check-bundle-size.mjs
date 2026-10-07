#!/usr/bin/env node
/**
 * Bundle-size gate: fail the build if initial JS gzip regresses >5%.
 *
 * docs/01-audit.md D3. "Initial JS" here means the JavaScript a first-time
 * visitor downloads to render the landing page: every script the built
 * `dist/index.html` references, in fetch order, measured after gzip. That is
 * the honest first-paint cost because the landing is the only public route.
 *
 * What counts (from dist/index.html):
 *   - <script type="module" src="...js">          the app entry
 *   - <link rel="modulepreload" href="...js">     its static chunk deps
 *
 * What does not count: dynamically imported chunks (TrendChart/recharts),
 * CSS, fonts, images. They are not part of first paint for the landing, and
 * including them would make the gate allergic to a graph library we already
 * keep out of the main bundle.
 *
 * Verdict: PASS unless  current > baseline * (1 + tolerancePct/100),
 * where tolerancePct comes from bundle-size.baseline.json (default 5).
 *
 * Usage:
 *   node scripts/check-bundle-size.mjs            gate (fail on >5% growth)
 *   node scripts/check-bundle-size.mjs --update-baseline
 *                                                 record the current build as
 *                                                 the new baseline (committed)
 *
 * The gate is wired into the build as `postbuild`, so `npm run build` fails
 * whenever the bundle regresses past the tolerance. Deliberate growth is a
 * one-line act: run with `--update-baseline` and commit the new baseline.
 */
import { gzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const baselineFile = path.join(root, 'bundle-size.baseline.json');
const reportFile = path.join(distDir, 'size-report.json');
const indexHtml = path.join(distDir, 'index.html');
const updateBaseline = process.argv.includes('--update-baseline');

const TOLERANCE_PCT = 5;

if (!existsSync(indexHtml)) {
  console.error(
    '[bundle] dist/index.html not found. Run `npm run build` before the gate.'
  );
  process.exit(1);
}

/** Collect the JS asset hrefs the built index.html fetches on load. */
function initialJsAssets(html) {
  const hrefs = new Set();
  for (const m of html.matchAll(/<script type="module"[^>]* src="([^"]+\.js)"/g)) {
    hrefs.add(m[1]);
  }
  for (const m of html.matchAll(/<link rel="modulepreload"[^>]* href="([^"]+\.js)"/g)) {
    hrefs.add(m[1]);
  }
  return [...hrefs];
}

/** Return [{ name, rawBytes, gzipBytes }] for the hrefs that exist in dist. */
function measureAssets(hrefs) {
  const assets = [];
  for (const href of hrefs) {
    const file = path.join(distDir, href.replace(/^\/assets\//, 'assets/'));
    if (!existsSync(file)) {
      console.error(`[bundle] ${file} (from index.html) missing after build.`);
      process.exit(1);
    }
    const raw = readFileSync(file);
    assets.push({
      name: path.basename(file),
      rawBytes: raw.length,
      gzipBytes: gzipSync(raw, { level: 9 }).length,
    });
  }
  return assets.sort((a, b) => b.gzipBytes - a.gzipBytes);
}

const html = readFileSync(indexHtml, 'utf8');
const assets = measureAssets(initialJsAssets(html));
const totalGzip = assets.reduce((sum, a) => sum + a.gzipBytes, 0);

let baseline = null;
if (existsSync(baselineFile)) {
  baseline = JSON.parse(readFileSync(baselineFile, 'utf8'));
}

const report = {
  measuredAt: new Date().toISOString(),
  route: '/',
  totalInitialJsGzipBytes: totalGzip,
  assets,
  tolerancePct: baseline?.tolerancePct ?? TOLERANCE_PCT,
  baselineBytes: baseline?.initialJsGzipBytes ?? null,
  verdict: null,
};
writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
console.log('[bundle] size report -> dist/size-report.json');

for (const a of assets) {
  console.log(
    `  ${String(a.name).padEnd(38)} ${String(a.rawBytes).padStart(9)} B raw  ${String(
      a.gzipBytes
    ).padStart(9)} B gzip`
  );
}
console.log(`  ${'initial JS total (gzip)'.padEnd(38)} ${String(totalGzip).padStart(9)} B`);

if (updateBaseline) {
  writeFileSync(
    baselineFile,
    `${JSON.stringify(
      {
        initialJsGzipBytes: totalGzip,
        tolerancePct: TOLERANCE_PCT,
        note:
          'Measured by node scripts/check-bundle-size.mjs --update-baseline after a deliberate bundle change. Update, do not delete.',
      },
      null,
      2
    )}\n`
  );
  console.log(`[bundle] baseline updated -> bundle-size.baseline.json (${totalGzip} B)`);
  process.exit(0);
}

if (!baseline) {
  console.error(
    '[bundle] no bundle-size.baseline.json. Run with --update-baseline to record the first one.'
  );
  process.exit(1);
}

const limit = Math.floor(baseline.initialJsGzipBytes * (1 + baseline.tolerancePct / 100));
const over = totalGzip - limit;
const deltaPct = ((totalGzip - baseline.initialJsGzipBytes) / baseline.initialJsGzipBytes) * 100;
report.verdict = over > 0 ? 'FAIL' : 'PASS';
writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);

console.log(`  baseline                 ${String(baseline.initialJsGzipBytes).padStart(9)} B`);
console.log(`  tolerance                ${baseline.tolerancePct}%  (limit ${limit} B)`);
console.log(`  delta                    ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(2)}%`);

if (over > 0) {
  console.error(
    `[bundle] FAIL: initial JS gzip is ${totalGzip - baseline.initialJsGzipBytes} B ` +
      `(+${deltaPct.toFixed(2)}%) over baseline, exceeding the +${baseline.tolerancePct}% ` +
      'tolerance. Shrink the bundle, or if the growth is deliberate and reviewed, ' +
      'run `node scripts/check-bundle-size.mjs --update-baseline` and commit the change.'
  );
  process.exit(1);
}

console.log(`[bundle] PASS: initial JS gzip within +${baseline.tolerancePct}% of baseline.`);
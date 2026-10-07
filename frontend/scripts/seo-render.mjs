/**
 * SEO render tool: regenerates the two committed artifacts that Phase 4 needs
 * but that the build cannot produce without a browser.
 *
 *   node scripts/seo-render.mjs root   -> prerender/landing-root.html
 *   node scripts/seo-render.mjs og     -> public/og-image.png
 *   node scripts/seo-render.mjs all    -> both
 *
 * Why not part of `npm run build`: `build` runs on Vercel's image, which has
 * no Chrome. So the landing snapshot is committed and the build simply injects
 * it into landing.html (see vite.config.ts, vorza-seo-files). Run this locally
 * whenever the landing markup or the og artwork changes, and commit the
 * results. Uses the system Chrome (CHROME_PATH overrides detection).
 */

import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

import { chromeExecutable, DIST, FRONTEND, startStaticServer } from './lib.mjs';

const PORT = 8017;
const OG_PORT = 8018;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Landing snapshot
// ---------------------------------------------------------------------------

const SNAPSHOT_MARKERS = [
  'Demo map of a codebase',
  'The living, AI-reviewed map of your codebase',
  '06 · Field notes',
  '172',
  '81%',
];

async function renderLandingRoot(browser) {
  const server = await startStaticServer(DIST, PORT);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${PORT}/`, {
      waitUntil: 'networkidle0',
      timeout: 60_000,
    });

    // Hero map present with its real accessible name.
    await page.waitForFunction(
      () =>
        document.querySelector('svg[aria-label^="Demo map of a codebase"]') !==
        null,
      { timeout: 30_000 }
    );
    await sleep(1600); // let the force simulation converge a bit

    // Walk the whole page so the IntersectionObserver-gated metric bars fire,
    // not just the hero ones. Scroll back to the top afterwards so the
    // snapshot is the top-of-page landing a crawler would see.
    await page.evaluate(async () => {
      const doc = document.documentElement;
      const total = Math.max(0, doc.scrollHeight - window.innerHeight);
      for (const f of [0.12, 0.28, 0.45, 0.62, 0.78, 0.92, 1]) {
        window.scrollTo(0, total * f);
        await new Promise((r) => setTimeout(r, 350));
      }
      window.scrollTo(0, 0);
    });
    await sleep(1600); // hero metrics re-settle / count-up completes

    const metricValues = await page.evaluate(() =>
      [...document.querySelectorAll('p.font-mono.text-3xl')].map((el) =>
        Number(el.textContent.replace(/[^0-9]/g, ''))
      )
    );
    if (metricValues.length === 0 || metricValues.every((v) => v === 0)) {
      throw new Error(
        `hero metrics did not settle (values: ${JSON.stringify(metricValues)}); ` +
          'snapshot would show broken count-ups'
      );
    }

    const inner = await page.evaluate(
      () => document.getElementById('root')?.innerHTML ?? ''
    );
    for (const marker of SNAPSHOT_MARKERS) {
      if (!inner.includes(marker)) {
        throw new Error(`landing snapshot is missing "${marker}"`);
      }
    }
    if (inner.length < 10_000) {
      throw new Error(
        `landing snapshot suspiciously small (${inner.length} chars); refusing to write`
      );
    }

    const out = resolve(FRONTEND, 'prerender', 'landing-root.html');
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, `${inner}\n`, 'utf8');
    console.log(
      `wrote prerender/landing-root.html (${inner.length} chars, ` +
        `metrics ${JSON.stringify(metricValues)})`
    );
  } finally {
    await server.close();
  }
}

// ---------------------------------------------------------------------------
// Open Graph image (1200x630)
// ---------------------------------------------------------------------------

/** Deterministic PRNG so the illustration is stable across runs. */
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Health colour for a score, using the signal tokens from src/index.css. */
function healthColor(score) {
  if (score >= 70) return 'hsl(143 62% 40%)'; // --signal-good
  if (score >= 45) return 'hsl(40 92% 42%)'; // --signal-warn
  return 'hsl(356 68% 48%)'; // --signal-bad
}

function buildOgSvg() {
  const clusters = [
    { cx: 175, cy: 150, name: 'backend', count: 10, label: 'backend/app' },
    { cx: 425, cy: 105, name: 'frontend', count: 9, label: 'frontend/src' },
    { cx: 295, cy: 345, name: 'docs', count: 7, label: 'docs' },
  ];
  const rng = seededRandom(20261007);
  const nodes = [];
  const links = [];

  clusters.forEach((cluster, ci) => {
    let hub = null;
    for (let i = 0; i < cluster.count; i += 1) {
      const isHub = i === 0;
      const health = isHub ? 92 : [88, 74, 80, 58, 46, 39, 68, 82][i % 8];
      const radius = isHub ? 15 : 5 + Math.round(rng() * 6);
      const ang = (i / cluster.count) * Math.PI * 2 + ci;
      const dist = isHub ? 4 : 18 + rng() * (i % 2 === 0 ? 62 : 96);
      const x = cluster.cx + Math.cos(ang) * dist;
      const y = cluster.cy + Math.sin(ang) * dist;
      const node = {
        id: `${cluster.name}:${i}`,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        r: radius,
        health,
        hub: isHub,
        label: isHub ? cluster.label : null,
      };
      nodes.push(node);
      if (hub)
        links.push(
          `<line x1="${hub.x}" y1="${hub.y}" x2="${node.x}" y2="${node.y}" />`
        );
      else hub = node;
    }
  });

  const circles = nodes
    .map((n) => {
      const ring = n.hub ? ` stroke="hsl(212 87% 44%)" stroke-width="2"` : '';
      const stroke = n.hub
        ? ''
        : ` stroke="hsl(220 13% 89%)" stroke-width="0.5"`;
      return `<circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${healthColor(n.health)}"${ring}${stroke}/>`;
    })
    .join('\n');

  const labels = nodes
    .filter((n) => n.label)
    .map(
      (n) =>
        `<text x="${n.x}" y="${n.y - n.r - 9}" text-anchor="middle" font-family="Consolas, 'SFMono-Regular', monospace" font-size="12" fill="#8B919B">${n.label}</text>`
    )
    .join('\n');

  return `
<svg viewBox="0 0 634 518" role="img" aria-label="Illustration: three clusters of code files as nodes, coloured by health score" style="width:100%;height:100%;display:block">
  <rect x="0.5" y="0.5" width="633" height="517" fill="hsl(0 0% 100%)" stroke="hsl(220 13% 89%)" />
  <!-- registration ticks in the corners, echoing MapFrame -->
  <path d="M0 28 V8 H28" fill="none" stroke="hsl(220 13% 82%)" stroke-width="2"/>
  <path d="M606 0 H634 V28" fill="none" stroke="hsl(220 13% 82%)" stroke-width="2" transform="translate(0 490)"/>
  ${links.join('\n')}
  ${circles}
  ${labels}
</svg>`;
}

function buildOgPage() {
  const svg = buildOgSvg();
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    background: hsl(220 20% 98%);
    font-family: -apple-system, "Segoe UI", Roboto, "Inter", "Helvetica Neue", Arial, sans-serif;
    color: #21242e;
    display: flex;
  }
  .left { width: 470px; padding: 70px 0 0 64px; }
  .eyebrow { display: flex; align-items: center; gap: 10px; }
  .eyebrow .dot { width: 12px; height: 12px; border-radius: 3px; background: hsl(212 87% 44%); }
  .eyebrow span {
    font-family: Consolas, "SFMono-Regular", monospace;
    font-size: 14px; letter-spacing: 0.28em; font-weight: 600;
    color: hsl(212 87% 44%);
  }
  h1 { font-size: 92px; font-weight: 700; letter-spacing: -0.03em; margin-top: 18px; color: #1f232c; }
  .tagline { font-size: 27px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.25; margin-top: 14px; color: #292d37; }
  .subline {
    font-family: Consolas, "SFMono-Regular", monospace;
    font-size: 13.5px; letter-spacing: 0.02em; margin-top: 18px; color: #575e68;
  }
  .legend { display: flex; gap: 22px; margin-top: 30px; }
  .legend .item { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: #575e68; }
  .legend .swatch { width: 10px; height: 10px; border-radius: 50%; }
  .site {
    font-family: Consolas, "SFMono-Regular", monospace;
    font-size: 12.5px; letter-spacing: 0.04em; margin-top: 46px; color: #8b919b;
  }
  .right { flex: 1; padding: 56px 56px 56px 34px; }
</style>
</head>
<body>
  <div class="left">
    <div class="eyebrow"><span class="dot"></span><span>VORZA</span></div>
    <h1>Vorza</h1>
    <p class="tagline">The living, AI-reviewed map of your codebase.</p>
    <p class="subline">complexity &middot; churn &middot; health &middot; AI PR reviews</p>
    <div class="legend">
      <div class="item"><span class="swatch" style="background:hsl(143 62% 40%)"></span>healthy &ge; 70</div>
      <div class="item"><span class="swatch" style="background:hsl(40 92% 42%)"></span>at risk &ge; 45</div>
      <div class="item"><span class="swatch" style="background:hsl(356 68% 48%)"></span>critical &lt; 45</div>
    </div>
    <p class="site">vorza-sigma.vercel.app</p>
  </div>
  <div class="right">${svg}</div>
</body>
</html>`;
}

async function renderOgImage(browser) {
  const previewDir = await mkdtemp(join(tmpdir(), 'vorza-og-'));
  await writeFile(join(previewDir, 'og-preview.html'), buildOgPage(), 'utf8');

  const server = await startStaticServer(previewDir, OG_PORT, { spa: false });
  const out = resolve(FRONTEND, 'public', 'og-image.png');
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${OG_PORT}/og-preview.html`, {
      waitUntil: 'networkidle0',
      timeout: 60_000,
    });
    await sleep(250);
    await page.screenshot({ path: out, type: 'png' });
  } finally {
    await server.close();
    await rm(previewDir, { recursive: true, force: true });
  }

  const buf = await readFile(out);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bytes = (await stat(out)).size;
  if (width !== 1200 || height !== 630) {
    throw new Error(`og-image rendered ${width}x${height}, expected 1200x630`);
  }
  if (bytes > 400_000) {
    throw new Error(
      `og-image is ${bytes} bytes; social platforms reject > ~512 kB`
    );
  }
  console.log(`wrote public/og-image.png (${width}x${height}, ${bytes} bytes)`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const action = process.argv[2] ?? 'all';
  if (!['root', 'og', 'all'].includes(action)) {
    throw new Error(`unknown action "${action}" (use: root | og | all)`);
  }
  const chrome = chromeExecutable();
  if (!chrome) {
    throw new Error(
      'no Chrome/Edge binary found; set CHROME_PATH to a chrome/msedge executable'
    );
  }
  if (
    (action === 'root' || action === 'all') &&
    !(await stat(DIST)).isDirectory()
  ) {
    throw new Error('frontend/dist is missing; run `npm run build` first');
  }
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  try {
    if (action === 'root' || action === 'all') await renderLandingRoot(browser);
    if (action === 'og' || action === 'all') await renderOgImage(browser);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(`[seo-render] ${err.message ?? err}`);
  process.exit(1);
});

/**
 * Pure HTML transforms for the Phase 4 SEO work.
 *
 * Both functions are shared by the Vite build (vite.config.ts) and the unit
 * tests (prerender/seo-html.test.mjs). They are pure on purpose: no filesystem,
 * no browser, so the build output is deterministic everywhere -- including on
 * Vercel's build machine, which has no Chrome.
 *
 * 1. `absolutizeHead` turns the relative canonical/og URLs in index.html into
 *    absolute ones from the build-time site origin (VITE_SITE_URL). Social and
 *    search crawlers do not run JS; the static head is the only head they see.
 * 2. `injectRoot` puts the committed landing snapshot into a document's
 *    `<div id="root">`. The build calls it on the built entry and overwrites
 *    `dist/index.html` with the result, so `/` returns full landing content and
 *    `application/ld+json`, not a `<div id="root"></div>`-only shell (the
 *    untouched built entry is kept as `shell.html` for the SPA deep links).
 */

/** Replace the relative head URLs with absolute ones from `site`. */
export function absolutizeHead(html, site) {
  const origin = (site ?? '').trim().replace(/\/+$/, '');
  if (!origin) return html;
  return html
    .replace(
      '<link rel="canonical" href="/" />',
      `<link rel="canonical" href="${origin}/" />`
    )
    .replace(
      '<meta property="og:url" content="/" />',
      `<meta property="og:url" content="${origin}/" />`
    )
    .replaceAll('content="/og-image.png"', `content="${origin}/og-image.png"`)
    .replace('"url": "/"', `"url": "${origin}/"`)
    .replace('"image": "/og-image.png"', `"image": "${origin}/og-image.png"`);
}

/** Put a pre-rendered body snapshot inside #root. Returns null if no root. */
export function injectRoot(html, snapshot) {
  const marker = '<div id="root"></div>';
  if (!html.includes(marker)) return null;
  return html.replace(marker, `<div id="root">${snapshot}</div>`);
}

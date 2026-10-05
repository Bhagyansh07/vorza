import path from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Routes that belong in `sitemap.xml`.
 *
 * Everything else in the app sits behind auth or is a per-repo detail page with
 * a UUID in the path, so there is no stable public URL to submit. Listing
 * `/dashboard` here would only advertise a login redirect.
 */
const INDEXABLE_ROUTES = ['/', '/login'];

/**
 * Emit `robots.txt` and `sitemap.xml` from the build-time site URL.
 *
 * These are static files, so unlike `src/lib/seo.ts` they cannot read
 * `window.location`. Generating them at build time means the sitemap's origin
 * is the same string the canonical tags use, instead of a hostname typed into
 * two places that then drift apart.
 *
 * A sitemap with a wrong origin fails silently, so an unset `VITE_SITE_URL`
 * is a build warning rather than a shrug.
 */
function seoFiles(): Plugin {
  let origin = '';
  return {
    name: 'vorza-seo-files',
    apply: 'build',
    configResolved(config) {
      origin = (config.env.VITE_SITE_URL ?? '').trim().replace(/\/+$/, '');
      if (!origin) {
        config.logger.warn(
          '[vorza] VITE_SITE_URL is unset, so robots.txt and sitemap.xml will ' +
            'point at http://localhost:5173. Set it before deploying ' +
            '(docs/MANUAL_STEPS.md).'
        );
      }
    },
    generateBundle() {
      const site = origin || 'http://localhost:5173';

      const sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...INDEXABLE_ROUTES.map(
          (route) =>
            `  <url><loc>${site}${route}</loc>` +
            '<changefreq>weekly</changefreq><priority>0.8</priority></url>'
        ),
        '</urlset>',
        '',
      ].join('\n');

      const robots = [
        '# Generated at build time from VITE_SITE_URL. Do not edit public/.',
        `Sitemap: ${site}/sitemap.xml`,
        '',
        'User-agent: *',
        'Allow: /',
        '',
        '# Behind auth: no standalone value in a search result, and indexing a',
        '# redirect to /login just wastes crawl budget.',
        'Disallow: /dashboard',
        'Disallow: /repos/',
        '',
      ].join('\n');

      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap });
    },
  };
}

export default defineConfig({
  plugins: [react(), seoFiles()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          d3: ['d3-force', 'd3-selection', 'd3-zoom'],
          charts: ['recharts'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
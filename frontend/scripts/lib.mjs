/**
 * Shared helpers for the SEO render scripts (scripts/seo-render.mjs).
 *
 * These scripts are developer tools, not part of the shipped app. They need a
 * Chrome binary on the machine they run on, so the Vite build itself never
 * calls them: `dist/landing.html` is assembled from a *committed* snapshot
 * (prerender/landing-root.html) so a deploy stays deterministic on machines
 * that have no browser (e.g. Vercel's build image).
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FRONTEND = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const DIST = resolve(FRONTEND, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

/** First installed Chrome/Edge binary, or null. Override with CHROME_PATH. */
export function chromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) ?? null;
}

/** Tiny static server for a build directory. Resolves SPA-style deep routes. */
export async function startStaticServer(rootDir, port, { spa = true } = {}) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'x'}`);
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/') rel = '/index.html';
      const file = normalize(join(rootDir, rel));
      if (!file.startsWith(normalize(rootDir))) {
        res.writeHead(403, { 'content-type': 'text/plain' });
        res.end('forbidden');
        return;
      }
      if (!existsSync(file) && spa) {
        res.end(await readFile(join(rootDir, 'index.html')));
        return;
      }
      if (!existsSync(file)) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('not found');
        return;
      }
      const data = await readFile(file);
      res.writeHead(200, {
        'content-type':
          MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      });
      res.end(data);
    } catch {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('internal error');
    }
  });
  await new Promise((resolveListen) =>
    server.listen(port, '127.0.0.1', resolveListen)
  );
  return server;
}

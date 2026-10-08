import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guards the committed pre-render snapshot that `/` is served from.
 *
 * `prerender/landing-root.html` is produced by `npm run prerender` (a local
 * Chrome render of the built app) and injected into `dist/index.html` at
 * build time. The build cannot regenerate it itself, so this test fails with a
 * regeneration hint if the committed file goes stale, is deleted, or a dev
 * commits a shell instead.
 */

// Resolve the path with node:path, not `new URL(...)`: under the jsdom test
// environment the global URL constructor cannot build a file:// URL object, so
// fileURLToPath then throws "The URL must be of scheme file".
const here = dirname(fileURLToPath(import.meta.url));

const SNAPSHOT = resolve(here, '../../../prerender/landing-root.html');

const REGENERATE =
  'Run `npm run build && npm run prerender` in frontend/ and commit the result.';

const REQUIRED_MARKERS = [
  'Demo map of a codebase',
  'The living, AI-reviewed map of your codebase',
  '06 · Field notes',
  '183',
  '81%',
];

describe('landing pre-render snapshot', () => {
  it('exists and is not an empty shell', () => {
    const html = readFileSync(SNAPSHOT, 'utf8');
    expect(html.length, `${REGENERATE} Snapshot is only ${html.length} chars.`).toBeGreaterThan(
      10_000,
    );
  });

  it.each(REQUIRED_MARKERS)('contains %j', (marker) => {
    const html = readFileSync(SNAPSHOT, 'utf8');
    expect(html, REGENERATE).toContain(marker);
  });

  it('is body content only: no script tags, no document markup', () => {
    const html = readFileSync(SNAPSHOT, 'utf8');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<!doctype');
    expect(html).not.toContain('<html');
  });
});
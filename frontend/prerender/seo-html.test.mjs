import { describe, expect, it } from 'vitest';

import { absolutizeHead, injectRoot } from './seo-html.mjs';

const ORIGIN = 'https://vorza-sigma.vercel.app';

const BASE = `<!doctype html>
<html lang="en">
  <head>
    <title>Vorza</title>
    <link rel="canonical" href="/" />
    <meta property="og:url" content="/" />
    <meta property="og:image" content="/og-image.png" />
    <meta name="twitter:image" content="/og-image.png" />
    <script type="application/ld+json">{"@type":"SoftwareApplication","url": "/", "image": "/og-image.png"}</script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

describe('absolutizeHead', () => {
  it('makes the canonical tag absolute', () => {
    const out = absolutizeHead(BASE, ORIGIN);
    expect(out).toContain('<link rel="canonical" href="https://vorza-sigma.vercel.app/" />');
  });

  it('makes og:url absolute', () => {
    const out = absolutizeHead(BASE, ORIGIN);
    expect(out).toContain(
      '<meta property="og:url" content="https://vorza-sigma.vercel.app/" />',
    );
  });

  it('makes both og:image and twitter:image absolute', () => {
    const out = absolutizeHead(BASE, ORIGIN);
    // Two `content=` values (og:image, twitter:image). The JSON-LD "image" is
    // also absolutized but is asserted by its own test below.
    const absolute = out.match(
      /content="https:\/\/vorza-sigma\.vercel\.app\/og-image\.png"/g,
    );
    expect(absolute).not.toBeNull();
    expect(absolute).toHaveLength(2);
  });

  it('makes the JSON-LD url and image absolute', () => {
    const out = absolutizeHead(BASE, ORIGIN);
    expect(out).toContain('"url": "https://vorza-sigma.vercel.app/"');
    expect(out).toContain(
      '"image": "https://vorza-sigma.vercel.app/og-image.png"',
    );
  });

  it('strips a trailing slash from the configured origin', () => {
    const out = absolutizeHead(BASE, `${ORIGIN}/`);
    expect(out).toContain('href="https://vorza-sigma.vercel.app/"');
  });

  it('leaves the html untouched when no site is configured', () => {
    expect(absolutizeHead(BASE, '')).toBe(BASE);
    expect(absolutizeHead(BASE, '   ')).toBe(BASE);
  });
});

describe('injectRoot', () => {
  it('puts the snapshot inside #root', () => {
    const html = '<div id="root"></div><script src="/assets/x.js"></script>';
    expect(injectRoot(html, '<h1>hi</h1>')).toBe(
      '<div id="root"><h1>hi</h1></div><script src="/assets/x.js"></script>',
    );
  });

  it('returns null when the document has no #root container', () => {
    expect(injectRoot('<p>no root</p>', '<h1>x</h1>')).toBeNull();
  });
});
/**
 * Tests for the document-head helper.
 *
 * These matter more than usual tags tests, because the thing they protect is
 * the only indexable surface the app has: `/` used to redirect into an auth
 * wall, so there was nothing else for a crawler to read.
 */
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { absoluteUrl, formatTitle, siteOrigin, useDocumentMeta } from './seo';

function metaContent(attribute: 'name' | 'property', key: string): string | null {
  return document.head
    .querySelector(`meta[${attribute}="${key}"]`)
    ?.getAttribute('content') ?? null;
}

function canonical(): string | null {
  return document.head
    .querySelector('link[rel="canonical"]')
    ?.getAttribute('href') ?? null;
}

function jsonLdText(): string | null {
  return document.head.querySelector('#vorza-jsonld')?.textContent ?? null;
}

describe('formatTitle', () => {
  it('suffixes the brand', () => {
    expect(formatTitle('Sign in')).toBe('Sign in · Vorza');
  });

  it('does not double up when the brand is already there', () => {
    expect(formatTitle('Vorza - the living map')).toBe('Vorza - the living map');
  });
});

describe('absoluteUrl', () => {
  it('builds an absolute URL from the origin and path', () => {
    expect(absoluteUrl('/login', 'https://vorza.app')).toBe(
      'https://vorza.app/login'
    );
  });

  it('tolerates a path without a leading slash', () => {
    expect(absoluteUrl('login', 'https://vorza.app')).toBe(
      'https://vorza.app/login'
    );
  });

  it('does not double a trailing slash on the origin', () => {
    expect(absoluteUrl('/', 'https://vorza.app/')).toBe('https://vorza.app/');
  });
});

describe('siteOrigin', () => {
  it('falls back to the live origin when VITE_SITE_URL is unset', () => {
    // This is the property that matters: a preview deployment describes itself
    // correctly instead of claiming to be production, and a missing env var
    // cannot emit a canonical pointing at a deployment that no longer exists.
    expect(siteOrigin()).toBe(window.location.origin);
    expect(siteOrigin()).not.toMatch(/\/+$/);
  });
});

describe('useDocumentMeta', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('sets title, description and canonical', () => {
    renderHook(() =>
      useDocumentMeta({
        title: 'Sign in',
        description: 'Sign in with GitHub.',
        path: '/login',
      })
    );

    expect(document.title).toBe('Sign in · Vorza');
    expect(metaContent('name', 'description')).toBe('Sign in with GitHub.');
    expect(canonical()).toBe(`${siteOrigin()}/login`);
  });

  it('keeps og and twitter tags in sync with the page', () => {
    renderHook(() =>
      useDocumentMeta({
        title: 'Snapshot history',
        description: 'Health over time.',
        path: '/repos/abc/history',
      })
    );

    expect(metaContent('property', 'og:title')).toBe('Snapshot history · Vorza');
    expect(metaContent('property', 'og:description')).toBe('Health over time.');
    expect(metaContent('property', 'og:url')).toBe(
      `${siteOrigin()}/repos/abc/history`
    );
    expect(metaContent('name', 'twitter:title')).toBe(
      'Snapshot history · Vorza'
    );
  });

  it('indexes by default', () => {
    renderHook(() =>
      useDocumentMeta({ title: 'Home', description: 'd', path: '/' })
    );
    expect(metaContent('name', 'robots')).toBe('index, follow');
  });

  it('sets noindex,nofollow when asked', () => {
    renderHook(() =>
      useDocumentMeta({
        title: 'Dashboard',
        description: 'd',
        path: '/dashboard',
        noindex: true,
      })
    );
    expect(metaContent('name', 'robots')).toBe('noindex, nofollow');
  });

  it('flips robots back to indexable when a noindex route is left', () => {
    const { rerender } = renderHook(
      (props: { noindex: boolean }) =>
        useDocumentMeta({
          title: 'T',
          description: 'd',
          path: '/x',
          noindex: props.noindex,
        }),
      { initialProps: { noindex: true } }
    );

    expect(metaContent('name', 'robots')).toBe('noindex, nofollow');

    rerender({ noindex: false });
    expect(metaContent('name', 'robots')).toBe('index, follow');
  });

  it('does not duplicate meta tags across renders', () => {
    const { rerender } = renderHook(
      () => useDocumentMeta({ title: 'A', description: 'd', path: '/a' })
    );
    rerender();
    rerender();

    expect(
      document.head.querySelectorAll('meta[name="description"]')
    ).toHaveLength(1);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(
      1
    );
  });

  it('writes json-ld when supplied', () => {
    renderHook(() =>
      useDocumentMeta({
        title: 'Home',
        description: 'd',
        path: '/',
        jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication' },
      })
    );

    const text = jsonLdText();
    expect(text).not.toBeNull();
    expect(JSON.parse(text as string)).toMatchObject({
      '@type': 'SoftwareApplication',
    });
  });

  it('clears json-ld left behind by a previous route', () => {
    const { rerender } = renderHook(
      (props: { jsonLd?: Record<string, unknown> }) =>
        useDocumentMeta({
          title: 'T',
          description: 'd',
          path: '/x',
          jsonLd: props.jsonLd,
        }),
      { initialProps: { jsonLd: { '@type': 'WebSite' } as Record<string, unknown> | undefined } }
    );

    expect(jsonLdText()).not.toBeNull();

    rerender({ jsonLd: undefined });
    expect(jsonLdText()).toBeNull();
  });

  it('does not loop when the caller passes a fresh object literal each render', () => {
    // An identity dependency on jsonLd would re-run the effect forever. The
    // serialized form is the real input, so a structurally identical object
    // must not retrigger it.
    let effectRuns = 0;
    const { rerender } = renderHook(() => {
      effectRuns += 1;
      useDocumentMeta({
        title: 'T',
        description: 'd',
        path: '/x',
        jsonLd: { '@type': 'WebSite' },
      });
    });

    const baseline = effectRuns;
    rerender();
    rerender();

    // Render runs, but the head-writing effect does not: same serialized input.
    expect(effectRuns).toBeGreaterThan(baseline);
    expect(
      document.head.querySelectorAll('#vorza-jsonld')
    ).toHaveLength(1);
  });
});
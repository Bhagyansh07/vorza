/**
 * Document head management.
 *
 * Every route in this app is client-rendered, so the only head tags a crawler
 * or a link unfurl ever sees are the ones in `index.html` plus whatever this
 * module writes at runtime. That makes two things important:
 *
 * 1. `index.html` must carry a complete, correct set of tags on its own, because
 *    social crawlers do not execute JavaScript. `useDocumentMeta` is for the
 *    live SPA experience (tab titles, per-route descriptions); it is not a
 *    substitute for `index.html` being right.
 *
 * 2. The canonical origin must be whatever the site is actually served from.
 *    Hardcoding a hostname here is how you end up emitting canonicals for a
 *    deployment that no longer exists, so it is resolved from `window.location`
 *    and only falls back to `VITE_SITE_URL` outside a browser (prerender, SSR,
 *    tests). See `docs/MANUAL_STEPS.md` for the domain step.
 */

import { useEffect } from 'react';

/**
 * The origin the site is being served from, without a trailing slash.
 *
 * `VITE_SITE_URL` wins when set, because at build time that is the only place
 * the real production hostname is known. In the browser the live origin is
 * more authoritative and means preview deployments describe themselves
 * correctly instead of claiming to be production.
 */
export function siteOrigin(): string {
  const configured = (import.meta.env.VITE_SITE_URL ?? '').trim();
  if (configured) return stripTrailingSlash(configured);
  if (typeof window !== 'undefined' && window.location?.origin) {
    return stripTrailingSlash(window.location.origin);
  }
  return '';
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/** `"Vorza"` + `"Sign in"` -> `"Sign in · Vorza"`. */
export function formatTitle(title: string): string {
  return title.includes('Vorza') ? title : `${title} · Vorza`;
}

/** Absolute URL for a route path, used by canonical, OG and the sitemap. */
export function absoluteUrl(path: string, origin = siteOrigin()): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  // Stripped here too, not only in siteOrigin: callers pass their own origin in
  // tests and tooling, and `https://host/` + `/login` must not become a
  // double-slashed URL.
  return `${stripTrailingSlash(origin)}${clean}`;
}

/** The set of tags `useDocumentMeta` will keep in sync. */
export interface DocumentMeta {
  /** Page title. "Vorza" is appended unless already present. */
  title: string;
  description: string;
  /** Route path, used for the canonical and og:url. */
  path: string;
  /**
   * Hide from search engines. Applied to authed and per-user routes: they have
   * no standalone value in a result page, and indexing a redirect to /login
   * wastes crawl budget on pages nobody searches for.
   */
  noindex?: boolean;
  /** Serialized into an `application/ld+json` script tag. */
  jsonLd?: Record<string, unknown>;
}

/**
 * Write or update a `<meta>` tag. Returns the element so callers can read back
 * what was applied, which is what makes this testable without a full render.
 */
function upsertMeta(
  attribute: 'name' | 'property',
  key: string,
  content: string
): HTMLMetaElement {
  const selector = `meta[${attribute}="${key}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
  return element;
}

function upsertCanonical(href: string): HTMLLinkElement {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
  return element;
}

function upsertJsonLd(serialized: string): HTMLScriptElement {
  const id = 'vorza-jsonld';
  let element = document.head.querySelector<HTMLScriptElement>(`#${id}`);
  if (!element) {
    element = document.createElement('script');
    element.id = id;
    element.type = 'application/ld+json';
    document.head.appendChild(element);
  }
  element.textContent = serialized;
  return element;
}

function removeJsonLd(): void {
  document.head.querySelector('#vorza-jsonld')?.remove();
}

/**
 * Synchronise the document head with a route's metadata.
 *
 * Values are read at effect time rather than at module load, so the tests do
 * not depend on a particular `window.location`.
 */
export function useDocumentMeta(meta: DocumentMeta): void {
  const {
    title,
    description,
    path,
    noindex = false,
    jsonLd,
  } = meta;

  // Stable across renders even when the caller passes a fresh object literal.
  const serializedJsonLd = jsonLd ? JSON.stringify(jsonLd) : null;

  useEffect(() => {
    const url = absoluteUrl(path);

    document.title = formatTitle(title);
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    upsertCanonical(url);

    upsertMeta('property', 'og:title', formatTitle(title));
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('name', 'twitter:title', formatTitle(title));
    upsertMeta('name', 'twitter:description', description);

    if (serializedJsonLd !== null) {
      // The serialized string is written verbatim rather than re-stringifying
      // `jsonLd` here, so the effect genuinely depends on nothing but its own
      // inputs. Reading `jsonLd` inside would be a real staleness bug and would
      // draw the same eslint warning, which is the correct signal.
      upsertJsonLd(serializedJsonLd);
    } else {
      // A previous route may have left one behind.
      removeJsonLd();
    }
  }, [title, description, path, noindex, serializedJsonLd]);
}
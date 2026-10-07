/**
 * Type declarations for the pure SEO transforms in seo-html.mjs, shared by the
 * Vite build and the unit tests. The implementation is plain JS on purpose so
 * the tests can import it without a build step.
 */

export declare function absolutizeHead(html: string, site: string): string;

export declare function injectRoot(
  html: string,
  snapshot: string,
): string | null;
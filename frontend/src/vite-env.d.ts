/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_USE_MOCKS: string;
  /**
   * Declared because `src/lib/seo.ts` reads it. Without this line the read
   * still typechecks -- vite/client merges an `[key: string]: any` index
   * signature into this interface -- but the value arrives as `any`, so the
   * fallback chain and the `.trim()` in `siteOrigin` are unchecked.
   */
  readonly VITE_SITE_URL: string;
  readonly VITE_GITHUB_OAUTH_URL: string;
  readonly VITE_GITHUB_CLIENT_ID: string;
  readonly VITE_GITHUB_CALLBACK_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
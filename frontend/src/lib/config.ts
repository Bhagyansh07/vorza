/**
 * Env-driven runtime config. Falls back to dev-friendly defaults so the app
 * boots even with no .env file.
 */

const raw = (key: string, fallback: string): string =>
  import.meta.env[key] ?? fallback;

export const config = {
  apiUrl: raw('VITE_API_URL', 'http://localhost:8000'),
  useMocks: raw('VITE_USE_MOCKS', 'true').toLowerCase() === 'true',
  githubOAuthUrl: raw(
    'VITE_GITHUB_OAUTH_URL',
    'https://github.com/login/oauth/authorize'
  ),
  githubClientId: raw('VITE_GITHUB_CLIENT_ID', ''),
  githubCallbackUrl: raw(
    'VITE_GITHUB_CALLBACK_URL',
    'http://localhost:8000/auth/github/callback'
  ),
};

/** The backend OAuth route from CONTRACTS.md. */
export const GITHUB_CALLBACK_PATH = '/auth/github/callback';

/** Navigate the browser to an external URL (injectable so it's testable). */
export function oauthRedirect(url: string): void {
  window.location.assign(url);
}
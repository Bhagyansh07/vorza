import type { Page } from '@playwright/test';

/**
 * Seed a signed-in session for authed specs. Runs before every navigation on
 * the page: the app reads `Vorza.access_token` on boot (features/auth/store)
 * and hits /me with it, which the test-double server answers without ever
 * checking the token value.
 */
export async function seedSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('Vorza.access_token', 'e2e-access-token');
  });
}

/** Unique-per-test value, so re-runs against a shared server never collide. */
export function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
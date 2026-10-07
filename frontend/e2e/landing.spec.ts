import { test, expect } from '@playwright/test';

/**
 * The landing page is the only route a crawler sees without running JS,
 * because dist/index.html carries the pre-rendered snapshot (see
 * vite.config.ts `seoFiles`). This smoke test pins that contract: the hero
 * and the public CTAs render at `/` and the primary CTA routes to /login.
 */
test('landing renders the hero and public CTAs lead to /login', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /The living, AI-reviewed map of your codebase/,
    })
  ).toBeVisible();

  // The landing page carries two "Connect a repo" CTAs (header nav + hero);
  // the hero one is the primary path for a first-time visitor.
  const connect = page.getByRole('link', { name: 'Connect a repo' }).last();
  await expect(connect).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();

  await connect.click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Sign in to Vorza')).toBeVisible();
});
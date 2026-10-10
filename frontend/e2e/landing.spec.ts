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

/**
 * Vorpy's guided tour is the page's only interactive explainer. This pins the
 * contract a visitor relies on: the invite is reachable, the tour opens on step
 * one, Next advances it, and it can be closed again.
 */
test('the Vorpy tour opens, steps forward and closes', async ({ page }) => {
  await page.goto('/');

  const invite = page.getByRole('button', {
    name: 'Start the Vorpy guided tour',
  });
  await expect(invite).toBeVisible();
  await invite.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Start here' })).toBeVisible();
  await expect(dialog.getByText('1 / 10')).toBeVisible();

  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByText('2 / 10')).toBeVisible();

  await dialog.getByRole('button', { name: 'Close the tour' }).click();
  await expect(dialog).toBeHidden();
});
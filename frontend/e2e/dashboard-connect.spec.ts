import { test, expect } from '@playwright/test';

import { seedSession } from './helpers';

/**
 * Dashboard list + connect-a-repo flow. The picker's GitHub repos come from
 * the mock GET /github/repos and connecting a repo stores it server-side, so
 * this exercises the real REST path (envelope unwrapping, 201 handling, query
 * invalidation) rather than the demo fixtures.
 */
test.beforeEach(async ({ page }) => {
  await seedSession(page);
});

test('dashboard lists connected repos and connects one from the picker', async ({
  page,
}) => {
  await page.goto('/dashboard');

  await expect(
    page.getByRole('heading', { name: /Connected repositories/ })
  ).toBeVisible();
  await expect(page.getByText('vorza-demo/landing')).toBeVisible();
  await expect(page.getByText('octocat/Spork')).toBeVisible();

  await page.getByRole('button', { name: /Connect repo/ }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: /Connect a GitHub repo/ })).toBeVisible();
  const widgets = dialog.locator('li').filter({ hasText: 'acme/widgets' });
  await expect(widgets).toBeVisible();
  await widgets.getByRole('button').click();

  await expect(page.getByText('Connected acme/widgets')).toBeVisible();

  // Close the dialog and confirm the new repo card joined the dashboard list.
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(
    page.getByText('acme/widgets').filter({ visible: true }).last()
  ).toBeVisible();
});
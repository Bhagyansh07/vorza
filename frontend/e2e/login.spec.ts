import { test, expect } from '@playwright/test';

/**
 * Full GitHub OAuth round trip, with GitHub replaced by the test-double's
 * `e2e/authorize` page (the same shape as the real chain: app -> authorize
 * URL -> consent page -> back to the app as the signed-in user).
 *
 * The consent sentence is asserted verbatim: the login screen must show what
 * `write_access: true` means before someone clicks Continue.
 */
test('OAuth round trip: consent copy, authorize page, signed-in dashboard', async ({
  page,
}) => {
  await page.goto('/login');

  // The login title is a CardTitle (a div), so match on text, not heading role.
  await expect(page.getByText('Sign in to Vorza')).toBeVisible();

  // The mock grant asks for the repo scope with write access, so the consent
  // copy must name what that grant actually is.
  await expect(
    page.getByText(/read and write access to your repositories/)
  ).toBeVisible();

  await page.getByRole('button', { name: /Continue with GitHub/ }).click();

  // Lands on the simulated consent page, which issues the token and returns
  // to the app.
  await expect(page.getByText('Simulated GitHub authorization')).toBeVisible();

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10_000 });
  await expect(
    page.getByRole('heading', { name: /Connected repositories/ })
  ).toBeVisible();
  await expect(page.getByText('vorza-demo/landing')).toBeVisible();
});
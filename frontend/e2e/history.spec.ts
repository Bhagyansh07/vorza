import { test, expect } from '@playwright/test';

import { seedSession } from './helpers';

/**
 * Health history: the only route that pulls in the recharts chunk (lazy; T6).
 * It must render the trend chart from the history envelope. The lazy chunk is
 * served from dist/assets like any other file, so this also proves the
 * server's static asset path works for hashed deep chunks.
 */
test('health history renders the trend chart from history summaries', async ({
  page,
}) => {
  await seedSession(page);

  await page.goto('/repos/r_1/history');

  await expect(
    page.getByRole('heading', { name: 'Health history' })
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to map' })).toBeVisible();

  await expect(page.locator('svg.recharts-surface')).toBeVisible({ timeout: 10_000 });
});
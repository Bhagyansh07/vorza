import { test, expect } from '@playwright/test';

import { seedSession } from './helpers';

/**
 * The AI review banner arrives over the real WebSocket: the test-double
 * pushes `review:new` through the same gateway channel the backend uses, and
 * the graph renders the review card with its original findings. This is the
 * only E2E path to a review, because reviews are only ever broadcast, never
 * pulled.
 */
test('review banner renders from a realtime review:new event and dismisses', async ({
  page,
  request,
}) => {
  await seedSession(page);

  await page.goto('/repos/r_1');
  await expect(page.getByRole('group', { name: 'Graph view' })).toBeVisible();

  // Broadcasts are replayed to sockets that connect late, so no handshake
  // dance is needed: the event always lands on the open socket.
  const pushed = await request.post('/e2e/review/r_1');
  expect(pushed.status()).toBe(200);

  await expect(page.getByText('AI review')).toBeVisible();
  await expect(page.getByText(/PR #42/)).toBeVisible();
  await expect(page.getByText(/risk 61/)).toBeVisible();
  await expect(page.getByText('high')).toBeVisible();
  await expect(
    page.getByText('Risky change behind a second chunk: the planner now rewrites state synchronously.')
  ).toBeVisible();

  await page.getByRole('button', { name: 'Dismiss review' }).click();
  await expect(page.getByText('AI review')).not.toBeVisible();
});
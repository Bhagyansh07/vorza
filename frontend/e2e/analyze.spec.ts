import { test, expect } from '@playwright/test';

import { seedSession } from './helpers';

/**
 * Analyze-from-scratch flow for a repo whose last attempt failed.
 *
 * 1. The detail page reports the failure ("The last analysis didn't complete")
 *    and the graph area sits on "Map unavailable".
 * 2. "Analyze now" queues the job (202) and toasts "Analysis queued".
 * 3. The spec completes the job through the server's control endpoint; the
 *    WebSocket gateway twin broadcasts `snapshot:updated` and the graph
 *    header flips to the new map without a reload.
 * 4. The graph's retry refetches the now-existing snapshot and the canvas
 *    renders the force-directed nodes.
 */
test('failed analysis can be re-queued and the live map appears', async ({
  page,
  request,
}) => {
  await seedSession(page);

  await page.goto('/repos/r_analyze');

  // The repo row carries the failed-analysis reason; the graph is unavailable.
  await expect(page.getByText(/The last analysis didn't complete/)).toBeVisible();
  await expect(page.getByText('Map unavailable')).toBeVisible();

  await page.getByRole('button', { name: 'Analyze now' }).click();
  await expect(page.getByText('Analysis queued')).toBeVisible();

  // Complete the job from the test side: the server stores the snapshot and
  // broadcasts snapshot:updated (replayed to late sockets, so ordering is
  // deterministic).
  const done = await request.post('/e2e/analyze/r_analyze');
  expect(done.status()).toBe(200);

  // The graph header reacts to the realtime event while the canvas still
  // shows the pre-refetch state.
  await expect(page.getByText(/· 4 files/)).toBeVisible();

  // Retry now refetches the snapshot over REST and the canvas renders. Both
  // the repo error card and the graph error state carry a "Try again";
  // the graph's one is last in DOM order.
  await page.getByRole('button', { name: 'Try again' }).last().click();
  await expect(page.getByRole('group', { name: 'Graph view' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fit map' })).toBeVisible();
  await expect(page.locator('[data-node-id]').first()).toBeVisible();
});
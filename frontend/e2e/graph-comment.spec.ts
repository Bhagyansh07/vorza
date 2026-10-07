import { test, expect } from '@playwright/test';

import { seedSession, unique } from './helpers';

/**
 * The map + comment pinning flow on a repo that already has a snapshot.
 *
 * Comment pins and the composer live inside an `aria-hidden` overlay (GraphView
 * wraps CommentLayer in one so the canvas does not clutter the accessibility
 * tree), so they are located by CSS attribute, never by role/name.
 *
 * Selects the file through the keyboard-accessible list view (W5/R8), drops a
 * comment pin from the file side panel, switches to the map, and verifies the
 * new pin rendered from the server's 201 response plus the seeded pin that
 * came from the envelope on load.
 */
test('graph renders, seeded pin is visible, and a new pin can be posted', async ({
  page,
}) => {
  await seedSession(page);

  await page.goto('/repos/r_1');

  // Map view is live: toggle group, canvas nodes, the seeded comment pin.
  await expect(page.getByRole('group', { name: 'Graph view' })).toBeVisible();
  await expect(page.locator('[data-node-id]').first()).toBeVisible();
  await expect(page.getByText(/· 4 files/)).toBeVisible();
  await expect(
    page.locator('[data-comment-pin][aria-label*="E2E seed comment on engine"]')
  ).toBeVisible();

  // Pick the file from the list view and start a comment pin on it.
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page
    .getByRole('button', { name: 'src/core/engine.ts', exact: true })
    .click();
  await page.getByRole('button', { name: 'Drop a comment pin' }).click();

  // The composer only renders in the map overlay; flip back and write the note.
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  const body = unique('E2E pin');
  await page.getByPlaceholder(/Leave a note/).fill(body);
  await page.getByText('Post', { exact: true }).click();

  // The new pin comes from the server row (author "You"), not an optimistic
  // stub, so its label is only complete after the POST resolves.
  const newPin = page.locator(`[data-comment-pin][aria-label*="${body}"]`);
  await expect(newPin).toBeVisible();

  // Open it to show the note body rendered from the stored comment.
  await newPin.click();
  await expect(page.getByText(body).first()).toBeVisible();
});
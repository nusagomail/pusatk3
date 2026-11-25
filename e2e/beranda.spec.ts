import { expect, test, type Page } from '@playwright/test';

/**
 * Collects console errors and uncaught exceptions (incl. CSP violations) on a page.
 * Chrome also logs the main document's own 404 status as an error; that one is expected on the
 * 404 page and is checked through the response status instead. Failing assets still count.
 */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const isOwnDocumentStatus =
      message.text().startsWith('Failed to load resource') && message.location().url === page.url();
    if (!isOwnDocumentStatus) errors.push(`console: ${message.text()} (${message.location().url})`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test('home page shows without login and without console errors', async ({ page }) => {
  const errors = collectErrors(page);
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  // Public page: no redirect to a login page.
  expect(new URL(page.url()).pathname).toBe('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('pelatihan & sertifikasi K3');
  // Sample schedules are always labelled (owner decision, #5).
  await expect(page.getByText('Contoh tampilan').first()).toBeVisible();

  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});

test('builds outside production are not indexable', async ({ request }) => {
  const response = await request.get('/');
  expect(response.headers()['x-robots-tag']).toMatch(/noindex/);
});

test('unknown paths get the 404 page', async ({ page }) => {
  const errors = collectErrors(page);
  const response = await page.goto('/halaman-yang-tidak-ada');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Halaman tidak ditemukan');
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});

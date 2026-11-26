import { expect, test, type Page } from '@playwright/test';

/**
 * Collects console errors and uncaught exceptions (incl. CSP violations) on a page.
 * Chrome also logs the main document's own error status (e.g. 404) as a console error; pass
 * `allowOwnStatus` only where that status is the point of the test (it is checked through the
 * response instead). Failing assets always count.
 */
function collectErrors(page: Page, options: { allowOwnStatus?: boolean } = {}): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const isOwnDocumentStatus =
      message.text().startsWith('Failed to load resource') && message.location().url === page.url();
    if (options.allowOwnStatus && isOwnDocumentStatus) return;
    errors.push(`console: ${message.text()} (${message.location().url})`);
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
  // Upcoming schedules come from the API (#25); sample data is always labelled "Contoh".
  const upcoming = page.locator('#jadwal article.result-card');
  await expect(upcoming.first()).toBeVisible();
  expect(await upcoming.count()).toBeLessThanOrEqual(4);
  await expect(upcoming.first().getByText('Contoh', { exact: true })).toBeVisible();
  // Cities in the search form come from GET /cities.
  await expect(page.locator('#hero-city option[value="bekasi"]')).toHaveCount(1);
  // SSR page: cacheable when complete, with the CSP meta and frame-ancestors header.
  expect(response?.headers()['cache-control']).toMatch(/^public, .*s-maxage=300/);
  expect(response?.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(response?.headers()['content-security-policy']).toContain('script-src');

  // CSP violations and script errors are reported before the load event.
  await page.waitForLoadState('load');
  expect(errors).toEqual([]);
});

test('builds outside production are not indexable', async ({ request }) => {
  const response = await request.get('/');
  expect(response.headers()['x-robots-tag']).toMatch(/noindex/);
});

test('unknown paths get the 404 page', async ({ page }) => {
  const errors = collectErrors(page, { allowOwnStatus: true });
  const response = await page.goto('/halaman-yang-tidak-ada');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Halaman tidak ditemukan');
  await page.waitForLoadState('load');
  expect(errors).toEqual([]);
});

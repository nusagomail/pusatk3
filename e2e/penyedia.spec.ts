import { expect, test, type Page } from '@playwright/test';

// /penyedia/[slug] from the local API (HTTP via API_ORIGIN) with the Jabodetabek sample data.

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (
      message.text().startsWith('Failed to load resource') &&
      message.location().url === page.url()
    )
      return;
    errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test('provider profile shows schedules, legality and branches, labelled as sample', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const response = await page.goto('/penyedia/contoh-mitra-k3-jakarta');
  expect(response?.status()).toBe(200);
  expect(response?.headers()['x-robots-tag']).toMatch(/noindex/);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mitra K3 Jakarta (Contoh)');
  await expect(page.getByText('Contoh — data fiktif')).toBeVisible();
  await expect(page.getByText('Terverifikasi')).toHaveCount(0);
  await expect(page.locator('#jadwal article.result-card').first()).toBeVisible();
  await expect(page.getByText('Izin PJK3')).toBeVisible();
  await expect(page.locator('#cabang li')).toHaveCount(2);
  await expect(page.locator('#cabang li').first()).toContainText('Kantor pusat');

  const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(jsonLd.map((text) => (JSON.parse(text) as { '@type': string })['@type'])).toEqual([
    'BreadcrumbList',
  ]);

  await page.waitForLoadState('load');
  expect(errors).toEqual([]);
});

test('provider links from a schedule card open the profile', async ({ page }) => {
  await page.goto('/cari');
  await page.locator('.result-card__provider a').first().click();
  await expect(page).toHaveURL(/\/penyedia\/contoh-/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('(Contoh)');
});

test('unknown and malformed slugs get a 404 page', async ({ page }) => {
  for (const path of ['/penyedia/tidak-ada', '/penyedia/Bukan%20Slug']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Penyedia tidak ditemukan');
  }
});

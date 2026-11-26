import { expect, test, type Page } from '@playwright/test';

// /cari renders on demand from the local API (service binding) with the Jabodetabek sample data
// imported by `pnpm test:e2e` (pnpm db:import:local).

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test('search page lists sample schedules from the API, labelled "Contoh"', async ({ page }) => {
  const errors = collectErrors(page);
  const response = await page.goto('/cari');
  expect(response?.status()).toBe(200);
  expect(response?.headers()['x-robots-tag']).toMatch(/noindex/);
  expect(response?.headers()['cache-control']).toMatch(/s-maxage=/);
  expect(response?.headers()['x-frame-options']).toBe('DENY');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pelatihan K3');
  const cards = page.locator('article.result-card');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(0);
  await expect(cards.first().getByText('Contoh', { exact: true })).toBeVisible();
  await expect(cards.first().getByRole('link').first()).toHaveAttribute(
    'href',
    /^\/jadwal\/[0-9A-Z]{26}$/,
  );
  await expect(page.getByRole('heading', { name: 'Cara kami mengurutkan hasil' })).toBeVisible();

  await page.waitForLoadState('load');
  expect(errors).toEqual([]);
});

test('filters by city through the form (no JavaScript needed)', async ({ page }) => {
  await page.goto('/cari');
  await page.getByLabel('Kota').selectOption('bekasi');
  await page.getByRole('button', { name: 'Terapkan filter' }).click();
  await expect(page).toHaveURL(/[?&]city=bekasi/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pelatihan K3 di Bekasi');
  const places = await page.locator('.result-card__meta').allTextContents();
  expect(places.length).toBeGreaterThan(0);
  for (const place of places) expect(place).toContain('Bekasi');
});

test('ignores unknown parameters such as utm_*', async ({ page }) => {
  const response = await page.goto('/cari?utm_source=wa&fbclid=x');
  expect(response?.status()).toBe(200);
});

test('explains invalid filters instead of failing', async ({ page }) => {
  const response = await page.goto('/cari?priceMin=9000000&priceMax=1');
  expect(response?.status()).toBe(400);
  await expect(page.getByRole('alert')).toContainText('tidak valid');
});

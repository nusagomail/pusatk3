import { expect, test, type Page } from '@playwright/test';

// /jadwal/[id] from the local API (HTTP via API_ORIGIN) with the Jabodetabek sample data.

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    // The 404 test expects its own document status.
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

async function openFirstSchedule(page: Page) {
  await page.goto('/cari');
  const link = page.locator('article.result-card h3 a').first();
  const href = await link.getAttribute('href');
  return page.goto(href as string);
}

test('schedule detail shows facts, legality and contact, labelled as sample', async ({ page }) => {
  const errors = collectErrors(page);
  const response = await openFirstSchedule(page);
  expect(response?.status()).toBe(200);
  expect(response?.headers()['x-robots-tag']).toMatch(/noindex/);

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Contoh — data fiktif')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Legalitas penyedia' })).toBeVisible();
  await expect(page.getByText(/belum diverifikasi/)).toBeVisible();
  await expect(page.getByText(/tidak memproses pendaftaran maupun pembayaran/)).toBeVisible();
  await expect(page.getByText(/data contoh fiktif/)).toBeVisible();

  const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
  const types = jsonLd.map((text) => (JSON.parse(text) as { '@type': string })['@type']);
  expect(types).toEqual(expect.arrayContaining(['Course', 'BreadcrumbList']));

  await page.waitForLoadState('load');
  expect(errors).toEqual([]);
});

test('unknown and malformed ids get a 404 page', async ({ page }) => {
  const errors = collectErrors(page);
  for (const path of ['/jadwal/01JAAAAAAAAAAAAAAAAAAAAAAA', '/jadwal/bukan-id']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jadwal tidak ditemukan');
  }
  expect(errors).toEqual([]);
});

test('phones get a bottom action bar', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await openFirstSchedule(page);
  await expect(page.getByRole('link', { name: 'Tanya' })).toBeVisible();
  await context.close();
});

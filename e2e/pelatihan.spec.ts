import { expect, test, type Page } from '@playwright/test';

// SEO page "Pelatihan X di Kota" (#27, ADR 0023) against the sample data: Operator Forklift ×
// Bekasi passes the thin-content rule (3 schedules, 2 providers); other combinations do not.

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test('a published SEO page answers first, lists schedules and providers, sample is noindex', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const response = await page.goto('/pelatihan/operator-forklift/bekasi');
  expect(response?.status()).toBe(200);
  expect(response?.headers()['cache-control']).toMatch(/s-maxage=/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /^Pelatihan Operator Forklift .* di Bekasi$/,
  );
  await expect(page.locator('.landing__answer')).toContainText('Ada 3 jadwal');
  await expect(page.locator('.landing__answer')).toContainText('dari 2 penyedia');
  await expect(page.locator('table.landing__table tbody tr')).toHaveCount(3);
  await expect(page.getByText('Contoh — data fiktif untuk uji coba')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  // Sample data: breadcrumb structured data only, and it parses.
  const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
  const types = jsonLd.map((text) => (JSON.parse(text) as { '@type': string })['@type']);
  expect(types).toEqual(['BreadcrumbList']);

  await page.waitForLoadState('load');
  expect(errors).toEqual([]);
});

for (const [name, path] of [
  ['a thin combination', '/pelatihan/ahli-k3-listrik/jakarta'],
  ['an unknown category', '/pelatihan/tidak-ada/bekasi'],
  ['an invalid slug', '/pelatihan/Bad_Slug/bekasi'],
] as const) {
  test(`${name} answers 404 and is not indexed`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Halaman belum tersedia');
  });
}

test('the sitemap is served and never lists sample data', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/application\/xml/);
  const xml = await res.text();
  expect(xml).toContain('<urlset');
  expect(xml).not.toMatch(/contoh-|\/pelatihan\//);
});

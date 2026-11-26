import { expect, test, type APIRequestContext } from '@playwright/test';
import { API_URL, WEB_URL } from './urls';

// Lead routes of the web app (#28, ADR 0022) against the local API and the sample data. Sample
// providers are unclaimed and have no WhatsApp: the form never shows and the API refuses them.

async function sampleScheduleId(request: APIRequestContext) {
  const body = (await (await request.get(`${API_URL}/api/v1/search?limit=1`)).json()) as {
    items: { id: string }[];
  };
  const id = body.items[0]?.id;
  if (!id) throw new Error('no sample schedule');
  return id;
}

test('the WhatsApp click beacon always answers 204 without content', async ({ request }) => {
  const res = await request.post('/kontak/klik-wa', {
    data: { providerSlug: 'contoh-mitra-k3-jakarta' },
  });
  expect(res.status()).toBe(204);
  expect(await res.text()).toBe('');
});

test('no question form for an unclaimed provider (nobody would read it)', async ({ page }) => {
  await page.goto(`/jadwal/${await sampleScheduleId(page.request)}`);
  await expect(page.locator('form.question')).toHaveCount(0);
  await expect(page.locator('script[src*="challenges.cloudflare.com"]')).toHaveCount(0);
});

test('a question for an unclaimed provider is refused and nothing is cached', async ({
  request,
}) => {
  const res = await request.post('/kontak/pertanyaan', {
    headers: { Origin: WEB_URL },
    form: {
      scheduleId: await sampleScheduleId(request),
      name: 'Budi',
      phone: '081234567890',
      message: 'Apakah masih ada kuota?',
      consent: 'on',
      'cf-turnstile-response': 'XXXX.DUMMY.TOKEN.XXXX',
    },
  });
  expect(res.status()).toBe(404);
  expect(res.headers()['cache-control']).toBe('no-store');
  expect(await res.text()).toContain('tidak lagi menerima pertanyaan');
});

test('a cross-site form post is refused (origin check)', async ({ request }) => {
  const res = await request.post('/kontak/pertanyaan', {
    headers: { Origin: 'https://evil.example' },
    form: { scheduleId: 'x' },
  });
  expect(res.status()).toBe(403);
});

test('opening the question page directly goes to the search page', async ({ page }) => {
  await page.goto('/kontak/pertanyaan');
  await expect(page).toHaveURL(/\/cari$/);
});

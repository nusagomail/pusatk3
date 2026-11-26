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

// e2e/fixtures.sql: the sample TUK Tangerang has a (fictional) WhatsApp number and claimed its
// profile, so its schedule page shows both the tracked WhatsApp button and the question form.
async function tangerangScheduleId(request: APIRequestContext) {
  const res = await request.get(`${API_URL}/api/v1/providers/contoh-tuk-k3-tangerang`);
  const body = (await res.json()) as { schedules: { id: string }[] };
  const id = body.schedules[0]?.id;
  if (!id) throw new Error('fixture provider has no schedule');
  return id;
}

test('a WhatsApp click opens wa.me and sends the lead beacon (no personal data)', async ({
  page,
}) => {
  const id = await tangerangScheduleId(page.request);
  await page.goto(`/jadwal/${id}`);
  const button = page.locator('aside a.wa[data-lead]');
  await expect(button).toHaveAttribute('href', /^https:\/\/wa\.me\/6281200000000/);
  // wa.me itself is never loaded in tests.
  await page.context().route('https://wa.me/**', (route) => route.abort());
  const beacon = page.waitForRequest('**/kontak/klik-wa');
  await button.click();
  const request = await beacon;
  expect(request.method()).toBe('POST');
  expect(JSON.parse(request.postData() ?? '{}')).toEqual({ scheduleId: id });
});

test('the question form shows for a claimed provider, with Turnstile allowed on that page only', async ({
  request,
}) => {
  const res = await request.get(`/jadwal/${await tangerangScheduleId(request)}`);
  const html = await res.text();
  expect(html).toContain('class="question');
  expect(html).toContain('data-action="lead-form"');
  const csp = res.headers()['content-security-policy'] ?? '';
  expect(csp).toMatch(/script-src 'self' https:\/\/challenges\.cloudflare\.com/);
  expect(csp).toContain('frame-src https://challenges.cloudflare.com');

  const other = await request.get(`/jadwal/${await sampleScheduleId(request)}`);
  expect(other.headers()['content-security-policy']).not.toContain('challenges.cloudflare.com');
});

test('the API stores a WhatsApp click for the fixture provider (202, not a hidden 500)', async ({
  request,
}) => {
  const res = await request.post(`${API_URL}/api/v1/leads/whatsapp`, {
    data: { scheduleId: await tangerangScheduleId(request) },
  });
  expect(res.status()).toBe(202);
});

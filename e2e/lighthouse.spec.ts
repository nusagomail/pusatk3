import { chromium, expect, test, type APIRequestContext } from '@playwright/test';
import lighthouse from 'lighthouse';
import { API_URL, WEB_URL } from './urls';

// Lighthouse ≥ 90 in performance, accessibility, best practices and SEO on the public pages
// (#41, roadmap Fase 1), mobile preset (Lighthouse default: slow 4G, mid-range phone simulated).
// `is-crawlable` is skipped: every non-production build is noindex on purpose (ADR 0011).
const MIN_SCORE = 0.9;
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'] as const;
const DEBUG_PORT = 9333;

test.describe.configure({ mode: 'serial', timeout: 180_000 });

async function samplePaths(request: APIRequestContext): Promise<string[]> {
  const body = (await (await request.get(`${API_URL}/api/v1/search?limit=1`)).json()) as {
    items: { id: string; provider: { slug: string } }[];
  };
  const first = body.items[0];
  if (!first) throw new Error('no sample schedule');
  return ['/', '/cari?q=forklift', `/jadwal/${first.id}`, `/penyedia/${first.provider.slug}`];
}

test('public pages score at least 90 in every Lighthouse category', async ({ request }) => {
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${DEBUG_PORT}`] });
  const failures: string[] = [];
  try {
    for (const path of await samplePaths(request)) {
      const result = await lighthouse(`${WEB_URL}${path}`, {
        port: DEBUG_PORT,
        output: 'json',
        logLevel: 'error',
        onlyCategories: [...CATEGORIES],
        skipAudits: ['is-crawlable'],
      });
      const categories = result?.lhr.categories ?? {};
      for (const name of CATEGORIES) {
        const score = categories[name]?.score ?? 0;
        if (score < MIN_SCORE) failures.push(`${path} ${name}: ${Math.round(score * 100)}`);
      }
    }
  } finally {
    await browser.close();
  }
  expect(failures, 'Lighthouse scores below 90').toEqual([]);
});

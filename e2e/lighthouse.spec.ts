import { createServer } from 'node:net';
import { chromium, expect, test, type APIRequestContext } from '@playwright/test';
import lighthouse from 'lighthouse';
import { API_URL, WEB_URL } from './urls';

// Lighthouse ≥ 90 in performance, accessibility, best practices and SEO on the public pages
// (#41, roadmap Fase 1), mobile preset (Lighthouse default: slow 4G, mid-range phone simulated).
// `is-crawlable` is skipped: every non-production build is noindex on purpose (ADR 0011).
// Error reporting (Sentry) stays off: `flags.enableErrorReporting` is never set.
const MIN_SCORE = 0.9;
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'] as const;

test.describe.configure({ mode: 'serial', timeout: 180_000 });

/** A free local port, so a developer's own Chrome on a fixed port is never audited by mistake. */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address
          ? resolve(address.port)
          : reject(new Error('no port')),
      );
    });
  });
}

async function samplePaths(request: APIRequestContext): Promise<string[]> {
  const body = (await (await request.get(`${API_URL}/api/v1/search?limit=1`)).json()) as {
    items: { id: string; provider: { slug: string } }[];
  };
  const first = body.items[0];
  if (!first) throw new Error('no sample schedule');
  return ['/', '/cari?q=forklift', `/jadwal/${first.id}`, `/penyedia/${first.provider.slug}`];
}

test('public pages score at least 90 in every Lighthouse category', async ({ request }) => {
  const port = await freePort();
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] });
  const failures: string[] = [];
  try {
    for (const path of await samplePaths(request)) {
      const result = await lighthouse(`${WEB_URL}${path}`, {
        port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: [...CATEGORIES],
        skipAudits: ['is-crawlable'],
      });
      const lhr = result?.lhr;
      const scores = CATEGORIES.map((name) => [name, lhr?.categories[name]?.score ?? 0] as const);
      // Every score is logged on every run, so a downward trend is visible before it fails.
      const summary = scores
        .map(([name, score]) => `${name} ${Math.round(score * 100)}`)
        .join(', ');
      const cause = [lhr?.runtimeError?.code, ...(lhr?.runWarnings ?? [])]
        .filter(Boolean)
        .join('; ');
      const line = `${path}: ${summary} (benchmarkIndex ${lhr?.environment.benchmarkIndex ?? '?'})${cause ? ` — ${cause}` : ''}`;
      test.info().annotations.push({ type: 'lighthouse', description: line });
      console.log(`[lighthouse] ${line}`);
      if (scores.some(([, score]) => score < MIN_SCORE)) failures.push(line);
    }
  } finally {
    await browser.close();
  }
  expect(failures, 'Lighthouse scores below 90').toEqual([]);
});

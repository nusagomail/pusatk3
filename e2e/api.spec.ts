import { expect, test } from '@playwright/test';
import { API_URL } from './urls';

test('GET /api/v1/health answers ok without login', async ({ request }) => {
  const response = await request.get(`${API_URL}/api/v1/health`);
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  const body = (await response.json()) as { status: string; version: string };
  expect(body.status).toBe('ok');
  expect(body.version).toBeTruthy();
});

test('the deployed API serves repeated public reads from the edge cache (ADR 0021)', async ({
  request,
}) => {
  const url = `${API_URL}/api/v1/search?q=ak3u&limit=7`;
  const first = await request.get(url);
  expect(first.headers()['x-cache']).toBe('MISS');
  const second = await request.get(url);
  expect(second.headers()['x-cache']).toBe('HIT');
  expect(await second.text()).toBe(await first.text());
  const version = await request.get(`${API_URL}/api/v1/meta/data-version`);
  expect(version.headers()['cache-control']).toBe('no-store');
});

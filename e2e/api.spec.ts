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

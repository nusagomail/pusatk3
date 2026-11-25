import { healthResponseSchema } from '@pusatk3/shared';
import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('GET /api/v1/health', () => {
  it('returns ok with the configured version', async () => {
    const res = await SELF.fetch('https://api.test/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^application\/json/);
    const body = healthResponseSchema.parse(await res.json());
    expect(body).toEqual({ status: 'ok', version: 'dev' });
  });

  it('is never cached', async () => {
    const res = await SELF.fetch('https://api.test/api/v1/health');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('is not served outside /api/v1', async () => {
    expect((await SELF.fetch('https://api.test/health')).status).toBe(404);
  });
});

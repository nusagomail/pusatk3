import { describe, expect, it, vi } from 'vitest';
import { apiGetWith } from '../src/lib/api-client';

const schema = {
  safeParse: (value: unknown) =>
    typeof value === 'object' && value !== null && 'ok' in value
      ? ({ success: true, data: value as { ok: boolean } } as const)
      : ({ success: false } as const),
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('apiGetWith', () => {
  it('uses the service binding when deployed, never the HTTP origin', async () => {
    const binding = { fetch: vi.fn(async (_request: Request) => json({ ok: true })) };
    const fetchImpl = vi.fn();
    const result = await apiGetWith(
      { API: binding, API_ORIGIN: 'http://127.0.0.1:8787' },
      '/search?q=a',
      schema,
      fetchImpl,
    );
    expect(result).toEqual({ ok: true, data: { ok: true } });
    expect(new URL(binding.fetch.mock.calls[0]?.[0].url ?? '').pathname).toBe('/api/v1/search');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('uses HTTP to API_ORIGIN locally', async () => {
    const fetchImpl = vi.fn(async (_request: Request) => json({ ok: true }));
    await apiGetWith(
      { API_ORIGIN: 'http://127.0.0.1:8787' },
      '/cities',
      schema,
      fetchImpl as unknown as typeof fetch,
    );
    expect(fetchImpl.mock.calls[0]?.[0].url).toBe('http://127.0.0.1:8787/api/v1/cities');
  });

  it.each([
    ['no route to the API', {}, undefined, 503],
    ['an API error status', { API_ORIGIN: 'http://x' }, async () => json({}, 422), 422],
    ['an unexpected body', { API_ORIGIN: 'http://x' }, async () => json({ nope: 1 }), 502],
    [
      'a network error',
      { API_ORIGIN: 'http://x' },
      async () => {
        throw new Error('down');
      },
      503,
    ],
  ])('never throws on %s', async (_name, runtime, impl, status) => {
    const result = await apiGetWith(runtime, '/cities', schema, (impl ?? vi.fn()) as typeof fetch);
    expect(result).toEqual({ ok: false, status });
  });
});

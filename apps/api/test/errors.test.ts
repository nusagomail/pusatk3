import { paginationQuerySchema } from '@pusatk3/shared';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { AppError } from '../src/lib/errors';
import { validateJson, validateQuery } from '../src/lib/validate';
import { call, expectApiError } from './helpers';

const app = createApp({
  extend: (v1) => {
    v1.get('/test/boom', () => {
      throw new Error('D1_ERROR: SELECT * FROM users WHERE email = "a@b.c"');
    });
    v1.get('/test/boom-string', () => {
      throw 'not an Error';
    });
    v1.get('/test/forbidden', () => {
      throw new AppError('FORBIDDEN', 'Tidak boleh.');
    });
    v1.post(
      '/test/echo',
      validateJson(z.strictObject({ name: z.string().min(1), phone: z.string().min(8) })),
      (c) => c.json(c.req.valid('json')),
    );
    v1.get('/test/items', validateQuery(paginationQuerySchema), (c) =>
      c.json(c.req.valid('query')),
    );
    v1.patch('/test/optional', validateJson(z.strictObject({ name: z.string().optional() })), (c) =>
      c.json(c.req.valid('json')),
    );
    v1.post(
      '/test/record',
      validateJson(z.strictObject({ tags: z.record(z.string(), z.number()) })),
      (c) => c.json(c.req.valid('json')),
    );
    v1.post('/test/many', validateJson(z.strictObject({ items: z.array(z.number()) })), (c) =>
      c.json(c.req.valid('json')),
    );
    v1.get('/test/tags', validateQuery(z.strictObject({ tag: z.string().optional() })), (c) =>
      c.json(c.req.valid('query')),
    );
    v1.get('/test/http/:status', (c) => {
      throw new HTTPException(Number(c.req.param('status')) as 400, { message: 'internal detail' });
    });
    v1.get('/test/app-error-fields', () => {
      throw new AppError('FORBIDDEN', 'x', [{ path: 'a', message: 'b' }]);
    });
  },
});

const json = (body: string) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body,
});

afterEach(() => vi.restoreAllMocks());

describe('not found', () => {
  it.each(['/api/v1/nope', '/nope', '/'])('%s → 404 NOT_FOUND', async (path) => {
    await expectApiError(await call(app, path), 404, 'NOT_FOUND');
  });

  it('wrong method on an existing path → 404 JSON', async () => {
    await expectApiError(await call(app, '/api/v1/health', { method: 'POST' }), 404, 'NOT_FOUND');
  });
});

describe('unexpected errors', () => {
  it('→ 500 without leaking internals, logging only request id and error name', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call(app, '/api/v1/test/boom');
    const body = await expectApiError(res, 500, 'INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toMatch(/D1_ERROR|SELECT|a@b\.c/);
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toMatch(/SELECT|a@b\.c/);
    expect(logged).toContain(res.headers.get('x-request-id'));
  });

  it('non-Error throws → 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expectApiError(await call(app, '/api/v1/test/boom-string'), 500, 'INTERNAL_ERROR');
  });
});

describe('AppError', () => {
  it('maps to its code and HTTP status', async () => {
    const body = await expectApiError(await call(app, '/api/v1/test/forbidden'), 403, 'FORBIDDEN');
    expect(body.error.message).toBe('Tidak boleh.');
  });
});

describe('validateJson', () => {
  it('passes valid input to the handler', async () => {
    const res = await call(app, '/api/v1/test/echo', json('{"name":"Ani","phone":"08123456789"}'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: 'Ani', phone: '08123456789' });
  });

  it('malformed JSON → 400 BAD_REQUEST', async () => {
    await expectApiError(
      await call(app, '/api/v1/test/echo', json('{"name":')),
      400,
      'BAD_REQUEST',
    );
  });

  it('invalid fields → 422 with per-field errors', async () => {
    const res = await call(app, '/api/v1/test/echo', json('{"name":"","phone":"1"}'));
    const body = await expectApiError(res, 422, 'VALIDATION_ERROR');
    expect(body.error.fields?.map((f) => f.path).sort()).toEqual(['name', 'phone']);
  });

  it('unknown fields → 422', async () => {
    const res = await call(
      app,
      '/api/v1/test/echo',
      json('{"name":"Ani","phone":"08123456789","isAdmin":true}'),
    );
    await expectApiError(res, 422, 'VALIDATION_ERROR');
  });

  it('non-object body (array) → 422 without fields for the root', async () => {
    const body = await expectApiError(
      await call(app, '/api/v1/test/echo', json('[]')),
      422,
      'VALIDATION_ERROR',
    );
    expect(body.error.fields).toBeUndefined();
  });

  it.each([
    ['no content-type', undefined],
    ['text/plain (CORS simple request)', 'text/plain'],
    ['form', 'application/x-www-form-urlencoded'],
  ])('%s → 415 even when every field is optional', async (_name, type) => {
    const res = await call(app, '/api/v1/test/optional', {
      method: 'PATCH',
      headers: type ? { 'content-type': type } : {},
      body: '{"name":"Ani"}',
    });
    await expectApiError(res, 415, 'UNSUPPORTED_MEDIA_TYPE');
  });

  it('accepts application/json with charset', async () => {
    const res = await call(app, '/api/v1/test/optional', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: '{"name":"Ani"}',
    });
    expect(res.status).toBe(200);
  });

  it('never emits fields with an empty path', async () => {
    const res = await call(app, '/api/v1/test/record', json('{"tags":{"":"x"}}'));
    const body = await expectApiError(res, 422, 'VALIDATION_ERROR');
    for (const field of body.error.fields ?? []) expect(field.path).not.toBe('');
  });

  it('caps the number of field errors at 50', async () => {
    const items = JSON.stringify({ items: Array.from({ length: 500 }, () => 'x') });
    const body = await expectApiError(
      await call(app, '/api/v1/test/many', json(items)),
      422,
      'VALIDATION_ERROR',
    );
    expect(body.error.fields?.length).toBe(50);
  });
});

describe('validateQuery', () => {
  it('applies schema defaults', async () => {
    const res = await call(app, '/api/v1/test/items');
    expect(await res.json()).toEqual({ limit: 20 });
  });

  it('rejects repeated query keys (arrive as arrays) with 422', async () => {
    await expectApiError(await call(app, '/api/v1/test/tags?tag=a&tag=b'), 422, 'VALIDATION_ERROR');
  });

  it('rejects bad and unknown query parameters with 422', async () => {
    await expectApiError(await call(app, '/api/v1/test/items?limit=020'), 422, 'VALIDATION_ERROR');
    await expectApiError(
      await call(app, '/api/v1/test/items?utm_source=x'),
      422,
      'VALIDATION_ERROR',
    );
  });
});

describe('HTTPException mapping', () => {
  it.each([
    [400, 'BAD_REQUEST'],
    [401, 'UNAUTHORIZED'],
    [405, 'BAD_REQUEST'],
    [413, 'PAYLOAD_TOO_LARGE'],
    [415, 'UNSUPPORTED_MEDIA_TYPE'],
    [418, 'BAD_REQUEST'],
  ] as const)('%i → %s (4xx is never a 500)', async (status, code) => {
    const res = await call(app, `/api/v1/test/http/${status}`);
    const expected = code === 'BAD_REQUEST' ? 400 : status;
    const body = await expectApiError(res, expected, code);
    expect(body.error.message).not.toContain('internal detail');
  });

  it('5xx → 500 INTERNAL_ERROR', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expectApiError(await call(app, '/api/v1/test/http/503'), 500, 'INTERNAL_ERROR');
  });
});

describe('error responses', () => {
  it('are never cached', async () => {
    expect((await call(app, '/api/v1/nope')).headers.get('cache-control')).toBe('no-store');
  });

  it('drop fields unless the code is VALIDATION_ERROR', async () => {
    const body = await expectApiError(
      await call(app, '/api/v1/test/app-error-fields'),
      403,
      'FORBIDDEN',
    );
    expect(body.error.fields).toBeUndefined();
  });
});

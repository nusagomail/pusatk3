import { paginationQuerySchema } from '@pusatk3/shared';
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

  it('missing JSON content-type → 422 or 400, never 200', async () => {
    const res = await call(app, '/api/v1/test/echo', { method: 'POST', body: '{"name":"Ani"}' });
    expect([400, 422]).toContain(res.status);
  });
});

describe('validateQuery', () => {
  it('applies schema defaults', async () => {
    const res = await call(app, '/api/v1/test/items');
    expect(await res.json()).toEqual({ limit: 20 });
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

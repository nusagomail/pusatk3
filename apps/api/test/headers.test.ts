import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { call } from './helpers';

const app = createApp({
  extend: (v1) => {
    v1.get('/test/boom', () => {
      throw new Error('boom');
    });
    v1.get('/test/raw', () => new Response('raw'));
    v1.get('/test/redirect', () => Response.redirect('https://wa.me/620000', 302));
  },
});

const paths = {
  'success (health)': '/api/v1/health',
  'not found': '/api/v1/nope',
  'internal error': '/api/v1/test/boom',
  'raw Response from a handler': '/api/v1/test/raw',
  'immutable Response (redirect)': '/api/v1/test/redirect',
};

describe.each(Object.entries(paths))('security headers on %s', (_name, path) => {
  it('are present', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call(app, path);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('strict-transport-security')).toBe(
      'max-age=31536000; includeSubDomains',
    );
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('content-security-policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
    expect(res.headers.get('x-powered-by')).toBeNull();
    // JSON API: never indexed, in any environment.
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
    vi.restoreAllMocks();
  });

  it('carry a request id', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call(app, path);
    expect(res.headers.get('x-request-id')).toMatch(/^[\w-]{8,}$/);
    vi.restoreAllMocks();
  });
});

describe('request id', () => {
  it('is unique per request', async () => {
    const a = (await call(app, '/api/v1/health')).headers.get('x-request-id');
    const b = (await call(app, '/api/v1/health')).headers.get('x-request-id');
    expect(a).not.toBe(b);
  });

  it('ignores any incoming id (no spoofed log correlation or injection)', async () => {
    for (const incoming of ['abc-123', 'evil"},{"level":"admin']) {
      const res = await call(app, '/api/v1/health', { headers: { 'x-request-id': incoming } });
      expect(res.headers.get('x-request-id')).not.toBe(incoming);
      expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('keeps redirects working', async () => {
    const res = await call(app, '/api/v1/test/redirect');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://wa.me/620000');
  });
});

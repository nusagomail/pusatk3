import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { requireAdmin, requireProviderRole, requireUser } from '../src/middleware/auth';
import { call, expectApiError } from './helpers';

// Until auth exists (Fase 2) every guard must fail closed: 401, handler never runs.
const handler = vi.fn(() => new Response('secret'));
const resolveProviderId = vi.fn(async () => 'prov_1');

const app = createApp({
  extend: (v1) => {
    v1.get('/test/user', requireUser(), handler);
    v1.get('/test/provider', requireProviderRole(['owner', 'admin'], resolveProviderId), handler);
    v1.get('/test/admin', requireAdmin(['super_admin']), handler);
    v1.use('/test/prefix/*', requireUser());
    v1.all('/test/prefix/*', handler);
    v1.all('/test/any', requireUser(), handler);
  },
});

describe.each(['/api/v1/test/user', '/api/v1/test/provider', '/api/v1/test/admin'])(
  'guarded route %s',
  (path) => {
    it('rejects anonymous requests with 401 and never runs the handler', async () => {
      handler.mockClear();
      resolveProviderId.mockClear();
      await expectApiError(await call(app, path), 401, 'UNAUTHORIZED');
      expect(handler).not.toHaveBeenCalled();
      expect(resolveProviderId).not.toHaveBeenCalled();
    });

    it('ignores spoofed identity headers and cookies', async () => {
      handler.mockClear();
      const res = await call(app, path, {
        headers: {
          authorization: 'Bearer anything',
          cookie: 'session=forged',
          'x-user-id': 'usr_admin',
          'x-provider-id': 'prov_1',
          'x-role': 'super_admin',
        },
      });
      await expectApiError(res, 401, 'UNAUTHORIZED');
      expect(handler).not.toHaveBeenCalled();
    });
  },
);

describe.each([
  ['HEAD', '/api/v1/test/any'],
  ['POST', '/api/v1/test/any'],
  ['PATCH', '/api/v1/test/any'],
  ['DELETE', '/api/v1/test/any'],
  ['GET', '/api/v1/test/prefix/deep/path'],
  ['POST', '/api/v1/test/prefix/x'],
])('%s %s', (method, path) => {
  it('is rejected and never reaches the handler', async () => {
    handler.mockClear();
    const res = await call(app, path, { method });
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
});

it.each(['/api/v1/test/user/', '//api/v1/test/user', '/api/v1/test/%75ser'])(
  '%s never reaches the handler',
  async (path) => {
    handler.mockClear();
    const res = await call(app, path);
    expect([401, 404]).toContain(res.status);
    expect(handler).not.toHaveBeenCalled();
  },
);

describe('guard construction', () => {
  it('requires at least one role', () => {
    expect(() => requireProviderRole([], resolveProviderId)).toThrow();
    expect(() => requireAdmin([])).toThrow();
  });
});

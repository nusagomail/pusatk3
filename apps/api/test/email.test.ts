import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMAIL_FROM, loginCodeEmail, RESEND_URL, sendEmail } from '../src/lib/email';

// Transactional email (#47, ADR 0024).
afterEach(() => vi.restoreAllMocks());

const email = loginCodeEmail('budi@contoh.id', '123456');
const deployed = { ENVIRONMENT: 'staging' as const, RESEND_API_KEY: 're_test' };

describe('sendEmail', () => {
  it('sends through Resend with the key, plain text, from noreply@pusatk3.id', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ id: 'x' }));
    expect(await sendEmail(deployed, email, fetchImpl as unknown as typeof fetch)).toBe('sent');
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(RESEND_URL);
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer re_test');
    expect(JSON.parse(String(init?.body))).toEqual({
      from: EMAIL_FROM,
      to: ['budi@contoh.id'],
      subject: 'Kode masuk PusatK3: 123456',
      text: email.text,
    });
  });

  it('only writes to the local log in local development (never sends)', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const fetchImpl = vi.fn();
    const result = await sendEmail(
      { ENVIRONMENT: 'local' },
      email,
      fetchImpl as unknown as typeof fetch,
    );
    expect(result).toBe('logged');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(String(log.mock.calls[0]?.[0])).toContain('123456');
  });

  it.each([
    ['no key', { ENVIRONMENT: 'production' as const }],
    ['no ENVIRONMENT (treated as deployed)', {}],
  ])('is unavailable with %s, never silent', async (_name, env) => {
    const fetchImpl = vi.fn();
    expect(await sendEmail(env, email, fetchImpl as unknown as typeof fetch)).toBe('unavailable');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ['an error status', async () => new Response('x', { status: 422 })],
    [
      'a network error',
      async () => {
        throw new TypeError('down');
      },
    ],
  ])('reports %s as unavailable and logs no recipient or code', async (_name, impl) => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await sendEmail(deployed, email, vi.fn(impl) as unknown as typeof fetch);
    expect(result).toBe('unavailable');
    const logged = JSON.stringify(errors.mock.calls);
    expect(logged).not.toMatch(/budi|123456/);
  });

  it.each([
    ['a recipient with a header break', { ...email, to: 'a@b.id\r\nBcc: x@y.id' }],
    ['a subject with a header break', { ...email, subject: 'Hi\r\nBcc: x@y.id' }],
    ['not an address', { ...email, to: 'bukan-email' }],
  ])('refuses %s', async (_name, bad) => {
    await expect(sendEmail(deployed, bad, vi.fn() as unknown as typeof fetch)).rejects.toThrow();
  });
});

describe('loginCodeEmail', () => {
  it('says how long the code is valid and warns not to share it', () => {
    expect(email.text).toMatch(/10 menit/);
    expect(email.text).toMatch(/Jangan berikan kode ini/);
  });
});

import {
  directoryStatements,
  parseCategoriesCsv,
  parseDirectoryCsv,
  referenceStatements,
  SAMPLE_CITIES,
} from '@pusatk3/db';
import { leadAcceptedResponseSchema, searchResponseSchema } from '@pusatk3/shared';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { scheduled } from '../src/index';
import { anonymizeExpiredLeads, retentionCutoff } from '../src/lib/lead-retention';
import { rateLimitKey } from '../src/middleware/rate-limit';
import { SITEVERIFY_URL, TURNSTILE_TEST_SECRETS } from '../src/lib/turnstile';
import categoriesCsv from '../../../docs/data/kategori-k3.csv?raw';
import cabang from '../../../docs/data/contoh/cabang.csv?raw';
import jadwal from '../../../docs/data/contoh/jadwal.csv?raw';
import legalitas from '../../../docs/data/contoh/legalitas.csv?raw';
import penyedia from '../../../docs/data/contoh/penyedia.csv?raw';
import { call, expectApiError } from './helpers';

// Leads (#28, ADR 0022): public anonymous endpoints guarded by Zod, Turnstile, rate limits and
// visibility rules. Raw SQL here only prepares or inspects the database state under test.
const TODAY = Date.UTC(2026, 11, 1, 5, 0);
const CLAIMED = 'contoh-mitra-k3-jakarta';
const UNCLAIMED = 'contoh-pusat-pelatihan-k3-bekasi';
const run = (query: string) => env.DB.prepare(query).run();
const all = async <T>(query: string) => (await env.DB.prepare(query).all<T>()).results;

const app = createApp({ now: () => TODAY });
const post = (path: string, body: unknown, bindings: Cloudflare.Env = env, headers = {}) =>
  call(
    app,
    `/api/v1${path}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    },
    bindings,
  );

/** Fake Workers rate limiter: records keys, allows until `allow` turns false. */
function limiter(allow = true) {
  const keys: string[] = [];
  return {
    keys,
    binding: {
      limit: vi.fn(async ({ key }: { key: string }) => {
        keys.push(key);
        return { success: allow };
      }),
    } as unknown as RateLimit,
  };
}

let scheduleOf: (provider: string) => Promise<string>;

beforeEach(async () => {
  for (const table of ['leads', 'schedules', 'provider_licenses', 'branches', 'providers']) {
    await run(`DELETE FROM ${table}`);
  }
  const categories = parseCategoriesCsv(categoriesCsv);
  const { data } = parseDirectoryCsv(
    { penyedia, cabang, legalitas, jadwal },
    { categories: categories.categories, citySlugs: new Set(SAMPLE_CITIES.map((c) => c.slug)) },
  );
  await env.DB.batch(
    [
      ...referenceStatements({ ...categories, cities: SAMPLE_CITIES }),
      ...directoryStatements(data, { isSample: true }),
    ].map((s) => env.DB.prepare(s)),
  );
  await run(
    `UPDATE providers SET status = 'claimed', whatsapp = '6281234567890' WHERE slug = '${CLAIMED}'`,
  );
  scheduleOf = async (provider) => {
    const res = await call(app, `/api/v1/providers/${provider}`);
    const body = (await res.json()) as { schedules: { id: string }[] };
    const id = body.schedules[0]?.id;
    if (!id) throw new Error(`no schedule for ${provider}`);
    return id;
  };
});

afterEach(() => vi.restoreAllMocks());

const form = async (overrides: Record<string, unknown> = {}) => ({
  scheduleId: await scheduleOf(CLAIMED),
  name: 'Budi Santoso',
  phone: '0812-3456-7890',
  message: 'Apakah masih ada kuota untuk bulan depan?',
  consent: true,
  turnstileToken: 'token-dari-widget',
  ...overrides,
});

interface LeadRow {
  channel: string;
  provider_id: string;
  schedule_id: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  consent_at: number | null;
  consent_version: string | null;
  anonymized_at: number | null;
  status: string;
}
const leadRows = () => all<LeadRow>('SELECT * FROM leads ORDER BY created_at');

describe('POST /api/v1/leads (question form, public)', () => {
  it('stores a lead for a claimed provider and answers without echoing anything', async () => {
    const res = await post('/leads', await form());
    expect(res.status).toBe(201);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ status: 'received' });
    const [row] = await leadRows();
    expect(row).toMatchObject({
      channel: 'form',
      name: 'Budi Santoso',
      phone: '6281234567890',
      email: null,
      status: 'new',
      consent_at: TODAY,
      consent_version: '2026-11-26',
    });
    expect(leadAcceptedResponseSchema.safeParse({ status: 'received' }).success).toBe(true);
  });

  it('accepts an email instead of a phone number (trimmed, lower-cased)', async () => {
    const res = await post('/leads', await form({ phone: '', email: '  Budi@Contoh.ID ' }));
    expect(res.status).toBe(201);
    expect((await leadRows())[0]).toMatchObject({ phone: null, email: 'budi@contoh.id' });
  });

  it.each([
    ['an unclaimed provider (nobody reads it yet, UU PDP)', async () => scheduleOf(UNCLAIMED)],
    ['an unknown schedule', async () => '01ARZ3NDEKTSV4RRFFQ69G5FAV'],
  ])('refuses %s with 404 and stores nothing', async (_name, schedule) => {
    await expectApiError(
      await post('/leads', await form({ scheduleId: await schedule() })),
      404,
      'NOT_FOUND',
    );
    expect(await leadRows()).toEqual([]);
  });

  it.each([
    ['a draft schedule', `UPDATE schedules SET status = 'draft'`],
    ['a schedule that already started', `UPDATE schedules SET start_date = '2026-11-30'`],
    ['a closed provider', `UPDATE providers SET status = 'closed'`],
  ])('refuses %s with 404', async (_name, change) => {
    const body = await form();
    await run(change);
    await expectApiError(await post('/leads', body), 404, 'NOT_FOUND');
    expect(await leadRows()).toEqual([]);
  });

  it.each([
    ['no consent', { consent: false }],
    ['missing consent', { consent: undefined }],
    ['neither phone nor email', { phone: '', email: '' }],
    ['a non-Indonesian phone', { phone: '+1 555 0100' }],
    ['a bad email', { phone: '', email: 'bukan-email' }],
    ['a too short message', { message: 'Halo' }],
    ['a too long message', { message: 'x'.repeat(1001) }],
    ['a name with control characters', { name: 'Budi\u0000' }],
    ['a name with an invisible direction override', { name: 'Budi\u202e' }],
    ['a provider chosen by the client', { providerId: 'x' }],
    ['a status chosen by the client', { status: 'registered' }],
    ['no Turnstile token', { turnstileToken: '' }],
  ])('refuses %s with 422', async (_name, overrides) => {
    await expectApiError(await post('/leads', await form(overrides)), 422, 'VALIDATION_ERROR');
    expect(await leadRows()).toEqual([]);
  });

  it('refuses a non-JSON body with 415 (no simple cross-site form posts)', async () => {
    const res = await call(app, '/api/v1/leads', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify(await form()),
    });
    await expectApiError(res, 415, 'UNSUPPORTED_MEDIA_TYPE');
  });

  describe('Turnstile', () => {
    it('refuses a failed check with 403 and stores nothing', async () => {
      const failing = { ...env, TURNSTILE_SECRET: TURNSTILE_TEST_SECRETS.alwaysFails };
      await expectApiError(await post('/leads', await form(), failing), 403, 'FORBIDDEN');
      expect(await leadRows()).toEqual([]);
    });

    it('is off (503) in a deployed environment without the secret', async () => {
      const deployed = { ...env, APP_VERSION: 'sha-test', TURNSTILE_SECRET: undefined };
      await expectApiError(
        await post('/leads', await form(), deployed),
        503,
        'SERVICE_UNAVAILABLE',
      );
      expect(await leadRows()).toEqual([]);
    });

    it('never accepts Cloudflare test keys in a deployed environment (503, form off)', async () => {
      const deployed = {
        ...env,
        APP_VERSION: 'sha-test',
        TURNSTILE_SECRET: TURNSTILE_TEST_SECRETS.alwaysPasses,
      };
      await expectApiError(
        await post('/leads', await form(), deployed),
        503,
        'SERVICE_UNAVAILABLE',
      );
      expect(await leadRows()).toEqual([]);
    });

    it('checks the token with Cloudflare siteverify using the secret', async () => {
      const siteverify = vi.fn(async (_url: string, _init: RequestInit) =>
        Response.json({ success: true, action: 'lead-form' }),
      );
      const withFetch = createApp({
        now: () => TODAY,
        fetch: siteverify as unknown as typeof fetch,
      });
      const res = await call(
        withFetch,
        '/api/v1/leads',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(await form()),
        },
        { ...env, TURNSTILE_SECRET: 'real-secret' },
      );
      expect(res.status).toBe(201);
      const [url, init] = siteverify.mock.calls[0] ?? [];
      expect(url).toBe(SITEVERIFY_URL);
      expect(JSON.parse(String(init?.body))).toEqual({
        secret: 'real-secret',
        response: 'token-dari-widget',
      });
    });

    it.each([
      ['refused by Cloudflare', async () => Response.json({ success: false }), 403],
      [
        'replayed (timeout-or-duplicate)',
        async () => Response.json({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
        403,
      ],
      [
        'made for another form (other action)',
        async () => Response.json({ success: true, action: 'login' }),
        403,
      ],
      [
        'rejected because our secret is wrong (configuration, not a bot)',
        async () => Response.json({ success: false, 'error-codes': ['invalid-input-secret'] }),
        503,
      ],
      ['Cloudflare answering an error', async () => new Response('x', { status: 500 }), 503],
      [
        'Cloudflare unreachable',
        async () => {
          throw new Error('network');
        },
        503,
      ],
    ])('treats a token %s as not passed (%i)', async (_name, impl, status) => {
      const withFetch = createApp({
        now: () => TODAY,
        fetch: vi.fn(impl) as unknown as typeof fetch,
      });
      const res = await call(
        withFetch,
        '/api/v1/leads',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(await form()),
        },
        { ...env, TURNSTILE_SECRET: 'real-secret' },
      );
      expect(res.status).toBe(status);
      expect(await leadRows()).toEqual([]);
    });
  });

  it('refuses a body over 8 KB with 413 before reading it as JSON', async () => {
    const res = await post('/leads', await form({ message: 'x'.repeat(9000) }));
    await expectApiError(res, 413, 'PAYLOAD_TOO_LARGE');
    expect(await leadRows()).toEqual([]);
  });

  it('limits calls from the web app by the visitor IP it forwards over the binding', async () => {
    const { binding, keys } = limiter(false);
    const res = await post(
      '/leads',
      await form(),
      { ...env, RL_LEAD_FORM: binding },
      {
        'X-PusatK3-Visitor-IP': '203.0.113.9',
      },
    );
    await expectApiError(res, 429, 'RATE_LIMITED');
    expect(keys).toEqual(['lead-form:203.0.113.9']);
  });

  it('never lets an internet client choose its key: CF-Connecting-IP wins over the header', async () => {
    const { binding, keys } = limiter(true);
    await post(
      '/leads',
      await form(),
      { ...env, RL_LEAD_FORM: binding },
      {
        'CF-Connecting-IP': '203.0.113.10',
        'X-PusatK3-Visitor-IP': '1.1.1.1',
      },
    );
    expect(keys).toEqual(['lead-form:203.0.113.10']);
  });

  it('is rate limited per visitor IP: 429 with Retry-After, nothing stored', async () => {
    const { binding, keys } = limiter(false);
    const res = await post(
      '/leads',
      await form(),
      { ...env, RL_LEAD_FORM: binding },
      {
        'CF-Connecting-IP': '203.0.113.7',
      },
    );
    await expectApiError(res, 429, 'RATE_LIMITED');
    expect(res.headers.get('retry-after')).toBe('60');
    expect(keys).toEqual(['lead-form:203.0.113.7']);
    expect(await leadRows()).toEqual([]);
  });

  it('never writes personal data to the logs', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    await post('/leads', await form({ email: 'budi@contoh.id' }));
    await post('/leads', await form({ phone: 'salah' }));
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    for (const value of ['Budi', '3456', 'budi@contoh.id', 'kuota', 'salah']) {
      expect(logged).not.toContain(value);
    }
  });
});

describe('POST /api/v1/leads/whatsapp (click, public)', () => {
  it('counts a click on a schedule without any personal data', async () => {
    const scheduleId = await scheduleOf(CLAIMED);
    const res = await post('/leads/whatsapp', { scheduleId });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ status: 'received' });
    const [row] = await leadRows();
    expect(row).toMatchObject({
      channel: 'whatsapp',
      schedule_id: scheduleId,
      name: null,
      phone: null,
      email: null,
      message: null,
      consent_at: null,
    });
  });

  it('counts a click on a provider profile (no schedule)', async () => {
    expect((await post('/leads/whatsapp', { providerSlug: CLAIMED })).status).toBe(202);
    expect((await leadRows())[0]).toMatchObject({ channel: 'whatsapp', schedule_id: null });
  });

  it.each([
    ['a provider without a WhatsApp number', { providerSlug: UNCLAIMED }],
    ['an unknown provider', { providerSlug: 'tidak-ada' }],
    ['an unknown schedule', { scheduleId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' }],
  ])('refuses %s with 404', async (_name, body) => {
    await expectApiError(await post('/leads/whatsapp', body), 404, 'NOT_FOUND');
  });

  it('refuses a closed provider with 404', async () => {
    await run(`UPDATE providers SET status = 'closed' WHERE slug = '${CLAIMED}'`);
    await expectApiError(
      await post('/leads/whatsapp', { providerSlug: CLAIMED }),
      404,
      'NOT_FOUND',
    );
  });

  it.each([
    ['both targets', { providerSlug: CLAIMED, scheduleId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' }],
    ['personal data', { providerSlug: CLAIMED, name: 'Budi' }],
    ['nothing', {}],
  ])('refuses %s with 422', async (_name, body) => {
    await expectApiError(await post('/leads/whatsapp', body), 422, 'VALIDATION_ERROR');
    expect(await leadRows()).toEqual([]);
  });

  it('refuses a body over 1 KB with 413', async () => {
    await expectApiError(
      await post('/leads/whatsapp', { providerSlug: 'a'.repeat(1100) }),
      413,
      'PAYLOAD_TOO_LARGE',
    );
  });

  it('counts clicks for an unclaimed provider that has WhatsApp (no personal data)', async () => {
    await run(`UPDATE providers SET whatsapp = '6281111111111' WHERE slug = '${UNCLAIMED}'`);
    expect((await post('/leads/whatsapp', { providerSlug: UNCLAIMED })).status).toBe(202);
  });

  it.each([
    ['a draft schedule', `UPDATE schedules SET status = 'draft'`],
    ['a schedule that already started', `UPDATE schedules SET start_date = '2026-11-30'`],
  ])('refuses a click on %s with 404', async (_name, change) => {
    const scheduleId = await scheduleOf(CLAIMED);
    await run(change);
    await expectApiError(await post('/leads/whatsapp', { scheduleId }), 404, 'NOT_FOUND');
  });

  it('is rate limited per visitor IP', async () => {
    const { binding, keys } = limiter(false);
    const res = await post(
      '/leads/whatsapp',
      { providerSlug: CLAIMED },
      { ...env, RL_LEAD_CLICK: binding },
      {
        'CF-Connecting-IP': '203.0.113.8',
      },
    );
    await expectApiError(res, 429, 'RATE_LIMITED');
    expect(keys).toEqual(['lead-click:203.0.113.8']);
  });
});

describe('leads are never readable from the public API', () => {
  it.each(['/leads', '/leads/whatsapp'])('GET %s → 404', async (path) => {
    await post('/leads', await form());
    const res = await call(app, `/api/v1${path}`);
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('Budi');
  });

  it('public directory answers never contain lead data', async () => {
    await post('/leads', await form());
    const profile = await (await call(app, `/api/v1/providers/${CLAIMED}`)).text();
    const search = searchResponseSchema.parse(await (await call(app, '/api/v1/search')).json());
    expect(profile).not.toMatch(/Budi|kuota untuk bulan/);
    expect(JSON.stringify(search)).not.toMatch(/Budi|kuota untuk bulan/);
  });
});

describe('rate limit on public reads (ADR 0022)', () => {
  it('limits direct public calls per visitor IP, before the edge cache', async () => {
    const { binding, keys } = limiter(false);
    const res = await call(
      app,
      '/api/v1/search',
      { headers: { 'CF-Connecting-IP': '198.51.100.1' } },
      { ...env, RL_READ: binding },
    );
    await expectApiError(res, 429, 'RATE_LIMITED');
    expect(keys).toEqual(['read:198.51.100.1']);
  });

  it('leaves calls without a public IP (the web app over the service binding) to the web', async () => {
    const { binding } = limiter(false);
    const res = await call(app, '/api/v1/search', undefined, { ...env, RL_READ: binding });
    expect(res.status).toBe(200);
    expect(binding.limit).not.toHaveBeenCalled();
  });

  it.each([
    '/providers/contoh-mitra-k3-jakarta',
    '/schedules/01ARZ3NDEKTSV4RRFFQ69G5FAV',
    '/categories',
  ])('limits %s too', async (path) => {
    const { binding } = limiter(false);
    const res = await call(
      app,
      `/api/v1${path}`,
      { headers: { 'CF-Connecting-IP': '198.51.100.3' } },
      { ...env, RL_READ: binding },
    );
    await expectApiError(res, 429, 'RATE_LIMITED');
  });

  it('lets requests through while under the limit', async () => {
    const { binding } = limiter(true);
    const res = await call(
      app,
      '/api/v1/cities',
      { headers: { 'CF-Connecting-IP': '198.51.100.2' } },
      { ...env, RL_READ: binding },
    );
    expect(res.status).toBe(200);
  });
});

describe('lead retention (UU PDP, 12 months)', () => {
  const db = () => drizzle(env.DB);

  it('clears personal data of form leads older than 12 months, keeps the rest', async () => {
    await post('/leads', await form());
    await post('/leads/whatsapp', { providerSlug: CLAIMED });
    const later = Date.UTC(2027, 11, 1, 5, 1); // 12 months + 1 minute after TODAY
    expect(await anonymizeExpiredLeads(db() as never, later)).toBe(1);
    const rows = await leadRows();
    expect(rows.find((r) => r.channel === 'form')).toMatchObject({
      name: null,
      phone: null,
      email: null,
      message: null,
      anonymized_at: later,
      status: 'new',
    });
    expect(rows).toHaveLength(2); // counts stay
    expect(await anonymizeExpiredLeads(db() as never, later)).toBe(0); // idempotent
  });

  it('keeps leads younger than 12 months', async () => {
    await post('/leads', await form());
    expect(await anonymizeExpiredLeads(db() as never, Date.UTC(2027, 10, 30, 5, 0))).toBe(0);
    expect((await leadRows())[0]?.name).toBe('Budi Santoso');
  });

  it('computes the cutoff as the same moment 12 months earlier', () => {
    expect(retentionCutoff(Date.UTC(2027, 11, 1, 5, 0)).toISOString()).toBe(
      '2026-12-01T05:00:00.000Z',
    );
  });

  it('the daily job runs the retention and reports failure instead of hiding it', async () => {
    await post('/leads', await form());
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await scheduled(env, Date.UTC(2027, 11, 1, 6, 0));
    expect((await leadRows())[0]?.name).toBeNull();

    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = {
      ...env,
      DB: {
        prepare: () => {
          throw new TypeError('D1 down');
        },
      } as unknown as D1Database,
    };
    await expect(scheduled(broken)).rejects.toThrow('D1 down');
    expect(JSON.stringify(errors.mock.calls)).toBe(
      JSON.stringify([[JSON.stringify({ job: 'lead-retention', error: 'TypeError' })]]),
    );
  });

  it('the database refuses a form lead without consent version or contact', async () => {
    const [provider] = await all<{ id: string }>(
      `SELECT id FROM providers WHERE slug = '${CLAIMED}'`,
    );
    for (const columns of [
      `consent_at, name, message, phone) VALUES (1, 'Budi', 'Halo halo halo', '6281'`,
      `consent_at, consent_version, name, message) VALUES (1, 'v', 'Budi', 'Halo halo halo'`,
    ]) {
      await expect(
        run(
          `INSERT INTO leads (id, created_at, updated_at, provider_id, channel, status, ${columns.replace(') VALUES (', `) VALUES ('f${columns.length}', 0, 0, '${provider?.id}', 'form', 'new', `)})`,
        ),
      ).rejects.toThrow(/CHECK constraint failed/);
    }
  });

  it('the database refuses personal data on a WhatsApp click', async () => {
    const [provider] = await all<{ id: string }>(
      `SELECT id FROM providers WHERE slug = '${CLAIMED}'`,
    );
    await expect(
      run(
        `INSERT INTO leads (id, created_at, updated_at, provider_id, channel, name, status)
         VALUES ('x', 0, 0, '${provider?.id}', 'whatsapp', 'Budi', 'new')`,
      ),
    ).rejects.toThrow(/CHECK constraint failed/);
  });
});

describe('rateLimitKey', () => {
  it.each([
    ['203.0.113.7', '203.0.113.7'],
    ['2001:db8:85a3:1:aaaa:bbbb:cccc:dddd', '2001:db8:85a3:1::/64'],
    ['2001:DB8:85A3:0001::1', '2001:db8:85a3:1::/64'],
    ['2001:db8::1', '2001:db8:0:0::/64'],
    ['::1', '0:0:0:0::/64'],
  ])('%s → %s (IPv6 grouped by /64)', (ip, key) => {
    expect(rateLimitKey(ip)).toBe(key);
  });
});

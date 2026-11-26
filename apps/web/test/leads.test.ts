import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { LEAD_CONSENT_TEXT } from '@pusatk3/shared';
import { describe, expect, it, vi } from 'vitest';
import QuestionForm from '../src/components/directory/QuestionForm.astro';
import WhatsAppButton from '../src/components/WhatsAppButton.astro';
import { apiGetWith, apiPostWith, VISITOR_IP_HEADER } from '../src/lib/api-client';
import { visitorContext } from '../src/lib/api';
import { parseClickBeacon, questionFromForm, questionOutcome } from '../src/lib/leads';
import { POST as clickBeacon } from '../src/pages/kontak/klik-wa';
import QuestionPage from '../src/pages/kontak/pertanyaan.astro';
import { attr, render, tag } from './render';

// Web side of leads (#28, ADR 0022). The API checks everything again; these tests cover what the
// web sends, shows and never does (block the WhatsApp link, leak data, cache results).
const SCHEDULE = '01M89PMTFMP52DZ0X42EEQV2RH';

describe('parseClickBeacon', () => {
  it.each([
    [`{"scheduleId":"${SCHEDULE}"}`, { scheduleId: SCHEDULE }],
    ['{"providerSlug":"contoh-mitra-k3-jakarta"}', { providerSlug: 'contoh-mitra-k3-jakarta' }],
  ])('accepts %s', (text, expected) => {
    expect(parseClickBeacon(text)).toEqual(expected);
  });

  it.each([
    'not json',
    '{}',
    `{"scheduleId":"${SCHEDULE}","name":"Budi"}`,
    `{"providerSlug":"${'a'.repeat(2000)}"}`,
  ])('ignores %s', (text) => {
    expect(parseClickBeacon(text)).toBeNull();
  });
});

describe('questionFromForm', () => {
  it('maps the form fields and the Turnstile token; consent only when ticked', () => {
    const form = new FormData();
    form.set('scheduleId', SCHEDULE);
    form.set('name', 'Budi');
    form.set('phone', '0812');
    form.set('message', 'Pertanyaan saya');
    form.set('cf-turnstile-response', 'tok');
    form.set('extra', 'ignored');
    expect(questionFromForm(form)).toEqual({
      scheduleId: SCHEDULE,
      name: 'Budi',
      phone: '0812',
      email: '',
      message: 'Pertanyaan saya',
      consent: false,
      turnstileToken: 'tok',
    });
    form.set('consent', 'on');
    expect(questionFromForm(form).consent).toBe(true);
  });

  it.each([
    [201, 'sent'],
    [422, 'invalid'],
    [413, 'invalid'],
    [403, 'blocked'],
    [404, 'gone'],
    [429, 'busy'],
    [503, 'unavailable'],
    [500, 'unavailable'],
  ] as const)('API %i → %s', (status, outcome) => {
    expect(questionOutcome(status)).toBe(outcome);
  });
});

describe('API client: POST and the visitor IP', () => {
  it('sends JSON and the visitor IP header over the binding; reads 422 field errors', async () => {
    const binding = {
      fetch: vi.fn(async (_request: Request) =>
        Response.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'x',
              fields: [{ path: 'phone', message: 'Isi nomor HP atau email' }],
            },
          },
          { status: 422 },
        ),
      ),
    };
    const result = await apiPostWith(
      { API: binding },
      '/leads',
      { a: 1 },
      { visitorIp: '203.0.113.5' },
    );
    expect(result).toEqual({
      status: 422,
      fields: [{ path: 'phone', message: 'Isi nomor HP atau email' }],
    });
    const request = binding.fetch.mock.calls[0]?.[0];
    expect(request?.method).toBe('POST');
    expect(request?.headers.get('content-type')).toBe('application/json');
    expect(request?.headers.get(VISITOR_IP_HEADER)).toBe('203.0.113.5');
    expect(await request?.text()).toBe('{"a":1}');
  });

  it('never throws: no route → 503, network error → 503', async () => {
    expect(await apiPostWith({}, '/leads', {})).toEqual({ status: 503 });
    const broken = { API: { fetch: vi.fn(async () => Promise.reject(new Error('down'))) } };
    expect(await apiPostWith(broken, '/leads', {})).toEqual({ status: 503 });
  });

  it('GET carries the visitor IP only when there is one', async () => {
    const binding = { fetch: vi.fn(async (_request: Request) => Response.json({ ok: true })) };
    const schema = { safeParse: (v: unknown) => ({ success: true as const, data: v }) };
    await apiGetWith({ API: binding }, '/cities', schema, fetch, 1000, '198.51.100.4');
    await apiGetWith({ API: binding }, '/cities', schema);
    expect(binding.fetch.mock.calls[0]?.[0].headers.get(VISITOR_IP_HEADER)).toBe('198.51.100.4');
    expect(binding.fetch.mock.calls[1]?.[0].headers.has(VISITOR_IP_HEADER)).toBe(false);
  });

  it('keeps the visitor per request (AsyncLocalStorage)', async () => {
    const seen = await Promise.all(
      ['a', 'b'].map((ip) => visitorContext.run({ ip }, async () => visitorContext.getStore()?.ip)),
    );
    expect(seen).toEqual(['a', 'b']);
    expect(visitorContext.getStore()).toBeUndefined();
  });
});

describe('WhatsAppButton lead tracking', () => {
  it('opens wa.me directly and carries what the click is about', async () => {
    const html = await render(
      WhatsAppButton,
      {
        phone: '0812-3456-7890',
        lead: { scheduleId: SCHEDULE },
      },
      'Chat',
    );
    const link = tag(html, 'a', 'wa');
    expect(attr(link, 'href')).toBe('https://wa.me/6281234567890');
    expect(attr(link, 'data-lead')?.replaceAll('&quot;', '"')).toBe(`{"scheduleId":"${SCHEDULE}"}`);
  });

  it('is not tracked without a lead', async () => {
    const html = await render(WhatsAppButton, { phone: '0812-3456-7890' }, 'Chat');
    expect(attr(tag(html, 'a', 'wa'), 'data-lead')).toBeNull();
  });
});

describe('QuestionForm', () => {
  it('posts to /kontak/pertanyaan with consent, Turnstile action and the site key', async () => {
    const html = await render(QuestionForm, {
      scheduleId: SCHEDULE,
      siteKey: '1x00000000000000000000AA',
    });
    const form = tag(html, 'form', 'question');
    expect(attr(form, 'method')).toBe('post');
    expect(attr(form, 'action')).toBe('/kontak/pertanyaan');
    expect(html).toContain(`value="${SCHEDULE}"`);
    expect(html).toContain(LEAD_CONSENT_TEXT);
    const consent = /<input[^>]*name="consent"[^>]*>/.exec(html)?.[0] ?? '';
    expect(consent).toContain('required');
    const widget = tag(html, 'div', 'cf-turnstile');
    expect(attr(widget, 'data-action')).toBe('lead-form');
    expect(attr(widget, 'data-sitekey')).toBe('1x00000000000000000000AA');
    expect(html).toContain('https://challenges.cloudflare.com/turnstile/v0/api.js');
  });
});

describe('/kontak/klik-wa', () => {
  it('always answers 204 without content, whatever was sent', async () => {
    for (const body of [`{"scheduleId":"${SCHEDULE}"}`, 'rubbish', '']) {
      const request = new Request('https://pusatk3.test/kontak/klik-wa', { method: 'POST', body });
      const res = await clickBeacon({ request } as never);
      expect(res.status).toBe(204);
      expect(await res.text()).toBe('');
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
  });
});

describe('/kontak/pertanyaan', () => {
  it('says the question could not be sent when the API is unavailable, never cached', async () => {
    const container = await AstroContainer.create();
    const form = new FormData();
    form.set('scheduleId', SCHEDULE);
    const res = await container.renderToResponse(QuestionPage, {
      request: new Request('https://pusatk3.test/kontak/pertanyaan', {
        method: 'POST',
        body: form,
      }),
    });
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const html = await res.text();
    expect(html).toContain('Pertanyaan belum bisa dikirim');
    expect(html).toContain(`href="/jadwal/${SCHEDULE}#kontak"`);
  });

  it('sends GET visitors to the search page', async () => {
    const container = await AstroContainer.create();
    const res = await container.renderToResponse(QuestionPage, {
      request: new Request('https://pusatk3.test/kontak/pertanyaan'),
    });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/cari');
  });
});

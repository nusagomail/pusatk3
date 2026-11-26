import { describe, expect, it } from 'vitest';
import {
  PLAN_CODE_VALUES,
  branchInputSchema,
  isoDateSchema,
  licenseInputSchema,
  planCodeSchema,
  providerInputSchema,
  scheduleInputSchema,
} from '../src/index';

describe('plan codes', () => {
  it('match docs/skema-db.md (plans.code)', () => {
    expect(PLAN_CODE_VALUES).toEqual(['free', 'pro', 'business']);
    expect(planCodeSchema.safeParse('gold').success).toBe(false);
  });
});

describe('isoDateSchema', () => {
  it.each(['2027-01-10', '2028-02-29'])('accepts %j', (value) => {
    expect(isoDateSchema.parse(value)).toBe(value);
  });

  it.each([
    '10/01/2027',
    '2027-1-10',
    '2027-02-30',
    '2027-13-01',
    '2027-01-10T00:00:00Z',
    '',
    '0202-01-10',
  ])('rejects %j', (value) => {
    expect(isoDateSchema.safeParse(value).success).toBe(false);
  });
});

describe('providerInputSchema', () => {
  const valid = { slug: 'pt-contoh-k3', name: 'PT Contoh K3', type: 'pjk3' };

  it('accepts the minimum and normalises the WhatsApp number', () => {
    const parsed = providerInputSchema.parse({ ...valid, whatsapp: '0812-3456-7890' });
    expect(parsed.whatsapp).toBe('6281234567890');
  });

  it('trims text and treats empty optional fields as absent', () => {
    const parsed = providerInputSchema.parse({ ...valid, name: '  PT Contoh K3 ', email: '' });
    expect(parsed.name).toBe('PT Contoh K3');
    expect(parsed.email).toBeUndefined();
  });

  it.each([
    ['bad slug', { slug: 'PT Contoh' }],
    ['unknown type', { type: 'agen' }],
    ['bad WhatsApp', { whatsapp: '123' }],
    ['bad email', { email: 'bukan-email' }],
    ['non-https website', { website: 'http://contoh.id' }],
    ['script website', { website: 'javascript:alert(1)' }],
    ['website with credentials', { website: 'https://kemnaker.go.id@evil.id' }],
    ['localhost website', { website: 'https://localhost' }],
    ['IP website', { website: 'https://127.0.0.1' }],
    ['host without a dot', { website: 'https://x' }],
    ['control character in name', { name: 'PT A\u0000B' }],
    ['markup in phone', { phone: '<script>' }],
    ['unknown field', { plan: 'pro' }],
  ])('rejects %s', (_name, overrides) => {
    expect(providerInputSchema.safeParse({ ...valid, ...overrides }).success).toBe(false);
  });

  it('normalises website and email', () => {
    const parsed = providerInputSchema.parse({
      ...valid,
      website: 'HTTPS://Contoh.ID/profil',
      email: 'Info@Contoh.ID',
      description: 'Baris satu\nBaris dua',
    });
    expect(parsed.website).toBe('https://contoh.id/profil');
    expect(parsed.email).toBe('info@contoh.id');
    expect(parsed.description).toBe('Baris satu\nBaris dua');
  });

  it('never accepts verification or plan from input (badge is never bought)', () => {
    for (const key of ['verificationStatus', 'verifiedAt', 'plan', 'status']) {
      expect(providerInputSchema.safeParse({ ...valid, [key]: 'verified' }).success).toBe(false);
    }
  });
});

describe('branchInputSchema', () => {
  const valid = { name: 'Kantor pusat', citySlug: 'jakarta', address: 'Jl. Contoh 1' };

  it('accepts a branch with optional coordinates', () => {
    expect(branchInputSchema.parse({ ...valid, lat: -6.2, lng: 106.8 }).isMain).toBe(false);
  });

  it.each([
    ['latitude out of range', { lat: 91, lng: 0 }],
    ['only one coordinate', { lat: -6.2 }],
    ['empty address', { address: ' ' }],
  ])('rejects %s', (_name, overrides) => {
    expect(branchInputSchema.safeParse({ ...valid, ...overrides }).success).toBe(false);
  });
});

describe('licenseInputSchema', () => {
  it('accepts free-text issuer (e.g. an LSP name for a TUK)', () => {
    const parsed = licenseInputSchema.parse({
      kind: 'tuk',
      number: 'TUK/123/2026',
      issuer: 'LSP K3 Contoh',
      validUntil: '2029-12-31',
    });
    expect(parsed.issuer).toBe('LSP K3 Contoh');
  });

  it('rejects an unknown kind', () => {
    expect(licenseInputSchema.safeParse({ kind: 'sio', number: '1', issuer: 'x' }).success).toBe(
      false,
    );
  });
});

describe('scheduleInputSchema', () => {
  const valid = {
    categorySlug: 'ahli-k3-umum',
    title: 'Pembinaan Ahli K3 Umum',
    issuer: 'kemnaker',
    mode: 'online',
    startDate: '2027-01-10',
    endDate: '2027-01-21',
    certificateKind: 'official',
  };

  it('accepts an online schedule without a branch', () => {
    expect(scheduleInputSchema.parse(valid).status).toBe('draft');
  });

  it('refuses a branch on online schedules', () => {
    expect(scheduleInputSchema.safeParse({ ...valid, branchName: 'Kantor pusat' }).success).toBe(
      false,
    );
  });

  it('requires a branch for offline schedules', () => {
    expect(scheduleInputSchema.safeParse({ ...valid, mode: 'offline' }).success).toBe(false);
    expect(
      scheduleInputSchema.safeParse({ ...valid, mode: 'offline', branchName: 'Kantor pusat' })
        .success,
    ).toBe(true);
  });

  it.each([
    ['end before start', { startDate: '2027-01-21', endDate: '2027-01-10' }],
    ['negative price', { priceIdr: -1 }],
    ['fractional price', { priceIdr: 1000.5 }],
    ['zero quota', { quota: 0 }],
    ['unknown issuer', { issuer: 'iso' }],
    ['expired status from input', { status: 'expired' }],
  ])('rejects %s', (_name, overrides) => {
    expect(scheduleInputSchema.safeParse({ ...valid, ...overrides }).success).toBe(false);
  });
});

describe('public contact schema', () => {
  it('only lets https websites reach a page', async () => {
    const { providerProfileSchema } = await import('../src/index');
    const contact = (website: string | null) => ({
      slug: 'pt-a',
      name: 'PT A',
      type: 'pjk3',
      verified: false,
      isSample: false,
      description: null,
      contact: { whatsapp: null, email: null, phone: null, website },
      branches: [],
      licenses: [],
      schedules: [],
    });
    expect(providerProfileSchema.safeParse(contact('https://pt-a.co.id')).success).toBe(true);
    expect(providerProfileSchema.safeParse(contact(null)).success).toBe(true);
    for (const bad of ['javascript:alert(1)', 'http://pt-a.co.id', 'data:text/html,x']) {
      expect(providerProfileSchema.safeParse(contact(bad)).success).toBe(false);
    }
  });
});

import type { ProviderProfile } from '@pusatk3/shared';
import { describe, expect, it } from 'vitest';
import { organizationJsonLd, profilePageStatus } from '../src/lib/provider-page';

const provider = (overrides: Partial<ProviderProfile> = {}): ProviderProfile => ({
  slug: 'pt-a',
  name: 'PT A',
  type: 'pjk3',
  verified: true,
  isSample: false,
  description: null,
  contact: { whatsapp: null, email: null, phone: null, website: 'https://pt-a.co.id' },
  branches: [
    { name: 'Cabang', address: 'Jl. B', city: { slug: 'bekasi', name: 'Bekasi' }, isMain: false },
    { name: 'Pusat', address: 'Jl. A', city: { slug: 'jakarta', name: 'Jakarta' }, isMain: true },
  ],
  licenses: [],
  schedules: [],
  ...overrides,
});

describe('profilePageStatus', () => {
  it.each([
    [true, null, 200],
    [false, null, 404],
    [false, 404, 404],
    [false, 422, 404],
    [false, 503, 503],
  ] as const)('found=%s failure=%s → %s', (found, failure, expected) => {
    expect(profilePageStatus(found, failure)).toBe(expected);
  });
});

describe('organizationJsonLd', () => {
  it('uses the main branch as address and the website as sameAs', () => {
    expect(organizationJsonLd(provider())).toMatchObject({
      '@type': 'Organization',
      sameAs: ['https://pt-a.co.id'],
      address: { streetAddress: 'Jl. A', addressLocality: 'Jakarta' },
    });
  });

  it('is never emitted for sample data', () => {
    expect(organizationJsonLd(provider({ isSample: true }))).toBeNull();
  });
});

import type { ScheduleDetail } from '@pusatk3/shared';
import { describe, expect, it } from 'vitest';
import {
  courseJsonLd,
  detailPageStatus,
  durationDays,
  scheduleTiming,
} from '../src/lib/schedule-page';

const schedule = (overrides: Partial<ScheduleDetail> = {}): ScheduleDetail => ({
  id: '01JAAAAAAAAAAAAAAAAAAAAAAA',
  title: 'Pembinaan Ahli K3 Umum',
  category: { slug: 'ahli-k3-umum', name: 'Ahli K3 Umum' },
  issuer: 'kemnaker',
  mode: 'offline',
  startDate: '2027-01-11',
  endDate: '2027-01-22',
  priceIdr: 5_500_000,
  level: null,
  certificateKind: 'official',
  city: { slug: 'jakarta', name: 'Jakarta' },
  description: null,
  requirements: null,
  quota: 30,
  branch: { name: 'Kantor', address: 'Jl. A', city: { slug: 'jakarta', name: 'Jakarta' } },
  provider: {
    slug: 'pt-a',
    name: 'PT A',
    type: 'pjk3',
    verified: true,
    isSample: false,
    contact: { whatsapp: null, email: null, phone: null, website: null },
    licenses: [],
  },
  ...overrides,
});

describe('detailPageStatus', () => {
  it.each([
    [true, null, 200],
    [false, null, 404],
    [false, 404, 404],
    [false, 422, 404],
    [false, 502, 503],
    [false, 503, 503],
    [false, 500, 503],
  ] as const)('found=%s failure=%s → %s', (found, failure, expected) => {
    expect(detailPageStatus(found, failure)).toBe(expected);
  });
});

describe('scheduleTiming', () => {
  it.each([
    ['2027-01-10', 'upcoming'],
    ['2027-01-11', 'started'],
    ['2027-01-22', 'started'],
    ['2027-01-23', 'ended'],
  ] as const)('today %s → %s', (today, expected) => {
    expect(scheduleTiming('2027-01-11', '2027-01-22', today)).toBe(expected);
  });
});

describe('courseJsonLd', () => {
  it('describes an upcoming course with an offer and a workload', () => {
    const data = courseJsonLd(schedule(), 'upcoming') as Record<string, Record<string, unknown>>;
    expect(data['@type']).toBe('Course');
    expect(data.offers).toEqual({
      '@type': 'Offer',
      category: 'Paid',
      price: 5_500_000,
      priceCurrency: 'IDR',
    });
    expect(data.hasCourseInstance).toMatchObject({ courseMode: 'Onsite', courseWorkload: 'P12D' });
  });

  it('keeps the offer category when the price is unknown', () => {
    const data = courseJsonLd(schedule({ priceIdr: null }), 'upcoming') as Record<string, unknown>;
    expect(data.offers).toEqual({ '@type': 'Offer', category: 'Paid' });
  });

  it('has no offer once the course started, and none at all for sample data', () => {
    expect(courseJsonLd(schedule(), 'started')).not.toHaveProperty('offers');
    const sample = schedule();
    sample.provider.isSample = true;
    expect(courseJsonLd(sample, 'upcoming')).toBeNull();
  });

  it('counts whole days inclusively', () => {
    expect(durationDays('2027-01-11', '2027-01-11')).toBe(1);
    expect(durationDays('2027-01-28', '2027-02-03')).toBe(7);
  });
});

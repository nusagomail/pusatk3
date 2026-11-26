import type { LandingPage, ScheduleSummary } from '@pusatk3/shared';
import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { landingJsonLd, landingPath, landingSummary, relatedPages } from '../src/lib/landing-page';
import { GET as sitemap } from '../src/pages/sitemap.xml';

// SEO page logic and the dynamic sitemap (#27, ADR 0023).
const runtime = env as Record<string, unknown>;
afterEach(() => {
  delete runtime.API;
});

const schedule = (overrides: Partial<ScheduleSummary> = {}): ScheduleSummary =>
  ({
    id: '01M89PMTFMP52DZ0X42EEQV2RH',
    title: 'Operator Forklift Kelas II',
    category: { slug: 'operator-forklift', name: 'Operator Forklift' },
    issuer: 'kemnaker',
    mode: 'offline',
    startDate: '2027-01-12',
    endDate: '2027-01-15',
    priceIdr: 3_200_000,
    city: { slug: 'bekasi', name: 'Bekasi' },
    level: null,
    certificateKind: 'official',
    provider: { slug: 'pt-a', name: 'PT A', type: 'pjk3', verified: true, isSample: false },
    ...overrides,
  }) as ScheduleSummary;

const page = (overrides: Partial<LandingPage> = {}): LandingPage => ({
  category: { slug: 'operator-forklift', name: 'Operator Forklift' },
  city: { slug: 'bekasi', name: 'Bekasi' },
  schedules: 3,
  providers: 2,
  isSample: false,
  ...overrides,
});

describe('landingSummary', () => {
  it('counts schedules and distinct providers, earliest start and lowest known price', () => {
    const summary = landingSummary([
      schedule({ startDate: '2027-02-01', priceIdr: null }),
      schedule({ startDate: '2027-01-12' }),
      schedule({
        startDate: '2027-03-01',
        priceIdr: 2_900_000,
        issuer: 'bnsp',
        provider: { slug: 'pt-b', name: 'PT B', type: 'lsp', verified: false, isSample: false },
      }),
    ]);
    expect(summary).toEqual({
      schedules: 3,
      providers: [
        { slug: 'pt-a', name: 'PT A', verified: true },
        { slug: 'pt-b', name: 'PT B', verified: false },
      ],
      firstStart: '2027-01-12',
      minPrice: 2_900_000,
      issuers: ['Kemnaker', 'BNSP'],
    });
  });
});

describe('relatedPages', () => {
  it('links other cities of the category and other categories of the city, never itself', () => {
    const self = page();
    const jakarta = page({ city: { slug: 'jakarta', name: 'Jakarta' } });
    const crane = page({ category: { slug: 'operator-crane', name: 'Operator Crane' } });
    const unrelated = page({
      category: { slug: 'juru-las', name: 'Juru Las' },
      city: { slug: 'depok', name: 'Depok' },
    });
    expect(relatedPages(self, [self, jakarta, crane, unrelated])).toEqual({
      sameCategory: [jakarta],
      sameCity: [crane],
    });
  });
});

describe('landingJsonLd', () => {
  it('gives real data a breadcrumb and an ItemList of Course with CourseInstance and offer', () => {
    const [breadcrumbs, list] = landingJsonLd(page(), [schedule()]);
    expect(breadcrumbs).toMatchObject({ '@type': 'BreadcrumbList' });
    expect(list).toMatchObject({
      '@type': 'ItemList',
      url: 'https://pusatk3.id/pelatihan/operator-forklift/bekasi',
      numberOfItems: 1,
      itemListElement: [
        {
          position: 1,
          item: {
            '@type': 'Course',
            url: 'https://pusatk3.id/jadwal/01M89PMTFMP52DZ0X42EEQV2RH',
            provider: { '@type': 'Organization', name: 'PT A' },
            hasCourseInstance: {
              '@type': 'CourseInstance',
              courseMode: 'Onsite',
              courseWorkload: 'P4D',
              startDate: '2027-01-12',
              location: { address: { addressLocality: 'Bekasi', addressCountry: 'ID' } },
            },
            offers: { price: 3_200_000, priceCurrency: 'IDR', category: 'Paid' },
          },
        },
      ],
    });
  });

  it('always sends an offer category, also without a price (Google Course rules)', () => {
    const [, list] = landingJsonLd(page(), [schedule({ priceIdr: null })]);
    const item = (list as { itemListElement: { item: { offers: unknown } }[] }).itemListElement[0];
    expect(item?.item.offers).toEqual({ '@type': 'Offer', category: 'Paid' });
  });

  it('gives sample data the breadcrumb only', () => {
    expect(landingJsonLd(page({ isSample: true }), [schedule()])).toHaveLength(1);
    const sample = schedule({
      provider: { slug: 'x', name: 'X', type: 'pjk3', verified: false, isSample: true },
    });
    expect(landingJsonLd(page(), [sample])).toHaveLength(1);
  });

  it('builds safe paths', () => {
    expect(landingPath('operator-forklift', 'bekasi')).toBe('/pelatihan/operator-forklift/bekasi');
  });
});

describe('sitemap.xml', () => {
  it('lists the static pages, published SEO pages, profiles and schedules from the API', async () => {
    runtime.API = {
      fetch: vi.fn(async () =>
        Response.json({
          landingPages: [{ category: 'operator-forklift', city: 'bekasi' }],
          providers: ['pt-a'],
          schedules: ['01M89PMTFMP52DZ0X42EEQV2RH'],
        }),
      ),
    };
    const res = await sitemap({} as never);
    const xml = await res.text();
    for (const path of [
      '/',
      '/pelatihan/operator-forklift/bekasi',
      '/penyedia/pt-a',
      '/jadwal/01M89PMTFMP52DZ0X42EEQV2RH',
    ]) {
      expect(xml).toContain(`<loc>https://pusatk3.id${path}</loc>`);
    }
    expect(res.headers.get('cache-control')).toBeNull();
  });

  it('answers 503 (crawlers keep the old sitemap) and is not cached when the API is unavailable', async () => {
    const res = await sitemap({} as never);
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('120');
    const xml = await res.text();
    expect(xml).toContain('<loc>https://pusatk3.id/</loc>');
    expect(xml).not.toContain('/penyedia/');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('/pelatihan/[kategori]/[kota] thin-content check on the shown rows', () => {
  it('answers 404 (noindex) when the search shows fewer rows than the rule needs', async () => {
    const { experimental_AstroContainer: AstroContainer } = await import('astro/container');
    const { default: LandingPageView } =
      await import('../src/pages/pelatihan/[kategori]/[kota].astro');
    runtime.API = {
      fetch: vi.fn(async (request: Request) =>
        new URL(request.url).pathname.endsWith('/landing-pages')
          ? Response.json({ items: [page({ schedules: 3, providers: 2 })] })
          : Response.json({ items: [schedule()], nextCursor: null, sponsored: [] }),
      ),
    };
    const container = await AstroContainer.create();
    const res = await container.renderToResponse(LandingPageView, {
      params: { kategori: 'operator-forklift', kota: 'bekasi' },
      request: new Request('https://pusatk3.test/pelatihan/operator-forklift/bekasi'),
    });
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain('Halaman belum tersedia');
    expect(html).toMatch(/<meta name="robots" content="noindex/);
  });
});

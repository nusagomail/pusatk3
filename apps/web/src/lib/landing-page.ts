import type { LandingPage, ScheduleSummary } from '@pusatk3/shared';
import { absoluteUrl } from '../data/site';
import { ISSUER_LABELS } from './format';

// Pure logic of the SEO page /pelatihan/[kategori]/[kota] (#27, ADR 0023), unit-tested.

export const landingPath = (category: string, city: string) =>
  `/pelatihan/${encodeURIComponent(category)}/${encodeURIComponent(city)}`;

export interface LandingSummary {
  schedules: number;
  providers: { slug: string; name: string; verified: boolean }[];
  firstStart: string | null;
  minPrice: number | null;
  issuers: string[];
}

/** Facts for the answer sentence at the top (easy to quote for search engines and AI). */
export function landingSummary(schedules: readonly ScheduleSummary[]): LandingSummary {
  const providers = new Map<string, LandingSummary['providers'][number]>();
  for (const s of schedules) {
    if (!providers.has(s.provider.slug)) {
      providers.set(s.provider.slug, {
        slug: s.provider.slug,
        name: s.provider.name,
        verified: s.provider.verified,
      });
    }
  }
  const prices = schedules.map((s) => s.priceIdr).filter((p): p is number => p !== null);
  const starts = schedules.map((s) => s.startDate).sort();
  return {
    schedules: schedules.length,
    providers: [...providers.values()],
    firstStart: starts[0] ?? null,
    minPrice: prices.length > 0 ? Math.min(...prices) : null,
    issuers: [...new Set(schedules.map((s) => ISSUER_LABELS[s.issuer]))],
  };
}

/** Other published pages for the same category (other cities) and city (other categories). */
export function relatedPages(page: LandingPage, all: readonly LandingPage[]) {
  const others = all.filter(
    (p) => !(p.category.slug === page.category.slug && p.city.slug === page.city.slug),
  );
  return {
    sameCategory: others.filter((p) => p.category.slug === page.category.slug),
    sameCity: others.filter((p) => p.city.slug === page.city.slug),
  };
}

/**
 * schema.org: BreadcrumbList always; ItemList of Course (each with its CourseInstance) only for
 * real data (sample data never gets Course structured data, like the detail page).
 */
export function landingJsonLd(
  page: LandingPage,
  schedules: readonly ScheduleSummary[],
): Record<string, unknown>[] {
  const url = absoluteUrl(landingPath(page.category.slug, page.city.slug));
  const breadcrumbs = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Beranda', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Cari pelatihan', item: absoluteUrl('/cari') },
      {
        '@type': 'ListItem',
        position: 3,
        name: `${page.category.name} di ${page.city.name}`,
        item: url,
      },
    ],
  };
  const real = schedules.filter((s) => !s.provider.isSample);
  if (page.isSample || real.length === 0) return [breadcrumbs];
  const list = {
    '@type': 'ItemList',
    name: `Pelatihan ${page.category.name} di ${page.city.name}`,
    url,
    numberOfItems: real.length,
    itemListElement: real.map((s, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Course',
        name: s.title,
        url: absoluteUrl(`/jadwal/${s.id}`),
        description: `${s.category.name} oleh ${s.provider.name}, penerbit ${ISSUER_LABELS[s.issuer]}.`,
        provider: {
          '@type': 'Organization',
          name: s.provider.name,
          url: absoluteUrl(`/penyedia/${s.provider.slug}`),
        },
        hasCourseInstance: {
          '@type': 'CourseInstance',
          courseMode: 'onsite',
          startDate: s.startDate,
          endDate: s.endDate,
          location: { '@type': 'Place', name: page.city.name, address: page.city.name },
        },
        ...(s.priceIdr !== null && {
          offers: {
            '@type': 'Offer',
            price: s.priceIdr,
            priceCurrency: 'IDR',
            category: 'Paid',
          },
        }),
      },
    })),
  };
  return [breadcrumbs, list];
}

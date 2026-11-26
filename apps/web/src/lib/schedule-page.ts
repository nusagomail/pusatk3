import type { ScheduleDetail } from '@pusatk3/shared';
import { absoluteUrl } from '../data/site';

// Pure logic of the schedule detail page (/jadwal/[id]), kept out of the .astro file so it can be
// unit-tested.

/** Page status: malformed id or API 404/422 → 404; any other API failure → 503; found → 200. */
export function detailPageStatus(found: boolean, failure: number | null): 200 | 404 | 503 {
  if (found) return 200;
  return failure !== null && failure !== 404 && failure !== 422 ? 503 : 404;
}

export type ScheduleTiming = 'upcoming' | 'started' | 'ended';

/** Whether registration can still make sense, by calendar date in Asia/Jakarta. */
export function scheduleTiming(startDate: string, endDate: string, today: string): ScheduleTiming {
  if (endDate < today) return 'ended';
  if (startDate <= today) return 'started';
  return 'upcoming';
}

/** Whole days from start to end, inclusive ("2027-01-11".."2027-01-22" → 12). */
export function durationDays(startDate: string, endDate: string): number {
  const ms = Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * schema.org Course + CourseInstance for an upcoming, real schedule. Sample (fictional) data
 * never gets structured data; schedules that already started get no offer.
 */
export function courseJsonLd(
  schedule: ScheduleDetail,
  timing: ScheduleTiming,
): Record<string, unknown> | null {
  if (schedule.provider.isSample) return null;
  return {
    '@type': 'Course',
    name: schedule.title,
    description: schedule.description ?? `${schedule.category.name} — ${schedule.provider.name}`,
    provider: {
      '@type': 'Organization',
      name: schedule.provider.name,
      url: absoluteUrl(`/penyedia/${schedule.provider.slug}`),
    },
    ...(timing === 'upcoming' && {
      offers: {
        '@type': 'Offer',
        category: 'Paid',
        ...(schedule.priceIdr !== null && { price: schedule.priceIdr, priceCurrency: 'IDR' }),
      },
    }),
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: schedule.mode === 'online' ? 'Online' : 'Onsite',
      courseWorkload: `P${durationDays(schedule.startDate, schedule.endDate)}D`,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      ...(schedule.branch && {
        location: {
          '@type': 'Place',
          name: schedule.branch.name,
          address: {
            '@type': 'PostalAddress',
            streetAddress: schedule.branch.address,
            addressLocality: schedule.branch.city.name,
            addressCountry: 'ID',
          },
        },
      }),
    },
  };
}

/**
 * "Kirim pertanyaan" is shown only where someone reads it (claimed provider), while the schedule
 * is still upcoming, and when Turnstile is configured (#28, ADR 0022).
 */
export function canAskQuestions(
  schedule: Pick<ScheduleDetail, 'provider'> | null,
  timing: string,
  siteKey: string | null,
): boolean {
  return (
    schedule !== null &&
    timing === 'upcoming' &&
    schedule.provider.acceptsQuestions &&
    siteKey !== null
  );
}

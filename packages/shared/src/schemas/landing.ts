import { z } from 'zod';
import { slugSchema } from './categories';

// SEO pages "Pelatihan <kategori> di <kota>" (#27, ADR 0023) and the sitemap.

/**
 * Thin-content rule: a category × city page is published only with at least this many upcoming
 * offline schedules from at least this many providers. Otherwise it answers 404 (not indexed,
 * not in the sitemap). Owner decision #27.
 */
export const LANDING_MIN_SCHEDULES = 3;
export const LANDING_MIN_PROVIDERS = 2;

const refSchema = z.object({ slug: slugSchema, name: z.string().min(1) });

export const landingPageSchema = z.object({
  category: refSchema,
  city: refSchema,
  /** Upcoming published offline schedules in this city for this category. */
  schedules: z.number().int().min(0),
  providers: z.number().int().min(0),
  /** Some of the data is sample data: the page is shown but never indexed. */
  isSample: z.boolean(),
});
export type LandingPage = z.infer<typeof landingPageSchema>;

/** GET /api/v1/landing-pages: only the pages that pass the thin-content rule. */
export const landingPagesResponseSchema = z.object({ items: z.array(landingPageSchema) });
export type LandingPagesResponse = z.infer<typeof landingPagesResponseSchema>;

/** GET /api/v1/sitemap: indexable URLs' keys (never sample data). */
export const sitemapResponseSchema = z.object({
  landingPages: z.array(z.object({ category: slugSchema, city: slugSchema })),
  providers: z.array(slugSchema),
  schedules: z.array(z.string().regex(/^[0-9A-Z]{26}$/)),
});
export type SitemapResponse = z.infer<typeof sitemapResponseSchema>;

/** Upper bound of each sitemap list (one sitemap file holds at most 50 000 URLs). */
export const SITEMAP_MAX_ITEMS = 10_000;

import { branches, cities, courseCategories, providers, schedules } from '@pusatk3/db';
import {
  LANDING_MIN_PROVIDERS,
  LANDING_MIN_SCHEDULES,
  landingPagesResponseSchema,
  noQuerySchema,
  SITEMAP_MAX_ITEMS,
  sitemapResponseSchema,
} from '@pusatk3/shared';
import { and, asc, count, countDistinct, eq, gte, ne, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { PUBLIC_DIRECTORY_CACHE } from '../lib/cache';
import { getDb } from '../lib/db';
import { validateQuery } from '../lib/validate';
import { jakartaToday, visible } from './directory';

// SEO pages and sitemap (#27, ADR 0023). Public, no login, edge-cached (ADR 0021).
// A category × city page counts upcoming published OFFLINE schedules (online ones belong to no
// city) and is listed only when it passes the thin-content rule. Order never uses the plan.

export const landingRoutes = new Hono<AppEnv>()
  .get('/landing-pages', validateQuery(noQuerySchema), async (c) => {
    const db = getDb(c.env);
    const scheduleCount = count(schedules.id);
    const providerCount = countDistinct(providers.id);
    const rows = await db
      .select({
        categorySlug: courseCategories.slug,
        categoryName: courseCategories.name,
        citySlug: cities.slug,
        cityName: cities.name,
        schedules: scheduleCount,
        providers: providerCount,
        // Real (non-sample) data alone must pass the rule for the page to be indexable, the same
        // rule /sitemap applies after leaving sample data out.
        realSchedules: sql<number>`sum(case when ${providers.isSample} = 0 then 1 else 0 end)`,
        realProviders: sql<number>`count(distinct case when ${providers.isSample} = 0 then ${providers.id} end)`,
      })
      .from(schedules)
      .innerJoin(providers, eq(providers.id, schedules.providerId))
      .innerJoin(courseCategories, eq(courseCategories.id, schedules.categoryId))
      .innerJoin(branches, eq(branches.id, schedules.branchId))
      .innerJoin(cities, eq(cities.id, branches.cityId))
      .where(and(visible(jakartaToday(c.var.now())), eq(schedules.mode, 'offline')))
      .groupBy(courseCategories.id, cities.id)
      .having(
        and(gte(scheduleCount, LANDING_MIN_SCHEDULES), gte(providerCount, LANDING_MIN_PROVIDERS)),
      )
      .orderBy(asc(courseCategories.slug), asc(cities.slug));
    const body = landingPagesResponseSchema.parse({
      items: rows.map((r) => ({
        category: { slug: r.categorySlug, name: r.categoryName },
        city: { slug: r.citySlug, name: r.cityName },
        schedules: r.schedules,
        providers: r.providers,
        isSample:
          Number(r.realSchedules) < LANDING_MIN_SCHEDULES ||
          Number(r.realProviders) < LANDING_MIN_PROVIDERS,
      })),
    });
    c.header('Cache-Control', PUBLIC_DIRECTORY_CACHE);
    return c.json(body);
  })
  // Indexable URLs for sitemap.xml: never sample data (staging only holds samples, so its
  // sitemap lists the homepage only; staging is noindex anyway).
  .get('/sitemap', validateQuery(noQuerySchema), async (c) => {
    const db = getDb(c.env);
    const today = jakartaToday(c.var.now());
    const real = eq(providers.isSample, false);
    const scheduleCount = count(schedules.id);
    const providerCount = countDistinct(providers.id);
    const [landing, profileRows, scheduleRows] = await Promise.all([
      db
        .select({ category: courseCategories.slug, city: cities.slug })
        .from(schedules)
        .innerJoin(providers, eq(providers.id, schedules.providerId))
        .innerJoin(courseCategories, eq(courseCategories.id, schedules.categoryId))
        .innerJoin(branches, eq(branches.id, schedules.branchId))
        .innerJoin(cities, eq(cities.id, branches.cityId))
        .where(and(visible(today), eq(schedules.mode, 'offline'), real))
        .groupBy(courseCategories.id, cities.id)
        .having(
          and(gte(scheduleCount, LANDING_MIN_SCHEDULES), gte(providerCount, LANDING_MIN_PROVIDERS)),
        )
        .orderBy(asc(courseCategories.slug), asc(cities.slug))
        .limit(SITEMAP_MAX_ITEMS),
      db
        .select({ slug: providers.slug })
        .from(providers)
        .where(and(ne(providers.status, 'closed'), real))
        .orderBy(asc(providers.slug))
        .limit(SITEMAP_MAX_ITEMS),
      db
        .select({ id: schedules.id })
        .from(schedules)
        .innerJoin(providers, eq(providers.id, schedules.providerId))
        .where(and(visible(today), real))
        .orderBy(asc(schedules.startDate), asc(schedules.id))
        .limit(SITEMAP_MAX_ITEMS),
    ]);
    const body = sitemapResponseSchema.parse({
      landingPages: landing,
      providers: profileRows.map((p) => p.slug),
      schedules: scheduleRows.map((s) => s.id),
    });
    c.header('Cache-Control', PUBLIC_DIRECTORY_CACHE);
    return c.json(body);
  });

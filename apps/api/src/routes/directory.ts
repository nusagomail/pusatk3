import {
  branches,
  cities,
  courseCategories,
  courseFields,
  providerLicenses,
  providers,
  schedules,
} from '@pusatk3/db';
import {
  citiesQuerySchema,
  citiesResponseSchema,
  PROVIDER_SCHEDULES_LIMIT,
  providerParamsSchema,
  providerProfileSchema,
  scheduleDetailSchema,
  scheduleParamsSchema,
  searchQuerySchema,
  searchResponseSchema,
  SEARCH_MAX_OFFSET,
  type ScheduleSummary,
  type SearchQuery,
} from '@pusatk3/shared';
import { and, asc, eq, gte, lt, lte, ne, sql, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { PUBLIC_DIRECTORY_CACHE, PUBLIC_REFERENCE_CACHE } from '../lib/cache';
import { getDb } from '../lib/db';
import { AppError } from '../lib/errors';
import { validateParam, validateQuery } from '../lib/validate';

// Public directory API (docs/api-contract.md, ADR 0018). No login; responses are edge-cacheable.
// Visible schedules: published, not ended (Asia/Jakarta date), provider not closed.
// Organic order never uses the plan (rule 5): soonest start first, or cheapest first.

/** Today's calendar date in Asia/Jakarta (UTC+7, no daylight saving). */
export function jakartaToday(now = Date.now()): string {
  return new Date(now + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** "2027-01" → "2027-02-01" (exclusive upper bound of the month). */
function nextMonthStart(month: string): string {
  const [year, m] = month.split('-').map(Number) as [number, number];
  return m === 12 ? `${year + 1}-01-01` : `${year}-${String(m + 1).padStart(2, '0')}-01`;
}

/** LIKE pattern for free text, with %, _ and \ escaped (used with ESCAPE '\'). */
function containsPattern(text: string): string {
  return `%${text.toLowerCase().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

const summaryColumns = {
  id: schedules.id,
  title: schedules.title,
  categorySlug: courseCategories.slug,
  categoryName: courseCategories.name,
  issuer: schedules.issuer,
  mode: schedules.mode,
  startDate: schedules.startDate,
  endDate: schedules.endDate,
  priceIdr: schedules.priceIdr,
  level: schedules.level,
  certificateKind: schedules.certificateKind,
  citySlug: cities.slug,
  cityName: cities.name,
  providerSlug: providers.slug,
  providerName: providers.name,
  providerType: providers.type,
  providerVerification: providers.verificationStatus,
  providerIsSample: providers.isSample,
};
type SummaryRow = {
  [K in keyof typeof summaryColumns]: (typeof summaryColumns)[K]['_']['data'] | null;
};

function toSummary(row: SummaryRow): ScheduleSummary {
  return {
    id: row.id as string,
    title: row.title as string,
    category: { slug: row.categorySlug as string, name: row.categoryName as string },
    issuer: row.issuer as ScheduleSummary['issuer'],
    mode: row.mode as ScheduleSummary['mode'],
    startDate: row.startDate as string,
    endDate: row.endDate as string,
    priceIdr: row.priceIdr,
    level: row.level,
    certificateKind: row.certificateKind as ScheduleSummary['certificateKind'],
    city: row.citySlug && row.cityName ? { slug: row.citySlug, name: row.cityName } : null,
    provider: {
      slug: row.providerSlug as string,
      name: row.providerName as string,
      type: row.providerType as ScheduleSummary['provider']['type'],
      verified: row.providerVerification === 'verified',
      isSample: row.providerIsSample === true,
    },
  };
}

/** Schedules joined with what a summary needs; `where` adds the visibility rules. */
function scheduleQuery(db: ReturnType<typeof getDb>, where: SQL | undefined) {
  return db
    .select(summaryColumns)
    .from(schedules)
    .innerJoin(providers, eq(providers.id, schedules.providerId))
    .innerJoin(courseCategories, eq(courseCategories.id, schedules.categoryId))
    .innerJoin(courseFields, eq(courseFields.id, courseCategories.fieldId))
    .leftJoin(branches, eq(branches.id, schedules.branchId))
    .leftJoin(cities, eq(cities.id, branches.cityId))
    .where(where);
}

const visible = (today: string) =>
  and(
    eq(schedules.status, 'published'),
    gte(schedules.endDate, today),
    ne(providers.status, 'closed'),
  );

function searchFilters(q: SearchQuery): (SQL | undefined)[] {
  const filters: (SQL | undefined)[] = [];
  if (q.q) {
    const p = containsPattern(q.q);
    filters.push(
      sql`(lower(${schedules.title}) LIKE ${p} ESCAPE '\\' OR lower(${courseCategories.name}) LIKE ${p} ESCAPE '\\' OR lower(${courseCategories.synonyms}) LIKE ${p} ESCAPE '\\' OR lower(${providers.name}) LIKE ${p} ESCAPE '\\')`,
    );
  }
  if (q.field) filters.push(eq(courseFields.slug, q.field));
  if (q.category) filters.push(eq(courseCategories.slug, q.category));
  if (q.city) filters.push(eq(cities.slug, q.city));
  if (q.mode) filters.push(eq(schedules.mode, q.mode));
  if (q.issuer) filters.push(eq(schedules.issuer, q.issuer));
  if (q.month) {
    filters.push(gte(schedules.startDate, `${q.month}-01`));
    filters.push(lt(schedules.startDate, nextMonthStart(q.month)));
  }
  if (q.priceMin !== undefined) filters.push(gte(schedules.priceIdr, q.priceMin));
  if (q.priceMax !== undefined) filters.push(lte(schedules.priceIdr, q.priceMax));
  if (q.verified) filters.push(eq(providers.verificationStatus, 'verified'));
  return filters;
}

async function licensesOf(db: ReturnType<typeof getDb>, providerId: string) {
  return db
    .select({
      kind: providerLicenses.kind,
      number: providerLicenses.number,
      issuer: providerLicenses.issuer,
      validUntil: providerLicenses.validUntil,
    })
    .from(providerLicenses)
    .where(eq(providerLicenses.providerId, providerId))
    .orderBy(asc(providerLicenses.kind), asc(providerLicenses.number));
}

export const directoryRoutes = new Hono<AppEnv>()
  .get('/search', validateQuery(searchQuerySchema), async (c) => {
    const q = c.req.valid('query');
    const offset = q.cursor ?? 0;
    const order =
      q.sort === 'price'
        ? [sql`${schedules.priceIdr} IS NULL`, asc(schedules.priceIdr), asc(schedules.startDate)]
        : [asc(schedules.startDate)];
    const rows = await scheduleQuery(
      getDb(c.env),
      and(visible(jakartaToday()), ...searchFilters(q)),
    )
      .orderBy(...order, asc(schedules.id))
      .limit(q.limit + 1)
      .offset(offset);
    const next = offset + q.limit;
    const hasMore = rows.length > q.limit && next <= SEARCH_MAX_OFFSET;
    const body = searchResponseSchema.parse({
      items: rows.slice(0, q.limit).map(toSummary),
      nextCursor: hasMore ? String(next) : null,
      sponsored: [],
    });
    c.header('Cache-Control', PUBLIC_DIRECTORY_CACHE);
    return c.json(body);
  })
  .get('/schedules/:id', validateParam(scheduleParamsSchema), async (c) => {
    const { id } = c.req.valid('param');
    const db = getDb(c.env);
    const [row] = await db
      .select({
        ...summaryColumns,
        providerId: providers.id,
        description: schedules.description,
        requirements: schedules.requirements,
        quota: schedules.quota,
        branchName: branches.name,
        branchAddress: branches.address,
        whatsapp: providers.whatsapp,
        email: providers.email,
        phone: providers.phone,
        website: providers.website,
      })
      .from(schedules)
      .innerJoin(providers, eq(providers.id, schedules.providerId))
      .innerJoin(courseCategories, eq(courseCategories.id, schedules.categoryId))
      .leftJoin(branches, eq(branches.id, schedules.branchId))
      .leftJoin(cities, eq(cities.id, branches.cityId))
      .where(
        and(
          eq(schedules.id, id),
          eq(schedules.status, 'published'),
          ne(providers.status, 'closed'),
        ),
      )
      .limit(1);
    if (!row) throw new AppError('NOT_FOUND');
    const summary = toSummary(row);
    const body = scheduleDetailSchema.parse({
      ...summary,
      description: row.description,
      requirements: row.requirements,
      quota: row.quota,
      branch:
        row.branchName && row.branchAddress && summary.city
          ? { name: row.branchName, address: row.branchAddress, city: summary.city }
          : null,
      provider: {
        ...summary.provider,
        contact: {
          whatsapp: row.whatsapp,
          email: row.email,
          phone: row.phone,
          website: row.website,
        },
        licenses: await licensesOf(db, row.providerId),
      },
    });
    c.header('Cache-Control', PUBLIC_DIRECTORY_CACHE);
    return c.json(body);
  })
  .get('/providers/:slug', validateParam(providerParamsSchema), async (c) => {
    const { slug } = c.req.valid('param');
    const db = getDb(c.env);
    const [provider] = await db
      .select({
        id: providers.id,
        slug: providers.slug,
        name: providers.name,
        type: providers.type,
        description: providers.description,
        verificationStatus: providers.verificationStatus,
        isSample: providers.isSample,
        whatsapp: providers.whatsapp,
        email: providers.email,
        phone: providers.phone,
        website: providers.website,
      })
      .from(providers)
      .where(and(eq(providers.slug, slug), ne(providers.status, 'closed')))
      .limit(1);
    if (!provider) throw new AppError('NOT_FOUND');

    const branchRows = await db
      .select({
        name: branches.name,
        address: branches.address,
        isMain: branches.isMain,
        citySlug: cities.slug,
        cityName: cities.name,
      })
      .from(branches)
      .innerJoin(cities, eq(cities.id, branches.cityId))
      .where(eq(branches.providerId, provider.id))
      .orderBy(sql`${branches.isMain} DESC`, asc(branches.name));
    const scheduleRows = await scheduleQuery(
      db,
      and(visible(jakartaToday()), eq(schedules.providerId, provider.id)),
    )
      .orderBy(asc(schedules.startDate), asc(schedules.id))
      .limit(PROVIDER_SCHEDULES_LIMIT);

    const body = providerProfileSchema.parse({
      slug: provider.slug,
      name: provider.name,
      type: provider.type,
      verified: provider.verificationStatus === 'verified',
      isSample: provider.isSample,
      description: provider.description,
      contact: {
        whatsapp: provider.whatsapp,
        email: provider.email,
        phone: provider.phone,
        website: provider.website,
      },
      branches: branchRows.map((b) => ({
        name: b.name,
        address: b.address,
        isMain: b.isMain,
        city: { slug: b.citySlug, name: b.cityName },
      })),
      licenses: await licensesOf(db, provider.id),
      schedules: scheduleRows.map(toSummary),
    });
    c.header('Cache-Control', PUBLIC_DIRECTORY_CACHE);
    return c.json(body);
  })
  .get('/cities', validateQuery(citiesQuerySchema), async (c) => {
    const rows = await getDb(c.env)
      .select({ slug: cities.slug, name: cities.name, province: cities.province })
      .from(cities)
      .orderBy(asc(cities.name), asc(cities.slug));
    const body = citiesResponseSchema.parse({ items: rows });
    c.header('Cache-Control', body.items.length > 0 ? PUBLIC_REFERENCE_CACHE : 'no-store');
    return c.json(body);
  });

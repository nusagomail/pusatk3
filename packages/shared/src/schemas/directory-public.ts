import { z } from 'zod';
import {
  certificateKindSchema,
  issuerSchema,
  licenseKindSchema,
  providerTypeSchema,
  scheduleModeSchema,
} from '../constants';
import { slugSchema } from './categories';
import { paginatedSchema, paginationQuerySchema } from './pagination';

// Public directory API (no login): GET /search, /schedules/:id, /providers/:slug, /cities.
// Output schemas are explicit: plan, raw verification status, document keys and other internal
// fields never leave the API. `verified` comes only from the verification status, never from
// the plan (rule 5). `isSample` marks fictional sample data, always labelled "Contoh" in the UI.

/** Whole rupiah as a canonical decimal string ("4500000", not "04500000" or "4.5e6"). */
const rupiahParam = z
  .string()
  .regex(/^(0|[1-9]\d{0,9})$/)
  .transform(Number);

export const SEARCH_SORT_VALUES = ['date', 'price'] as const;

/** Search pages are offset based: the cursor is the next offset, at most SEARCH_MAX_OFFSET. */
export const SEARCH_MAX_OFFSET = 1000;

/** Drops empty values: a search form sends `?q=&city=` for fields left blank. */
const withoutEmptyValues = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).filter(([, v]) => v !== ''))
    : value;

const searchQueryObjectSchema = paginationQuerySchema
  .extend({
    cursor: z
      .string()
      .regex(/^[1-9]\d{0,3}$/)
      .transform(Number)
      .pipe(z.number().max(SEARCH_MAX_OFFSET))
      .optional(),
    /** Free text: schedule title, category name or synonym, provider name. */
    q: z.string().trim().min(1).max(100).optional(),
    /** Bidang K3 slug (e.g. `k3-umum`). */
    field: slugSchema.optional(),
    category: slugSchema.optional(),
    city: slugSchema.optional(),
    mode: scheduleModeSchema.optional(),
    issuer: issuerSchema.optional(),
    /** Start month "YYYY-MM". */
    month: z
      .string()
      .regex(/^20\d{2}-(0[1-9]|1[0-2])$/)
      .optional(),
    priceMin: rupiahParam.optional(),
    priceMax: rupiahParam.optional(),
    /** Only verified providers. */
    verified: z.literal('true').optional(),
    /** `date` (default): soonest start first; `price`: cheapest first, unknown price last. */
    sort: z.enum(SEARCH_SORT_VALUES).default('date'),
  })
  .refine((q) => q.priceMin === undefined || q.priceMax === undefined || q.priceMin <= q.priceMax, {
    message: 'priceMin tidak boleh lebih besar dari priceMax',
    path: ['priceMin'],
  });

export const searchQuerySchema = z.preprocess(withoutEmptyValues, searchQueryObjectSchema);
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const publicProviderRefSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1),
  type: providerTypeSchema,
  verified: z.boolean(),
  isSample: z.boolean(),
});

const cityRefSchema = z.object({ slug: slugSchema, name: z.string().min(1) });

export const scheduleSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.object({ slug: slugSchema, name: z.string().min(1) }),
  issuer: issuerSchema,
  mode: scheduleModeSchema,
  startDate: z.string(),
  endDate: z.string(),
  priceIdr: z.number().int().nullable(),
  level: z.string().nullable(),
  certificateKind: certificateKindSchema,
  /** Null for online schedules. */
  city: cityRefSchema.nullable(),
  provider: publicProviderRefSchema,
});
export type ScheduleSummary = z.infer<typeof scheduleSummarySchema>;

/**
 * Organic results and sponsored slots are always separate lists (rule 5); `sponsored` stays
 * empty until sponsor slots exist (Fase 4) and is always labelled in the UI.
 */
export const searchResponseSchema = paginatedSchema(scheduleSummarySchema).extend({
  sponsored: z.array(scheduleSummarySchema),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

export const publicLicenseSchema = z.object({
  kind: licenseKindSchema,
  number: z.string().min(1),
  issuer: z.string().min(1),
  validUntil: z.string().nullable(),
});

export const publicBranchSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  city: cityRefSchema,
  isMain: z.boolean(),
});

const contactSchema = z.object({
  /** "62…" for wa.me links. */
  whatsapp: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  /** Only https links ever reach a page (a `javascript:` URL would be a stored XSS). */
  website: z.url({ protocol: /^https$/ }).nullable(),
});

export const scheduleDetailSchema = scheduleSummarySchema.extend({
  description: z.string().nullable(),
  requirements: z.string().nullable(),
  quota: z.number().int().nullable(),
  branch: publicBranchSchema.omit({ isMain: true }).nullable(),
  provider: publicProviderRefSchema.extend({
    contact: contactSchema,
    licenses: z.array(publicLicenseSchema),
  }),
});
export type ScheduleDetail = z.infer<typeof scheduleDetailSchema>;

export const providerProfileSchema = publicProviderRefSchema.extend({
  description: z.string().nullable(),
  contact: contactSchema,
  branches: z.array(publicBranchSchema),
  licenses: z.array(publicLicenseSchema),
  /** Upcoming published schedules, soonest first (at most PROVIDER_SCHEDULES_LIMIT). */
  schedules: z.array(scheduleSummarySchema),
});
export type ProviderProfile = z.infer<typeof providerProfileSchema>;
export const PROVIDER_SCHEDULES_LIMIT = 50;

export const scheduleParamsSchema = z.strictObject({ id: z.string().regex(/^[0-9A-Z]{26}$/) });
export const providerParamsSchema = z.strictObject({ slug: slugSchema });
export const citiesQuerySchema = z.strictObject({});
/** Detail and profile take no query parameters (also keeps cache keys canonical, ADR 0021). */
export const noQuerySchema = z.strictObject({});

export const citiesResponseSchema = z.object({
  items: z.array(cityRefSchema.extend({ province: z.string().min(1) })),
});
export type CitiesResponse = z.infer<typeof citiesResponseSchema>;

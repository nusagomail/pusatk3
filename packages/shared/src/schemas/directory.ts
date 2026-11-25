import { z } from 'zod';
import {
  certificateKindSchema,
  issuerSchema,
  licenseKindSchema,
  providerTypeSchema,
  scheduleModeSchema,
} from '../constants';
import { slugSchema } from './categories';
import { whatsappNumberSchema } from './whatsapp';

// Input schemas for directory data (curated import in Fase 1, provider dashboard in Fase 2).
// Verification, status and plan are never part of input: they are set by admins and
// subscriptions only (badge is never tied to payment, CLAUDE.md rule 5).

/** Calendar date "YYYY-MM-DD" (no time zone); must be a real date. */
export const isoDateSchema = z.string().refine((value) => {
  // Years 2000–2099 only: catches typos like 0202 or 20277.
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Tanggal harus berformat YYYY-MM-DD');

/** No control characters (single-line fields); `multiline` also allows newlines and tabs. */
const SINGLE_LINE = /^[^\p{Cc}]*$/u;
const MULTILINE = /^(?:[^\p{Cc}]|[\n\r\t])*$/u;
const noControl = (multiline: boolean) => (multiline ? MULTILINE : SINGLE_LINE);

const text = (max: number) =>
  z.string().trim().min(1).max(max).regex(SINGLE_LINE, 'Teks berisi karakter tidak sah');
/** Optional text: empty or whitespace-only becomes undefined. */
const optionalText = (max: number, multiline = false) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z
      .string()
      .trim()
      .max(max)
      .regex(noControl(multiline), 'Teks berisi karakter tidak sah')
      .optional(),
  );

/** Public https link to a real domain: no credentials, no localhost/IP, normalised. */
const websiteSchema = z
  .url({ protocol: /^https$/, hostname: z.regexes.domain, normalize: true })
  .max(500)
  .refine((value) => {
    const url = new URL(value);
    return url.username === '' && url.password === '';
  }, 'Alamat situs tidak boleh berisi nama pengguna atau kata sandi');
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

export const providerInputSchema = z.strictObject({
  slug: slugSchema,
  name: text(200),
  type: providerTypeSchema,
  description: optionalText(5000, true),
  whatsapp: optional(whatsappNumberSchema),
  email: optional(z.email().max(254).toLowerCase()),
  phone: optional(
    z
      .string()
      .trim()
      .max(30)
      .regex(/^\+?[\d\s()-]{6,}$/, 'Nomor telepon hanya boleh angka, spasi, +, (, ), -'),
  ),
  website: optional(websiteSchema),
});
export type ProviderInput = z.infer<typeof providerInputSchema>;

export const branchInputSchema = z
  .strictObject({
    name: text(200),
    citySlug: slugSchema,
    address: text(500),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    isMain: z.boolean().default(false),
  })
  .refine((b) => (b.lat === undefined) === (b.lng === undefined), {
    message: 'Isi lat dan lng bersamaan',
    path: ['lng'],
  });
export type BranchInput = z.infer<typeof branchInputSchema>;

export const licenseInputSchema = z.strictObject({
  kind: licenseKindSchema,
  number: text(100),
  /** Free text: e.g. "Kemnaker RI", "BNSP", or the LSP name for a TUK. */
  issuer: text(200),
  validUntil: optional(isoDateSchema),
});
export type LicenseInput = z.infer<typeof licenseInputSchema>;

export const scheduleInputSchema = z
  .strictObject({
    categorySlug: slugSchema,
    /** Required for offline schedules: the provider branch where it takes place. */
    branchName: optionalText(200),
    title: text(200),
    issuer: issuerSchema,
    mode: scheduleModeSchema,
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    priceIdr: z.number().int().min(0).max(1_000_000_000).optional(),
    quota: z.number().int().min(1).max(10_000).optional(),
    description: optionalText(5000, true),
    requirements: optionalText(5000, true),
    level: optionalText(100),
    certificateKind: certificateKindSchema,
    /** Input may only draft or publish; `expired` is set by the scheduled job. */
    status: z.enum(['draft', 'published']).default('draft'),
  })
  .refine((s) => s.endDate >= s.startDate, {
    message: 'Tanggal selesai tidak boleh sebelum tanggal mulai',
    path: ['endDate'],
  })
  .refine((s) => (s.mode === 'offline') === (s.branchName !== undefined), {
    message: 'Jadwal offline wajib punya cabang; jadwal online tanpa cabang',
    path: ['branchName'],
  });
export type ScheduleInput = z.infer<typeof scheduleInputSchema>;

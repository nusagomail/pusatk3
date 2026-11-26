import { z } from 'zod';
import { slugSchema } from './categories';
import { normalizeWhatsAppNumber } from './whatsapp';

// Leads (#28, ADR 0022). Public, anonymous input: every field is bounded and strict (unknown
// fields are refused). Personal data only in the question form, with explicit consent (UU PDP).

const ULID = /^[0-9A-Z]{26}$/;
/** No control or invisible format characters (e.g. U+202E reverses text in the provider inbox). */
const NAME_CHARS = /^[^\p{Cc}\p{Cf}]*$/u;
const MULTILINE = /^(?:[^\p{Cc}]|[\n\r\t])*$/u;

/**
 * Consent text shown next to the checkbox, and its version stored with every form lead (set by
 * the server, so the agreed wording can be proven later). Change the version with the text.
 */
export const LEAD_CONSENT_VERSION = '2026-11-26';
export const LEAD_CONSENT_TEXT =
  'Saya setuju PusatK3 meneruskan nama, kontak, dan pertanyaan ini ke penyedia pelatihan yang ' +
  'saya hubungi, hanya untuk menjawab pertanyaan saya. Data pribadi disimpan paling lama 12 bulan, ' +
  'lalu dihapus. Saya bisa meminta akses atau penghapusan data lewat kontak PusatK3.';

/** Turnstile widget action of the question form (checked by the API). */
export const TURNSTILE_LEAD_ACTION = 'lead-form';

export const LEAD_NAME_MAX = 100;
export const LEAD_MESSAGE_MAX = 1000;
/** Turnstile tokens are up to 2048 characters (Cloudflare docs). */
export const TURNSTILE_TOKEN_MAX = 2048;

const scheduleIdSchema = z.string().regex(ULID, 'ID jadwal tidak valid');

/** Indonesian phone number, normalised to "62…" (same rules as WhatsApp numbers). */
const leadPhoneSchema = z
  .string()
  .trim()
  .max(30)
  .transform((value, ctx) => {
    const normalized = normalizeWhatsAppNumber(value);
    if (normalized === null) {
      ctx.addIssue({ code: 'custom', message: 'Nomor HP Indonesia tidak valid' });
      return z.NEVER;
    }
    return normalized;
  });

/** POST /api/v1/leads: "Kirim pertanyaan" form on a schedule. */
export const leadFormRequestSchema = z
  .strictObject({
    scheduleId: scheduleIdSchema,
    name: z
      .string()
      .trim()
      .min(2, 'Nama minimal 2 huruf')
      .max(LEAD_NAME_MAX)
      .regex(NAME_CHARS, 'Nama berisi karakter tidak sah'),
    // Empty strings from an HTML form mean "not given".
    phone: z.preprocess((v) => (v === '' ? undefined : v), leadPhoneSchema.optional()),
    email: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z
        .string()
        .trim()
        .pipe(z.email('Email tidak valid').max(254))
        .transform((v) => v.toLowerCase())
        .optional(),
    ),
    message: z
      .string()
      .trim()
      .min(10, 'Pertanyaan minimal 10 karakter')
      .max(LEAD_MESSAGE_MAX)
      .regex(MULTILINE, 'Pertanyaan berisi karakter tidak sah'),
    /** The visitor ticked "my data may be shared with this provider" (UU PDP). */
    consent: z.literal(true, 'Persetujuan wajib dicentang'),
    turnstileToken: z.string().min(1, 'Verifikasi anti-bot wajib').max(TURNSTILE_TOKEN_MAX),
  })
  .refine((v) => v.phone !== undefined || v.email !== undefined, {
    message: 'Isi nomor HP atau email',
    path: ['phone'],
  });
export type LeadFormRequest = z.infer<typeof leadFormRequestSchema>;

/** POST /api/v1/leads/whatsapp: a WhatsApp button click (no personal data at all). */
export const leadClickRequestSchema = z.union([
  z.strictObject({ scheduleId: scheduleIdSchema }),
  z.strictObject({ providerSlug: slugSchema }),
]);
export type LeadClickRequest = z.infer<typeof leadClickRequestSchema>;

/** Both lead endpoints answer only this: nothing about the provider or the stored lead. */
export const leadAcceptedResponseSchema = z.strictObject({ status: z.literal('received') });
export type LeadAcceptedResponse = z.infer<typeof leadAcceptedResponseSchema>;

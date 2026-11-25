import { z } from 'zod';

/**
 * Normalises an Indonesian phone/WhatsApp number to wa.me format: "62" + national number,
 * digits only. Accepts "0812-…", "+62 812 …", "+62 (0)812 …", "(021) …". Returns null when the
 * result is not a plausible Indonesian number (10–15 digits, no 0 after the country code).
 */
export function normalizeWhatsAppNumber(input: string): string | null {
  const compact = input.replace(/[\s().-]/g, '');
  if (!/^\+?\d+$/.test(compact)) return null;
  let digits = compact.replace(/^\+/, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  // "+62 (0)812…" / "+62 0812…": drop the trunk 0 after the country code.
  if (digits.startsWith('620')) digits = `62${digits.slice(3)}`;
  return /^62[1-9]\d{7,12}$/.test(digits) ? digits : null;
}

/** Validates and normalises a WhatsApp number (use when storing provider data). */
export const whatsappNumberSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeWhatsAppNumber(value);
  if (normalized === null) {
    ctx.addIssue({ code: 'custom', message: 'Nomor WhatsApp Indonesia tidak valid' });
    return z.NEVER;
  }
  return normalized;
});

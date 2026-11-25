/**
 * Normalises an Indonesian phone number to wa.me format (62…, digits only).
 * Accepts "0812-…", "+62 812 …", "62812…". Throws for anything else so a broken
 * number never produces a wrong WhatsApp link.
 */
export function toWhatsAppNumber(input: string): string {
  let digits = input.replace(/[\s().+-]/g, '');
  if (!/^\d+$/.test(digits)) throw new Error('WhatsApp number must contain digits only');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  if (!digits.startsWith('62') || digits.length < 10 || digits.length > 15) {
    throw new Error('WhatsApp number must be an Indonesian number (62…, 10–15 digits)');
  }
  return digits;
}

export function whatsAppUrl(phone: string, message?: string): string {
  const base = `https://wa.me/${toWhatsAppNumber(phone)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

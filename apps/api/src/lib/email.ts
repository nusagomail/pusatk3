import type { Env } from '../env';

// Transactional email (#47, ADR 0024): Resend REST API, no SDK. Local development never sends:
// messages go to the local log instead, so login works without a Resend account. A deployed
// environment without RESEND_API_KEY reports `unavailable` (callers answer 503), never silent.

export const RESEND_URL = 'https://api.resend.com/emails';
export const EMAIL_FROM = 'PusatK3 <noreply@pusatk3.id>';

export interface Email {
  to: string;
  subject: string;
  /** Plain text body (no HTML: nothing to escape, renders everywhere). */
  text: string;
}

export type EmailResult = 'sent' | 'logged' | 'unavailable';

/** A single plain address (real validation is Zod at the edge): no lists, quotes or controls. */
const LOOKS_LIKE_EMAIL = /^[^\s@<>,;"\p{Cc}]+@[^\s@<>,;"\p{Cc}]+\.[^\s@<>,;"\p{Cc}]+$/u;
const SAFE_SUBJECT = /^[^\p{Cc}]{1,200}$/u;

export async function sendEmail(
  env: Pick<Env, 'ENVIRONMENT' | 'RESEND_API_KEY'>,
  email: Email,
  fetchImpl: typeof fetch = fetch,
): Promise<EmailResult> {
  // Checked in every environment, local included.
  if (!LOOKS_LIKE_EMAIL.test(email.to) || !SAFE_SUBJECT.test(email.subject)) {
    throw new Error('sendEmail: invalid recipient or subject');
  }
  if (env.ENVIRONMENT === 'local') {
    // Local only (wrangler dev): the developer reads the message here instead of an inbox.
    // ENVIRONMENT=local exists only in the top-level wrangler config (tests/wrangler-config.test.ts).
    console.log(`[email lokal] Kepada: ${email.to}\nSubjek: ${email.subject}\n\n${email.text}`);
    return 'logged';
  }
  if (!env.RESEND_API_KEY) return 'unavailable';
  try {
    const res = await fetchImpl(RESEND_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [email.to],
        subject: email.subject,
        text: email.text,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return 'sent';
    // Status only: never the recipient or the content (personal data, codes).
    console.error(JSON.stringify({ event: 'email-failed', status: res.status }));
    return 'unavailable';
  } catch (err) {
    console.error(
      JSON.stringify({ event: 'email-failed', error: err instanceof Error ? err.name : 'Unknown' }),
    );
    return 'unavailable';
  }
}

/** The login code email (Indonesian). The code is the only secret in it. */
export function loginCodeEmail(to: string, code: string): Email {
  return {
    to,
    subject: `Kode masuk PusatK3: ${code}`,
    text:
      `Kode masuk PusatK3 Anda: ${code}\n\n` +
      'Kode ini berlaku 10 menit dan hanya bisa dipakai sekali. Jangan berikan kode ini kepada ' +
      'siapa pun, termasuk yang mengaku dari PusatK3.\n\n' +
      'Bila Anda tidak meminta kode ini, abaikan email ini.\n\nPusatK3 — pusatk3.id',
  };
}

// Cloudflare Turnstile server-side check (#28, ADR 0022). The secret is a Workers secret
// (TURNSTILE_SECRET), never in the repository except Cloudflare's public test keys for local use.

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Cloudflare's documented test secret keys (public, for local development and tests only). They
 * answer the same on siteverify; answering them here keeps local runs offline.
 */
export const TURNSTILE_TEST_SECRETS = {
  alwaysPasses: '1x0000000000000000000000000000000AA',
  alwaysFails: '2x0000000000000000000000000000000AA',
} as const;

export type TurnstileResult = 'passed' | 'failed' | 'unavailable';

/** `unavailable` = no secret configured or Cloudflare unreachable: the form is off, not open. */
export async function verifyTurnstile(
  token: string,
  secret: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileResult> {
  if (!secret) return 'unavailable';
  if (secret === TURNSTILE_TEST_SECRETS.alwaysPasses) return 'passed';
  if (secret === TURNSTILE_TEST_SECRETS.alwaysFails) return 'failed';
  try {
    const res = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return 'unavailable';
    const body = (await res.json()) as { success?: unknown };
    return body.success === true ? 'passed' : 'failed';
  } catch {
    return 'unavailable';
  }
}

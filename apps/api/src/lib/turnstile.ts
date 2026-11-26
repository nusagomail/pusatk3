// Cloudflare Turnstile server-side check (#28, ADR 0022). The secret is a Workers secret
// (TURNSTILE_SECRET), never in the repository; locally the API uses Cloudflare's public test key.

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Cloudflare's documented test secret keys (public). Accepted only in local development: a test
 * key set by mistake in a deployed environment switches the form off instead of disabling the check.
 */
export const TURNSTILE_TEST_SECRETS = {
  alwaysPasses: '1x0000000000000000000000000000000AA',
  alwaysFails: '2x0000000000000000000000000000000AA',
} as const;

/**
 * siteverify error codes that mean "our configuration or Cloudflare is broken", not "a bot":
 * the form answers 503 (and the operator sees it), never "verification failed" to every visitor.
 */
const CONFIGURATION_ERRORS = new Set([
  'missing-input-secret',
  'invalid-input-secret',
  'bad-request',
  'internal-error',
]);

export type TurnstileResult = 'passed' | 'failed' | 'unavailable';

export interface TurnstileCheck {
  token: string;
  secret: string | undefined;
  /** Widget action the token must carry (a token from another form is refused). */
  action: string;
  /** Local development: the test keys are accepted. */
  local: boolean;
  fetch?: typeof fetch;
}

/** `unavailable` = no usable secret, broken configuration or Cloudflare unreachable (form off). */
export async function verifyTurnstile(check: TurnstileCheck): Promise<TurnstileResult> {
  const { secret } = check;
  if (!secret) return 'unavailable';
  if (secret === TURNSTILE_TEST_SECRETS.alwaysPasses) return check.local ? 'passed' : 'unavailable';
  if (secret === TURNSTILE_TEST_SECRETS.alwaysFails) return check.local ? 'failed' : 'unavailable';
  try {
    const res = await (check.fetch ?? fetch)(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, response: check.token }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return 'unavailable';
    const body = (await res.json()) as {
      success?: unknown;
      action?: unknown;
      'error-codes'?: unknown;
    };
    const codes = Array.isArray(body['error-codes']) ? body['error-codes'].map(String) : [];
    if (codes.some((code) => CONFIGURATION_ERRORS.has(code))) {
      // Codes only: never the token or form data.
      console.error(JSON.stringify({ event: 'turnstile-unavailable', codes }));
      return 'unavailable';
    }
    return body.success === true && body.action === check.action ? 'passed' : 'failed';
  } catch {
    return 'unavailable';
  }
}

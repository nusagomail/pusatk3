/** Bindings and vars from wrangler.jsonc. */
export interface Env {
  APP_VERSION: string;
  DB: D1Database;
  /** Turnstile secret (Workers secret in staging/production; test key locally). */
  TURNSTILE_SECRET?: string;
  /** Rate limiters (staging/production only, ADR 0022). */
  RL_READ?: RateLimit;
  RL_LEAD_FORM?: RateLimit;
  RL_LEAD_CLICK?: RateLimit;
}

export type RateLimitBindingName = 'RL_READ' | 'RL_LEAD_FORM' | 'RL_LEAD_CLICK';

export interface AppEnv {
  Bindings: Env;
  Variables: {
    /** Set by the request-id middleware for every request. */
    requestId: string;
    /** Current time in ms; injectable for tests (`createApp({ now })`). */
    now: () => number;
  };
}

type AppBindings = Env;

declare global {
  // Augments the global `Cloudflare` namespace from the Workers types; must be a namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cloudflare {
    // Lets `env` from `cloudflare:test` see the same bindings.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Env extends AppBindings {}
  }
}

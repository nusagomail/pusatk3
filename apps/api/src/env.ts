/** Bindings and vars from wrangler.jsonc. */
export interface Env {
  APP_VERSION: string;
  DB: D1Database;
}

export interface AppEnv {
  Bindings: Env;
  Variables: {
    /** Set by the request-id middleware for every request. */
    requestId: string;
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

import { createApp } from './app';
import type { Env } from './env';
import { getDb } from './lib/db';
import { anonymizeExpiredLeads } from './lib/lead-retention';

// Deployed app: public GET responses go through the edge cache (ADR 0021).
const app = createApp({ edgeCache: { cache: () => caches.default } });

/**
 * Daily Cron Trigger (wrangler.jsonc): lead retention (UU PDP, ADR 0022). Awaited, and a failure
 * is rethrown, so the invocation shows as failed in Cron Events (never silently skipped).
 * Logs hold counts and error names only, never personal data.
 */
export async function scheduled(env: Env, now: number = Date.now()): Promise<void> {
  try {
    const anonymized = await anonymizeExpiredLeads(getDb(env), now);
    console.log(JSON.stringify({ job: 'lead-retention', anonymized }));
  } catch (err) {
    const name = err instanceof Error ? err.name : 'Unknown';
    console.error(JSON.stringify({ job: 'lead-retention', error: name }));
    throw err;
  }
}

export default {
  fetch: app.fetch,
  scheduled: (_controller, env) => scheduled(env),
} satisfies ExportedHandler<Env>;

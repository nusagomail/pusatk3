import { createApp } from './app';
import type { Env } from './env';
import { getDb } from './lib/db';
import { anonymizeExpiredLeads } from './lib/lead-retention';

// Deployed app: public GET responses go through the edge cache (ADR 0021).
const app = createApp({ edgeCache: { cache: () => caches.default } });

export default {
  fetch: app.fetch,
  // Daily Cron Trigger (wrangler.jsonc): lead retention (UU PDP, ADR 0022).
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      anonymizeExpiredLeads(getDb(env)).then((count) => {
        // A count only: never personal data in logs.
        console.log(JSON.stringify({ job: 'lead-retention', anonymized: count }));
      }),
    );
  },
} satisfies ExportedHandler<Env>;

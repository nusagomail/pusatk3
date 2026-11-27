import { createApp } from './app';
import type { Env } from './env';
import { getDb } from './lib/db';
import { anonymizeExpiredLeads } from './lib/lead-retention';
import { expireFinishedSchedules } from './lib/schedule-expiry';

// Deployed app: public GET responses go through the edge cache (ADR 0021).
const app = createApp({ edgeCache: { cache: () => caches.default } });

/** Jobs of the daily Cron Trigger (wrangler.jsonc, 02:17 WIB). Each returns a count to log. */
const DAILY_JOBS: { name: string; key: string; run: (env: Env, now: number) => Promise<number> }[] =
  [
    // Lead retention (UU PDP, ADR 0022).
    {
      name: 'lead-retention',
      key: 'anonymized',
      run: (env, now) => anonymizeExpiredLeads(getDb(env), now),
    },
    // Finished schedules → expired (#57).
    {
      name: 'schedule-expiry',
      key: 'expired',
      run: (env, now) => expireFinishedSchedules(getDb(env), now),
    },
  ];

/**
 * Runs every daily job, each on its own: one failure never skips the others. Any failure is
 * rethrown afterwards, so the invocation shows as failed in Cron Events (never silently skipped).
 * Logs hold counts and error names only, never personal data.
 */
export async function scheduled(env: Env, now: number = Date.now()): Promise<void> {
  const failures: { job: string; error: unknown }[] = [];
  for (const job of DAILY_JOBS) {
    try {
      const count = await job.run(env, now);
      console.log(JSON.stringify({ job: job.name, [job.key]: count }));
    } catch (err) {
      failures.push({ job: job.name, error: err });
      const name = err instanceof Error ? err.name : 'Unknown';
      console.error(JSON.stringify({ job: job.name, error: name }));
    }
  }
  if (failures.length > 0) {
    // Cron Events shows the first error; this line names every job that failed.
    console.error(JSON.stringify({ job: 'daily', failed: failures.map((f) => f.job) }));
    throw failures[0]?.error;
  }
}

export default {
  fetch: app.fetch,
  // scheduledTime keeps "today" stable when an invocation is delayed or retried.
  scheduled: (controller, env) => scheduled(env, controller.scheduledTime),
} satisfies ExportedHandler<Env>;

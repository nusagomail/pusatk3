import { leads } from '@pusatk3/db';
import { and, eq, isNull, lt } from 'drizzle-orm';
import type { getDb } from './db';

// Retention of personal data in leads (UU PDP, ADR 0022): 12 months after a form lead arrives,
// name, phone, email and message are cleared. The row stays (channel, provider, schedule, date),
// so lead counts and statistics keep working. Runs daily from the Cron Trigger (src/index.ts).

export const LEAD_RETENTION_MONTHS = 12;

/** Start of the retention window: same day and time, 12 months earlier (UTC). */
export function retentionCutoff(now: number): Date {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - LEAD_RETENTION_MONTHS);
  return cutoff;
}

/** Clears personal data of form leads older than the retention window; returns how many. */
export async function anonymizeExpiredLeads(
  db: ReturnType<typeof getDb>,
  now: number = Date.now(),
): Promise<number> {
  const at = new Date(now);
  const result = await db
    .update(leads)
    .set({ name: null, phone: null, email: null, message: null, anonymizedAt: at, updatedAt: at })
    .where(
      and(
        eq(leads.channel, 'form'),
        isNull(leads.anonymizedAt),
        lt(leads.createdAt, retentionCutoff(now)),
      ),
    )
    .run();
  return result.meta.changes ?? 0;
}

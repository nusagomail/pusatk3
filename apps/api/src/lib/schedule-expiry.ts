import { appMeta, DATA_VERSION_KEY, schedules } from '@pusatk3/db';
import { and, eq, lt } from 'drizzle-orm';
import { jakartaToday } from './date';
import type { getDb } from './db';

// Daily expiry of finished schedules (#57, docs/skema-db.md): a published schedule whose end date
// is before today (Asia/Jakarta) becomes `expired`. Drafts are never touched.
// The status change and a new data version are written in ONE batch (a D1 transaction), and the
// version is renewed on every run: copies cached after midnight under the new date key (schedule
// still published) are dropped too, and a failed run never leaves changed rows behind a stale
// version (ADR 0021).

export async function expireFinishedSchedules(
  db: ReturnType<typeof getDb>,
  now: number = Date.now(),
): Promise<number> {
  const at = new Date(now);
  const version = crypto.randomUUID();
  const [expired] = await db.batch([
    db
      .update(schedules)
      .set({ status: 'expired', updatedAt: at })
      .where(and(eq(schedules.status, 'published'), lt(schedules.endDate, jakartaToday(now)))),
    db
      .insert(appMeta)
      .values({ key: DATA_VERSION_KEY, value: version, updatedAt: at })
      .onConflictDoUpdate({ target: appMeta.key, set: { value: version, updatedAt: at } }),
  ]);
  return expired.meta.changes ?? 0;
}

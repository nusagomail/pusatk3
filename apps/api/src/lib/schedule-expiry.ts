import { schedules } from '@pusatk3/db';
import { and, eq, lt } from 'drizzle-orm';
import { jakartaToday } from '../routes/directory';
import { bumpDataVersion } from './data-version';
import type { getDb } from './db';

// Daily expiry of finished schedules (#57, docs/skema-db.md): a published schedule whose end date
// is before today (Asia/Jakarta) becomes `expired`. Drafts are never touched. A change announces a
// new data version, so edge-cached pages and answers drop it at once (ADR 0021).

export async function expireFinishedSchedules(
  db: ReturnType<typeof getDb>,
  now: number = Date.now(),
): Promise<number> {
  const result = await db
    .update(schedules)
    .set({ status: 'expired', updatedAt: new Date(now) })
    .where(and(eq(schedules.status, 'published'), lt(schedules.endDate, jakartaToday(now))))
    .run();
  const expired = result.meta.changes ?? 0;
  if (expired > 0) await bumpDataVersion(db, now);
  return expired;
}

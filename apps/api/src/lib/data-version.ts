import { appMeta, DATA_VERSION_KEY } from '@pusatk3/db';
import { eq } from 'drizzle-orm';
import type { getDb } from './db';

/** Version before any import has written one (empty database). */
export const INITIAL_DATA_VERSION = '0';

/** Current public data version (ADR 0021). */
export async function readDataVersion(db: ReturnType<typeof getDb>): Promise<string> {
  const row = await db
    .select({ value: appMeta.value })
    .from(appMeta)
    .where(eq(appMeta.key, DATA_VERSION_KEY))
    .get();
  return row?.value ?? INITIAL_DATA_VERSION;
}

/** Announces changed public data: every cached copy keyed on the old version goes stale. */
export async function bumpDataVersion(
  db: ReturnType<typeof getDb>,
  now: number = Date.now(),
): Promise<string> {
  const version = crypto.randomUUID();
  const at = new Date(now);
  await db
    .insert(appMeta)
    .values({ key: DATA_VERSION_KEY, value: version, updatedAt: at })
    .onConflictDoUpdate({ target: appMeta.key, set: { value: version, updatedAt: at } });
  return version;
}

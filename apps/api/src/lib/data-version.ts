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

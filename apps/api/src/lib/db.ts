import { schema } from '@pusatk3/db';
import { drizzle } from 'drizzle-orm/d1';
import type { Env } from '../env';

/** Drizzle client for the request's D1 binding. Queries only through Drizzle (CLAUDE.md #3). */
export function getDb(env: Env) {
  return drizzle(env.DB, { schema });
}

import type { AdminRole, ProviderMemberRole } from '@pusatk3/shared';
import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';
import { AppError } from '../lib/errors';

// Authorization guards. Order on a route: rate limit → auth guard → validation → handler.
//
// FAIL-CLOSED STUBS: there is no authentication yet (Fase 2, ADR 0003). Every guard
// rejects with 401 and never calls `next()`. Do not loosen these without owner approval
// (CLAUDE.md: auth/roles gate). Client headers/cookies are never trusted as identity.

/** Resolves the provider that owns the target record, from the database — never from input. */
export type ProviderIdResolver = (c: Context<AppEnv>) => Promise<string | null>;

const reject: MiddlewareHandler<AppEnv> = async () => {
  throw new AppError('UNAUTHORIZED');
};

function assertRoles(roles: readonly string[], guard: string): void {
  if (roles.length === 0) throw new Error(`${guard} needs at least one role`);
}

/** Requires a signed-in user. */
export function requireUser(): MiddlewareHandler<AppEnv> {
  return reject;
}

/**
 * Requires membership of the provider returned by `resolveProviderId` with one of `roles`.
 * Example: schedule → its provider_id, then check provider_members.
 */
export function requireProviderRole(
  roles: readonly ProviderMemberRole[],
  _resolveProviderId: ProviderIdResolver,
): MiddlewareHandler<AppEnv> {
  assertRoles(roles, 'requireProviderRole');
  return reject;
}

/** Requires one of the PusatK3 admin `roles`. */
export function requireAdmin(roles: readonly AdminRole[]): MiddlewareHandler<AppEnv> {
  assertRoles(roles, 'requireAdmin');
  return reject;
}

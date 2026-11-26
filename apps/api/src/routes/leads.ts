import { leads, providers, schedules } from '@pusatk3/db';
import {
  leadAcceptedResponseSchema,
  leadClickRequestSchema,
  leadFormRequestSchema,
} from '@pusatk3/shared';
import { and, eq, isNotNull, ne } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { getDb } from '../lib/db';
import { AppError } from '../lib/errors';
import { TURNSTILE_TEST_SECRETS, verifyTurnstile } from '../lib/turnstile';
import { validateJson } from '../lib/validate';
import { rateLimit } from '../middleware/rate-limit';
import { jakartaToday, visible } from './directory';

// Leads (#28, ADR 0022). Public and anonymous by design (no login for visitors, PRD), so the
// controls are: strict Zod input, Turnstile on the form, per-visitor rate limits, and only
// visible schedules/providers. Nothing is ever read back here: providers read their leads in
// the dashboard (Fase 2, with role + ownership checks). Answers never echo stored data, and
// personal data is never logged.

const accepted = () => leadAcceptedResponseSchema.parse({ status: 'received' });

/**
 * Staging/production: the TURNSTILE_SECRET Workers secret (set by the owner); without it the form
 * is off. Local `dev` only: Cloudflare's public "always passes" test key, so dev and e2e work.
 */
function turnstileSecret(env: AppEnv['Bindings']): string | undefined {
  if (env.TURNSTILE_SECRET) return env.TURNSTILE_SECRET;
  return env.APP_VERSION === 'dev' ? TURNSTILE_TEST_SECRETS.alwaysPasses : undefined;
}

export interface LeadRoutesOptions {
  /** Network access for Turnstile siteverify (tests inject a fake). */
  fetch?: typeof fetch;
}

export function leadRoutes(options: LeadRoutesOptions = {}) {
  return (
    new Hono<AppEnv>()
      // "Kirim pertanyaan": only for claimed providers, who can read it (Fase 2 inbox).
      // Collecting personal data for an unclaimed profile nobody reads would break data
      // minimisation (UU PDP) and mislead the visitor.
      .post(
        '/leads',
        rateLimit('RL_LEAD_FORM', 'lead-form'),
        validateJson(leadFormRequestSchema),
        async (c) => {
          const input = c.req.valid('json');
          const turnstile = await verifyTurnstile(
            input.turnstileToken,
            turnstileSecret(c.env),
            options.fetch,
          );
          if (turnstile === 'unavailable') throw new AppError('SERVICE_UNAVAILABLE');
          if (turnstile === 'failed') {
            throw new AppError(
              'FORBIDDEN',
              'Verifikasi anti-bot gagal. Muat ulang lalu coba lagi.',
            );
          }

          const db = getDb(c.env);
          const [target] = await db
            .select({ scheduleId: schedules.id, providerId: providers.id })
            .from(schedules)
            .innerJoin(providers, eq(providers.id, schedules.providerId))
            .where(
              and(
                eq(schedules.id, input.scheduleId),
                visible(jakartaToday(c.var.now())),
                eq(providers.status, 'claimed'),
              ),
            )
            .limit(1);
          if (!target) throw new AppError('NOT_FOUND');

          const now = new Date(c.var.now());
          await db.insert(leads).values({
            providerId: target.providerId,
            scheduleId: target.scheduleId,
            channel: 'form',
            name: input.name,
            phone: input.phone ?? null,
            email: input.email ?? null,
            message: input.message,
            consentAt: now,
            createdAt: now,
            updatedAt: now,
          });
          c.header('Cache-Control', 'no-store');
          return c.json(accepted(), 201);
        },
      )
      // WhatsApp button: counts the click only (no personal data, so no Turnstile: the visitor
      // is already on the way to WhatsApp). Only providers that have a WhatsApp number.
      .post(
        '/leads/whatsapp',
        rateLimit('RL_LEAD_CLICK', 'lead-click'),
        validateJson(leadClickRequestSchema),
        async (c) => {
          const input = c.req.valid('json');
          const db = getDb(c.env);
          const hasWhatsapp = isNotNull(providers.whatsapp);
          let target: { providerId: string; scheduleId: string | null } | undefined;
          if ('scheduleId' in input) {
            [target] = await db
              .select({ providerId: providers.id, scheduleId: schedules.id })
              .from(schedules)
              .innerJoin(providers, eq(providers.id, schedules.providerId))
              .where(
                and(
                  eq(schedules.id, input.scheduleId),
                  visible(jakartaToday(c.var.now())),
                  hasWhatsapp,
                ),
              )
              .limit(1);
          } else {
            const [provider] = await db
              .select({ providerId: providers.id })
              .from(providers)
              .where(
                and(
                  eq(providers.slug, input.providerSlug),
                  ne(providers.status, 'closed'),
                  hasWhatsapp,
                ),
              )
              .limit(1);
            target = provider && { providerId: provider.providerId, scheduleId: null };
          }
          if (!target) throw new AppError('NOT_FOUND');

          const now = new Date(c.var.now());
          await db.insert(leads).values({
            providerId: target.providerId,
            scheduleId: target.scheduleId,
            channel: 'whatsapp',
            createdAt: now,
            updatedAt: now,
          });
          c.header('Cache-Control', 'no-store');
          return c.json(accepted(), 202);
        },
      )
  );
}

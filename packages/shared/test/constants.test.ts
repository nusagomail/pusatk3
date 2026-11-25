import { describe, expect, it } from 'vitest';
import {
  ADMIN_ROLE_VALUES,
  CERTIFICATE_KIND_VALUES,
  CLAIM_STATUS_VALUES,
  ISSUER_VALUES,
  LEAD_CHANNEL_VALUES,
  LEAD_STATUS_VALUES,
  LICENSE_KIND_VALUES,
  LOCALE_VALUES,
  PROVIDER_MEMBER_ROLE_VALUES,
  PROVIDER_STATUS_VALUES,
  PROVIDER_TYPE_VALUES,
  REVIEW_STATUS_VALUES,
  SCHEDULE_MODE_VALUES,
  SCHEDULE_STATUS_VALUES,
  VERIFICATION_STATUS_VALUES,
  adminRoleSchema,
  certificateKindSchema,
  claimStatusSchema,
  issuerSchema,
  leadChannelSchema,
  leadStatusSchema,
  licenseKindSchema,
  localeSchema,
  providerMemberRoleSchema,
  providerStatusSchema,
  providerTypeSchema,
  reviewStatusSchema,
  scheduleModeSchema,
  scheduleStatusSchema,
  verificationStatusSchema,
} from '../src/index';

// Expected values are copied from docs/skema-db.md (source of truth).
const cases = [
  ['provider type', PROVIDER_TYPE_VALUES, providerTypeSchema, ['pjk3', 'lsp', 'tuk']],
  [
    'provider member role',
    PROVIDER_MEMBER_ROLE_VALUES,
    providerMemberRoleSchema,
    ['owner', 'admin', 'staff'],
  ],
  [
    'admin role',
    ADMIN_ROLE_VALUES,
    adminRoleSchema,
    ['super_admin', 'curator', 'moderator', 'support'],
  ],
  [
    'provider status',
    PROVIDER_STATUS_VALUES,
    providerStatusSchema,
    ['unclaimed', 'claimed', 'closed'],
  ],
  [
    'verification status',
    VERIFICATION_STATUS_VALUES,
    verificationStatusSchema,
    ['none', 'pending', 'verified', 'suspended'],
  ],
  ['claim status', CLAIM_STATUS_VALUES, claimStatusSchema, ['pending', 'approved', 'rejected']],
  ['license kind', LICENSE_KIND_VALUES, licenseKindSchema, ['izin_pjk3', 'lisensi_lsp', 'tuk']],
  ['issuer', ISSUER_VALUES, issuerSchema, ['kemnaker', 'bnsp', 'pupr', 'esdm', 'intl']],
  ['schedule mode', SCHEDULE_MODE_VALUES, scheduleModeSchema, ['offline', 'online']],
  [
    'schedule status',
    SCHEDULE_STATUS_VALUES,
    scheduleStatusSchema,
    ['draft', 'published', 'expired'],
  ],
  [
    'certificate kind',
    CERTIFICATE_KIND_VALUES,
    certificateKindSchema,
    ['official', 'training_only'],
  ],
  ['lead channel', LEAD_CHANNEL_VALUES, leadChannelSchema, ['whatsapp', 'form']],
  [
    'lead status',
    LEAD_STATUS_VALUES,
    leadStatusSchema,
    ['new', 'contacted', 'registered', 'closed'],
  ],
  ['review status', REVIEW_STATUS_VALUES, reviewStatusSchema, ['pending', 'published', 'hidden']],
  ['locale', LOCALE_VALUES, localeSchema, ['id', 'en']],
] as const;

describe.each(cases)('%s', (_name, values, schema, expected) => {
  it('matches docs/skema-db.md', () => {
    expect([...values]).toEqual(expected);
  });

  it('accepts every documented value', () => {
    for (const value of expected) expect(schema.parse(value)).toBe(value);
  });

  it('rejects unknown, differently cased and non-string values', () => {
    expect(schema.safeParse('unknown').success).toBe(false);
    expect(schema.safeParse(expected[0].toUpperCase()).success).toBe(false);
    expect(schema.safeParse(undefined).success).toBe(false);
    expect(schema.safeParse(1).success).toBe(false);
  });
});

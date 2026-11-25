import { z } from 'zod';

// Domain constants. Values mirror docs/skema-db.md exactly (source of truth);
// change both together. Changing roles is an owner approval gate (CLAUDE.md).

export const PROVIDER_TYPE_VALUES = ['pjk3', 'lsp', 'tuk'] as const;
export const providerTypeSchema = z.enum(PROVIDER_TYPE_VALUES);
export type ProviderType = z.infer<typeof providerTypeSchema>;

export const PROVIDER_MEMBER_ROLE_VALUES = ['owner', 'admin', 'staff'] as const;
export const providerMemberRoleSchema = z.enum(PROVIDER_MEMBER_ROLE_VALUES);
export type ProviderMemberRole = z.infer<typeof providerMemberRoleSchema>;

export const ADMIN_ROLE_VALUES = ['super_admin', 'curator', 'moderator', 'support'] as const;
export const adminRoleSchema = z.enum(ADMIN_ROLE_VALUES);
export type AdminRole = z.infer<typeof adminRoleSchema>;

export const PROVIDER_STATUS_VALUES = ['unclaimed', 'claimed', 'closed'] as const;
export const providerStatusSchema = z.enum(PROVIDER_STATUS_VALUES);
export type ProviderStatus = z.infer<typeof providerStatusSchema>;

export const VERIFICATION_STATUS_VALUES = ['none', 'pending', 'verified', 'suspended'] as const;
export const verificationStatusSchema = z.enum(VERIFICATION_STATUS_VALUES);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export const CLAIM_STATUS_VALUES = ['pending', 'approved', 'rejected'] as const;
export const claimStatusSchema = z.enum(CLAIM_STATUS_VALUES);
export type ClaimStatus = z.infer<typeof claimStatusSchema>;

export const LICENSE_KIND_VALUES = ['izin_pjk3', 'lisensi_lsp', 'tuk'] as const;
export const licenseKindSchema = z.enum(LICENSE_KIND_VALUES);
export type LicenseKind = z.infer<typeof licenseKindSchema>;

/** Certificate issuers. Uppercase codes in docs/kategori-k3.md map to these on import. */
export const ISSUER_VALUES = ['kemnaker', 'bnsp', 'pupr', 'esdm', 'intl'] as const;
export const issuerSchema = z.enum(ISSUER_VALUES);
export type Issuer = z.infer<typeof issuerSchema>;

export const SCHEDULE_MODE_VALUES = ['offline', 'online'] as const;
export const scheduleModeSchema = z.enum(SCHEDULE_MODE_VALUES);
export type ScheduleMode = z.infer<typeof scheduleModeSchema>;

export const SCHEDULE_STATUS_VALUES = ['draft', 'published', 'expired'] as const;
export const scheduleStatusSchema = z.enum(SCHEDULE_STATUS_VALUES);
export type ScheduleStatus = z.infer<typeof scheduleStatusSchema>;

/** `training_only` must be labelled "Sertifikat pelatihan (bukan lisensi)" in the UI. */
export const CERTIFICATE_KIND_VALUES = ['official', 'training_only'] as const;
export const certificateKindSchema = z.enum(CERTIFICATE_KIND_VALUES);
export type CertificateKind = z.infer<typeof certificateKindSchema>;

export const LEAD_CHANNEL_VALUES = ['whatsapp', 'form'] as const;
export const leadChannelSchema = z.enum(LEAD_CHANNEL_VALUES);
export type LeadChannel = z.infer<typeof leadChannelSchema>;

export const LEAD_STATUS_VALUES = ['new', 'contacted', 'registered', 'closed'] as const;
export const leadStatusSchema = z.enum(LEAD_STATUS_VALUES);
export type LeadStatus = z.infer<typeof leadStatusSchema>;

export const REVIEW_STATUS_VALUES = ['pending', 'published', 'hidden'] as const;
export const reviewStatusSchema = z.enum(REVIEW_STATUS_VALUES);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

export const LOCALE_VALUES = ['id', 'en'] as const;
export const localeSchema = z.enum(LOCALE_VALUES);
export type Locale = z.infer<typeof localeSchema>;

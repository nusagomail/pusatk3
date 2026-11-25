interface ImportMetaEnv {
  /** Public https base URL of the media bucket (R2/CDN) holding the intro video. Optional. */
  readonly PUBLIC_MEDIA_BASE_URL?: string;
  /** Target environment at build time; "production" only for production, else noindex (ADR 0011). */
  readonly CLOUDFLARE_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

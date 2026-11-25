interface ImportMetaEnv {
  /** Public https base URL of the media bucket (R2/CDN) holding the intro video. Optional. */
  readonly PUBLIC_MEDIA_BASE_URL?: string;
  /** "production" only for the production build; anything else is noindex (ADR 0011). */
  readonly DEPLOY_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

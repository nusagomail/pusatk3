interface ImportMetaEnv {
  /** Public https base URL of the media bucket (R2/CDN) holding the intro video. Optional. */
  readonly PUBLIC_MEDIA_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  /** Public https base URL of the media bucket (R2/CDN) holding the intro video. Optional. */
  readonly PUBLIC_MEDIA_BASE_URL?: string;
  /** Target environment at build time; "production" only for production, else noindex (ADR 0011). */
  readonly CLOUDFLARE_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Cloudflare runtime bindings (wrangler.jsonc). Only what the web app uses is typed here. */
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
  export function waitUntil(promise: Promise<unknown>): void;
}

/** Unique per build (astro.config.ts `vite.define`); part of the page cache keys (ADR 0021). */
declare const __PUSATK3_BUILD_ID__: string;

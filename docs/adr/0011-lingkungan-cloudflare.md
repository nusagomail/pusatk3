# ADR 0011: Lingkungan Cloudflare (lokal, staging, production)

Status: diterima · 25 November 2026 · issue #7. Desain: `docs/superpowers/specs/2026-11-25-env-design.md`.

## Konteks
API dan web perlu dideploy terpisah ke staging (otomatis dari `main`, #8) dan production (manual, persetujuan pemilik). Domain `pusatk3.id` belum ada di Cloudflare. Akun Cloudflare juga berisi resource proyek lain yang tidak boleh tersentuh.

## Keputusan
- **Satu file `wrangler.jsonc` per app** dengan tingkat atas = lokal, `env.staging`, dan `env.production`. Wrangler tidak mewariskan `vars`, `d1_databases`, maupun `routes` ke environment, jadi tiap environment menuliskannya sendiri. Dijaga oleh `tests/wrangler-config.test.ts`.
- **Nama:** Worker `pusatk3-{api,web}-{staging,production}`; D1 `pusatk3-staging` / `pusatk3-production`; R2 `pusatk3-media-staging` / `pusatk3-media-production`.
- **Staging** (keputusan pemilik 1A): di `*.workers.dev`, observability aktif (hanya data contoh). Resource staging dibuat lewat konektor Cloudflare (keputusan 2A): D1 `pusatk3-staging` (`b8fcd041-…`, lokasi APAC), R2 `pusatk3-media-staging` (APAC, belum publik).
- **Production:** di `pusatk3.id/*` (web) dan `pusatk3.id/api/*` (API, satu origin sehingga tanpa CORS); tanpa `workers.dev`/preview URL; observability mati sampai kebijakan privasi (Fase 3) karena log memuat URL lengkap. ID D1 production berupa teks penanda `ISI-ID-D1-PRODUCTION-OLEH-PEMILIK` yang diganti pemilik; CI (#8) wajib menolak deploy selama teks penanda masih ada.
- **Indeks mesin pencari:** hanya build web dengan `DEPLOY_ENV=production` yang boleh diindeks; build lain (staging, lokal, variabel lupa diisi) otomatis `X-Robots-Tag: noindex, nofollow` + `robots.txt` `Disallow: /`. API selalu `X-Robots-Tag: noindex`.
- **Build web per environment:** `CLOUDFLARE_ENV=<env> DEPLOY_ENV=<env> PUBLIC_MEDIA_BASE_URL=<url> pnpm --filter @pusatk3/web build`, lalu deploy hasil build. `APP_VERSION` API diisi CI dengan SHA commit.
- **Secret:** tidak ada di repo. Lokal di `.dev.vars` (contoh: `apps/api/.dev.vars.example`); staging/production diisi pemilik. Hook pengaman memblokir `wrangler secret put|delete`, deploy production, dan setiap operasi D1 `--remote` dari sesi Claude Code.

## Konsekuensi
- Langkah pemilik (pindah domain, resource production, secret CI, video): `docs/setup-cloudflare.md`.
- Staging dan production web berbeda origin dengan API staging (`*.workers.dev`) sampai staging pindah ke `staging.pusatk3.id`; bila web perlu memanggil API dari browser sebelum itu, CORS harus diputuskan (Fase 1).
- Saat Cache Rules/Cache API aktif (Fase 1), deploy wajib mem-purge HTML (ADR 0010).

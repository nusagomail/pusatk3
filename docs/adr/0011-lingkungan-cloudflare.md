# ADR 0011: Lingkungan Cloudflare (lokal, staging, production)

Status: diterima · 25 November 2026 · issue #7. Desain: `docs/superpowers/specs/2026-11-25-env-design.md`. Akun bersama: ADR 0016 (#32).

## Konteks
API dan web perlu dideploy terpisah ke staging (otomatis dari `main`, #8) dan production (manual, persetujuan pemilik). Domain `pusatk3.id` belum ada di Cloudflare. Akun Cloudflare juga berisi resource proyek lain yang tidak boleh tersentuh.

## Keputusan
- **Satu file `wrangler.jsonc` per app** dengan tingkat atas = lokal, `env.staging`, dan `env.production`. Wrangler tidak mewariskan `vars`, `d1_databases`, maupun `routes` ke environment, jadi tiap environment menuliskannya sendiri. Dijaga oleh `tests/wrangler-config.test.ts`.
- **Nama:** Worker `pusatk3-{api,web}-{staging,production}`; D1 `pusatk3-staging` / `pusatk3-production`; R2 `pusatk3-media-staging` / `pusatk3-media-production`.
- **Staging** (keputusan pemilik 1A): di `*.workers.dev`, observability aktif (hanya data contoh). Resource staging dibuat lewat konektor Cloudflare (keputusan 2A): D1 `pusatk3-staging` (`b8fcd041-…`, lokasi APAC), R2 `pusatk3-media-staging` (APAC, belum publik).
- **Production:** di `pusatk3.id/*` (web) dan `pusatk3.id/api/*` (API, satu origin sehingga tanpa CORS); tanpa `workers.dev`/preview URL; observability mati sampai kebijakan privasi (Fase 3) karena log memuat URL lengkap. ID D1 production berupa teks penanda `ISI-ID-D1-PRODUCTION-OLEH-PEMILIK` yang diganti pemilik; CI (#8) wajib menolak deploy selama teks penanda masih ada.
- **Indeks mesin pencari:** hanya build web dengan `CLOUDFLARE_ENV` bernilai `production` yang boleh diindeks (satu variabel yang juga dipakai adapter untuk memilih config wrangler, jadi keduanya tidak bisa berbeda); build lain (staging, lokal, variabel lupa diisi) otomatis `X-Robots-Tag: noindex, nofollow` + `robots.txt` `Disallow: /`. API selalu `X-Robots-Tag: noindex`.
- **Build web per environment:** `CLOUDFLARE_ENV=<env> PUBLIC_MEDIA_BASE_URL=<url> pnpm --filter @pusatk3/web build`, lalu deploy hasil build. Turborepo memasukkan kedua variabel ke hash cache build (`turbo.json`), agar artefak staging tidak terpakai untuk production. `APP_VERSION` API diisi CI dengan SHA commit.
- **Hook pengaman** (`.claude/hooks/guard.sh`, dites `tests/guard-hook.test.ts`) memblokir dari sesi Claude Code: semua operasi D1 remote (termasuk subperintah yang selalu remote: create/delete/info/list/insights/time-travel), `wrangler dev --remote`, deploy/versions/rollback/delete/triggers production dalam bentuk apa pun, `CLOUDFLARE_ENV` production, deploy biasa saat hasil build web menargetkan production, dan perubahan secret.
- **Secret:** tidak ada di repo. Lokal di `.dev.vars` (contoh: `apps/api/.dev.vars.example`); staging/production diisi pemilik. Hook pengaman memblokir `wrangler secret put|delete`, deploy production, dan setiap operasi D1 `--remote` dari sesi Claude Code.

## Konsekuensi
- Langkah pemilik (pindah domain, resource production, secret CI, video): `docs/setup-cloudflare.md`.
- **Akun Cloudflare dipakai bersama proyek lain.** Izin token API *Workers Scripts: Edit* dan *D1: Edit* berlaku untuk seluruh akun, jadi token CI secara teknis bisa mengubah resource proyek lain. Sejak ADR 0015, token build staging (Workers Builds) berjalan selama install dan build di akun bersama ini. Pemilik memutuskan PusatK3 tetap di akun bersama ini; risiko dan jaring pengamannya di **ADR 0016**.
- `public/_headers` tidak berlaku untuk respons Worker: halaman SSR pertama (Fase 1) wajib memasang `X-Robots-Tag` staging lewat middleware Astro.
- `robots.txt` `Disallow` membuat crawler tidak membaca `noindex`, sehingga URL staging yang ditautkan di tempat lain masih bisa muncul tanpa isi. Sebelum login (email OTP, Fase 2) tersedia di staging, pertimbangkan Cloudflare Access di depan staging.
- Web staging dan API staging berbeda origin (dua subdomain `*.workers.dev`) sampai staging pindah ke `staging.pusatk3.id`; bila web perlu memanggil API dari browser sebelum itu, CORS harus diputuskan (Fase 1).
- Saat Cache Rules/Cache API aktif (Fase 1), deploy wajib mem-purge HTML (ADR 0010).

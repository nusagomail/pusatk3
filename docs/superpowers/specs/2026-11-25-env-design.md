# Desain: lingkungan Cloudflare staging & production (issue #7)

Status: disetujui pemilik, 25 November 2026 (1A: staging di `*.workers.dev`, production di `pusatk3.id` setelah domain pindah ke Cloudflare; 2A: resource staging dibuat lewat konektor Cloudflare, resource production dibuat pemilik). Hook pengaman diperketat (keputusan pemilik di #4, opsi A).

## Maksud

Konfigurasi deploy terpisah untuk staging dan production (API dan web), nama resource `pusatk3-*`, tanpa deploy di issue ini.

## Tujuan

- `env.staging` dan `env.production` di `apps/api/wrangler.jsonc` dan `apps/web/wrangler.jsonc`.
- D1 `pusatk3-staging` (dibuat sekarang) dan `pusatk3-production` (ID diisi pemilik; teks penanda sampai saat itu). R2 `pusatk3-media-staging` untuk video (production: `pusatk3-media-production`, dibuat pemilik).
- Staging tidak diindeks (X-Robots-Tag + robots.txt) — build web dengan `CLOUDFLARE_ENV` (satu variabel; awalnya `DEPLOY_ENV`, disatukan setelah review); bawaan = bukan production (aman).
- Observability: staging aktif, production mati sampai Fase 3.
- `.dev.vars.example`, dokumentasi lingkungan, langkah pemilik (pindah domain, resource production, secret CI).
- Hook pengaman memblokir `--remote` untuk semua perintah D1 dan skrip `db:*`.

## Bukan tujuan

Deploy dan GitHub Actions (#8), migrasi remote (#8, lewat CI), custom domain staging.

## Gerbang persetujuan

Binding production: konfigurasi saja; resource, ID, dan secret production diisi pemilik. Hook pengaman: diubah atas persetujuan pemilik.

# ADR 0015: Deploy staging lewat Cloudflare Workers Builds

Status: diterima · 25 November 2026 · keputusan pemilik ("ribet, beresin aja"). Menggantikan bagian staging dari ADR 0012.

## Konteks
Deploy staging lewat GitHub Actions (ADR 0012) butuh token Cloudflare yang disimpan sebagai secret environment GitHub. Pemilik memilih menghubungkan repo langsung ke Cloudflare (Workers Builds), sehingga tidak ada token yang perlu disalin ke GitHub.

## Keputusan
- **Dua Worker staging terhubung ke repo `nusagomail/pusatk3`, cabang `main` saja** (tidak ada build untuk cabang lain atau PR):

  | Worker | Folder | Build | Deploy |
  | --- | --- | --- | --- |
  | `pusatk3-api-staging` | `apps/api` | — | migrasi D1 staging (`--env staging --remote`), lalu `wrangler deploy --env staging --var APP_VERSION:$WORKERS_CI_COMMIT_SHA` |
  | `pusatk3-web-staging` | `apps/web` | `pnpm run build` dengan variabel build `CLOUDFLARE_ENV=staging` | `wrangler deploy` (konfigurasi hasil build) |

- Token build `pusatk3 build token` dikelola Cloudflare, tidak pernah ada di repo atau GitHub.
- `.github/workflows/deploy-staging.yml` dihapus agar tidak ada dua jalur deploy. `tests/workflows.test.ts` memastikan tidak ada workflow GitHub yang men-deploy staging.
- **Production tidak berubah:** tetap `deploy-production.yml` manual dengan persetujuan environment `production` (ADR 0012), sesudah domain dan data asli ada.

## Konsekuensi
- Deploy staging berjalan untuk setiap commit di `main` **tanpa menunggu CI**. Penjaganya: PR hanya di-merge bila CI (termasuk e2e) hijau. Bila `main` rusak, staging ikut rusak sampai perbaikan di-merge; production tidak terpengaruh.
- Uji asap otomatis setelah deploy (health, `noindex`) tidak lagi berjalan. Cek manual di alamat staging, atau tambahkan langkah uji asap ke perintah deploy bila diperlukan.
- API dan web di-build terpisah dan bisa selesai tidak bersamaan; perubahan yang butuh keduanya sekaligus sebaiknya kompatibel mundur.
- Pengaturan build ada di dashboard Cloudflare (Worker → **Settings → Build**), bukan di repo. Ubah dengan hati-hati dan catat di ADR ini.
- Sesi Claude Code tidak bisa membuka `*.workers.dev` (jaringan sesi dibatasi); hasil deploy dicek lewat log build di Cloudflare.

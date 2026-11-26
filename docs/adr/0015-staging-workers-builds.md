# ADR 0015: Deploy staging lewat Cloudflare Workers Builds

Status: diterima · 25 November 2026 · keputusan pemilik ("ribet, beresin aja"). Menggantikan bagian staging dari ADR 0012. Langkah impor data contoh ditambahkan di #22 (ADR 0017).

## Konteks
Deploy staging lewat GitHub Actions (ADR 0012) butuh token Cloudflare yang disimpan sebagai secret environment GitHub. Pemilik memilih menghubungkan repo langsung ke Cloudflare (Workers Builds), sehingga tidak ada token yang perlu disalin ke GitHub.

## Keputusan
- **Dua Worker staging terhubung ke repo `nusagomail/pusatk3`, cabang `main` saja** (tidak ada build untuk cabang lain atau PR):

  | Worker | Folder | Build | Deploy |
  | --- | --- | --- | --- |
  | `pusatk3-api-staging` | `apps/api` | `true` | `npx wrangler d1 migrations apply DB --env staging --remote && npx tsx scripts/import-sql.ts --dir ../../docs/data/contoh --sample --out .wrangler/import/contoh.sql && npx wrangler d1 execute DB --env staging --remote --file .wrangler/import/contoh.sql && npx wrangler deploy --env staging --var APP_VERSION:$(git rev-parse HEAD) && curl -sf --retry 6 --retry-delay 5 --retry-all-errors https://pusatk3-api-staging.nusagomail.workers.dev/api/v1/health` |
  | `pusatk3-web-staging` | `apps/web` | `pnpm run build` dengan variabel build `CLOUDFLARE_ENV=staging` | `node -e "const f=require('fs');const p=f.existsSync('dist/server/wrangler.json')?'dist/server/wrangler.json':'dist/client/wrangler.json';process.exit(JSON.parse(f.readFileSync(p,'utf8')).name==='pusatk3-web-staging'?0:1)" && grep -q 'X-Robots-Tag: noindex' dist/client/_headers && npx wrangler deploy` (diperbarui #24: konfigurasi hasil build di `dist/server/` sejak ada halaman SSR) |

  Keduanya: `branch_includes: ["main"]`, tanpa build cabang lain/PR, *watch paths* `*` (seluruh repo, sehingga perubahan `packages/` ikut memicu build). Deploy web gagal bila hasil build bukan untuk `pusatk3-web-staging` atau tidak `noindex`; deploy API diakhiri uji asap health.

- Token build `pusatk3 build token` dikelola Cloudflare, tidak pernah ada di repo atau GitHub.
- `.github/workflows/deploy-staging.yml` dihapus agar tidak ada dua jalur deploy. `tests/workflows.test.ts` memastikan tidak ada workflow GitHub yang men-deploy staging.
- **Production tidak berubah:** tetap `deploy-production.yml` manual dengan persetujuan environment `production` (ADR 0012), sesudah domain dan data asli ada.

## Konsekuensi
- Deploy staging berjalan untuk setiap commit di `main` **tanpa menunggu CI**. Penjaganya: PR hanya di-merge bila CI (termasuk e2e) hijau. Bila `main` rusak, staging ikut rusak sampai perbaikan di-merge; production tidak terpengaruh.
- **Token build berlaku untuk seluruh akun** (izin persisnya tidak terlihat dari sesi ini) dan tersedia selama install dan build, jadi kode dependensi yang berjalan saat build `main` secara teknis bisa menyentuh resource lain di akun bersama ini. Ini kemunduran dibanding ADR 0012 (token hanya di langkah deploy). Pemilik memilih tetap satu akun (ADR 0016). Mitigasi: hanya `main` yang di-build, pnpm memblokir skrip install yang tidak diizinkan dan hanya memasang rilis npm berumur ≥ 3 hari (`minimumReleaseAge`), serta jaring pengaman lain di `docs/akses.md`.
- `APP_VERSION` memakai `git rev-parse HEAD`: dengan `WORKERS_CI_COMMIT_SHA`, health staging setelah merge PR #31 menjawab `"version":"main"` (nama cabang); setelah diganti, menjawab SHA lengkap `d7fd7a8…`. Perintah di dashboard sudah diperbarui (25 November 2026).
- `main` wajib dilindungi (PR + cek CI wajib, tanpa push langsung; `docs/setup-cloudflare.md` langkah 4), dan hook pengaman memblokir `git push` ke `main` dari sesi Claude Code.
- Mengubah pengaturan build (perintah, variabel, cabang) di Cloudflare termasuk perubahan deploy: catat di ADR ini dan beri tahu pemilik.
- API dan web di-build terpisah dan bisa selesai tidak bersamaan; perubahan yang butuh keduanya sekaligus sebaiknya kompatibel mundur.
- Pengaturan build ada di dashboard Cloudflare (Worker → **Settings → Build**), bukan di repo. Ubah dengan hati-hati dan catat di ADR ini.
- Sesi Claude Code tidak bisa membuka `*.workers.dev` (jaringan sesi dibatasi); hasil deploy dicek lewat log build di Cloudflare.

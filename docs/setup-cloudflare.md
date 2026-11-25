# Setup Cloudflare untuk PusatK3 (langkah pemilik)

Langkah yang **hanya pemilik** lakukan (gerbang persetujuan: resource, binding, dan secret production). Claude Code tidak menjalankan langkah ini. Keputusan teknis: `docs/adr/0011-lingkungan-cloudflare.md`.

Status 25 November 2026:

| Resource | Staging | Production |
| --- | --- | --- |
| D1 | `pusatk3-staging` ✅ dibuat | `pusatk3-production` ⬜ dibuat pemilik |
| R2 (video) | `pusatk3-media-staging` ✅ dibuat, belum publik | `pusatk3-media-production` ⬜ dibuat pemilik |
| Domain | `*.workers.dev` (sementara) | `pusatk3.id` ⬜ pindah ke Cloudflare |
| Worker | dibuat otomatis saat deploy pertama (#8) | dibuat saat rilis pertama |

## 1. Pindahkan domain `pusatk3.id` ke Cloudflare (sekali)

1. Masuk ke dashboard Cloudflare → **Add a domain** → ketik `pusatk3.id` → pilih paket **Free**.
2. Cloudflare memberi dua alamat *nameserver*. Masuk ke tempat Anda membeli domain (registrar `.id`), ganti nameserver domain ke dua alamat itu.
3. Tunggu status domain di Cloudflare menjadi **Active** (biasanya beberapa jam, maksimal 24 jam).
4. Di **DNS → Records**, pastikan ada record untuk `pusatk3.id` dengan awan **oranye (Proxied)**. Bila belum ada (situs belum punya hosting), buat record `AAAA` nama `@`, isi `100::`, Proxied. Rute Worker hanya berjalan untuk record yang di-proxy.
5. Opsional: record `AAAA` `www` → `100::` (Proxied) + **Rules → Redirect Rules** `www.pusatk3.id/*` → `https://pusatk3.id/$1` (301).
6. Beri tahu Claude Code; rute `pusatk3.id/*` (web) dan `pusatk3.id/api/*` (API) sudah ada di konfigurasi. Catatan: `pusatk3.id/api` tanpa garis miring akhir ditangani web (404).

## 2. Buat database production

1. Dashboard → **Storage & Databases → D1 → Create** → nama `pusatk3-production`, lokasi **Asia-Pacific**.
2. Salin **Database ID**.
3. Di `apps/api/wrangler.jsonc`, ganti `ISI-ID-D1-PRODUCTION-OLEH-PEMILIK` dengan ID tersebut (lewat PR; ID database bukan rahasia). Tes dan pemeriksaan rilis menerima ID berformat UUID yang berbeda dari ID staging.

## 3. Buat penyimpanan video production (R2)

1. Dashboard → **R2 → Create bucket** → nama `pusatk3-media-production`, lokasi **Asia-Pacific**.
2. Setelah domain aktif: **Settings → Custom Domains** → `media.pusatk3.id`.
3. Unggah `brand/video/pusatk3-intro.mp4` (nama file tetap) ke bucket.
4. Alamatnya (`https://media.pusatk3.id`) dipakai sebagai `PUBLIC_MEDIA_BASE_URL` saat build production (#8).

Untuk staging: bucket `pusatk3-media-staging` sudah ada tetapi belum bisa diakses publik. Untuk menampilkan video di staging, aktifkan **Public Development URL (r2.dev)** di bucket itu dan unggah video yang sama, atau minta Claude Code melakukannya (perlu persetujuan Anda). URL r2.dev dibatasi lajunya dan hanya untuk staging, bukan production.

## 4. Lindungi cabang `main` (sekarang)

Sejak ADR 0015, setiap commit di `main` langsung di-deploy ke staging (termasuk migrasi database staging) tanpa menunggu CI. Karena itu `main` hanya boleh menerima PR yang CI-nya hijau:

1. GitHub → repo → **Settings → Branches → Add branch ruleset** (atau *branch protection rule*) untuk `main`.
2. Centang **Require a pull request before merging** dan **Require status checks to pass**; pilih cek `Lint, typecheck, test, build` dan `E2E (Playwright)`.
3. Centang **Block force pushes**, dan jangan izinkan *bypass*.
4. **Required approvals:** biarkan 0 selama hanya Anda (bersama Claude Code) yang membuat PR; ubah ke **1** saat developer pertama bergabung (`docs/akses.md`).

Bila Anda sempat membuat environment `staging` di GitHub atau token Cloudflare untuk staging sebelum ADR 0015: hapus environment/secret itu dan cabut (*revoke*) tokennya di Cloudflare; keduanya tidak dipakai lagi.

## 5. Production (nanti: setelah domain dan data asli ada)

**Akun Cloudflare:** pemilik memutuskan tetap memakai akun yang sama dengan selfgrow (ADR 0016). Token build staging dan token API berlaku untuk seluruh akun, termasuk resource production PusatK3, jadi sebelum production pasang jaring pengaman yang tercantum di `docs/akses.md` (cadangan D1, notifikasi deploy, 2FA).

Langkah production:
1. GitHub → **Settings → Environments → New environment** `production`:
   - **Required reviewers** → akun Anda (jangan centang *Prevent self-review*).
   - **Deployment branches and tags** → *Selected branches and tags* → `main`.
2. Token Cloudflare production (**My Profile → API Tokens → Create Token → Custom token**): *Account → Workers Scripts: Edit*, *Account → D1: Edit*, *Account → Account Settings: Read*, *Zone → Workers Routes: Edit* dan *Zone → Zone: Read* untuk zona `pusatk3.id`.
3. Environment secret `production`: `CLOUDFLARE_API_TOKEN` (token tadi), `CLOUDFLARE_ACCOUNT_ID` (ID akun Cloudflare).
4. Environment variable `production`: `PUBLIC_MEDIA_BASE_URL` = `https://media.pusatk3.id` (setelah bagian 3, R2 production).

Variabel build staging (mis. `PUBLIC_MEDIA_BASE_URL` untuk video staging) diisi sebagai **build variable** Worker `pusatk3-web-staging` di Cloudflare (Settings → Build), bukan di GitHub.

## 6. Cara kerja deploy (#8, ADR 0012)

- **Staging (Cloudflare Workers Builds, ADR 0015):** otomatis setiap kali ada commit baru di `main`. Dua Worker terhubung ke repo GitHub: `pusatk3-api-staging` (folder `apps/api`: migrasi D1 staging lalu deploy API) dan `pusatk3-web-staging` (folder `apps/web`: build dengan `CLOUDFLARE_ENV=staging` lalu deploy). Status dan log: dashboard Cloudflare → **Workers & Pages** → worker → **Deployments**. Alamat: web https://pusatk3-web-staging.nusagomail.workers.dev, API https://pusatk3-api-staging.nusagomail.workers.dev/api/v1/health.
- **Production:** tidak pernah otomatis. Tab **Actions → Deploy production → Run workflow** (cabang `main`), lalu setujui di halaman run (reviewer environment `production`). Deploy ditolak otomatis bila ID database production belum benar, situs masih memakai jadwal contoh, secret belum ada, atau dijalankan dari cabang selain `main`. Sebelum menjalankannya, ikuti checklist `/siapkan-rilis` (pastikan commit itu sudah hijau di CI dan sudah dicek di staging).

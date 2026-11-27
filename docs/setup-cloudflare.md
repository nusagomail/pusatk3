# Setup Cloudflare untuk PusatK3 (langkah pemilik)

Langkah yang **hanya pemilik** lakukan (gerbang persetujuan: resource, binding, dan secret production). Claude Code tidak menjalankan langkah ini. Keputusan teknis: `docs/adr/0011-lingkungan-cloudflare.md`.

Status 25 November 2026:

| Resource | Staging | Production |
| --- | --- | --- |
| D1 | `pusatk3-staging` ✅ dibuat | `pusatk3-production` ⬜ dibuat pemilik |
| R2 (video) | `pusatk3-media-staging` ✅ dibuat, belum publik | `pusatk3-media-production` ⬜ dibuat pemilik |
| Domain | `*.workers.dev` (sementara) | `pusatk3.id` ⬜ pindah ke Cloudflare |
| Worker | dibuat otomatis saat deploy pertama (#8) | dibuat saat rilis pertama |
| Turnstile (form pertanyaan) | ⬜ widget dibuat pemilik (langkah 5a) | ⬜ widget dibuat pemilik (langkah 5a) |

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

## 5a. Turnstile untuk form "Kirim pertanyaan" (ADR 0022)

Form pertanyaan baru tampil bila penyedia sudah klaim profil **dan** Turnstile terpasang. Di production, form juga menunggu halaman kebijakan privasi (dijaga tes).
1. Dashboard Cloudflare → **Turnstile** → **Add widget**. Nama `pusatk3-staging` (atau `pusatk3-production`), hostname `pusatk3-web-staging.nusagomail.workers.dev` (atau `pusatk3.id`), mode **Managed**.
2. **Site key** (publik): kirim ke developer. Nilainya diisi di `TURNSTILE_SITE` pada `apps/web/wrangler.jsonc` env yang sama, lewat PR.
3. **Secret key** (rahasia, jangan dikirim ke siapa pun): Workers & Pages → `pusatk3-api-staging` (atau `-production`) → **Settings → Variables and Secrets** → **Add** → tipe **Secret**, nama `TURNSTILE_SECRET`, tempel secret key → **Deploy**.
4. Tanpa secret, API menjawab form dengan 503 ("belum tersedia"); kunci uji Cloudflare ditolak di luar lokal.

Variabel lingkungan terkait: `ENVIRONMENT` di `apps/api/wrangler.jsonc` (`local`/`staging`/`production`; hanya `local` menerima kunci uji Turnstile).

## 5b. Email kode masuk (Resend, ADR 0024)

Butuh domain `pusatk3.id` aktif di Cloudflare (langkah 1).
1. Daftar di resend.com (paket gratis) dengan email pemilik.
2. **Domains → Add Domain** → `pusatk3.id`. Resend menampilkan beberapa catatan DNS (SPF, DKIM).
3. Di Cloudflare → `pusatk3.id` → **DNS → Records**, tambahkan setiap catatan persis seperti di Resend (tipe, nama, nilai; bila ada tombol proxy, biarkan **mati**/abu-abu). Tambahkan juga catatan TXT `_dmarc` dengan nilai `v=DMARC1; p=none;`. Kembali ke Resend → **Verify**. Tunggu sampai status **Verified**. Saat membuat domain di Resend, pilih region terdekat (Tokyo/`ap-northeast-1`). Kuota gratis: 100 email per hari, dipakai bersama staging dan production.
4. Resend → **API Keys → Create** → nama `pusatk3-staging`, izin **Sending access**, domain `pusatk3.id`. Salin kunci (hanya tampil sekali).
5. Cloudflare → Workers & Pages → `pusatk3-api-staging` → **Settings → Variables and Secrets → Add** → tipe **Secret**, nama `RESEND_API_KEY`, tempel kunci → **Deploy**. Ulangi dengan kunci terpisah `pusatk3-production` untuk `pusatk3-api-production` saat production disiapkan.

## 5c. "Masuk dengan Google" (ADR 0024)

1. Buka console.cloud.google.com dengan akun pemilik → buat project `pusatk3`.
2. **APIs & Services → OAuth consent screen**: tipe **External**, nama aplikasi "PusatK3", email dukungan pemilik. *Authorized domains:* `pusatk3.id` dan (untuk staging) `nusagomail.workers.dev`. Izin (scope) hanya `email`, `profile`, `openid`. Setelah tersimpan, klik **Publish app**: dalam mode *Testing* hanya akun yang didaftarkan sebagai *test user* yang bisa masuk. Scope dasar ini tidak memerlukan verifikasi Google.
3. **Credentials → Create credentials → OAuth client ID** → tipe **Web application**, nama `pusatk3-staging`.
   - *Authorized redirect URIs:* `https://pusatk3-web-staging.nusagomail.workers.dev/api/v1/auth/callback/google` (harus **persis** sama, termasuk `https` dan tanpa garis miring di akhir). *JavaScript origins* tidak perlu diisi.
4. Salin **Client ID** (publik, boleh dikirim ke developer) dan **Client secret** (rahasia).
5. Cloudflare → `pusatk3-api-staging` → Variables and Secrets: Secret `GOOGLE_CLIENT_SECRET` = client secret. **Client ID** dikirim ke developer untuk dimasukkan ke `wrangler.jsonc` (variabel biasa yang diisi di dashboard akan tertimpa setiap deploy; secret tidak).
6. Untuk production buat client kedua `pusatk3-production` dengan origin `https://pusatk3.id` dan redirect `https://pusatk3.id/api/v1/auth/callback/google`.

## 5d. Kunci rahasia sesi dan 2FA (ADR 0024)

Dua secret acak per lingkungan, dibuat sendiri dan tidak pernah dikirim ke siapa pun:
1. Buat **dua** nilai acak berbeda, masing-masing minimal 40 karakter, dengan fitur "generate password" di pengelola kata sandi (mis. Bitwarden, 1Password, atau Google Password Manager). Jangan memakai situs pembuat kunci yang tidak dikenal, dan jangan mengirim nilainya ke siapa pun.
2. Cloudflare → `pusatk3-api-staging` → Variables and Secrets: Secret `AUTH_SECRET` = nilai pertama, Secret `TWO_FACTOR_KEY` = nilai kedua. Untuk production buat **dua nilai baru lagi** (jangan memakai nilai staging).
3. Mengganti `AUTH_SECRET` membuat semua orang keluar (harus masuk lagi). Jangan pernah mengganti `TWO_FACTOR_KEY` setelah dipakai (2FA yang sudah aktif tidak bisa dibuka lagi); kalau bocor, hubungi developer untuk prosedur rotasi.

## 6. Cara kerja deploy (#8, ADR 0012)

- **Staging (Cloudflare Workers Builds, ADR 0015):** otomatis setiap kali ada commit baru di `main`. Dua Worker terhubung ke repo GitHub: `pusatk3-api-staging` (folder `apps/api`: migrasi D1 staging lalu deploy API) dan `pusatk3-web-staging` (folder `apps/web`: build dengan `CLOUDFLARE_ENV=staging` lalu deploy). Status dan log: dashboard Cloudflare → **Workers & Pages** → worker → **Deployments**. Alamat: web https://pusatk3-web-staging.nusagomail.workers.dev, API https://pusatk3-api-staging.nusagomail.workers.dev/api/v1/health.
- **Production:** tidak pernah otomatis. Tab **Actions → Deploy production → Run workflow** (cabang `main`), lalu setujui di halaman run (reviewer environment `production`). Deploy ditolak otomatis bila ID database production belum benar, situs production belum tersambung ke API production, data contoh terlihat di production (uji asap), secret belum ada, atau dijalankan dari cabang selain `main`. Sebelum menjalankannya, ikuti checklist `/siapkan-rilis` (pastikan commit itu sudah hijau di CI dan sudah dicek di staging).

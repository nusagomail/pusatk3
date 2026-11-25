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
3. Di `apps/api/wrangler.jsonc`, ganti `ISI-ID-D1-PRODUCTION-OLEH-PEMILIK` dengan ID tersebut (lewat PR; ID database bukan rahasia).

## 3. Buat penyimpanan video production (R2)

1. Dashboard → **R2 → Create bucket** → nama `pusatk3-media-production`, lokasi **Asia-Pacific**.
2. Setelah domain aktif: **Settings → Custom Domains** → `media.pusatk3.id`.
3. Unggah `brand/video/pusatk3-intro.mp4` (nama file tetap) ke bucket.
4. Alamatnya (`https://media.pusatk3.id`) dipakai sebagai `PUBLIC_MEDIA_BASE_URL` saat build production (#8).

Untuk staging: bucket `pusatk3-media-staging` sudah ada tetapi belum bisa diakses publik. Untuk menampilkan video di staging, aktifkan **Public Development URL (r2.dev)** di bucket itu dan unggah video yang sama, atau minta Claude Code melakukannya (perlu persetujuan Anda). URL r2.dev dibatasi lajunya dan hanya untuk staging, bukan production.

## 4. Secret untuk GitHub Actions (#8)

Akun Cloudflare ini juga berisi proyek lain, dan izin token Workers/D1 berlaku untuk seluruh akun. Karena itu:

1. **Dua token terpisah**, masing-masing dengan izin minimal: *Account → Workers Scripts: Edit*, *Account → D1: Edit*, *Account → Account Settings: Read*. Token production juga *Zone → Workers Routes: Edit* untuk zona `pusatk3.id` (baru bisa dipilih setelah langkah 1 selesai; buat token staging dulu, token production setelah domain aktif).
2. Di GitHub → repo → **Settings → Environments**, buat environment `staging` dan `production`. Untuk `production`, aktifkan **Required reviewers** (Anda sendiri).
3. Simpan token sebagai **environment secret** (bukan repository secret), agar workflow dari PR atau branch lain tidak bisa memakainya:

| Environment | Secret | Isi |
| --- | --- | --- |
| `staging` | `CLOUDFLARE_API_TOKEN` | token staging |
| `production` | `CLOUDFLARE_API_TOKEN` | token production |
| keduanya | `CLOUDFLARE_ACCOUNT_ID` | ID akun Cloudflare (dashboard, halaman Workers) |

4. Pertimbangkan akun Cloudflare terpisah khusus PusatK3 sebelum rilis production (ADR 0011).

Workflow yang memakai secret ini disiapkan di #8.

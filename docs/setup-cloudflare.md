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
4. Beri tahu Claude Code; rute `pusatk3.id/*` dan `pusatk3.id/api/*` sudah ada di konfigurasi.

## 2. Buat database production

1. Dashboard → **Storage & Databases → D1 → Create** → nama `pusatk3-production`, lokasi **Asia-Pacific**.
2. Salin **Database ID**.
3. Di `apps/api/wrangler.jsonc`, ganti `ISI-ID-D1-PRODUCTION-OLEH-PEMILIK` dengan ID tersebut (lewat PR; ID database bukan rahasia).

## 3. Buat penyimpanan video production (R2)

1. Dashboard → **R2 → Create bucket** → nama `pusatk3-media-production`, lokasi **Asia-Pacific**.
2. Setelah domain aktif: **Settings → Custom Domains** → `media.pusatk3.id`.
3. Unggah `brand/video/pusatk3-intro.mp4` (nama file tetap) ke bucket.
4. Alamatnya (`https://media.pusatk3.id`) dipakai sebagai `PUBLIC_MEDIA_BASE_URL` saat build production (#8).

Untuk staging: bucket `pusatk3-media-staging` sudah ada tetapi belum bisa diakses publik. Untuk menampilkan video di staging, aktifkan **Public Development URL (r2.dev)** di bucket itu dan unggah video yang sama, atau minta Claude Code melakukannya (perlu persetujuan Anda).

## 4. Secret untuk GitHub Actions (#8)

Di GitHub → repo → **Settings → Secrets and variables → Actions**:

| Nama | Isi |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | ID akun Cloudflare (dashboard, kanan bawah halaman Workers) |
| `CLOUDFLARE_API_TOKEN` | Token API dengan izin minimal: *Workers Scripts: Edit*, *D1: Edit*, *Workers Routes: Edit* (zona `pusatk3.id`), *Account Settings: Read* |

Detail dan environment GitHub yang butuh persetujuan untuk production disiapkan di #8.

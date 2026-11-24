# PusatK3

Direktori independen pelatihan & sertifikasi K3 di Indonesia (pusatk3.id). Platform mempertemukan peserta/perusahaan dengan penyedia (PJK3, LSP, TUK). PusatK3 **tidak** menyelenggarakan pelatihan, **tidak** menerbitkan sertifikat, dan **tidak** memproses transaksi pelatihan. Pendapatan hanya dari langganan penyedia; user selalu gratis.

Bahasa produk: Indonesia (utama) dan Inggris. Tulis kode, nama variabel, dan commit dalam bahasa Inggris. Teks UI, dokumen, dan komentar untuk tim boleh bahasa Indonesia.

## Baca dulu sebelum bekerja

| Dokumen | Isi |
| --- | --- |
| `docs/prd.md` | Produk, peran, fitur, prinsip yang tidak boleh dilanggar |
| `docs/roadmap.md` | Fase, urutan kerja, kriteria selesai |
| `docs/arsitektur.md` | Stack, struktur repo, alur data, cache |
| `docs/skema-db.md` | Tabel dan relasi (sumber kebenaran skema) |
| `docs/api-contract.md` | Konvensi API dan daftar endpoint |
| `docs/keamanan.md` | Aturan keamanan dan checklist per endpoint |
| `docs/design-tokens.md` | Warna, huruf, komponen; mengikuti panduan merek |
| `docs/glosarium-k3.md` | Istilah K3 (AK3U, SIO, PJK3, LSP, TUK, dll.) |
| `docs/kategori-k3.md` | 14 bidang & 59 kategori sertifikasi K3 resmi + penerbit + regulasi |
| `docs/workflow.md` | Cara kerja per issue, gerbang persetujuan manusia |
| `docs/bisnis.md` | Model bisnis, paket, risiko (hasil brainstorming) |
| `docs/ui-halaman.md` | Spesifikasi tiap halaman berdasarkan mockup |
| `docs/adr/` | Keputusan teknis beserta alasannya |

Jika instruksi di sini bertentangan dengan `docs/`, ikuti `docs/` dan laporkan konfliknya.

## Stack

- Monorepo pnpm + Turborepo: `apps/web` (Astro), `apps/api` (Hono di Cloudflare Workers), `packages/shared` (tipe + skema Zod), nanti `apps/mobile` (Expo).
- Database: Cloudflare D1 via Drizzle ORM. Pencarian: Meilisearch/Typesense. File: R2. Background: Queues + Cron Triggers.
- Auth: tanpa password (Google + email OTP), 2FA wajib untuk penyedia dan admin.
- Deploy: Cloudflare, lewat GitHub Actions. Lingkungan: `staging` dan `production`.

## Perintah

Prasyarat: Node 22 (`.nvmrc`) dan pnpm 10.28 (terkunci di `packageManager`). Jalankan dari root repo.

| Perintah | Fungsi |
| --- | --- |
| `pnpm install` | Pasang dependensi semua app/paket |
| `pnpm dev` | Jalankan semua app lokal (`turbo run dev`) |
| `pnpm build` | Build semua app/paket (`turbo run build`) |
| `pnpm lint` | ESLint seluruh repo + cek format Prettier |
| `pnpm format` | Rapikan format dengan Prettier |
| `pnpm typecheck` | `tsc` untuk file root + `turbo run typecheck` per paket |
| `pnpm test` | Vitest: tes root (`tests/`) + setiap `apps/*`/`packages/*` yang punya `vitest.config.ts` |

Belum ada (jangan dipakai sampai issue-nya selesai): `pnpm test:e2e` (#9), `pnpm db:generate` dan `pnpm db:migrate:local` (#4; migrasi remote hanya lewat CI).

Setiap app/paket baru wajib `"private": true` dan punya skrip `typecheck` dan `test` (dijaga `tests/workspace.test.ts`).

## Aturan wajib

1. **API-first.** Logika bisnis hanya di `apps/api`. `apps/web` dan mobile hanya memanggil API.
2. **Cek peran dan kepemilikan di setiap endpoint** (bukan hanya di UI). Penyedia A tidak boleh membaca atau mengubah data penyedia B. Setiap endpoint baru wajib punya tes hak akses.
3. **Validasi semua input dengan Zod** dari `packages/shared`. Query hanya lewat Drizzle; tidak ada string SQL mentah.
4. **Halaman publik harus bisa di-cache** (SSR + cache CDN) dan tidak boleh mewajibkan login.
5. **Badge verifikasi tidak pernah dikaitkan dengan pembayaran.** Hasil organik dan slot sponsor selalu dipisah dan slot sponsor selalu berlabel.
6. **Mengubah nomor WhatsApp atau data legalitas penyedia** wajib memicu verifikasi ulang.
7. Jangan menyimpan scan sertifikat user. Pengingat sertifikat hanya menyimpan nama dan tanggal yang diisi user.
8. Teks tombol di atas oranye `#E07400` memakai navy `#0F1B2D` (kontras). Ikuti `docs/design-tokens.md`.
9. Jangan menambah dependensi baru tanpa menyebut alasannya di PR.

## Yang tidak boleh dilakukan tanpa persetujuan pemilik

- Migrasi database yang menghapus atau mengubah kolom berisi data
- Perubahan apa pun pada auth, sesi, peran, atau pembayaran
- Deploy ke `production`
- Mengubah `.env`, secret, atau `wrangler` binding production
- Menerbitkan konten K3 (e-course, FAQ) yang belum ditinjau Ahli K3

## Cara kerja

Proses kerja memakai plugin **Superpowers** (brainstorming → rencana → TDD → review). Aturan di file ini dan di `docs/` selalu didahulukan di atas kebiasaan Superpowers.

Satu issue per sesi. Tulis rencana dan **tunggu persetujuan pemilik** sebelum menulis kode. Implementasi di branch `feat/<issue>-<slug>` dengan tes ditulis dulu. Sebelum selesai: jalankan lint, typecheck, test; jalankan subagent `reviewer`; lalu **buka PR** memakai template (jangan merge ke `main` secara lokal). Detail di `docs/workflow.md`.

Referensi tampilan: `docs/ui-halaman.md` (spesifikasi halaman dari mockup) dan aset logo di `brand/`.

Setiap keputusan teknis baru → tambahkan ADR di `docs/adr/`. Setiap perubahan skema → perbarui `docs/skema-db.md` di PR yang sama.

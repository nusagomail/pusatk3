# Panduan developer baru

Selamat datang di PusatK3. Dokumen ini untuk developer manusia yang baru bergabung: apa yang dipasang, apa yang dibaca, dan bagaimana membuat perubahan pertama sampai tampil di staging. Aturan di sini sama dengan yang dipakai Claude Code (`CLAUDE.md`); bila ada yang bertentangan, `docs/` yang benar.

## 1. Gambaran singkat

PusatK3 adalah direktori independen pelatihan dan sertifikasi K3 di Indonesia. Situs ini mempertemukan peserta/perusahaan dengan penyedia (PJK3, LSP, TUK). PusatK3 **tidak** menyelenggarakan pelatihan, **tidak** menerbitkan sertifikat, dan **tidak** memproses transaksi. Pendapatannya hanya dari langganan penyedia; peserta selalu gratis.

Istilah K3 yang sering muncul (AK3U, SIO, PJK3, LSP, TUK): `docs/glosarium-k3.md`.

## 2. Hari pertama: baca dengan urutan ini

| Urutan | Dokumen | Untuk apa |
| --- | --- | --- |
| 1 | `docs/prd.md` | Produk, peran, dan prinsip yang tidak boleh dilanggar |
| 2 | `docs/arsitektur.md` | Peta sistem (diagram), struktur repo, lingkungan |
| 3 | `docs/roadmap.md` | Fase dan apa yang sedang dikerjakan |
| 4 | `docs/workflow.md` | Cara kerja per issue dan gerbang persetujuan pemilik |
| 5 | `docs/keamanan.md` | Aturan keamanan dan checklist per endpoint |
| 6 | `docs/adr/` | Alasan di balik setiap keputusan teknis (baca judulnya dulu, buka bila relevan) |
| 7 | `docs/akses.md` | Akun dan akses yang Anda perlukan |

Sesuai tugas: `docs/skema-db.md` (database), `docs/api-contract.md` (endpoint), `docs/design-tokens.md` dan `docs/ui-halaman.md` (tampilan), `docs/kategori-k3.md` (59 kategori sertifikasi).

## 3. Setup lokal

Prasyarat: Git, **Node 22** (versi 22.23.4 atau lebih baru di seri 22, lihat `.nvmrc`), dan pnpm lewat `corepack enable` (versi terkunci di `package.json`). Akses yang dibutuhkan: lihat `docs/akses.md`.

```bash
git clone https://github.com/nusagomail/pusatk3.git
cd pusatk3
corepack enable
pnpm install
pnpm db:migrate:local && pnpm db:seed:local   # database lokal (D1 di .wrangler/)
pnpm dev        # API: http://127.0.0.1:8787/api/v1/health · web: http://localhost:4321
```

Pastikan semuanya hijau sebelum mengubah apa pun:

```bash
pnpm lint && pnpm typecheck && pnpm test   # cepat, wajib sebelum PR
pnpm test:e2e                              # tes browser; hentikan `pnpm dev` dulu
```

`pnpm test:e2e` butuh Chromium: jalankan sekali `pnpm exec playwright install chromium` di komputer Anda. Daftar lengkap perintah ada di `CLAUDE.md` bagian "Perintah". Secret lokal (bila nanti ada) disimpan di `apps/api/.dev.vars` (contoh: `.dev.vars.example`) dan tidak pernah di-commit.

## 4. Struktur repo

```
apps/web/        Astro: halaman publik (dan dashboard nanti); hanya memanggil API
apps/api/        Hono di Cloudflare Workers: REST /api/v1, semua logika bisnis
packages/shared/ Skema Zod, tipe, konstanta (dipakai web, API, dan nanti mobile)
packages/db/     Skema Drizzle + migrasi SQL untuk D1
e2e/             Tes browser (Playwright)
tests/           Tes struktur repo, workflow, hook pengaman
scripts/         Skrip pendukung (mis. preflight rilis production)
docs/            Semua dokumen; docs/adr/ = catatan keputusan
.github/         CI (ci.yml) dan deploy production (deploy-production.yml)
.claude/         Pengaturan Claude Code: hook pengaman, subagent reviewer, skill proyek
```

## 5. Alur perubahan: dari issue sampai staging

1. **Issue.** Setiap pekerjaan berawal dari issue GitHub (label fase). Baca kriteria selesainya.
2. **Rencana.** Tulis rencana singkat di issue atau PR: file yang diubah, perubahan skema/endpoint, tes. Bila menyentuh gerbang persetujuan (bagian 7), tunggu persetujuan pemilik dulu.
3. **Branch.** `feat/<nomor-issue>-<slug>` dari `main` terbaru. Commit kecil, pesan dalam bahasa Inggris.
4. **Tes dulu.** Tulis tes yang gagal, lalu kodenya. Endpoint baru wajib punya tes hak akses (anonim, user, penyedia lain ditolak).
5. **Cek lokal.** `pnpm lint && pnpm typecheck && pnpm test`, ditambah `pnpm test:e2e` bila `apps/web` atau `apps/api` berubah.
6. **Dokumen.** Skema berubah → `docs/skema-db.md`. Endpoint → `docs/api-contract.md`. Keputusan teknis baru → ADR baru di `docs/adr/`.
7. **Pull request** memakai template (Ringkasan, Perubahan, Cek, Gerbang persetujuan). Dependensi baru harus disebut beserta alasannya.
8. **CI** (`.github/workflows/ci.yml`) menjalankan lint, typecheck, test, build, dan e2e. Cabang `main` dilindungi: PR hanya bisa di-merge bila keduanya hijau, dan push langsung ke `main` ditolak.
9. **Merge → staging otomatis.** Setiap commit di `main` di-deploy ke staging oleh Cloudflare Workers Builds (ADR 0015), termasuk migrasi database staging. Cek hasilnya di https://pusatk3-web-staging.nusagomail.workers.dev dan https://pusatk3-api-staging.nusagomail.workers.dev/api/v1/health (versi = SHA commit).
10. **Production** hanya dijalankan pemilik: GitHub → **Actions → Deploy production**, dengan persetujuan (ADR 0012, checklist `/siapkan-rilis`).

## 6. Aturan wajib (versi singkat)

1. **API-first:** logika bisnis hanya di `apps/api`; web dan mobile hanya memanggil API.
2. **Cek peran dan kepemilikan di setiap endpoint**, bukan hanya di UI. Penyedia A tidak boleh membaca atau mengubah data penyedia B.
3. **Validasi semua input dengan Zod** dari `packages/shared`. Query hanya lewat Drizzle, tanpa string SQL mentah di kode aplikasi.
4. **Halaman publik bisa di-cache** dan tidak pernah mewajibkan login.
5. **Badge verifikasi tidak pernah dikaitkan dengan pembayaran.** Hasil organik dan slot sponsor selalu dipisah, dan sponsor selalu berlabel.
6. **Mengubah nomor WhatsApp atau data legalitas penyedia** memicu verifikasi ulang.
7. **Jangan menyimpan scan sertifikat user.**
8. Tombol oranye `#E07400` memakai teks navy `#0F1B2D`. Ikuti `docs/design-tokens.md`.
9. **Dependensi baru** selalu disebut alasannya di PR. Paket npm yang dirilis kurang dari 3 hari tidak akan dipasang (`minimumReleaseAge`).

## 7. Butuh persetujuan pemilik dulu

- Migrasi database yang menghapus atau mengubah kolom berisi data (tes `packages/db/test/migrations.test.ts` menolaknya).
- Perubahan auth, sesi, peran, atau pembayaran.
- Deploy production.
- Mengubah secret, `.env`, binding production, atau pengaturan build Workers Builds di Cloudflare.
- Menerbitkan konten K3 (e-course, FAQ) yang belum ditinjau Ahli K3.

## 8. Bekerja bersama Claude Code

Proyek ini dibangun bersama Claude Code. Konfigurasinya ada di repo, jadi developer dan Claude memakai aturan yang sama:

- `.claude/hooks/guard.sh` memblokir perintah berbahaya dari sesi Claude (deploy production, D1 remote, secret, push ke `main`). Detailnya di `tests/guard-hook.test.ts`.
- `.claude/agents/reviewer.md` adalah reviewer otomatis yang dijalankan sebelum PR.
- `.claude/skills/` berisi prosedur proyek: `tambah-endpoint`, `migrasi-db`, `halaman-seo`, `siapkan-rilis`.

Setup Claude Code di komputer Anda: `docs/setup-claude-code.md`.

## 9. Bila ada masalah

- **CI merah:** buka log job di tab **Actions** atau di PR, lalu perbaiki penyebabnya. Jangan menonaktifkan tes.
- **Staging gagal deploy:** dashboard Cloudflare → **Workers & Pages** → `pusatk3-api-staging` / `pusatk3-web-staging` → **Deployments** → log build.
- **Ragu apakah sesuatu butuh persetujuan:** anggap butuh, dan tanya pemilik.

Panduan insiden lengkap (situs mati, pemulihan database) menyusul menjelang rilis production.

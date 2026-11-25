# ADR 0012: CI dan deploy lewat GitHub Actions

Status: diterima · 25 November 2026 · issue #8. Desain: `docs/superpowers/specs/2026-11-25-ci-design.md`. Melanjutkan ADR 0011.

## Keputusan
- **`ci.yml`** (PR dan push ke `main`): `pnpm install --frozen-lockfile`, lint, typecheck, test, build. Izin hanya baca, tanpa secret. Run PR lama dibatalkan bila ada commit baru. Cache hanya store pnpm (bukan `node_modules`, lihat catatan `@emnapi` di `apps/README.md`).
- **`deploy-staging.yml`** dipicu `workflow_run` setelah CI **sukses** untuk **push ke `main`**, dan men-deploy **commit yang sama** yang dites CI (`head_sha`). Urutan: migrasi D1 staging → deploy API (`APP_VERSION` = SHA) → build web `CLOUDFLARE_ENV=staging` → deploy web → uji asap (health mengembalikan SHA, beranda tampil dan `noindex`). Tanpa secret staging: dilewati dengan notice, `main` tetap hijau (keputusan pemilik A).
- **`deploy-production.yml`** hanya `workflow_dispatch` dari `main`, lewat environment GitHub `production` (reviewer wajib: pemilik). Sebelum menyentuh Cloudflare: cek secret (gagal keras), `scripts/production-preflight.mjs` (menolak teks penanda ID D1 dan halaman publik yang masih memakai jadwal contoh), lint, typecheck, test. Lalu migrasi D1 production → deploy API → build web `CLOUDFLARE_ENV=production` → deploy web → uji asap di `pusatk3.id` (harus bisa diindeks).
- **Keamanan rantai pasok:** action dikunci ke SHA commit (checkout v7.0.1, setup-node v7.1.0, pnpm/action-setup v6.1.1; semua berumur ≥ 2 minggu saat dipilih), `persist-credentials: false`, tanpa `pull_request_target`, secret hanya lewat `env:` di job deploy (tidak pernah ditulis langsung di baris perintah). Dijaga oleh `tests/workflows.test.ts`.
- **Secret per environment** (`staging`, `production`), bukan secret repository, agar workflow dari PR tidak bisa memakainya (`docs/setup-cloudflare.md`).
- **Migrasi remote** hanya di workflow ini; dari sesi Claude Code diblokir hook (ADR 0011). Migrasi destruktif dicegah lebih awal oleh tes `packages/db/test/migrations.test.ts` di CI.

## Konsekuensi
- Memperbarui versi action: cari tag baru, pilih yang berumur ≥ 2 minggu, ganti SHA di workflow **dan** di `tests/workflows.test.ts`.
- Workflow `workflow_run` selalu memakai file workflow dari `main`; perubahan pada `deploy-staging.yml` baru berlaku setelah di-merge.
- Uji asap staging bergantung pada URL `*.workers.dev` yang dicetak wrangler; bila formatnya berubah, langkah uji asap gagal dengan pesan jelas.
- E2E Playwright ditambahkan ke CI di #9.

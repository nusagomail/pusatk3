# Alur kerja dengan Claude Code

Proses kerja memakai plugin **Superpowers** (brainstorming → rencana → TDD → review → selesai). Aturan khusus PusatK3 ada di `CLAUDE.md`, `docs/`, hooks pengaman, subagent `reviewer`, dan skill proyek. Jika Superpowers dan dokumen proyek berbeda pendapat, **aturan proyek yang menang**.

Cara memasang semuanya: `docs/setup-claude-code.md`.

## Satu issue, satu sesi

1. Pemilik membuat issue dari template "Fitur" (label fase).
2. Buka sesi baru (`/clear` bila melanjutkan sesi lama), lalu tulis: *"Kerjakan issue #N."*
3. **Brainstorming & rencana (Superpowers).** Claude bertanya bila ada yang belum jelas, lalu menulis rencana berisi tugas kecil, file yang diubah, perubahan skema, endpoint, dan tes. Rencana wajib menyebut gerbang persetujuan yang tersentuh.
4. **Gerbang 1 — pemilik menyetujui rencana.**
5. **Implementasi (Superpowers).** Branch/worktree `feat/<nomor-issue>-<slug>`, tes ditulis dulu (TDD), commit kecil. Pakai skill proyek yang relevan: `tambah-endpoint`, `migrasi-db`, `halaman-seo`.
6. Jalankan `pnpm lint && pnpm typecheck && pnpm test` dan tunjukkan hasilnya (verifikasi sebelum klaim selesai); bila `apps/web` atau `apps/api` berubah, jalankan juga `pnpm test:e2e`. Setelah PR dibuka, GitHub Actions (`ci.yml`) menjalankan pemeriksaan yang sama ditambah e2e; PR baru boleh di-merge bila CI hijau.
7. **Review.** Jalankan subagent `reviewer` (aturan keamanan & bisnis PusatK3) selain review bawaan Superpowers. Perbaiki semua temuan **Kritis**.
8. Perbarui `docs/` bila skema, API, atau keputusan berubah.
9. **Selesai:** selalu pilih **buka Pull Request**. Jangan merge ke `main` secara lokal dan jangan menghapus branch sebelum PR di-merge.
10. **Gerbang 2 — pemilik menyetujui dan me-merge PR.** Merge ke `main` → deploy staging otomatis oleh Cloudflare Workers Builds (ADR 0015); CI di `main` tetap berjalan untuk pemeriksaan.
11. **Gerbang 3 — deploy production** hanya atas perintah pemilik (`/siapkan-rilis`), dijalankan pemilik lewat **Actions → Deploy production** dan disetujui di environment `production` (ADR 0012).

## Gerbang persetujuan wajib

- Migrasi yang menghapus/mengubah data
- Auth, sesi, peran, pembayaran
- Deploy production, secret, binding production
- Konten K3 yang dipublikasikan

Hooks di `.claude/hooks/guard.sh` memblokir edit file secret, deploy production (termasuk memicu workflow `Deploy production` lewat `gh`), operasi D1 remote, perubahan secret, dan force push ke `main`.

## Komponen proyek

| Komponen | Fungsi |
| --- | --- |
| Subagent `reviewer` | Review keamanan (IDOR, otorisasi), prinsip PRD, design tokens |
| Skill `tambah-endpoint` | Prosedur endpoint baru: skema Zod, otorisasi, tes hak akses |
| Skill `migrasi-db` | Prosedur perubahan skema D1 + Drizzle |
| Skill `halaman-seo` | Prosedur halaman publik SEO/GEO |
| Skill `/siapkan-rilis` | Checklist sebelum deploy production (dipanggil manual) |

## Plugin yang dipakai

| Plugin | Fungsi |
| --- | --- |
| `superpowers` | Proses: brainstorming, rencana, TDD, debugging, verifikasi, review |
| `frontend-design` | Kualitas UI saat membangun halaman dari mockup |
| Plugin Cloudflare | Praktik terbaik Workers, Wrangler, D1, Turnstile |

## Review otomatis di GitHub

Setelah `/install-github-app` dijalankan (lihat setup), Claude bisa dipanggil dengan menulis `@claude` di komentar issue atau PR.

# Alur kerja dengan Claude Code

## Satu issue, satu sesi

1. Pemilik membuat issue dari template "Fitur" (label fase).
2. Buka sesi baru (`/clear` bila melanjutkan sesi lama).
3. Masuk **plan mode**. Minta subagent `planner` menyusun rencana: file yang diubah, perubahan skema, endpoint, tes, risiko.
4. **Gerbang 1 — pemilik menyetujui rencana.**
5. Buat branch `feat/<nomor-issue>-<slug>`. Implementasi bertahap, commit kecil.
6. Jalankan `pnpm lint && pnpm typecheck && pnpm test`.
7. Minta subagent `tester` melengkapi tes (termasuk hak akses), lalu subagent `reviewer` memeriksa diff.
8. Perbaiki temuan; perbarui `docs/` bila ada keputusan atau skema baru.
9. Buka PR memakai template.
10. **Gerbang 2 — pemilik menyetujui PR.** Merge ke `main` → deploy staging otomatis.
11. **Gerbang 3 — deploy production** hanya atas perintah pemilik.

## Gerbang persetujuan wajib

- Migrasi yang menghapus/mengubah data
- Auth, sesi, peran, pembayaran
- Deploy production, secret, binding production
- Konten K3 yang dipublikasikan

## Skill proyek

| Perintah | Fungsi |
| --- | --- |
| `/kerjakan-issue <nomor>` | Menjalankan alur di atas untuk satu issue |
| `/tambah-endpoint` | Prosedur endpoint baru (skema, otorisasi, tes) |
| `/migrasi-db` | Prosedur perubahan skema D1 + Drizzle |
| `/halaman-seo` | Prosedur halaman publik SEO/GEO |
| `/siapkan-rilis` | Checklist sebelum deploy production |

## Subagent

| Nama | Peran |
| --- | --- |
| `planner` | Menyusun rencana dan spesifikasi; tidak mengubah file |
| `reviewer` | Review keamanan dan kualitas diff; tidak mengubah file |
| `tester` | Menulis dan menjalankan tes |

Sesi utama yang mengimplementasikan. Tambah subagent lain (SEO, data, infra) hanya bila memang dibutuhkan.

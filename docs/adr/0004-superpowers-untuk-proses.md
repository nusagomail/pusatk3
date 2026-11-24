# ADR 0004: Superpowers untuk proses, aturan proyek di repo

Status: diterima · 25 November 2026

## Konteks
Starter kit awal punya subagent `planner`, `tester`, dan skill `/kerjakan-issue`. Plugin Superpowers menyediakan alur yang sama (brainstorming, rencana, TDD, review, verifikasi) dalam bentuk yang lebih matang.

## Keputusan
- Proses kerja memakai Superpowers.
- `planner`, `tester`, dan `/kerjakan-issue` dihapus agar tidak ada dua alur yang bersaing.
- Aturan khusus PusatK3 tetap di repo: `CLAUDE.md`, `docs/`, hooks pengaman, subagent `reviewer`, skill `tambah-endpoint`, `migrasi-db`, `halaman-seo`, `/siapkan-rilis`.
- Bila Superpowers dan aturan proyek berbeda, aturan proyek yang berlaku. Contoh: selalu berakhir dengan PR, tidak merge lokal ke `main`.

## Konsekuensi
- Setiap kolaborator perlu memasang plugin (lihat `docs/setup-claude-code.md`).
- Sesi lebih banyak bertanya dan memakai lebih banyak token, sebagai ganti kualitas dan disiplin tes.

---
name: kerjakan-issue
description: Menjalankan alur kerja standar PusatK3 untuk satu issue GitHub, dari rencana sampai PR.
argument-hint: [nomor-issue]
disable-model-invocation: true
---

Kerjakan issue #$ARGUMENTS mengikuti `docs/workflow.md`.

1. Baca issue: `gh issue view $ARGUMENTS`.
2. Minta subagent `planner` menyusun rencana. Tampilkan rencananya dan **berhenti sampai pemilik menyetujui**.
3. Setelah disetujui: `git switch -c feat/$ARGUMENTS-<slug-singkat>`.
4. Implementasi langkah demi langkah sesuai rencana. Commit kecil dengan pesan bahasa Inggris.
5. Jalankan `pnpm lint && pnpm typecheck && pnpm test`. Perbaiki sampai lulus.
6. Minta subagent `tester`, lalu subagent `reviewer`. Perbaiki semua temuan **Kritis**.
7. Perbarui `docs/` bila skema, API, atau keputusan berubah.
8. Buka PR dengan `gh pr create` memakai `.github/pull_request_template.md`, tautkan `Closes #$ARGUMENTS`.
9. Ringkas untuk pemilik: apa yang berubah, hasil tes, temuan reviewer, dan gerbang persetujuan yang tersentuh.

Jangan merge dan jangan deploy production.

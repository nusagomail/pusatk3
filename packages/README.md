# packages

Kode bersama yang dipakai oleh `apps/`. Lihat `docs/arsitektur.md`.

| Folder | Isi | Issue |
| --- | --- | --- |
| `shared/` | Tipe, skema Zod, konstanta | #2 |
| `db/` | Skema Drizzle + migrasi D1 | #4 |
| `ui/` | Design tokens + komponen (bila dipakai web & mobile) | #6 |

Setiap paket wajib `"private": true` dan punya skrip `typecheck` dan `test` (dicek oleh `tests/workspace.test.ts`).

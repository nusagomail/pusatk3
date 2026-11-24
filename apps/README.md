# apps

Aplikasi yang bisa dijalankan. Lihat `docs/arsitektur.md`.

| Folder | Isi | Issue |
| --- | --- | --- |
| `web/` | Astro di Cloudflare: halaman publik + dashboard | #5 |
| `api/` | Hono di Cloudflare Workers: REST `/api/v1`, semua logika bisnis | #3 |
| `mobile/` | Expo (Fase 5) | — |

Setiap app wajib `"private": true` dan punya skrip `typecheck` dan `test` (dicek oleh `tests/workspace.test.ts`).

# Kontrak API

## Konvensi

- Basis: `/api/v1`. JSON. Nama field `camelCase`.
- Skema request/response didefinisikan dengan Zod di `packages/shared` dan dipakai bersama oleh API, web, dan mobile.
- Error: `{ "error": { "code": "FORBIDDEN", "message": "..." } }` dengan status HTTP yang sesuai. Skema: `apiErrorSchema` di `@pusatk3/shared`. Isian tak dikenal ditolak; `message` tidak boleh kosong dan tidak memuat detail internal (stack, SQL).

  | Kode | HTTP | Pakai untuk |
  | --- | --- | --- |
  | `BAD_REQUEST` | 400 | Request tidak bisa dibaca (mis. JSON rusak) |
  | `UNAUTHORIZED` | 401 | Belum login / sesi habis |
  | `FORBIDDEN` | 403 | Login, tapi tidak berhak |
  | `NOT_FOUND` | 404 | Data tidak ada (juga dipakai agar tidak membocorkan keberadaan data milik penyedia lain) |
  | `CONFLICT` | 409 | Bentrok dengan data yang ada (mis. klaim ganda) |
  | `PAYLOAD_TOO_LARGE` | 413 | Body melebihi batas |
  | `UNSUPPORTED_MEDIA_TYPE` | 415 | Body bukan JSON (`Content-Type` wajib `application/json`) |
  | `VALIDATION_ERROR` | 422 | Input gagal validasi Zod |
  | `RATE_LIMITED` | 429 | Terlalu banyak permintaan |
  | `INTERNAL_ERROR` | 500 | Kesalahan server |

  Khusus `VALIDATION_ERROR`, boleh menyertakan `fields: [{ "path": "phone", "message": "..." }]` agar form bisa menandai isian yang salah; kode lain tidak boleh membawa `fields`. `path` adalah path isian yang digabung titik (mis. `items.0.phone`); kesalahan di level objek (tanpa path) masuk ke `message`, bukan `fields`. `message` maksimal 500 karakter. `fields` maksimal 50 entri; path kosong dibuang. Respons error selalu `Cache-Control: no-store`.
- Paginasi: cursor (`?cursor=…&limit=…`), respons `{ items, nextCursor }`. `limit` bilangan bulat 1–100 dalam bentuk desimal kanonik (`20`, bukan `020`/`2e1`/` 20 `) agar satu ukuran halaman = satu URL (ramah cache), bawaan 20; `cursor` opsional, 1–512 karakter; `nextCursor` bernilai `null` di halaman terakhir. Skema: `paginationQuerySchema` dan `paginatedSchema(item)` di `@pusatk3/shared`.
- Input (body/query) memakai objek ketat: parameter tak dikenal ditolak 422. Karena itu web **tidak** meneruskan seluruh query string halaman ke API (mis. `utm_*`, `fbclid`), hanya parameter yang dikenal (whitelist). Respons memakai skema eksplisit yang membuang field tak dikenal saat di-parse, sehingga menambah field respons tidak memecah klien lama.
- Auth: cookie sesi `HttpOnly; Secure; SameSite=Lax`. Mutasi dari browser wajib lolos cek CSRF/origin.
- Otorisasi: middleware `requireUser()`, `requireProviderRole(roles, resolveProviderId)`, `requireAdmin(roles)`. **Selalu ambil `providerId` dari data di database, bukan dari body.** Urutan di rute: rate limit → `requireUser()` → `validate…` → `requireProviderRole(...)` → handler. `resolveProviderId` membaca param yang sudah divalidasi (`c.req.valid('param')`), mencari record di DB, dan mengembalikan `null` bila tidak ada → 404 (bukan 403) agar keberadaan data penyedia lain tidak bocor.
- Rate limiting per IP + per user di endpoint auth, lead, dan pencarian.

## Perilaku umum (`apps/api`)

- Setiap respons (termasuk error, redirect, dan `Response` mentah dari handler) membawa `X-Request-Id` (selalu dibuat server, `X-Request-Id` dari klien diabaikan) dan header keamanan: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`.
- Rute tak dikenal atau metode salah → 404 `NOT_FOUND`. Body bukan JSON → 415 (juga menutup celah CSRF lewat `text/plain`). JSON rusak → 400 `BAD_REQUEST`. `HTTPException` 4xx lain → 400, tidak pernah 500. Input gagal Zod → 422 `VALIDATION_ERROR` + `fields` (helper `validateJson`/`validateQuery`; kunci query yang berulang menjadi array dan ditolak skema skalar). Error tak terduga → 500 `INTERNAL_ERROR` tanpa detail; log hanya request id + nama error.
- Penjaga `requireUser`, `requireProviderRole(roles, resolveProviderId)`, `requireAdmin(roles)` saat ini **selalu menolak 401** sampai auth dibuat (Fase 2). `resolveProviderId` mengambil penyedia pemilik dari database (mis. jadwal → `provider_id`), bukan dari body/query.
- CORS belum dibuka; diputuskan saat web dan API disambungkan.

## Endpoint awal

### Publik (tanpa login, dapat di-cache)
| Metode | Path | Fungsi |
| --- | --- | --- |
| GET | `/health` | Cek layanan: `{ "status": "ok", "version": "<sha commit / dev>" }`, `Cache-Control: no-store` (`healthResponseSchema`) |
| GET | `/search` | Cari jadwal/penyedia (q, city, category, mode, issuer, month, priceMin, priceMax) |
| GET | `/schedules/:id` | Detail jadwal |
| GET | `/providers/:slug` | Profil publik penyedia |
| GET | `/categories` | Bidang K3 + kategori sertifikasi (`categoriesResponseSchema`): `{ items: [{ slug, name, categories: [{ slug, name, issuers, documentType, typicalValidityYears, regulationRef }] }] }`, bidang urut `sort_order`, kategori di tiap bidang urut nama (collation `id`, lalu slug); bidang tanpa kategori tidak tampil. Tanpa parameter (parameter apa pun → 422). `Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=86400`; daftar kosong (DB belum di-seed) → `no-store`. Purge saat seed/kategori berubah: `/api/v1/categories` |
| GET | `/cities` | Data referensi kota (Fase 1) |
| POST | `/leads` | Catat lead (Turnstile wajib) |

### Auth
| Metode | Path | Fungsi |
| --- | --- | --- |
| POST | `/auth/email/start` | Kirim kode OTP |
| POST | `/auth/email/verify` | Verifikasi kode, buat sesi |
| GET | `/auth/google/*` | OAuth Google |
| POST | `/auth/2fa/verify` | Verifikasi 2FA |
| POST | `/auth/logout` | Hapus sesi |

### Penyedia (login + peran)
| Metode | Path | Peran |
| --- | --- | --- |
| POST | `/providers/:id/claims` | user |
| GET/PATCH | `/me/providers/:id` | owner, admin |
| CRUD | `/me/providers/:id/schedules` | owner, admin, staff |
| GET/PATCH | `/me/providers/:id/leads` | owner, admin, staff |
| CRUD | `/me/providers/:id/branches` | owner, admin |
| CRUD | `/me/providers/:id/members` | owner |
| POST | `/me/providers/:id/transfer-ownership` | owner |

### User
| Metode | Path |
| --- | --- |
| GET/PATCH/DELETE | `/me` |
| GET | `/me/sessions`, DELETE `/me/sessions/:id` |
| CRUD | `/me/saved-schedules` |

### Admin
| Metode | Path | Peran |
| --- | --- | --- |
| GET/POST | `/admin/claims`, `/admin/claims/:id/decision` | curator, super_admin |
| GET/POST | `/admin/reviews/:id/moderate` | moderator |
| POST | `/admin/impersonate/:userId` | super_admin (wajib log audit) |

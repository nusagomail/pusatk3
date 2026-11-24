# Kontrak API

## Konvensi

- Basis: `/api/v1`. JSON. Nama field `camelCase`.
- Skema request/response didefinisikan dengan Zod di `packages/shared` dan dipakai bersama oleh API, web, dan mobile.
- Error: `{ "error": { "code": "FORBIDDEN", "message": "..." } }` dengan status HTTP yang sesuai (400, 401, 403, 404, 409, 422, 429, 500).
- Paginasi: cursor (`?cursor=…&limit=…`), respons `{ items, nextCursor }`.
- Auth: cookie sesi `HttpOnly; Secure; SameSite=Lax`. Mutasi dari browser wajib lolos cek CSRF/origin.
- Otorisasi: middleware `requireUser`, `requireProviderRole(providerId, ['owner','admin'])`, `requireAdmin(role)`. **Selalu ambil `providerId` dari data di database, bukan dari body.**
- Rate limiting per IP + per user di endpoint auth, lead, dan pencarian.

## Endpoint awal

### Publik (tanpa login, dapat di-cache)
| Metode | Path | Fungsi |
| --- | --- | --- |
| GET | `/health` | Cek layanan |
| GET | `/search` | Cari jadwal/penyedia (q, city, category, mode, issuer, month, priceMin, priceMax) |
| GET | `/schedules/:id` | Detail jadwal |
| GET | `/providers/:slug` | Profil publik penyedia |
| GET | `/cities`, `/categories` | Data referensi |
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

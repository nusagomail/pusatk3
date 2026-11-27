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
  | `SERVICE_UNAVAILABLE` | 503 | Fitur belum aktif di lingkungan ini (mis. form tanpa secret Turnstile) atau layanan luar tidak terjangkau |

  Khusus `VALIDATION_ERROR`, boleh menyertakan `fields: [{ "path": "phone", "message": "..." }]` agar form bisa menandai isian yang salah; kode lain tidak boleh membawa `fields`. `path` adalah path isian yang digabung titik (mis. `items.0.phone`); kesalahan di level objek (tanpa path) masuk ke `message`, bukan `fields`. `message` maksimal 500 karakter. `fields` maksimal 50 entri; path kosong dibuang. Respons error selalu `Cache-Control: no-store`.
- Paginasi: cursor (`?cursor=…&limit=…`), respons `{ items, nextCursor }`. `limit` bilangan bulat 1–100 dalam bentuk desimal kanonik (`20`, bukan `020`/`2e1`/` 20 `) agar satu ukuran halaman = satu URL (ramah cache), bawaan 20; `cursor` opsional, 1–512 karakter; `nextCursor` bernilai `null` di halaman terakhir. Skema: `paginationQuerySchema` dan `paginatedSchema(item)` di `@pusatk3/shared`.
- Input (body/query) memakai objek ketat: parameter tak dikenal ditolak 422. Karena itu web **tidak** meneruskan seluruh query string halaman ke API (mis. `utm_*`, `fbclid`), hanya parameter yang dikenal (whitelist). Respons memakai skema eksplisit yang membuang field tak dikenal saat di-parse, sehingga menambah field respons tidak memecah klien lama.
- Auth: cookie sesi `HttpOnly; Secure; SameSite=Lax`. Mutasi dari browser wajib lolos cek CSRF/origin.
- Otorisasi: middleware `requireUser()`, `requireProviderRole(roles, resolveProviderId)`, `requireAdmin(roles)`. **Selalu ambil `providerId` dari data di database, bukan dari body.** Urutan di rute: rate limit → `requireUser()` → `validate…` → `requireProviderRole(...)` → handler. `resolveProviderId` membaca param yang sudah divalidasi (`c.req.valid('param')`), mencari record di DB, dan mengembalikan `null` bila tidak ada → 404 (bukan 403) agar keberadaan data penyedia lain tidak bocor.
- Rate limiting per IP + per user di endpoint auth, lead, dan pencarian. Fase 1 (ADR 0022): binding Workers Rate Limiting per IP `CF-Connecting-IP`; baca publik 120/menit, form lead 5/menit, klik WhatsApp 20/menit; IP = `CF-Connecting-IP`; untuk request web lewat service binding (tanpa header itu) dipakai `X-PusatK3-Visitor-IP` yang diisi Worker web. IPv6 dikelompokkan per /64.

## Perilaku umum (`apps/api`)

- Setiap respons (termasuk error, redirect, dan `Response` mentah dari handler) membawa `X-Request-Id` (selalu dibuat server, `X-Request-Id` dari klien diabaikan) dan header keamanan: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `X-Robots-Tag: noindex` (JSON tidak pernah diindeks).
- Rute tak dikenal atau metode salah → 404 `NOT_FOUND`. Body bukan JSON → 415 (juga menutup celah CSRF lewat `text/plain`). JSON rusak → 400 `BAD_REQUEST`. `HTTPException` 4xx lain → 400, tidak pernah 500. Input gagal Zod → 422 `VALIDATION_ERROR` + `fields` (helper `validateJson`/`validateQuery`; kunci query yang berulang menjadi array dan ditolak skema skalar). Error tak terduga → 500 `INTERNAL_ERROR` tanpa detail; log hanya request id + nama error.
- Penjaga `requireUser`, `requireProviderRole(roles, resolveProviderId)`, `requireAdmin(roles)` saat ini **selalu menolak 401** sampai auth dibuat (Fase 2). `resolveProviderId` mengambil penyedia pemilik dari database (mis. jadwal → `provider_id`), bukan dari body/query.
- CORS belum dibuka; diputuskan saat web dan API disambungkan.

## Endpoint awal

### Publik (tanpa login, dapat di-cache)
| Metode | Path | Fungsi |
| --- | --- | --- |
| GET | `/health` | Cek layanan: `{ "status": "ok", "version": "<sha commit / dev>" }`, `Cache-Control: no-store` (`healthResponseSchema`) |
| GET | `/meta/data-version` | Versi publik `{ "version": "<versi data>.<versi API>" }` (`dataVersionResponseSchema`, opaque), berubah setiap impor dan setiap deploy API; dipakai web untuk kunci cache halaman. Tanpa parameter (→ 422). `Cache-Control: no-store` (ADR 0021) |
| GET | `/search` | Cari jadwal (`searchQuerySchema`): `q` (1–100 karakter; dipecah per kata, maks 6, hanya huruf/angka; kata pengisi seperti "pelatihan"/"sertifikasi"/"k3" dibuang bila ada kata lain; **semua** kata sisanya wajib cocok sebagai awal kata (mis. "forklif") di judul, nama/sinonim kategori, nama bidang, nama penyedia, nama kota, penerbit, atau metode; kata 1–2 karakter harus utuh; huruf besar/kecil dan tanda baca diabaikan; teks yang hanya berisi simbol → tanpa hasil; ADR 0020), `field` (slug bidang K3, mis. `k3-umum`), `category`, `city`, `mode`, `issuer`, `month` (`YYYY-MM`, tanggal mulai), `priceMin`/`priceMax` (rupiah bulat, min ≤ max), `verified=true`, `sort` (`date` bawaan: mulai terdekat; `price`: termurah, harga kosong di akhir), `limit` (1–100, bawaan 20), `cursor` (offset, maks 1000). Respons `{ items, nextCursor, sponsored }`: `sponsored` selalu terpisah dari hasil organik (kosong sampai Fase 4). Hanya jadwal `published`, belum selesai (tanggal Asia/Jakarta), penyedia tidak `closed`. Urutan tidak pernah memakai paket. `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600`. Disimpan di cache edge dengan kunci versi data + versi API + tanggal Jakarta, hanya untuk request anonim (ADR 0021; header `X-Cache: HIT/MISS`; parameter `__cache` dicadangkan: request yang membawanya dilewati cache dan ditolak 422) |
| GET | `/schedules/:id` | Detail jadwal (`scheduleDetailSchema`): ringkasan + deskripsi, syarat, kuota, cabang (null untuk online), penyedia dengan kontak, legalitas (tanpa dokumen), dan `acceptsQuestions` (true hanya untuk penyedia `claimed`: form pertanyaan tampil, ADR 0022). `id` = ULID, selain itu 422; parameter query apa pun → 422. Draf, `expired`, atau penyedia `closed` → 404. Cache sama dengan `/search` |
| GET | `/providers/:slug` | Profil publik penyedia (`providerProfileSchema`): kontak, cabang (kantor pusat dulu), legalitas, maks 50 jadwal yang tampil (mulai terdekat). Penyedia `closed`/tidak ada → 404; parameter query apa pun → 422. Cache sama dengan `/search` |
| GET | `/categories` | Bidang K3 + kategori sertifikasi (`categoriesResponseSchema`): `{ items: [{ slug, name, categories: [{ slug, name, issuers, documentType, typicalValidityYears, regulationRef }] }] }`, bidang urut `sort_order`, kategori di tiap bidang urut nama (collation `id`, lalu slug); bidang tanpa kategori tidak tampil. Tanpa parameter (parameter apa pun → 422). `Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=86400`; daftar kosong (DB belum di-seed) → `no-store`. Cache edge seperti `/search` (ADR 0021): seed/impor menulis versi data baru |
| GET | `/landing-pages` | Halaman SEO kategori × kota yang lolos aturan halaman tipis (≥ 3 jadwal offline yang tampil dari ≥ 2 penyedia; ADR 0023): `{ items: [{ category: { slug, name }, city: { slug, name }, schedules, providers, isSample }] }`. Tanpa parameter (→ 422). Cache seperti `/search` |
| GET | `/sitemap` | Kunci URL yang boleh diindeks, **tanpa data contoh**: `{ landingPages: [{ category, city }], providers: [slug], schedules: [id] }` (masing-masing maks 10 000). Tanpa parameter (→ 422). Cache seperti `/search` |
| GET | `/cities` | Daftar kota yang punya minimal satu cabang penyedia tidak `closed` `{ items: [{ slug, name, province }] }`, urut nama (daftar rujukan lengkap: `docs/data/kota.csv`, #54); tanpa parameter (parameter apa pun → 422). Cache seperti `/categories` |
| POST | `/leads` | Form "Kirim pertanyaan" (`leadFormRequestSchema`): `scheduleId`, `name`, `phone` (HP Indonesia) dan/atau `email`, `message` (10–1000), `consent: true`, `turnstileToken`. Hanya jadwal yang tampil milik penyedia `claimed` (selain itu 404). Turnstile gagal, dipakai ulang, atau action bukan `lead-form` → 403; belum dikonfigurasi, salah konfigurasi, atau tidak terjangkau → 503. Body bukan JSON → 415, lebih dari 8 KB → 413. Rate limit 5/menit per IP → 429 + `Retry-After`. Jawaban `201 { "status": "received" }`, `no-store`. Tidak ada endpoint publik untuk membaca lead (ADR 0022) |
| POST | `/leads/whatsapp` | Catat klik WhatsApp tanpa data pribadi (`leadClickRequestSchema`): tepat satu dari `{ scheduleId }` atau `{ providerSlug }`; hanya penyedia tidak `closed` yang punya nomor WhatsApp (selain itu 404). Tanpa Turnstile; body maks 1 KB (413); rate limit 20/menit per IP. Jawaban `202 { "status": "received" }` |

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

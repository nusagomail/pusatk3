# ADR 0022: Pencatatan lead, Turnstile, rate limit, dan retensi data pribadi

Status: diterima · 26 November 2026 · issue #28. Keputusan pemilik: konfigurasi rate limit dan Cron di production boleh ditambahkan (tanpa deploy); masa simpan data pribadi lead 12 bulan ("terserah yang terbaik").

## Konteks
PRD: setiap klik WhatsApp dan kiriman form pertanyaan dicatat sebagai lead. Pengunjung tidak login, jadi endpoint lead publik dan anonim. Risikonya spam lead dan scraping (`docs/keamanan.md`). Lead berisi data pribadi, sehingga wajib mengikuti UU PDP: ada persetujuan, data minimal, dan retensi terbatas.

## Keputusan
- **Dua endpoint, dua tingkat data:**
  - `POST /api/v1/leads/whatsapp` mencatat klik WhatsApp **tanpa data pribadi**, cukup penyedia dan jadwal atau profil. Tidak memakai Turnstile, karena pengunjung sudah menuju WhatsApp dan tidak boleh tertahan. Tombol tetap langsung membuka `wa.me`; pencatatan dikirim terpisah (`sendBeacon`, PR web).
  - `POST /api/v1/leads` untuk form "Kirim pertanyaan", berisi nama, HP atau email, pesan, dan persetujuan. **Turnstile wajib.**
- **Form hanya untuk penyedia yang sudah klaim** (`status = claimed`). Profil yang belum diklaim tidak punya pembaca lead. Mengumpulkan data pribadi untuknya melanggar prinsip data minimal dan menyesatkan pengunjung, yang mengira pertanyaannya sampai. Untuk profil ini UI hanya menampilkan WhatsApp (bila ada).
- **Kontrol endpoint:**
  - skema Zod ketat (field tak dikenal ditolak; `providerId` tidak pernah dari body, selalu dari jadwal di database);
  - hanya jadwal yang tampil (published, belum mulai, penyedia tidak `closed`), selain itu 404;
  - body wajib JSON (415 menutup form lintas situs);
  - jawaban hanya `{ status: "received" }`, tidak menggemakan data apa pun;
  - tidak ada endpoint publik untuk membaca lead; penyedia membacanya di dasbor Fase 2 dengan cek peran dan kepemilikan.
- **Turnstile:**
  - Verifikasi di API lewat siteverify dengan secret `TURNSTILE_SECRET` (Workers secret, diisi pemilik).
  - Tanpa secret di lingkungan yang dideploy, form dimatikan (503 `SERVICE_UNAVAILABLE`), bukan dibuka tanpa perlindungan. Bila Cloudflare tidak bisa dihubungi, jawabannya juga 503.
  - Lokal (`APP_VERSION=dev`) memakai kunci uji publik Cloudflare "selalu lolos".
- **Rate limit (binding Workers Rate Limiting, per IP pengunjung, per 60 detik):**
  - baca publik (`/search`, `/schedules/*`, `/providers/*`, `/cities`, `/categories`): 120;
  - form: 5;
  - klik WhatsApp: 20.
  - Kunci rate limit diambil dari `CF-Connecting-IP`, yang dipasang edge Cloudflare dan tidak bisa diisi klien.
  - Request dari web lewat service binding tidak membawa IP publik yang bisa dipercaya, jadi **web Worker membatasi trafik halaman sendiri** (ia melihat IP pengunjung) dan API membatasi panggilan publik langsung. Asumsi "binding tanpa `CF-Connecting-IP`" dicek setelah rilis di zona production (checklist `/siapkan-rilis`).
  - Rate limit berjalan sebelum cache edge, sehingga jawaban dari cache tetap dihitung.
  - Namespace id `28xxx` dicadangkan untuk pusatk3 di akun bersama (ADR 0016): staging `28101–28103`, production `28201–28203`, web `2811x/2821x`.
- **Data pribadi minimal:**
  - hanya nama, satu kontak (HP Indonesia dinormalkan `62…` atau email), pesan, dan waktu persetujuan;
  - klik WhatsApp dijaga CHECK di database agar tidak pernah berisi data pribadi;
  - tidak menyimpan IP atau user agent;
  - data pribadi tidak pernah masuk log.
- **Retensi 12 bulan:** Cron harian (02.17 WIB, staging dan production) mengosongkan nama, HP, email, dan pesan lead form yang berumur lebih dari 12 bulan (`anonymized_at` diisi). Baris lead tetap ada untuk statistik. Hapus akun (Fase 2) menganonimkan lead milik user itu lebih awal.
- **`profile_views`** (agregat harian per penyedia dan jadwal, tanpa data pengunjung) dibuat sekarang, tetapi baru diisi bersama statistik dasbor penyedia (Fase 2). Halaman publik di-cache (ADR 0021), sehingga penghitungan butuh beacon terpisah yang dirancang bersama dasbor.

## Konsekuensi
- Selama belum ada penyedia yang klaim (data contoh), form tidak tampil di mana pun. Endpoint dan alurnya sudah diuji dengan data klaim buatan.
- Pemilik mengisi `TURNSTILE_SECRET` (API) dan site key (web) per lingkungan. Sebelum itu form di staging menjawab 503.
- Klik WhatsApp bisa dibesar-besarkan bot sampai batas rate limit; angka klik dipakai sebagai statistik kasar, bukan dasar tagihan.
- Lead penyedia yang kemudian `closed` tetap tersimpan sampai masa retensi habis.

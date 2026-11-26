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
  - body wajib JSON (415 menutup form lintas situs) dan dibatasi ukurannya sebelum dibaca: form 8 KB, klik 1 KB (413);
  - jawaban hanya `{ status: "received" }`, tidak menggemakan data apa pun;
  - tidak ada endpoint publik untuk membaca lead; penyedia membacanya di dasbor Fase 2 dengan cek peran dan kepemilikan.
- **Turnstile:**
  - Verifikasi di API lewat siteverify dengan secret `TURNSTILE_SECRET` (Workers secret, diisi pemilik). Token wajib membawa action widget `lead-form`, sehingga token dari form lain (kelak login atau klaim) ditolak.
  - Tanpa secret di lingkungan yang dideploy, form dimatikan (503 `SERVICE_UNAVAILABLE`), bukan dibuka tanpa perlindungan.
  - Kode error konfigurasi atau internal dari Cloudflare (`invalid-input-secret`, `missing-input-secret`, `bad-request`, `internal-error`), Cloudflare tidak terjangkau, atau kunci uji yang terpasang di lingkungan deploy juga menghasilkan 503. Kasus ini dicatat (hanya kode, tanpa token atau data form), jadi secret yang salah tidak tampil sebagai "anti-bot gagal" untuk semua pengunjung.
  - Token ditolak atau dipakai ulang (`timeout-or-duplicate`) → 403.
  - Lokal (`APP_VERSION=dev`) memakai kunci uji publik Cloudflare "selalu lolos".
- **Rate limit (binding Workers Rate Limiting, per IP pengunjung, per 60 detik):**
  - baca publik (`/search`, `/schedules/*`, `/providers/*`, `/cities`, `/categories`): 120;
  - form: 5;
  - klik WhatsApp: 20.
  - Kunci rate limit = IP pengunjung. IPv6 dikelompokkan per /64, karena satu rumah atau HP mendapat satu /64 dan bisa berganti alamat di dalamnya.
  - Request dari internet selalu membawa `CF-Connecting-IP` dari edge Cloudflare; klien tidak bisa mengisi atau menghapusnya.
  - Web memanggil API lewat service binding dan meneruskan IP pengunjung di header `X-PusatK3-Visitor-IP`. **Header itu hanya dipercaya bila `CF-Connecting-IP` tidak ada**, jadi klien dari internet tidak pernah bisa memilih kuncinya sendiri. Semua rate limit terpusat di API; web tidak perlu limiter sendiri. Halaman yang dilayani dari cache web tidak memanggil API, dan memang murah.
  - Asumsi "request lewat binding tidak membawa `CF-Connecting-IP`" diperiksa lewat log `rate-limit-key-source` (sekali per isolate, tanpa IP) di staging setelah merge.
  - Sisa risiko: Worker lain di akun bersama (ADR 0016) yang di-bind ke `pusatk3-api-*` bisa mengisi header itu. Binding ke Worker pusatk3 hanya dibuat oleh proyek ini.
  - Workers Rate Limiting dihitung per lokasi Cloudflare dan bersifat perkiraan. Pengguna seluler di balik CGNAT bisa berbagi IP, jadi batas form (5/menit) sengaja longgar untuk manusia.
  - Rate limit berjalan sebelum cache edge, sehingga jawaban dari cache tetap dihitung.
  - Namespace id `28xxx` dicadangkan untuk pusatk3 di akun bersama (ADR 0016): staging `28101–28103`, production `28201–28203`.
- **Data pribadi minimal:**
  - hanya nama, kontak (HP Indonesia dinormalkan `62…` dan/atau email; minimal satu), pesan, waktu persetujuan, dan **versi teks persetujuan** (`consent_version`, dari konstanta server `LEAD_CONSENT_VERSION`; teksnya `LEAD_CONSENT_TEXT` di `packages/shared`), sehingga kalimat yang disetujui bisa dibuktikan;
  - klik WhatsApp dijaga CHECK di database agar tidak pernah berisi data pribadi;
  - tidak menyimpan IP atau user agent;
  - data pribadi tidak pernah masuk log.
- **Retensi 12 bulan:**
  - Cron harian (02.17 WIB, staging dan production) mengosongkan nama, HP, email, dan pesan lead form yang berumur lebih dari 12 bulan (`anonymized_at` diisi). Baris lead tetap ada untuk statistik.
  - Handler menunggu pekerjaannya selesai dan melempar ulang error, sehingga kegagalan tercatat di Cron Events. Log hanya berisi jumlah atau nama error.
  - D1 Time Travel menyimpan riwayat sekitar 30 hari, jadi masa simpan efektif ±12 bulan + 30 hari. Ini wajib disebut di kebijakan privasi.
  - Hapus akun (Fase 2) menganonimkan lead milik user itu lebih awal.
- **Hak subjek data (pengunjung anonim):** permintaan akses atau hapus lewat email ke pengelola. Admin mencari lead berdasarkan email/HP yang disebut, lalu mengosongkan data pribadinya (sama seperti retensi). Prosedur manual ini berlaku sampai ada alat admin (Fase 2).
- **`profile_views`** (agregat harian per penyedia dan jadwal, tanpa data pengunjung) dibuat sekarang, tetapi baru diisi bersama statistik dasbor penyedia (Fase 2). Halaman publik di-cache (ADR 0021), sehingga penghitungan butuh beacon terpisah yang dirancang bersama dasbor.

## Konsekuensi
- Selama belum ada penyedia yang klaim (data contoh), form tidak tampil di mana pun. Endpoint dan alurnya sudah diuji dengan data klaim buatan.
- **Form tidak boleh aktif di production sebelum halaman kebijakan privasi terbit** (`docs/keamanan.md`, UU PDP; roadmap menempatkan halaman legal di Fase 3, sehingga halaman privasi perlu dimajukan bersama klaim di Fase 2). Ini dicatat di checklist `/siapkan-rilis`.
- Lead punya FK ke penyedia dan jadwal. Membersihkan data contoh kelak harus menghapus lead contoh lebih dulu.
- Pemilik mengisi `TURNSTILE_SECRET` (API) dan site key (web) per lingkungan. Sebelum itu form di staging menjawab 503.
- Klik WhatsApp bisa dibesar-besarkan bot sampai batas rate limit; angka klik dipakai sebagai statistik kasar, bukan dasar tagihan.
- Lead penyedia yang kemudian `closed` tetap tersimpan sampai masa retensi habis.

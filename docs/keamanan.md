# Keamanan

## Checklist setiap endpoint baru

- [ ] Input divalidasi Zod; field tak dikenal ditolak
- [ ] Autentikasi sesuai (publik / user / penyedia / admin)
- [ ] Otorisasi: peran **dan** kepemilikan dicek terhadap data di database
- [ ] Tes hak akses: user lain, penyedia lain, dan anonim ditolak (403/404)
- [ ] Rate limit untuk endpoint sensitif
- [ ] Tidak ada data pribadi di log
- [ ] Respons tidak membocorkan field internal (pakai skema output eksplisit)

## Aturan umum

- Secret hanya di Workers Secrets / GitHub Secrets. Tidak pernah di repo atau log.
- Cookie sesi `HttpOnly; Secure; SameSite=Lax`; rotasi sesi setelah login dan setelah 2FA.
- Header: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'` (kecuali website instan).
- Turnstile di semua form publik (lead, kontak, klaim, login). Script/frame `challenges.cloudflare.com` hanya diizinkan CSP di halaman yang menampilkan widget (ADR 0022).
- Upload hanya ke R2 lewat URL bertanda tangan; batasi jenis dan ukuran file; dokumen legalitas tidak publik.
- Data rahasia di DB (secret 2FA) dienkripsi.
- Dependabot + secret scanning aktif.

## Risiko khas platform

| Risiko | Kontrol |
| --- | --- |
| Klaim listing palsu | Bukti legalitas + verifikasi nomor kantor + review kurator |
| Pembajakan profil (WA diganti) | OTP ke nomor baru + verifikasi ulang + notifikasi ke owner |
| Ulasan palsu | Hanya peserta terverifikasi, moderasi |
| Spam lead | Turnstile + rate limit |
| Scraping | Rate limit + bot management |
| Phishing via website instan | Hanya penyedia terverifikasi, moderasi konten |
| IDOR di API | Middleware kepemilikan + tes otomatis |

## UU PDP

- Persetujuan saat pengumpulan data, kebijakan privasi jelas.
- Hak akses, koreksi, dan hapus akun.
- Retensi data lead dibatasi; anonimisasi saat akun dihapus.
- Prosedur notifikasi kebocoran 3×24 jam.

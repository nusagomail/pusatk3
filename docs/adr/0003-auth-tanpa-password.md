# ADR 0003: Login tanpa password, 2FA wajib untuk penyedia

Status: diterima · 25 November 2026

## Keputusan
- Metode masuk: Google OAuth dan email + kode sekali pakai (OTP). Tidak ada password, sehingga tidak ada alur lupa password.
- 2FA (aplikasi authenticator + kode cadangan) wajib untuk anggota penyedia dan admin.
- Login tidak sama dengan verifikasi penyedia; klaim profil tetap memerlukan bukti legalitas.
- Library: Better Auth (berjalan di Workers) — dikonfirmasi saat Fase 2.

## Konsekuensi
- Pengiriman email OTP harus andal (Resend) dan di-rate-limit.
- Perubahan email/nomor WA memerlukan konfirmasi OTP ke alamat baru.

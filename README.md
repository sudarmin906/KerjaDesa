# KerjaDesa Pro

Sistem digital untuk mendukung administrasi dan monitoring desa.

## Modul
- Dashboard
- Data Desa
- Monitoring Lapangan
- Dokumentasi
- Dokumen Digital
- Laporan
- APBDes
- RKPDes
- Realisasi Dana Desa
- BUMDes dan Koperasi

## Status
Pengembangan berkelanjutan.

## Inisialisasi Admin Aman

KerjaDesa tidak menyimpan username/password default di source code.

Untuk production, gunakan salah satu metode berikut:

1. **Seed saat deployment**
   - `ADMIN_USERNAME` (opsional, default: `admin`)
   - `ADMIN_PASSWORD` (wajib minimal 15 karakter)
2. **Bootstrap satu kali**
   - Set `ADMIN_BOOTSTRAP_TOKEN` sebagai secret deployment dengan minimal 32 karakter.
   - Saat database belum memiliki pengguna, panggil `POST /api/auth/bootstrap`.
   - Kirim `bootstrap_token`, `username` (opsional, default `admin`), dan password baru minimal 15 karakter.
   - Setelah akun pertama dibuat, endpoint bootstrap otomatis tidak dapat digunakan lagi selama masih ada pengguna.
   - Bootstrap production hanya diterima melalui HTTPS.

Contoh request bootstrap (jangan simpan token/password ini di repository):

```bash
curl -X POST "https://API-ANDA/api/auth/bootstrap" \
  -H "Content-Type: application/json" \
  -d '{"bootstrap_token":"SECRET_DEPLOYMENT_ANDA","username":"admin","password":"PASSWORD_KUAT_MINIMAL_15","nama_lengkap":"Administrator KerjaDesa"}'
```

Setelah berhasil, login normal melalui halaman KerjaDesa. Password tidak pernah dikembalikan oleh API dan tidak disimpan dalam plaintext.

# KerjaDesa Pro Upgrade Roadmap

Dokumen ini adalah roadmap eksekusi tingkat tinggi. Registry mesin ada di `kerjadesa_upgrade_manifest.json`.

## Baseline yang dipertahankan

- PWA dan offline/localStorage
- Dashboard
- Data kegiatan
- Monitoring lapangan + GPS
- Dokumentasi
- Dokumen digital
- Laporan
- APBDes/RKPDes dan realisasi sebagai domain aplikasi
- BUMDes dan Koperasi
- DRP/photo OCR
- Digital Twin
- Upgrade Control Center
- CI quality gate dan Pages smoke test

## Tahap yang baru diaktifkan

### Server-backed foundation

1. API server benar-benar merutekan request.
2. Authentication menggunakan session token opaque.
3. Password admin disimpan sebagai scrypt hash, bukan plaintext.
4. Role access diterapkan pada resource API.
5. CRUD server-backed untuk user, desa, kegiatan, monitoring, dokumen, dan laporan.
6. Dashboard API membaca agregat server.
7. Frontend login/logout terhubung ke backend dan tetap memiliki fallback offline.
8. CI melakukan syntax check backend dan smoke test `/api/health`.

## A1-A9

A1-A9 tetap menjadi fondasi lintas modul: arsitektur, data, authentication/roles, backend integration, offline/sync, quality, deployment, mobile, dan governance. Implementasi baru harus menambah kemampuan yang benar-benar aktif di source code; tidak cukup hanya menandai milestone sebagai selesai.

## Rentang 1-600

Rentang 1-600 diperlakukan sebagai roadmap jangka panjang lintas domain, bukan alasan untuk membuat 600 placeholder. Setiap batch implementasi harus menghasilkan perubahan source code yang dapat diuji, lalu dicatat di manifest.

## Urutan eksekusi berikutnya

- Pengujian integrasi frontend ↔ API
- Migrasi persistence ke PostgreSQL saat server database tersedia
- Sinkronisasi data offline dengan conflict handling
- Penguatan manajemen user/role
- Modul administrasi desa dan dokumen berbasis server
- Deployment backend production

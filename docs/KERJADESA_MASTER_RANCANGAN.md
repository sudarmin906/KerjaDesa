# KerjaDesa Pro — Master Rekonsiliasi Rancangan

Dokumen ini menyatukan rancangan yang pernah dibuat untuk KerjaDesa Pro dengan repository aktif. Prinsipnya: **upgrade source yang sudah ada, tidak rebuild dari nol**.

## 1. Pondasi yang sudah ada
- PWA/website existing dengan localStorage dan offline-first.
- Login, session, role, dashboard, kegiatan, monitoring, GPS, dokumentasi.
- DRP, laporan bulanan, SPPD editable dan output Word/PDF.
- Dokumen desa, backup/restore, galeri, pengaturan.
- API Node.js, auth scrypt, audit log, PostgreSQL + JSON fallback.
- Offline Sync Queue, retry, conflict/version control.
- Dashboard server analytics.
- Docker Compose, Nginx/Caddy, HTTPS/deployment foundation.
- Digital Twin 2.0 dan Upgrade Control Center.

## 2. Arsitektur pengguna dan hak akses
Role yang menjadi rancangan target:
- ADMIN
- PLD
- TPP
- KADES
- SEKDES
- BENDAHARA
- KAUR
- KASI
- OPERATOR
- PEMDES

Hak akses harus diterapkan di backend, bukan hanya disembunyikan di UI.

## 3. Master wilayah dan desa
- Wilayah/kecamatan/kabupaten/provinsi.
- Profil desa.
- Penugasan PLD/TPP ke desa.
- Data identitas desa dan metadata.
- Statistik ringkas per desa.

## 4. Pemerintahan, perencanaan dan keuangan desa
### Perencanaan
- RPJMDes
- RKPDes
- Musrenbang Desa
- Pra-Musrenbang Dusun
- agenda dan tindak lanjut

### APBDes dan RAB
- APBDes
- RAB
- sumber dana
- kegiatan/subkegiatan
- pagu/anggaran
- realisasi
- sisa anggaran
- progres fisik/keuangan
- import Excel/PDF dan validasi data

### Realisasi dan LPJ
- realisasi Dana Desa
- Monev Dana Desa
- SPP
- kuitansi
- nota pesanan
- LPJ
- berita acara/surat
- arsip bukti

## 5. Pembangunan dan monitoring
- kegiatan pembangunan.
- monitoring berkala.
- progres 0–100%.
- titik nol/GPS.
- histori progres.
- foto sebelum/sesudah.
- timestamp dan metadata foto.
- catatan masalah.
- tindak lanjut.
- rekomendasi.
- relasi APBDes → kegiatan → monitoring → dokumentasi → realisasi → laporan.

## 6. DRP dan laporan PLD
Alur target:
1. Input kunjungan.
2. Data kegiatan/tujuan.
3. GPS dan dokumentasi.
4. Narasi hasil.
5. masalah.
6. langkah tindak lanjut.
7. rekomendasi.
8. validasi dokumentasi.
9. laporan bulanan.
10. output Word/PDF.

DRP Master mencakup identitas, aktivitas, narasi, hasil, masalah, tindak lanjut, rekomendasi dan dokumentasi.

## 7. SPPD
- Identitas PLD.
- tujuan/perjalanan.
- tanggal mulai/selesai.
- jumlah hari otomatis.
- beberapa kunjungan.
- template Word asli/editable.
- penyimpanan server.
- offline queue.
- server hydration.

## 8. Arsip digital desa
Kategori utama:
- RPJMDes
- RKPDes
- APBDes
- RAB
- Realisasi
- LPJ
- BA
- Surat
- Monev DD
- BUMDes
- Koperasi Desa Merah Putih
- dokumen pendukung lainnya

Dokumen besar/foto tidak boleh dipaksa masuk payload JSON API; metadata dan status sinkronisasi dipisahkan dari binary storage.

## 9. Kependudukan dan program sosial
Rancangan domain:
- penduduk
- KPM
- BLT
- stunting
- data sasaran
- validasi KPM
- riwayat bantuan
- kegiatan kesehatan/intervensi.

## 10. BUMDes, UMKM dan Koperasi
- BUMDes
- unit usaha
- kegiatan usaha
- laporan/LPJ.
- Koperasi Desa Merah Putih.
- progres pembangunan.
- dokumentasi.
- administrasi dan arsip.

## 11. Pertanian, kesehatan, pendidikan dan pariwisata
Domain yang dirancang untuk dapat dikembangkan di atas platform yang sama:
- pertanian
- kesehatan
- pendidikan
- ekowisata/pariwisata
- program/kegiatan desa
- monitoring dan dokumentasi.

## 12. AI Assistance
- penyusunan/penyempurnaan narasi.
- bantuan laporan.
- knowledge base desa.
- API key tetap di server/proxy.
- AI tidak boleh menambahkan fakta yang tidak berasal dari data pengguna.

## 13. Dashboard
Dashboard target:
- profil desa.
- statistik kegiatan.
- monitoring.
- progres pembangunan.
- APBDes/keuangan.
- dokumen.
- laporan.
- agenda.
- notifikasi.
- status sinkronisasi.
- statistik per desa dan per periode.
- dashboard berbeda sesuai role.

## 14. Offline-first
Semua modul yang memungkinkan harus:
- dapat digunakan offline.
- menyimpan perubahan lokal.
- memasukkan perubahan ke queue.
- retry otomatis.
- sinkron saat online.
- mendeteksi konflik versi.
- mempertahankan data lokal yang belum tersinkron.
- menampilkan status sinkronisasi.

## 15. Output dan integrasi
- Word.
- PDF.
- Excel.
- import Excel/PDF dengan validasi.
- backup/restore.
- PWA/Android wrapper.
- deployment web/API/database.

## 16. Aturan pengembangan berikutnya
1. Jangan membangun ulang KerjaDesa dari nol.
2. Jangan menghapus fitur yang sudah bekerja.
3. Setiap modul baru harus memakai auth/role, API, offline sync, audit dan struktur data yang sama.
4. UI mobile dan web tetap satu sumber data.
5. Jangan menyatakan milestone selesai sebelum benar-benar masuk repository dan lolos pemeriksaan.
6. Modul yang baru berupa entry point/menu belum boleh disebut modul penuh.

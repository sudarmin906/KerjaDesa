# KerjaDesa Pro — Deployment Gratis Render + Supabase

Konfigurasi gratis sudah disiapkan untuk menjalankan frontend + API dalam satu Render Web Service, sehingga aplikasi tetap memakai /api tanpa perlu mengubah URL API setelah deployment.

## 1. Buat database Supabase
1. Buat project baru di Supabase.
2. Buka Connect.
3. Ambil Session pooler connection string untuk backend yang berjalan di platform publik.
4. Ganti password placeholder dengan password database Anda.
5. Simpan sebagai DATABASE_URL.

KerjaDesa akan membuat tabel production yang dibutuhkan saat startup melalui adapter PostgreSQL.

## 2. Deploy KerjaDesa ke Render
1. Login ke Render.
2. Pilih New → Blueprint.
3. Hubungkan repository GitHub sudarmin906/KerjaDesa.
4. Render akan membaca render.yaml.
5. Isi ADMIN_PASSWORD dengan password login admin yang Anda tentukan.
6. Isi DATABASE_URL dengan connection string Supabase.
7. Deploy.

Blueprint memakai Web Service Docker, Free plan, health check /api/health, frontend dan API dari service yang sama, serta CORS_ORIGIN kosong karena same-origin.

## 3. Login
Setelah deploy selesai, Render memberikan alamat seperti https://<nama-service>.onrender.com.
Username: admin
Password: nilai ADMIN_PASSWORD yang Anda isi di Render.

## 4. Catatan free tier
Render Free cocok untuk tahap uji coba/hobi dan dapat melakukan spin-down ketika tidak digunakan. Supabase Free juga memiliki batas penggunaan dan dapat melakukan pause pada project yang tidak aktif. Untuk penggunaan desa yang benar-benar operasional, nanti dapat dinaikkan ke VPS/hosting berbayar tanpa mengganti arsitektur aplikasi.

## 5. Jalur VPS tetap tersedia
Deployment Docker Compose + Caddy + PostgreSQL yang sudah ada tidak dihapus.
Gratis/testing: Render + Supabase.
Produksi penuh: VPS + Docker Compose + Caddy + PostgreSQL.
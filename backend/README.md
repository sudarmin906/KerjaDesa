# KerjaDesa Pro Backend

Backend API sekarang dapat dijalankan langsung dengan Node.js tanpa dependency runtime tambahan.

## Jalankan lokal

```bash
cd backend
npm start
```

Default:
- API: http://localhost:3000
- Health: GET /api/health
- Login: POST /api/auth/login
- Session: GET /api/auth/me
- Dashboard: GET /api/dashboard

## Akun awal

Username: `admin`

Password default: `admin123`

Untuk deployment, ubah password awal dengan environment variable `ADMIN_PASSWORD`.

## Resource API

- `/api/users`
- `/api/desa`
- `/api/kegiatan`
- `/api/monitoring`
- `/api/dokumen`
- `/api/laporan`

CRUD memakai Bearer session token. Data lokal disimpan di `backend/data/store.json` sebagai fallback zero-dependency. Skema PostgreSQL tersedia di `backend/database/schema.sql` untuk migrasi ke database server.

## Environment

Lihat `config/.env.example`.

Untuk frontend beda domain, set `CORS_ORIGIN` ke origin frontend, misalnya `https://contoh.pages.dev`.

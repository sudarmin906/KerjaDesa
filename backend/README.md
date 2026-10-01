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


## Production deployment

The API can run in a Node.js 18+ host or Docker.

Required production environment:
- `NODE_ENV=production`
- `ADMIN_PASSWORD` — set a strong initial admin password
- `CORS_ORIGIN` — set to the exact frontend origin when frontend and API use different domains
- `DATABASE_URL` — optional PostgreSQL connection string; when omitted, the JSON store is used

Docker:

```bash
cd backend
docker build -t kerjadesa-api .
docker run -p 3000:3000 -e ADMIN_PASSWORD='change-this' -e CORS_ORIGIN='https://frontend.example' kerjadesa-api
```

For PostgreSQL production, apply `database/schema.sql` first and set `DATABASE_URL`. Do not use the default `admin123` password in production.


## Production database

When `DATABASE_URL` is set, the API uses PostgreSQL for users, desa, kegiatan, monitoring, dokumen, laporan, and audit_log through `kerjadesa_records`. Without it, local JSON storage remains the development fallback.

1. Create the PostgreSQL database.
2. Set `DATABASE_URL` and a strong `ADMIN_PASSWORD`.
3. Start the API; the production table is created automatically.
4. If an existing JSON `backend/data/store.json` must be retained, run `npm run migrate` once with the PostgreSQL `DATABASE_URL` set.
5. Set `CORS_ORIGIN` to the exact frontend origin.
6. If frontend and API are hosted separately, set `window.KERJADESA_API_BASE` in `js/deployment-config.js` to the API origin ending in `/api`.

The API intentionally does not use the default `admin123` password in production: startup fails when `NODE_ENV=production` and `ADMIN_PASSWORD` is missing.

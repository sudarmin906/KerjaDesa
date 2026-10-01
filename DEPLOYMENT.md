# KerjaDesa Pro Production

1. Copy `.env.production.example` to `.env`.
2. Set strong random values for POSTGRES_PASSWORD and ADMIN_PASSWORD.
3. Set CORS_ORIGIN to the exact frontend origin.
4. Run `docker compose up -d --build`.
5. Check `/api/health` and then test admin login.
6. If old JSON data must be retained, run `docker compose exec api npm run migrate`.
7. PostgreSQL is private to the Docker network; only the API port is published.
8. Use HTTPS/reverse proxy before exposing the API to the public internet.

Do not commit the production `.env` file.

## Public web access

The Compose stack now contains:
- `web`: Nginx serving the PWA/static frontend
- `api`: KerjaDesa API
- `postgres`: PostgreSQL

Nginx proxies `/api/*` to the internal API service, so the browser can use the default same-origin `/api` configuration.

For a real domain, point DNS to the server and put an HTTPS reverse proxy/load balancer in front of the web container, or terminate TLS at the hosting provider. Set `CORS_ORIGIN` to the final HTTPS origin.

Example:
`https://kerjadesa.example.com`

For a hosting provider that already provides HTTPS, keep `WEB_PORT` bound to the provider's expected port or adapt the platform configuration accordingly.


## GitHub Actions automatic deployment

Workflow:
`.github/workflows/production-deploy.yml`

The workflow always validates backend syntax and Docker Compose first.

Automatic deployment is deliberately disabled until the repository owner enables it with:

Repository variable:
`PRODUCTION_DEPLOY_ENABLED=true`

Required production secrets:
- `PRODUCTION_HOST`
- `PRODUCTION_USER`
- `PRODUCTION_SSH_KEY`
- optional `PRODUCTION_SSH_PORT`

Required repository variable:
- `PRODUCTION_APP_DIR` — absolute path of the cloned KerjaDesa directory on the server.

The server must already have Docker, Docker Compose, Git, and the KerjaDesa repository cloned.

Example server preparation:

`git clone https://github.com/sudarmin906/KerjaDesa.git /opt/kerjadesa`

Then create `/opt/kerjadesa/.env` from `.env.production.example` and fill the real production values.

The GitHub Actions job then performs:
1. fetch latest `main`
2. reset working tree to `origin/main`
3. rebuild the containers
4. restart the stack
5. verify container status
6. call the API health endpoint

No production password is committed to Git.

## VPS + automatic HTTPS

For a public domain, use the included Caddy service.

Server bootstrap:
`bash deploy/bootstrap-ubuntu.sh`

Then:
`cp .env.production.example .env`

Set:
- `KERJADESA_DOMAIN=your-domain.example`
- `CORS_ORIGIN=https://your-domain.example`
- strong database/admin passwords

Point the domain's DNS A/AAAA record to the VPS and allow TCP ports 80 and 443.

Start:
`docker compose up -d --build`

Caddy terminates HTTPS and proxies the request to the internal Nginx frontend. Nginx then proxies `/api` to the internal API.

The database remains private and is not published to the host.


## Koyeb deployment architecture

For Koyeb, deploy three components separately:

### PostgreSQL
Create a Koyeb managed PostgreSQL Database Service and use its connection string as `DATABASE_URL` for the API.

### API Service
- GitHub repository: `sudarmin906/KerjaDesa`
- Branch: `main`
- Builder: Dockerfile
- Work directory: `backend`
- Dockerfile: `Dockerfile`
- Port: `3000/http`
- Route: `/:3000`
- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT=3000`
- `ADMIN_PASSWORD=<strong secret>`
- `DATABASE_URL=<Koyeb PostgreSQL connection string>`
- `PG_POOL_MAX=10`
- Health check: `GET /api/health`

### Frontend Service
- GitHub repository: `sudarmin906/KerjaDesa`
- Branch: `main`
- Builder: Dockerfile
- Work directory: repository root
- Dockerfile: `deploy/Dockerfile`
- Port: `80/http`
- Route: `/:80`
- Build variable: `KERJADESA_API_BASE=https://<API-SERVICE-DOMAIN>/api`

The frontend build injects the API base into `js/deployment-config.js`. Koyeb supports GitHub/Dockerfile deployments plus configurable ports, routes, and environment variables.

## Gratis untuk tahap uji online

Untuk uji online tanpa VPS, gunakan Render Free sebagai web service dan Neon Free sebagai PostgreSQL.

Render blueprint:
`render.yaml`

Render web service menjalankan frontend dan API dari satu container, sehingga browser tetap memakai `/api` pada domain yang sama.

Di Render, isi:
- `ADMIN_PASSWORD`
- `DATABASE_URL` dari database Neon

Neon menyediakan Free Postgres dengan scale-to-zero dan batas penyimpanan 0.5 GB per project. Render Free web service memiliki 512 MB RAM/0.1 CPU dan dapat sleep setelah 15 menit tanpa trafik, sehingga waktu bangun pertama bisa sekitar satu menit. Render sendiri menyatakan Free cocok untuk testing/hobby dan bukan production yang membutuhkan availability tinggi.

Setelah deploy, Render memberikan URL `onrender.com` dengan HTTPS. Tidak perlu membeli domain untuk tahap uji.

Untuk data penting jangka panjang, jangan menganggap tier gratis sebagai backup production.

## Jalur gratis: GitHub Pages + Render + PostgreSQL

Untuk mulai online tanpa VPS/domain:

### A. PostgreSQL gratis
Buat database PostgreSQL pada provider managed PostgreSQL yang menyediakan free tier, misalnya Neon.
Ambil connection string `postgresql://...`.

### B. API gratis di Render
Repository sudah menyediakan `render.yaml`.

Di Render:
1. New Blueprint / Web Service dari repository ini.
2. Pilih `render.yaml`.
3. Isi `ADMIN_PASSWORD`.
4. Isi `DATABASE_URL` dengan connection string PostgreSQL.
5. Setelah API aktif, catat URL HTTPS API, misalnya `https://kerjadesa-api.onrender.com`.
6. Set `CORS_ORIGIN` sementara ke URL GitHub Pages.

Render free service dapat sleep saat tidak digunakan; request berikutnya dapat memerlukan waktu startup.

### C. Frontend gratis di GitHub Pages
Aktifkan GitHub Pages untuk repository dan pilih GitHub Actions sebagai source.

Tambahkan Repository Variable:
`KERJADESA_API_BASE=https://URL-API-ANDA/api`

Workflow `.github/workflows/pages.yml` akan memasukkan URL tersebut saat build dan menerbitkan frontend.

Setelah GitHub Pages aktif, salin URL Pages ke `CORS_ORIGIN` pada API Render lalu redeploy.

### Catatan data
Gunakan PostgreSQL managed sebagai penyimpanan utama. Jangan mengandalkan filesystem Render untuk data production karena service free dapat dihentikan/dibuat ulang.

Jalur gratis ini cocok untuk uji online awal. VPS + domain + Caddy tetap menjadi jalur production penuh.

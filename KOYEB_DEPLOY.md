# KerjaDesa Pro — Koyeb Deployment

KerjaDesa Pro dapat dijalankan sebagai **satu Koyeb Web Service** menggunakan Dockerfile di root repository.

## Koyeb Service settings

Use:
- Deployment: GitHub
- Repository: `sudarmin906/KerjaDesa`
- Branch: `main`
- Builder: Dockerfile
- Dockerfile location: `Dockerfile`
- Exposed port: `3000/http`
- Route: `/:3000`
- Service type: Web

The root Dockerfile runs `backend/server.js`. That server serves both the KerjaDesa frontend and `/api/*`, so a separate frontend container is not required on Koyeb.

## Required environment variables

Set these in the Koyeb Service environment:

`NODE_ENV=production`

`PORT=3000`

`HOST=0.0.0.0`

`ADMIN_PASSWORD=<strong-random-password>`

For PostgreSQL production also set:

`DATABASE_URL=<postgresql-connection-string>`

Optionally:

`PG_POOL_MAX=10`

If the frontend and API use the same Koyeb public URL, CORS does not need a cross-origin value. If another frontend origin is used, set `CORS_ORIGIN` to that exact HTTPS origin.

## Health check

Use:
- Protocol: HTTP
- Port: 3000
- Path: `/api/health`

## Important

Do **not** select `deploy/Dockerfile` for the Koyeb API service. That Dockerfile is the static Nginx frontend image intended for the VPS Compose architecture.

Do **not** deploy `docker-compose.yml` directly to Koyeb. The Koyeb deployment should be the root Dockerfile Web Service.

## After deployment

Koyeb provides a public `.koyeb.app` domain for the Web Service. Open that Service URL, not `app.koyeb.com`.

GitHub-driven Koyeb deployments can automatically redeploy when changes are pushed to the tracked branch.

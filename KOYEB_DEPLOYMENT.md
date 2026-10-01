# Koyeb deployment — KerjaDesa Pro

Use Koyeb with one Web Service from the repository root Dockerfile and one Koyeb PostgreSQL Database Service.

## 1. Koyeb Database
Create a PostgreSQL Database Service first and copy its connection string.

## 2. Koyeb Web Service
Choose Web and mobile applications in the project category screen.

Create Web Service → GitHub → select:
sudarmin906/KerjaDesa

Branch: main
Builder: Dockerfile
Dockerfile: ./Dockerfile
Exposed port: 3000/http
Health check: /api/health

## 3. Environment variables
Set:
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
ADMIN_PASSWORD=<strong-random-password>
DATABASE_URL=<Koyeb PostgreSQL connection string>
PG_POOL_MAX=5
CORS_ORIGIN=

Keep CORS_ORIGIN empty because the root Docker image serves the frontend and API from the same origin.

## 4. Deploy
After deployment, check:
https://<your-koyeb-domain>/api/health

Then test login, dashboard, activity creation, monitoring, logout/login, offline queue, and synchronization.

## 5. Automatic updates
Enable Koyeb GitHub automatic deployment for the main branch.

## 6. Existing JSON data
If backend/data/store.json contains production data, migrate it before relying on the new PostgreSQL database. Verify imported record counts before switching users.

The VPS Nginx/Caddy/Compose files remain available for self-managed VPS deployment, but they are not required for the Koyeb path.

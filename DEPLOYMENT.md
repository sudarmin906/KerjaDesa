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

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


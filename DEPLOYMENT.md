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

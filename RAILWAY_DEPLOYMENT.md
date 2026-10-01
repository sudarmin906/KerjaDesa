# KerjaDesa Pro — Railway Deployment

Koyeb is no longer required for the primary deployment path.

## Architecture

Railway Project:
- Service: KerjaDesa Pro (Dockerfile.railway)
- Database: PostgreSQL
- One public application URL serves both frontend and `/api`

The existing Node server already serves the PWA/static frontend and API from the same process. Railway only needs to provide the public port and `DATABASE_URL`.

## Create the project

1. Create a new Railway project.
2. Add a PostgreSQL service.
3. Add the GitHub repository `sudarmin906/KerjaDesa` as a service.
4. Railway will use `railway.json` and `Dockerfile.railway`.
5. Connect the PostgreSQL service to the application service.
6. Set these application variables:
   - `NODE_ENV=production`
   - `ADMIN_PASSWORD=<strong random password>`
   - `DATABASE_URL=<Railway PostgreSQL DATABASE_URL>`
   - `PG_POOL_MAX=10`
   - `CORS_ORIGIN=<the final public https URL>`
7. Deploy.
8. Health check: `/api/health`.
9. Open the generated Railway domain and test admin login.

Railway PostgreSQL exposes `DATABASE_URL` to connected services. The database is private by default, which is appropriate for KerjaDesa.

## Important

Do not put `ADMIN_PASSWORD` or a database password into GitHub files.

The frontend does not need a separate API URL because it uses same-origin `/api`.

## Existing data

If the old JSON data must be migrated, use the existing migration command after the PostgreSQL service is connected:

`npm run migrate`

For a safer production migration, first make a backup of the existing JSON data and verify the record counts after migration.

## Why this path

This deployment avoids the previous Koyeb connection problem by using a single application service with the existing Node server, while PostgreSQL is supplied as a separate managed Railway service.

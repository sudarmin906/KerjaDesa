/*
 * PostgreSQL adapter.
 * Supports a full DATABASE_URL as well as Blitz Cloud's separate
 * DB_HOST / DB_PORT / NAMA_DB / PENGGUNA_DB / KATA SANDI DB variables.
 */
let Pool = null;
let pool = null;

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRESQL_URL || '';
}

function discreteConfig() {
  const host = process.env.DB_HOST || '';
  const database = process.env.DB_NAME || process.env.NAMA_DB || '';
  const user = process.env.DB_USER || process.env.PENGGUNA_DB || '';
  const password = process.env.DB_PASSWORD || process.env.KATA_SANDI_DB || '';
  const port = process.env.DB_PORT || '';
  if (!host || !database || !user || !password) return null;
  return {
    host,
    database,
    user,
    password,
    ...(port ? { port: Number(port) } : {})
  };
}

function enabled() {
  return Boolean(connectionString() || discreteConfig())
    && String(process.env.KERJADESA_DB_DISABLED || '') !== '1';
}

function getPool() {
  if (!enabled()) return null;
  if (!Pool) {
    try {
      Pool = require('pg').Pool;
    } catch {
      throw new Error('PostgreSQL adapter membutuhkan dependency pg.');
    }
  }

  if (!pool) {
    const config = discreteConfig();
    pool = new Pool({
      ...(connectionString() ? { connectionString: connectionString() } : config),
      max: Number(process.env.PG_POOL_MAX || 5),
      connectionTimeoutMillis: Math.max(1000, Number(process.env.PG_CONNECTION_TIMEOUT_MS || 3000)),
      idleTimeoutMillis: Math.max(1000, Number(process.env.PG_IDLE_TIMEOUT_MS || 10000)),
      // Blitz Cloud managed PostgreSQL uses the private network without TLS.
      // Set DB_SSL=true only when the database endpoint explicitly requires TLS.
      ssl: (() => {
        const configured = String(process.env.DB_SSL || '').trim().toLowerCase();
        const useSsl = configured
          ? /^(1|true|yes)$/i.test(configured)
          : String(process.env.NODE_ENV || '').toLowerCase() === 'production';
        return useSsl
          ? { rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true') !== 'false' }
          : undefined;
      })()
    });
  }
  return pool;
}

async function query(text, params = []) {
  const p = getPool();
  if (!p) throw new Error('PostgreSQL belum diaktifkan. Set DATABASE_URL atau DB_HOST/DB_NAME/DB_USER/DB_PASSWORD.');
  return p.query(text, params);
}

async function health() {
  if (!enabled()) return { enabled: false, status: 'disabled' };
  try {
    const result = await query('SELECT NOW() AS now');
    return { enabled: true, status: 'healthy', now: result.rows[0].now };
  } catch (error) {
    return { enabled: true, status: 'unavailable' };
  }
}

module.exports = { enabled, getPool, query, health };

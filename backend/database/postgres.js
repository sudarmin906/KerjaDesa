/*
 * Optional PostgreSQL adapter.
 * Enable with DATABASE_URL. JSON store remains the default fallback.
 */
let Pool = null;
let pool = null;

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRESQL_URL || '';
}

function enabled() {
  return Boolean(connectionString()) && String(process.env.KERJADESA_DB_DISABLED || '') !== '1';
}

function getPool() {
  if (!enabled()) return null;
  if (!Pool) {
    try {
      Pool = require('pg').Pool;
    } catch {
      throw new Error('PostgreSQL adapter membutuhkan dependency pg saat DATABASE_URL digunakan.');
    }
  }
  if (!pool) {
    pool = new Pool({
      connectionString: connectionString(),
      max: Number(process.env.PG_POOL_MAX || 5),
      connectionTimeoutMillis: Math.max(1000, Number(process.env.PG_CONNECTION_TIMEOUT_MS || 3000)),
      idleTimeoutMillis: Math.max(1000, Number(process.env.PG_IDLE_TIMEOUT_MS || 10000)),
      // Blitz managed PostgreSQL may be served without TLS. Only enable
      // PostgreSQL SSL when it is explicitly requested by the environment.
      ssl: /^(1|true|yes)$/i.test(String(process.env.DB_SSL || ''))
        ? { rejectUnauthorized: false }
        : undefined
    });
  }
  return pool;
}

async function query(text, params = []) {
  const p = getPool();
  if (!p) throw new Error('PostgreSQL belum diaktifkan. Set DATABASE_URL.');
  return p.query(text, params);
}

async function health() {
  if (!enabled()) return { enabled: false, status: 'disabled' };
  try {
    const result = await query('SELECT NOW() AS now');
    return { enabled: true, status: 'healthy', now: result.rows[0].now };
  } catch (error) {
    // The API health endpoint must stay reachable while PostgreSQL is starting
    // or temporarily unavailable; ensureDatabase() handles the actual fallback.
    return { enabled: true, status: 'unavailable' };
  }
}

module.exports = { enabled, getPool, query, health };

/*
 * Optional PostgreSQL adapter.
 * Enable with DATABASE_URL. JSON store remains the default fallback.
 */
const { Pool } = require('pg');

let pool = null;

function enabled() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!enabled()) return null;
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.PG_POOL_MAX || 10) });
  return pool;
}

async function query(text, params = []) {
  const p = getPool();
  if (!p) throw new Error('PostgreSQL belum diaktifkan. Set DATABASE_URL.');
  return p.query(text, params);
}

async function health() {
  if (!enabled()) return { enabled: false };
  const result = await query('SELECT NOW() AS now');
  return { enabled: true, now: result.rows[0].now };
}

module.exports = { enabled, getPool, query, health };

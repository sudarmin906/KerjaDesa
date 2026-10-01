const { query } = require('./postgres');

const RESOURCE_NAMES = new Set(['users','desa','kegiatan','monitoring','dokumen','laporan','audit_log']);

function assertResource(resource) {
  if (!RESOURCE_NAMES.has(resource)) throw new Error('Resource tidak tersedia.');
}

function hydrate(row) {
  return {
    ...(row.data || {}),
    id: row.id,
    created_at: row.created_at?.toISOString ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at?.toISOString ? row.updated_at.toISOString() : row.updated_at,
    version: Number(row.version || 1)
  };
}

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS kerjadesa_records (
      id BIGSERIAL PRIMARY KEY,
      resource VARCHAR(40) NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_kerjadesa_records_resource ON kerjadesa_records(resource);
    CREATE INDEX IF NOT EXISTS idx_kerjadesa_records_resource_username ON kerjadesa_records(resource, ((data->>'username')));
  `);
}

async function list(resource) {
  assertResource(resource);
  const r = await query('SELECT * FROM kerjadesa_records WHERE resource=$1 ORDER BY id ASC', [resource]);
  return r.rows.map(hydrate);
}

async function get(resource, id) {
  assertResource(resource);
  const r = await query('SELECT * FROM kerjadesa_records WHERE resource=$1 AND id=$2', [resource, id]);
  return r.rows[0] ? hydrate(r.rows[0]) : null;
}

async function findByField(resource, field, value) {
  assertResource(resource);
  const r = await query('SELECT * FROM kerjadesa_records WHERE resource=$1 AND data->>$2=$3 LIMIT 1', [resource, field, String(value)]);
  return r.rows[0] ? hydrate(r.rows[0]) : null;
}

async function create(resource, payload) {
  assertResource(resource);
  const now = new Date().toISOString();
  const clean = { ...payload };
  delete clean.id;
  delete clean.version;
  const r = await query(
    'INSERT INTO kerjadesa_records(resource,data,version,created_at,updated_at) VALUES($1,$2::jsonb,1,$3,$3) RETURNING *',
    [resource, JSON.stringify(clean), now]
  );
  return hydrate(r.rows[0]);
}

async function update(resource, id, patch) {
  assertResource(resource);
  const current = await get(resource, id);
  if (!current) return null;
  const clean = { ...patch };
  delete clean.id; delete clean.version; delete clean.created_at; delete clean.updated_at;
  const merged = { ...current, ...clean };
  delete merged.id; delete merged.version; delete merged.created_at; delete merged.updated_at;
  const r = await query(
    'UPDATE kerjadesa_records SET data=$1::jsonb, version=version+1, updated_at=NOW() WHERE resource=$2 AND id=$3 RETURNING *',
    [JSON.stringify(merged), resource, id]
  );
  return r.rows[0] ? hydrate(r.rows[0]) : null;
}

async function remove(resource, id) {
  assertResource(resource);
  const r = await query('DELETE FROM kerjadesa_records WHERE resource=$1 AND id=$2', [resource, id]);
  return r.rowCount > 0;
}

async function count(resource) {
  assertResource(resource);
  const r = await query('SELECT COUNT(*)::int AS count FROM kerjadesa_records WHERE resource=$1', [resource]);
  return Number(r.rows[0].count);
}

module.exports = { ensureSchema, list, get, findByField, create, update, remove, count };

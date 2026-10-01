const fs = require('fs');
const { ensureDatabase } = require('./database/store');
const { query } = require('./database/postgres');
const { readStore } = require('./database/jsonStore');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL wajib diisi.');
  await ensureDatabase();
  const store = readStore();
  const resources = ['users','desa','kegiatan','monitoring','dokumen','laporan','audit_log'];
  const result = {};
  for (const resource of resources) {
    result[resource] = 0;
    for (const item of (store[resource] || [])) {
      const exists = await query('SELECT id FROM kerjadesa_records WHERE resource=$1 AND id=$2', [resource, Number(item.id)]);
      if (exists.rowCount) continue;
      const clean = { ...item };
      delete clean.id; delete clean.version; delete clean.created_at; delete clean.updated_at;
      const numericId = Number.isInteger(Number(item.id)) ? Number(item.id) : null;
      if (numericId) {
        await query(
          'INSERT INTO kerjadesa_records(id,resource,data,version,created_at,updated_at) VALUES($1,$2,$3::jsonb,$4,$5,$6)',
          [numericId, resource, JSON.stringify(clean), Number(item.version || 1), item.created_at || new Date().toISOString(), item.updated_at || new Date().toISOString()]
        );
      } else {
        await query(
          'INSERT INTO kerjadesa_records(resource,data,version,created_at,updated_at) VALUES($1,$2::jsonb,$3,$4,$5)',
          [resource, JSON.stringify(clean), Number(item.version || 1), item.created_at || new Date().toISOString(), item.updated_at || new Date().toISOString()]
        );
      }
      result[resource]++;
    }
  }
  await query(`SELECT setval(pg_get_serial_sequence('kerjadesa_records','id'), COALESCE((SELECT MAX(id) FROM kerjadesa_records),1), true)`);
  console.log(JSON.stringify({ success: true, imported: result }, null, 2));
}
main().catch(error => { console.error(error); process.exit(1); });

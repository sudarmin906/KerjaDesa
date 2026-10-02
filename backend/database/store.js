const json = require('./jsonStore');
const pg = require('./postgresStore');
const { enabled } = require('./postgres');

function usingPostgres() { return enabled(); }
function ensureStore() { if (!usingPostgres()) json.ensureStore(); }
async function list(resource) { return usingPostgres() ? pg.list(resource) : json.list(resource); }
async function get(resource,id) { return usingPostgres() ? pg.get(resource,id) : json.get(resource,id); }
async function findByField(resource,field,value) { return usingPostgres() ? pg.findByField(resource,field,value) : json.list(resource).find(item => String(item[field]) === String(value)) || null; }
async function create(resource,payload) { return usingPostgres() ? pg.create(resource,payload) : json.create(resource,payload); }
async function update(resource,id,patch) { return usingPostgres() ? pg.update(resource,id,patch) : json.update(resource,id,patch); }
async function remove(resource,id) { return usingPostgres() ? pg.remove(resource,id) : json.remove(resource,id); }
async function count(resource) { return usingPostgres() ? pg.count(resource) : json.list(resource).length; }

async function ensureDatabase() {
  ensureStore();
  if (!usingPostgres()) return;

  // Managed databases can become reachable a few seconds after the app starts.
  // Retry schema initialization instead of terminating the whole service on the
  // first ECONNREFUSED / transient connection error.
  const attempts = Math.max(1, Number(process.env.DB_STARTUP_RETRIES || 5));
  const delayMs = Math.max(250, Number(process.env.DB_STARTUP_RETRY_MS || 1000));
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await pg.ensureSchema();
      return;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      console.warn(`PostgreSQL belum siap (percobaan ${attempt}/${attempts}). Menunggu ${delayMs}ms sebelum mencoba lagi.`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Never silently fall back to a local JSON database in production.
  // That can expose stale/local data and bypass the intended database security model.
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    throw new Error('PostgreSQL tidak tersedia pada mode production: ' + (lastError?.message || 'koneksi gagal'));
  }
  process.env.KERJADESA_DB_DISABLED = '1';
  console.warn('PostgreSQL tidak tersedia; menggunakan JSON store hanya untuk development:', lastError?.message || lastError);
  return;
}

module.exports = { usingPostgres, ensureStore, ensureDatabase, list, get, findByField, create, update, remove, count };

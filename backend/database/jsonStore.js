const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

const DEFAULT_STORE = {
  users: [],
  desa: [],
  kegiatan: [],
  monitoring: [],
  dokumen: [],
  laporan: [],
  sppd: [],
  audit_log: []
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_STORE, null, 2), 'utf8');
  }
}

function readStore() {
  ensureStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return { ...clone(DEFAULT_STORE), ...parsed };
  } catch (error) {
    throw new Error('Data store tidak dapat dibaca: ' + error.message);
  }
}

function writeStore(store) {
  ensureStore();
  const temp = DATA_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(temp, DATA_FILE);
  return store;
}

function list(resource) {
  return readStore()[resource] || [];
}

function get(resource, id) {
  return list(resource).find(item => String(item.id) === String(id)) || null;
}

function create(resource, payload) {
  const store = readStore();
  const items = store[resource] || [];
  const item = {
    id: payload.id || cryptoRandomId(),
    created_at: payload.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: Number(payload.version || 1),
    ...payload
  };
  items.push(item);
  store[resource] = items;
  writeStore(store);
  return item;
}

function update(resource, id, patch) {
  const store = readStore();
  const items = store[resource] || [];
  const index = items.findIndex(item => String(item.id) === String(id));
  if (index < 0) return null;
  items[index] = { ...items[index], ...patch, id: items[index].id, updated_at: new Date().toISOString(), version: Number(items[index].version || 1) + 1 };
  store[resource] = items;
  writeStore(store);
  return items[index];
}

function remove(resource, id) {
  const store = readStore();
  const items = store[resource] || [];
  const next = items.filter(item => String(item.id) !== String(id));
  if (next.length === items.length) return false;
  store[resource] = next;
  writeStore(store);
  return true;
}

function cryptoRandomId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

module.exports = {
  DATA_FILE,
  ensureStore,
  readStore,
  writeStore,
  list,
  get,
  create,
  update,
  remove
};

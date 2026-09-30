const crypto = require('crypto');
const {
  readStore,
  writeStore,
  list,
  get,
  create,
  update,
  remove
} = require('../database/jsonStore');
const { writeAudit, listAudit } = require('../middleware/audit');
const {
  issueSession,
  revokeSession,
  publicUser,
  sendJson
} = require('../middleware/auth');

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map();

function loginAllowed(key) {
  const now = Date.now();
  const item = loginAttempts.get(key);
  if (!item || now - item.startedAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { startedAt: now, count: 0 });
    return true;
  }
  return item.count < LOGIN_MAX_ATTEMPTS;
}

function recordLoginFailure(key) {
  const now = Date.now();
  const item = loginAttempts.get(key) || { startedAt: now, count: 0 };
  if (now - item.startedAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { startedAt: now, count: 1 });
  } else {
    item.count += 1;
    loginAttempts.set(key, item);
  }
}

const RESOURCE_RULES = {
  desa: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR'], write: ['ADMIN', 'PEMDES'] },
  kegiatan: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR'], write: ['ADMIN', 'PLD', 'OPERATOR'] },
  monitoring: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR'], write: ['ADMIN', 'PLD', 'OPERATOR'] },
  dokumen: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR'], write: ['ADMIN', 'PLD', 'OPERATOR'] },
  laporan: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR'], write: ['ADMIN', 'PLD'] },
  users: { read: ['ADMIN'], write: ['ADMIN'] },
  audit_log: { read: ['ADMIN'], write: [] }
};

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('Payload terlalu besar.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('JSON request tidak valid.'));
      }
    });
    req.on('error', reject);
  });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, expected] = stored.split(':');
  const actual = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

function seedAdmin() {
  const store = readStore();
  if (!store.users.length) {
    store.users.push({
      id: 1,
      nama_lengkap: 'Administrator KerjaDesa',
      username: 'admin',
      password_hash: hashPassword(process.env.ADMIN_PASSWORD || 'admin123'),
      role: 'ADMIN',
      desa: '',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    writeStore(store);
  }
}

function normalizeResourcePayload(resource, body, user) {
  const payload = { ...body };
  delete payload.password;
  delete payload.password_hash;
  if (resource !== 'users') {
    payload.created_by = payload.created_by || user.id;
  }
  return payload;
}

async function login(req, res) {
  try {
    const body = await parseJsonBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const key = username.toLowerCase() || 'anonymous';
    if (!loginAllowed(key)) return sendJson(res, 429, { success: false, message: 'Terlalu banyak percobaan login. Coba lagi beberapa menit.' });
    const user = list('users').find(item => item.username === username && item.status !== 'INACTIVE');

    if (!user || !verifyPassword(password, user.password_hash)) {
      recordLoginFailure(key);
      return sendJson(res, 401, { success: false, message: 'Username atau password tidak sesuai.' });
    }

    loginAttempts.delete(key);
    writeAudit({ user, action: 'LOGIN', resource: 'auth' });
    const token = issueSession(user);
    return sendJson(res, 200, {
      success: true,
      token,
      expires_in: 8 * 60 * 60,
      user: publicUser(user)
    });
  } catch (error) {
    return sendJson(res, 400, { success: false, message: error.message });
  }
}

function logout(req, res) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  revokeSession(token);
  return sendJson(res, 200, { success: true, message: 'Logout berhasil.' });
}

function dashboard(req, res) {
  const store = readStore();
  const kegiatanSelesai = store.kegiatan.filter(x => String(x.status || '').toUpperCase() === 'SELESAI').length;
  const monitoringProgres = store.monitoring.length ? Math.round(store.monitoring.reduce((a,x) => a + Number(x.progres || 0), 0) / store.monitoring.length) : 0;
  return sendJson(res, 200, {
    success: true,
    data: {
      desa: store.desa.length,
      kegiatan: store.kegiatan.length,
      monitoring: store.monitoring.length,
      dokumen: store.dokumen.length,
      laporan: store.laporan.length,
      users: store.users.length,
      kegiatan_selesai: kegiatanSelesai,
      rata_rata_progres: monitoringProgres,
      audit_log: (store.audit_log || []).length
    }
  });
}

async function resourceHandler(req, res, resource, id, method, auth) {
  const rules = RESOURCE_RULES[resource];
  if (!rules) return sendJson(res, 404, { success: false, message: 'Resource tidak tersedia.' });

  const roles = method === 'GET' ? rules.read : rules.write;
  if (!roles.includes(auth.user.role)) {
    return sendJson(res, 403, { success: false, message: 'Role tidak memiliki hak akses.' });
  }

  if (method === 'GET') {
    if (id) {
      const item = get(resource, id);
      return item
        ? sendJson(res, 200, { success: true, data: item })
        : sendJson(res, 404, { success: false, message: 'Data tidak ditemukan.' });
    }
    return sendJson(res, 200, { success: true, data: resource === 'audit_log' ? listAudit(200) : list(resource) });
  }

  if (method === 'POST') {
    const body = await parseJsonBody(req);
    if (resource === 'users') {
      const username = String(body.username || '').trim();
      if (!username || !body.password) {
        return sendJson(res, 422, { success: false, message: 'Username dan password wajib diisi.' });
      }
      if (list('users').some(item => item.username === username)) {
        return sendJson(res, 409, { success: false, message: 'Username sudah digunakan.' });
      }
      const item = create('users', {
        nama_lengkap: String(body.nama_lengkap || ''),
        username,
        password_hash: hashPassword(body.password),
        role: body.role || 'OPERATOR',
        desa: body.desa || '',
        status: body.status || 'ACTIVE'
      });
      writeAudit({ user: auth.user, action: 'CREATE', resource: 'users', recordId: item.id });
      return sendJson(res, 201, { success: true, data: publicUser(item) });
    }

    const item = create(resource, normalizeResourcePayload(resource, body, auth.user));
    writeAudit({ user: auth.user, action: 'CREATE', resource, recordId: item.id });
    return sendJson(res, 201, { success: true, data: resource === 'users' ? publicUser(item) : item });
  }

  if (method === 'PATCH' && id) {
    const body = await parseJsonBody(req);
    if (resource === 'users' && body.password) {
      body.password_hash = hashPassword(body.password);
      delete body.password;
    }
    delete body.id;
    const current = get(resource, id);
    if (!current) return sendJson(res, 404, { success: false, message: 'Data tidak ditemukan.' });
    if (body.base_version !== undefined && Number(body.base_version) !== Number(current.version || 1)) {
      return sendJson(res, 409, {
        success: false,
        message: 'Konflik data: versi server sudah berubah.',
        code: 'SYNC_CONFLICT',
        server_id: current.id,
        server_version: Number(current.version || 1),
        server_data: resource === 'users' ? publicUser(current) : current
      });
    }
    delete body.base_version;
    const item = update(resource, id, body);
    if (item) writeAudit({ user: auth.user, action: 'UPDATE', resource, recordId: item.id });
    return item
      ? sendJson(res, 200, { success: true, data: resource === 'users' ? publicUser(item) : item })
      : sendJson(res, 404, { success: false, message: 'Data tidak ditemukan.' });
  }

  if (method === 'DELETE' && id) {
    const ok = remove(resource, id);
    if (ok) writeAudit({ user: auth.user, action: 'DELETE', resource, recordId: id });
    return sendJson(res, ok ? 200 : 404, {
      success: ok,
      message: ok ? 'Data dihapus.' : 'Data tidak ditemukan.'
    });
  }

  return sendJson(res, 405, { success: false, message: 'Method tidak didukung.' });
}

seedAdmin();

module.exports = {
  login,
  logout,
  dashboard,
  resourceHandler,
  seedAdmin
};

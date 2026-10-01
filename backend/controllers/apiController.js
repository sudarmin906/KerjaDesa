const crypto = require('crypto');
const { usingPostgres, list, get, findByField, create, update, remove, count } = require('../database/store');
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

async function seedAdmin() {
  if (!(await count('users'))) {
    await create('users', {
      nama_lengkap: 'Administrator KerjaDesa',
      username: 'admin',
      password_hash: hashPassword(process.env.ADMIN_PASSWORD || 'admin123'),
      role: 'ADMIN',
      desa: '',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
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
    const user = await findByField('users', 'username', username);

    if (!user || !verifyPassword(password, user.password_hash)) {
      recordLoginFailure(key);
      return sendJson(res, 401, { success: false, message: 'Username atau password tidak sesuai.' });
    }

    loginAttempts.delete(key);
    await writeAudit({ user, action: 'LOGIN', resource: 'auth' });
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

async async function logout(req, res) {
  const auth = await require('../middleware/auth').authenticate(req);
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (auth) await writeAudit({ user: auth.user, action: 'LOGOUT', resource: 'auth' });
  revokeSession(token);
  return sendJson(res, 200, { success: true, message: 'Logout berhasil.' });
}

async function dashboard(req, res) {
  const [desaCount,kegiatanCount,monitoringCount,dokumenCount,laporanCount,usersCount,auditRows,kegiatanRows,monitoringRows] = await Promise.all([
    count('desa'), count('kegiatan'), count('monitoring'), count('dokumen'), count('laporan'), count('users'), list('audit_log'), list('kegiatan'), list('monitoring')
  ]);
  const kegiatanSelesai = kegiatanRows.filter(x => String(x.status || '').toUpperCase() === 'SELESAI').length;
  const monitoringProgres = monitoringRows.length ? Math.round(monitoringRows.reduce((a,x) => a + Number(x.progres || 0), 0) / monitoringRows.length) : 0;
  return sendJson(res, 200, {
    success: true,
    data: {
      desa: desaCount,
      kegiatan: kegiatanCount,
      monitoring: monitoringCount,
      dokumen: dokumenCount,
      laporan: laporanCount,
      users: usersCount,
      kegiatan_selesai: kegiatanSelesai,
      rata_rata_progres: monitoringProgres,
      audit_log: auditRows.length
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
      const item = await get(resource, id);
      return item
        ? sendJson(res, 200, { success: true, data: item })
        : sendJson(res, 404, { success: false, message: 'Data tidak ditemukan.' });
    }
    return sendJson(res, 200, { success: true, data: resource === 'audit_log' ? await listAudit(200) : await list(resource) });
  }

  if (method === 'POST') {
    const body = await parseJsonBody(req);
    if (resource === 'users') {
      const username = String(body.username || '').trim();
      if (!username || !body.password) {
        return sendJson(res, 422, { success: false, message: 'Username dan password wajib diisi.' });
      }
      if (await findByField('users', 'username', username)) {
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
      await writeAudit({ user: auth.user, action: 'CREATE', resource: 'users', recordId: item.id });
      return sendJson(res, 201, { success: true, data: publicUser(item) });
    }

    const item = create(resource, normalizeResourcePayload(resource, body, auth.user));
    await writeAudit({ user: auth.user, action: 'CREATE', resource, recordId: item.id });
    return sendJson(res, 201, { success: true, data: resource === 'users' ? publicUser(item) : item });
  }

  if (method === 'PATCH' && id) {
    const body = await parseJsonBody(req);
    if (resource === 'users' && body.password) {
      body.password_hash = hashPassword(body.password);
      delete body.password;
    }
    delete body.id;
    const current = await get(resource, id);
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
    const item = await update(resource, id, body);
    if (item) await writeAudit({ user: auth.user, action: 'UPDATE', resource, recordId: item.id });
    return item
      ? sendJson(res, 200, { success: true, data: resource === 'users' ? publicUser(item) : item })
      : sendJson(res, 404, { success: false, message: 'Data tidak ditemukan.' });
  }

  if (method === 'DELETE' && id) {
    const ok = await remove(resource, id);
    if (ok) await writeAudit({ user: auth.user, action: 'DELETE', resource, recordId: id });
    return sendJson(res, ok ? 200 : 404, {
      success: ok,
      message: ok ? 'Data dihapus.' : 'Data tidak ditemukan.'
    });
  }

  return sendJson(res, 405, { success: false, message: 'Method tidak didukung.' });
}

module.exports = {
  login,
  logout,
  dashboard,
  resourceHandler,
  seedAdmin
};

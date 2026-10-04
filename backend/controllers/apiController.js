const crypto = require('crypto');
const { list, get, findByField, create, update, remove, count } = require('../database/store');
const { writeAudit, listAudit } = require('../middleware/audit');
const {
  issueSession,
  revokeSession,
  publicUser,
  sendJson,
  setAuthResponseCookies,
  clearAuthResponseCookies
} = require('../middleware/auth');
const pdfParse = require('pdf-parse');

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_MAX_KEYS = 10000;
const loginAttempts = new Map();

const BOOTSTRAP_WINDOW_MS = 15 * 60 * 1000;
const BOOTSTRAP_MAX_ATTEMPTS = 5;
const BOOTSTRAP_MAX_KEYS = 5000;
const bootstrapAttempts = new Map();
let bootstrapInProgress = false;

function bootstrapAllowed(key) {
  const now = Date.now();
  const item = bootstrapAttempts.get(key);
  if (!item || now - item.startedAt > BOOTSTRAP_WINDOW_MS) {
    bootstrapAttempts.set(key, { startedAt: now, count: 0 });
    return true;
  }
  return item.count < BOOTSTRAP_MAX_ATTEMPTS;
}

function recordBootstrapFailure(key) {
  const now = Date.now();
  if (bootstrapAttempts.size >= BOOTSTRAP_MAX_KEYS && !bootstrapAttempts.has(key)) {
    const oldest = bootstrapAttempts.keys().next().value;
    if (oldest) bootstrapAttempts.delete(oldest);
  }
  const item = bootstrapAttempts.get(key) || { startedAt: now, count: 0 };
  if (now - item.startedAt > BOOTSTRAP_WINDOW_MS) {
    bootstrapAttempts.set(key, { startedAt: now, count: 1 });
  } else {
    item.count += 1;
    bootstrapAttempts.set(key, item);
  }
}

function secretMatches(provided, expected) {
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function productionRequestIsSecure(req) {
  if (String(process.env.NODE_ENV || '').toLowerCase() !== 'production') return true;
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return req.socket?.encrypted === true || forwarded === 'https';
}

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
  if (loginAttempts.size >= LOGIN_MAX_KEYS && !loginAttempts.has(key)) {
    const oldest = loginAttempts.keys().next().value;
    if (oldest) loginAttempts.delete(oldest);
  }
  const item = loginAttempts.get(key) || { startedAt: now, count: 0 };
  if (now - item.startedAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { startedAt: now, count: 1 });
  } else {
    item.count += 1;
    loginAttempts.set(key, item);
  }
}

const VILLAGE_SCOPED_RESOURCES = new Set([
  'desa','wilayah','kegiatan','monitoring','dokumen','laporan','sppd','rkpdes',
  'apbdes','rab','realisasi','lpj','penduduk','kpm','blt','stunting','bumdes',
  'koperasi','agenda','notifications','ai_knowledge','gps_points','drp'
]);

function userVillages(user) {
  return String(user?.desa || '').split(/[,;|]/).map(x => x.trim().toLowerCase()).filter(Boolean);
}
function itemVillage(item) {
  return String(item?.desa || item?.nama_desa || item?.desa_id || '').trim().toLowerCase();
}
function canAccessVillage(resource, item, user) {
  if (user?.role === 'ADMIN' || !VILLAGE_SCOPED_RESOURCES.has(resource)) return true;
  const allowed = userVillages(user);
  // Deny by default: a non-admin without an explicit village scope must not
  // receive or modify village-scoped records.
  if (!allowed.length) return false;
  const village = itemVillage(item);
  return !!village && allowed.includes(village);
}
function scopeRows(resource, rows, user) {
  if (user?.role === 'ADMIN' || !VILLAGE_SCOPED_RESOURCES.has(resource)) return rows;
  return rows.filter(item => canAccessVillage(resource, item, user));
}

const RESOURCE_RULES = {
  desa: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR'], write: ['ADMIN', 'PEMDES'] },
  kegiatan: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR'], write: ['ADMIN', 'PLD', 'OPERATOR'] },
  monitoring: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR'], write: ['ADMIN', 'PLD', 'OPERATOR'] },
  dokumen: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR'], write: ['ADMIN', 'PLD', 'OPERATOR'] },
  laporan: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR'], write: ['ADMIN', 'PLD'] },
  sppd: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR'], write: ['ADMIN', 'PLD', 'OPERATOR'] },
  wilayah: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'], write: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'] },
  apbdes: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'], write: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'] },
  rkpdes: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'], write: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'] },
  rab: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'], write: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'] },
  realisasi: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'], write: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'] },
  lpj: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'], write: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'] },
  penduduk: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'], write: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'] },
  kpm: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'], write: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'] },
  blt: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'], write: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'] },
  stunting: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'], write: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'] },
  bumdes: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'], write: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'] },
  koperasi: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'], write: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'] },
  agenda: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'], write: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'] },
  notifications: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'], write: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'] },
  ai_knowledge: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'], write: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'] },
  gps_points: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'], write: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'] },
  drp: { read: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'], write: ['ADMIN', 'PLD', 'PEMDES', 'OPERATOR', 'KADES', 'SEKDES', 'BENDAHARA', 'KAUR', 'KASI', 'TPP'] },
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

const PASSWORD_MIN_LENGTH = 15;
const PASSWORD_MAX_LENGTH = 128;
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

function validatePassword(password) {
  const value = String(password || '');
  if (value.length < PASSWORD_MIN_LENGTH) {
    const error = new Error('Password minimal 15 karakter.');
    error.statusCode = 422;
    throw error;
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    const error = new Error('Password maksimal 128 karakter.');
    error.statusCode = 422;
    throw error;
  }
  return value;
}

function hashPassword(password) {
  const value = validatePassword(password);
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(value, salt, 64, SCRYPT_OPTIONS);
  return 'scrypt$32768$8$3$' + salt.toString('hex') + '$' + hash.toString('hex');
}

function verifyPassword(password, stored) {
  if (!stored) return { valid: false, needsUpgrade: false };
  const value = String(password || '');
  try {
    if (stored.startsWith('scrypt$')) {
      const parts = stored.split('$');
      if (parts.length !== 6) return { valid: false, needsUpgrade: false };
      const n = Number(parts[1]), r = Number(parts[2]), p = Number(parts[3]);
      const salt = Buffer.from(parts[4], 'hex'), expected = Buffer.from(parts[5], 'hex');
      if (!Number.isSafeInteger(n) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p) || !salt.length || !expected.length) return { valid: false, needsUpgrade: false };
      const actual = crypto.scryptSync(value, salt, expected.length, { N: n, r, p, maxmem: 64 * 1024 * 1024 });
      const valid = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
      return { valid, needsUpgrade: valid && (n !== 32768 || r !== 8 || p !== 3 || expected.length !== 64) };
    }
    const legacy = String(stored).split(':');
    if (legacy.length !== 2) return { valid: false, needsUpgrade: false };
    const salt = Buffer.from(legacy[0], 'hex'), expected = Buffer.from(legacy[1], 'hex');
    if (!salt.length || !expected.length) return { valid: false, needsUpgrade: false };
    const actual = crypto.scryptSync(value, salt, expected.length, SCRYPT_OPTIONS);
    const valid = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    return { valid, needsUpgrade: valid };
  } catch {
    return { valid: false, needsUpgrade: false };
  }
}

async function seedAdmin() {
  if (!(await count('users'))) {
    const username = String(process.env.ADMIN_USERNAME || 'admin').trim();
    const password = process.env.ADMIN_PASSWORD;
    if (!password) return;
    await create('users', {
      nama_lengkap: String(process.env.ADMIN_NAME || 'Administrator KerjaDesa'),
      username,
      password_hash: hashPassword(password),
      role: 'ADMIN',
      desa: '',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
}


async function resetAdminPassword(req, res) {
  const enabled = String(process.env.ADMIN_RESET_ENABLED || '').trim().toLowerCase() === 'true';
  if (!enabled) return sendJson(res, 404, { success: false, message: 'Reset admin tidak tersedia.' });

  const configuredToken = String(process.env.ADMIN_BOOTSTRAP_TOKEN || '');
  if (configuredToken.length < 32) return sendJson(res, 404, { success: false, message: 'Reset admin tidak tersedia.' });
  if (!productionRequestIsSecure(req)) return sendJson(res, 400, { success: false, message: 'Reset admin wajib menggunakan HTTPS.' });

  const ip = req.socket?.remoteAddress || 'unknown';
  if (!bootstrapAllowed(ip)) return sendJson(res, 429, { success: false, message: 'Terlalu banyak percobaan reset. Coba lagi nanti.' });
  if (bootstrapInProgress) return sendJson(res, 409, { success: false, message: 'Reset admin sedang diproses.' });

  bootstrapInProgress = true;
  try {
    const body = await parseJsonBody(req);
    if (!secretMatches(body.reset_token, configuredToken)) {
      recordBootstrapFailure(ip);
      return sendJson(res, 401, { success: false, message: 'Reset credential tidak valid.' });
    }

    const username = String(body.username || 'admin').trim();
    if (!/^[A-Za-z0-9._-]{3,64}$/.test(username)) {
      return sendJson(res, 422, { success: false, message: 'Username tidak valid.' });
    }

    const password = validatePassword(body.password);
    const user = await findByField('users', 'username', username);
    if (!user || String(user.role || '').toUpperCase() !== 'ADMIN') {
      return sendJson(res, 404, { success: false, message: 'Akun admin tidak ditemukan.' });
    }

    const updated = await update('users', user.id, {
      password_hash: hashPassword(password),
      status: 'ACTIVE',
      updated_at: new Date().toISOString()
    });

    bootstrapAttempts.delete(ip);
    await writeAudit({ user: updated || user, action: 'RESET_ADMIN_PASSWORD', resource: 'auth', recordId: user.id });
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return sendJson(res, 200, {
      success: true,
      message: 'Password admin berhasil direset. Matikan ADMIN_RESET_ENABLED setelah login berhasil.'
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 400, { success: false, message: error.message });
  } finally {
    bootstrapInProgress = false;
  }
}

async function bootstrapAdmin(req, res) {
  const configuredToken = String(process.env.ADMIN_BOOTSTRAP_TOKEN || '');
  if (configuredToken.length < 32) return sendJson(res, 404, { success: false, message: 'Bootstrap admin tidak tersedia.' });
  if (!productionRequestIsSecure(req)) return sendJson(res, 400, { success: false, message: 'Bootstrap admin wajib menggunakan HTTPS.' });
  const ip = req.socket?.remoteAddress || 'unknown';
  if (!bootstrapAllowed(ip)) return sendJson(res, 429, { success: false, message: 'Terlalu banyak percobaan bootstrap. Coba lagi nanti.' });
  if (bootstrapInProgress) return sendJson(res, 409, { success: false, message: 'Bootstrap admin sedang diproses.' });

  bootstrapInProgress = true;
  try {
    if (await count('users')) return sendJson(res, 409, { success: false, message: 'Bootstrap admin sudah tidak tersedia.' });
    const body = await parseJsonBody(req);
    if (!secretMatches(body.bootstrap_token, configuredToken)) {
      recordBootstrapFailure(ip);
      return sendJson(res, 401, { success: false, message: 'Bootstrap credential tidak valid.' });
    }
    const username = String(body.username || 'admin').trim();
    if (!/^[A-Za-z0-9._-]{3,64}$/.test(username)) return sendJson(res, 422, { success: false, message: 'Username tidak valid.' });
    const password = validatePassword(body.password);
    if (await findByField('users', 'username', username)) return sendJson(res, 409, { success: false, message: 'Username sudah digunakan.' });
    const item = await create('users', {
      nama_lengkap: String(body.nama_lengkap || 'Administrator KerjaDesa').trim().slice(0, 120),
      username,
      password_hash: hashPassword(password),
      role: 'ADMIN',
      desa: '',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    bootstrapAttempts.delete(ip);
    await writeAudit({ user: item, action: 'BOOTSTRAP_ADMIN', resource: 'auth', recordId: item.id });
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return sendJson(res, 201, { success: true, message: 'Admin berhasil dibuat. Gunakan akun ini untuk login melalui halaman login KerjaDesa.', user: publicUser(item) });
  } catch (error) {
    return sendJson(res, error.statusCode || 400, { success: false, message: error.message });
  } finally {
    bootstrapInProgress = false;
  }
}

function normalizeResourcePayload(resource, body, user) {
  const payload = { ...body };
  delete payload.password;
  delete payload.password_hash;
  if (resource !== 'users') {
    payload.created_by = user.id;
  }
  return payload;
}

async function login(req, res) {
  try {
    const body = await parseJsonBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const ip = req.socket?.remoteAddress || 'unknown';
    const key = ip + ':' + (username.toLowerCase() || 'anonymous');
    if (!loginAllowed(key)) return sendJson(res, 429, { success: false, message: 'Terlalu banyak percobaan login. Coba lagi beberapa menit.' });
    const user = await findByField('users', 'username', username);

    const passwordCheck = user ? verifyPassword(password, user.password_hash) : { valid: false, needsUpgrade: false };
    if (!user || user.status === 'INACTIVE' || !passwordCheck.valid) {
      recordLoginFailure(key);
      return sendJson(res, 401, { success: false, message: 'Username atau password tidak sesuai.' });
    }

    loginAttempts.delete(key);
    if (passwordCheck.needsUpgrade) {
      await update('users', user.id, { password_hash: hashPassword(password) });
      user.password_hash = undefined;
    }
    await writeAudit({ user, action: 'LOGIN', resource: 'auth' });
    const token = issueSession(user);
    const csrfToken = setAuthResponseCookies(res, token);
    res.setHeader('Cache-Control','no-store');
    return sendJson(res, 200, {
      success: true,
      expires_in: 8 * 60 * 60,
      csrf_token: csrfToken,
      user: publicUser(user)
    });
  } catch (error) {
    return sendJson(res, 400, { success: false, message: error.message });
  }
}

async function logout(req, res) {
  const auth = await require('../middleware/auth').authenticate(req);
  const token = auth?.token || '';
  if (auth) await writeAudit({ user: auth.user, action: 'LOGOUT', resource: 'auth' });
  revokeSession(token);
  clearAuthResponseCookies(res);
  return sendJson(res, 200, { success: true, message: 'Logout berhasil.' });
}

async function dashboard(req, res, auth) {
  const reqUser = auth?.user || null;
  const resources=['desa','wilayah','rkpdes','apbdes','rab','realisasi','lpj','penduduk','kpm','blt','stunting','bumdes','koperasi','agenda','gps_points','drp','dokumen','laporan','kegiatan','monitoring','notifications','ai_knowledge','users'];
  const rows=await Promise.all(resources.map(r=>scopeRows(r,list(r),reqUser)));
  const by=Object.fromEntries(resources.map((r,i)=>[r,rows[i]]));
  const kegiatanSelesai=by.kegiatan.filter(x=>String(x.status||'').toUpperCase()==='SELESAI').length;
  const monitoringProgres=by.monitoring.length?Math.round(by.monitoring.reduce((a,x)=>a+Number(x.progres||0),0)/by.monitoring.length):0;
  const apbPagu=by.apbdes.reduce((a,x)=>a+Number(x.pagu||0),0);
  const apbRealisasi=by.apbdes.reduce((a,x)=>a+Number(x.realisasi||0),0);
  const realisasiNilai=by.realisasi.reduce((a,x)=>a+Number(x.nilai||0),0);
  const monevSelesai=by.realisasi.filter(x=>String(x.status||'').toUpperCase()==='SELESAI').length;
  return sendJson(res,200,{success:true,data:{
    desa:by.desa.length,wilayah:by.wilayah.length,kegiatan:by.kegiatan.length,monitoring:by.monitoring.length,
    dokumen:by.dokumen.length,laporan:by.laporan.length,users:by.users.length,audit_log:(await list('audit_log')).length,
    kegiatan_selesai:kegiatanSelesai,rata_rata_progres:monitoringProgres,
    perencanaan:{rkpdes:by.rkpdes.length},
    keuangan:{apbdes:by.apbdes.length,rab:by.rab.length,lpj:by.lpj.length,pagu:apbPagu,realisasi:apbRealisasi,realisasi_records:by.realisasi.length,realisasi_nilai:realisasiNilai,serapan:apbPagu?Math.round(apbRealisasi/apbPagu*100):0,monev_selesai:monevSelesai},
    sosial:{penduduk:by.penduduk.length,kpm:by.kpm.length,blt:by.blt.length,stunting:by.stunting.length},
    ekonomi:{bumdes:by.bumdes.length,koperasi:by.koperasi.length},
    lapangan:{agenda:by.agenda.length,gps_points:by.gps_points.length,drp:by.drp.length},
    sistem:{notifications:by.notifications.length,ai_knowledge:by.ai_knowledge.length}
  }});
}

async function validateFinanceReferences(resource, payload, user) {
  const refs = [
    ['apbdes_id','apbdes'],
    ['rab_id','rab'],
    ['kegiatan_id','kegiatan'],
    ['rkpdes_id','rkpdes']
  ];
  for (const [field, target] of refs) {
    const id = payload?.[field];
    if (!id) continue;
    const row = await get(target, id);
    if (!row) {
      const err = new Error('Referensi '+field+' tidak ditemukan.');
      err.statusCode = 422;
      throw err;
    }
    if (!canAccessVillage(target, row, user) || (payload.desa && itemVillage(row) && itemVillage(row) !== String(payload.desa).trim().toLowerCase())) {
      const err = new Error('Referensi '+field+' harus berasal dari desa yang sama.');
      err.statusCode = 422;
      throw err;
    }
  }
}

function normalizeFinancePayload(resource, payload) {
  const out = { ...payload };
  if (resource === 'rab') {
    out.jumlah = Number(out.volume || 0) * Number(out.harga_satuan || 0);
  }
  return out;
}

async function syncApbdesRealization(apbdesId) {
  if (!apbdesId) return;
  const apb = await get('apbdes', apbdesId);
  if (!apb) return;
  const rows = await list('realisasi');
  const total = rows
    .filter(x => String(x.apbdes_id || '') === String(apbdesId))
    .reduce((sum, x) => sum + Number(x.nilai || 0), 0);
  const pagu = Number(apb.pagu || 0);
  const progress = pagu > 0 ? Math.min(100, Math.round(total / pagu * 100)) : 0;
  if (Number(apb.realisasi || 0) !== total || Number(apb.progres_keuangan || 0) !== progress) {
    await update('apbdes', apbdesId, { realisasi: total, progres_keuangan: progress });
  }
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
      if (!item || !canAccessVillage(resource, item, auth.user)) return sendJson(res, 404, { success: false, message: 'Data tidak ditemukan.' });
      return sendJson(res, 200, { success: true, data: resource === 'users' ? publicUser(item) : item });
    }
    const rows = resource === 'audit_log' ? await listAudit(200) : scopeRows(resource, await list(resource), auth.user);
    return sendJson(res, 200, { success: true, data: resource === 'users' ? rows.map(publicUser) : rows });
  }

  if (method === 'POST') {
    const body = await parseJsonBody(req);
    if (resource === 'users') {
      const username = String(body.username || '').trim();
      if (!username || !body.password) {
        return sendJson(res, 422, { success: false, message: 'Username dan password wajib diisi.' });
      }
      try { validatePassword(body.password); } catch (error) { return sendJson(res, error.statusCode || 422, { success: false, message: error.message }); }
      if (await findByField('users', 'username', username)) {
        return sendJson(res, 409, { success: false, message: 'Username sudah digunakan.' });
      }
      const item = await create('users', {
        nama_lengkap: String(body.nama_lengkap || ''),
        username,
        password_hash: hashPassword(body.password),
        role: ['ADMIN','PLD','PEMDES','OPERATOR','KADES','SEKDES','BENDAHARA','KAUR','KASI','TPP'].includes(String(body.role || '').toUpperCase()) ? String(body.role || '').toUpperCase() : 'OPERATOR',
        desa: body.desa || '',
        status: ['ACTIVE','INACTIVE'].includes(String(body.status || '').toUpperCase()) ? String(body.status || '').toUpperCase() : 'ACTIVE'
      });
      await writeAudit({ user: auth.user, action: 'CREATE', resource: 'users', recordId: item.id });
      return sendJson(res, 201, { success: true, data: publicUser(item) });
    }

    let payload = normalizeResourcePayload(resource, body, auth.user);
    payload = normalizeFinancePayload(resource, payload);
    if (['rkpdes','apbdes','rab','realisasi','lpj'].includes(resource)) {
      try { await validateFinanceReferences(resource, payload, auth.user); }
      catch (error) { return sendJson(res, error.statusCode || 422, { success: false, message: error.message }); }
    }
    if (VILLAGE_SCOPED_RESOURCES.has(resource) && auth.user.role !== 'ADMIN') {
      const allowedVillages = userVillages(auth.user);
      if (!allowedVillages.length) return sendJson(res, 403, { success: false, message: 'Akun belum memiliki kewenangan desa untuk resource ini.' });
      if (payload.desa && !allowedVillages.includes(String(payload.desa).trim().toLowerCase())) {
        return sendJson(res, 403, { success: false, message: 'Data hanya boleh dibuat untuk desa yang menjadi kewenangan akun.' });
      }
      if (!payload.desa) payload.desa = allowedVillages[0];
    }
    const item = await create(resource, payload);
    if (resource === 'realisasi' && item.apbdes_id) await syncApbdesRealization(item.apbdes_id);
    await writeAudit({ user: auth.user, action: 'CREATE', resource, recordId: item.id });
    return sendJson(res, 201, { success: true, data: resource === 'users' ? publicUser(item) : item });
  }

  if (method === 'PATCH' && id) {
    const body = await parseJsonBody(req);
    if (resource === 'users' && body.password) {
      try { validatePassword(body.password); } catch (error) { return sendJson(res, error.statusCode || 422, { success: false, message: error.message }); }
      body.password_hash = hashPassword(body.password);
      delete body.password;
    }
    delete body.id;
    if (resource === 'users') {
      if (body.role !== undefined && !['ADMIN','PLD','PEMDES','OPERATOR','KADES','SEKDES','BENDAHARA','KAUR','KASI','TPP'].includes(String(body.role).toUpperCase())) return sendJson(res, 422, { success: false, message: 'Role tidak valid.' });
      if (body.status !== undefined && !['ACTIVE','INACTIVE'].includes(String(body.status).toUpperCase())) return sendJson(res, 422, { success: false, message: 'Status pengguna tidak valid.' });
      if (body.role !== undefined) body.role = String(body.role).toUpperCase();
      if (body.status !== undefined) body.status = String(body.status).toUpperCase();
    }
    const current = await get(resource, id);
    if (!current || !canAccessVillage(resource, current, auth.user)) return sendJson(res, 404, { success: false, message: 'Data tidak ditemukan.' });
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
    const normalizedBody = normalizeFinancePayload(resource, body);
    if (['rkpdes','apbdes','rab','realisasi','lpj'].includes(resource)) {
      try { await validateFinanceReferences(resource, normalizedBody, auth.user); }
      catch (error) { return sendJson(res, error.statusCode || 422, { success: false, message: error.message }); }
    }
    if (VILLAGE_SCOPED_RESOURCES.has(resource) && userVillages(auth.user).length && normalizedBody.desa && !userVillages(auth.user).includes(String(normalizedBody.desa).trim().toLowerCase())) return sendJson(res, 403, { success: false, message: 'Data hanya boleh dipindahkan ke desa yang menjadi kewenangan akun.' });
    const item = await update(resource, id, normalizedBody);
    if (item && resource === 'realisasi') {
      if (current.apbdes_id) await syncApbdesRealization(current.apbdes_id);
      if (item.apbdes_id && String(item.apbdes_id) !== String(current.apbdes_id || '')) await syncApbdesRealization(item.apbdes_id);
    }
    if (item) await writeAudit({ user: auth.user, action: 'UPDATE', resource, recordId: item.id });
    return item
      ? sendJson(res, 200, { success: true, data: resource === 'users' ? publicUser(item) : item })
      : sendJson(res, 404, { success: false, message: 'Data tidak ditemukan.' });
  }

  if (method === 'DELETE' && id) {
    const current = await get(resource, id);
    if (!current || !canAccessVillage(resource, current, auth.user)) return sendJson(res, 404, { success: false, message: 'Data tidak ditemukan.' });
    const ok = await remove(resource, id);
    if (ok && resource === 'realisasi' && current.apbdes_id) await syncApbdesRealization(current.apbdes_id);
    if (ok) await writeAudit({ user: auth.user, action: 'DELETE', resource, recordId: id });
    return sendJson(res, ok ? 200 : 404, {
      success: ok,
      message: ok ? 'Data dihapus.' : 'Data tidak ditemukan.'
    });
  }

  return sendJson(res, 405, { success: false, message: 'Method tidak didukung.' });
}

async function extractDrpPdf(req, res) {
  const MAX_BYTES = 15 * 1024 * 1024;
  const chunks = [];
  let total = 0;
  try {
    for await (const chunk of req) {
      total += chunk.length;
      if (total > MAX_BYTES) return sendJson(res, 413, { success: false, message: 'PDF terlalu besar. Maksimum 15 MB.' });
      chunks.push(chunk);
    }
    if (!total) return sendJson(res, 400, { success: false, message: 'File PDF kosong.' });
    const buffer = Buffer.concat(chunks, total);
    if (buffer.slice(0, 5).toString('ascii') !== '%PDF-') {
      return sendJson(res, 422, { success: false, message: 'File bukan PDF yang valid.' });
    }
    const parsed = await pdfParse(buffer, { max: 0 });
    const text = String(parsed.text || '').replace(/\u0000/g, ' ').trim();
    if (!text) return sendJson(res, 422, { success: false, message: 'PDF terbaca tetapi tidak mengandung teks.' });
    return sendJson(res, 200, { success: true, text, pages: Number(parsed.numpages || 0) });
  } catch (error) {
    console.error('DRP PDF extraction failed:', error);
    return sendJson(res, 422, { success: false, message: 'Server gagal membaca PDF DRP: ' + String(error?.message || error).slice(0, 300) });
  }
}

module.exports = {
  login,
  bootstrapAdmin,
  resetAdminPassword,
  logout,
  dashboard,
  resourceHandler,
  seedAdmin,
  extractDrpPdf
};

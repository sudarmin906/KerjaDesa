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

const VILLAGE_SCOPED_RESOURCES = new Set([
  'desa','wilayah','kegiatan','monitoring','dokumen','laporan','sppd','rkpdes',
  'apbdes','rab','realisasi','lpj','penduduk','kpm','blt','stunting','bumdes',
  'koperasi','agenda','gps_points','drp'
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
  if (!allowed.length) return true;
  const village = itemVillage(item);
  return !!village && allowed.includes(village);
}
function scopeRows(resource, rows, user) {
  if (user?.role === 'ADMIN' || !VILLAGE_SCOPED_RESOURCES.has(resource)) return rows;
  const allowed = userVillages(user);
  if (!allowed.length) return rows;
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
      password_hash: hashPassword(process.env.ADMIN_PASSWORD),
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
    const ip = req.socket?.remoteAddress || 'unknown';
    const key = ip + ':' + (username.toLowerCase() || 'anonymous');
    if (!loginAllowed(key)) return sendJson(res, 429, { success: false, message: 'Terlalu banyak percobaan login. Coba lagi beberapa menit.' });
    const user = await findByField('users', 'username', username);

    if (!user || !verifyPassword(password, user.password_hash)) {
      recordLoginFailure(key);
      return sendJson(res, 401, { success: false, message: 'Username atau password tidak sesuai.' });
    }

    loginAttempts.delete(key);
    await writeAudit({ user, action: 'LOGIN', resource: 'auth' });
    const token = issueSession(user);
    setAuthResponseCookies(res, token);
    res.setHeader('Cache-Control','no-store');
    return sendJson(res, 200, {
      success: true,
      expires_in: 8 * 60 * 60,
      user: publicUser(user)
    });
  } catch (error) {
    return sendJson(res, 400, { success: false, message: error.message });
  }
}

async function logout(req, res) {
  const auth = await require('../middleware/auth').authenticate(req);
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
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
      if (await findByField('users', 'username', username)) {
        return sendJson(res, 409, { success: false, message: 'Username sudah digunakan.' });
      }
      const item = await create('users', {
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

    let payload = normalizeResourcePayload(resource, body, auth.user);
    payload = normalizeFinancePayload(resource, payload);
    if (['rkpdes','apbdes','rab','realisasi','lpj'].includes(resource)) {
      try { await validateFinanceReferences(resource, payload, auth.user); }
      catch (error) { return sendJson(res, error.statusCode || 422, { success: false, message: error.message }); }
    }
    if (VILLAGE_SCOPED_RESOURCES.has(resource) && userVillages(auth.user).length) {
      if (payload.desa && !userVillages(auth.user).includes(String(payload.desa).trim().toLowerCase())) return sendJson(res, 403, { success: false, message: 'Data hanya boleh dibuat untuk desa yang menjadi kewenangan akun.' });
      if (!payload.desa) payload.desa = auth.user.desa;
    }
    const item = await create(resource, payload);
    if (resource === 'realisasi' && item.apbdes_id) await syncApbdesRealization(item.apbdes_id);
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

module.exports = {
  login,
  logout,
  dashboard,
  resourceHandler,
  seedAdmin
};

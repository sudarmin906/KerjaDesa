const crypto = require('crypto');
const { get } = require('../database/store');

const { enabled: postgresEnabled, query: postgresQuery } = require('../database/postgres');

const sessions = new Map();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SESSION_IDLE_MS = 30 * 60 * 1000;
const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REMEMBER_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-kd_session' : 'kd_session';
const CSRF_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-kd_csrf' : 'kd_csrf';

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

async function issueSession(user, rememberMe = false) {
  const token = crypto.randomBytes(48).toString('base64url');
  const now = Date.now();
  const ttl = rememberMe ? REMEMBER_TTL_MS : SESSION_TTL_MS;
  const session = {
    userId: user.id,
    rememberMe: !!rememberMe,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: now + ttl
  };
  if (postgresEnabled()) {
    await postgresQuery(
      'INSERT INTO auth_sessions(token_hash,user_id,remember_me,created_at,last_seen_at,expires_at) VALUES($1,$2,$3,NOW(),NOW(),$4)',
      [hashToken(token), user.id, !!rememberMe, new Date(session.expiresAt)]
    );
  } else {
    sessions.set(token, session);
  }
  return token;
}

async function revokeSession(token) {
  if (!token) return;
  if (postgresEnabled()) {
    await postgresQuery('DELETE FROM auth_sessions WHERE token_hash=$1', [hashToken(token)]);
  } else {
    sessions.delete(token);
  }
}

async function cleanupSessions() {
  if (postgresEnabled()) {
    await postgresQuery("DELETE FROM auth_sessions WHERE expires_at <= NOW() OR last_seen_at <= CASE WHEN remember_me THEN NOW() - INTERVAL '7 days' ELSE NOW() - INTERVAL '30 minutes' END").catch(()=>{});
    return;
  }
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    const idle = session.rememberMe ? REMEMBER_IDLE_MS : SESSION_IDLE_MS;
    if (session.expiresAt <= now || now - session.lastSeenAt > idle) sessions.delete(token);
  }
}

function parseCookies(req) {
  const out={};
  String(req.headers.cookie||'').split(';').forEach(part=>{
    const i=part.indexOf('=');
    if(i<0)return;
    const k=part.slice(0,i).trim(),v=part.slice(i+1).trim();
    try{out[k]=decodeURIComponent(v)}catch(_){out[k]=v}
  });
  return out;
}
function getToken(req) {
  return parseCookies(req)[SESSION_COOKIE] || '';
}
function csrfValid(req) {
  if (['GET','HEAD','OPTIONS'].includes(String(req.method||'').toUpperCase())) return true;
  const cookie=parseCookies(req)[CSRF_COOKIE] || '';
  const header=String(req.headers['x-csrf-token']||'');
  if(!cookie || !header || cookie.length!==header.length) return false;
  return crypto.timingSafeEqual(Buffer.from(cookie),Buffer.from(header));
}
function cookieContext(req) {
  const secure = process.env.NODE_ENV === 'production';
  const origin = String(req?.headers?.origin || '').replace(/\/$/, '');
  const host = String(req?.headers?.host || '');
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || (secure ? 'https' : 'http');
  const requestOrigin = host ? protocol + '://' + host : '';
  const sameOrigin = !origin || !requestOrigin || origin === requestOrigin;
  return {
    secure,
    sameOrigin,
    sameSite: secure ? (sameOrigin ? 'SameSite=Lax' : 'SameSite=None') : 'SameSite=Lax',
    partitioned: secure && !sameOrigin ? 'Partitioned' : ''
  };
}
function setAuthResponseCookies(res, token, req, rememberMe = false) {
  const ctx=cookieContext(req);
  const csrf=crypto.randomBytes(32).toString('hex');
  const maxAge = rememberMe ? Math.floor(REMEMBER_TTL_MS/1000) : null;
  const sessionFlags=['Path=/','HttpOnly',ctx.secure?'Secure':'',ctx.sameSite,ctx.partitioned,maxAge!==null?'Max-Age='+maxAge:''].filter(Boolean).join('; ');
  const csrfFlags=['Path=/',ctx.secure?'Secure':'',ctx.sameSite,ctx.partitioned,maxAge!==null?'Max-Age='+maxAge:''].filter(Boolean).join('; ');
  res.setHeader('Set-Cookie',[
    SESSION_COOKIE+'='+encodeURIComponent(token)+'; '+sessionFlags,
    CSRF_COOKIE+'='+csrf+'; '+csrfFlags
  ]);
  return csrf;
}
function clearAuthResponseCookies(res, req) {
  const ctx=cookieContext(req);
  const flags=['Path=/','HttpOnly',ctx.secure?'Secure':'',ctx.sameSite,ctx.partitioned,'Max-Age=0'].filter(Boolean).join('; ');
  res.setHeader('Set-Cookie',[
    SESSION_COOKIE+'=; '+flags,
    CSRF_COOKIE+'=; '+flags
  ]);
}
async function authenticate(req) {
  await cleanupSessions();
  const token = getToken(req);
  if (!token) return null;
  let session = null;
  if (postgresEnabled()) {
    const r = await postgresQuery('SELECT user_id,remember_me,created_at,last_seen_at,expires_at FROM auth_sessions WHERE token_hash=$1 LIMIT 1', [hashToken(token)]);
    if (r.rows[0]) {
      const row=r.rows[0];
      session={
        userId: row.user_id,
        rememberMe: !!row.remember_me,
        createdAt: new Date(row.created_at).getTime(),
        lastSeenAt: new Date(row.last_seen_at).getTime(),
        expiresAt: new Date(row.expires_at).getTime()
      };
    }
  } else {
    session = sessions.get(token) || null;
  }
  const now = Date.now();
  const idleLimit = session?.rememberMe ? REMEMBER_IDLE_MS : SESSION_IDLE_MS;
  if (!session || session.expiresAt <= now || now - session.lastSeenAt > idleLimit) {
    await revokeSession(token);
    return null;
  }
  if (postgresEnabled()) {
    await postgresQuery('UPDATE auth_sessions SET last_seen_at=NOW() WHERE token_hash=$1', [hashToken(token)]);
  } else {
    session.lastSeenAt = now;
  }
  const user = await get('users', session.userId);
  if (!user || String(user.status || '').toUpperCase() === 'INACTIVE') {
    await revokeSession(token);
    return null;
  }
  return { user, token, rememberMe: session.rememberMe };
}
async function requireAuth(req, res) {
  const auth = await authenticate(req);
  if (!auth) {
    sendJson(res, 401, { success: false, code: 'AUTH_SESSION_INVALID', message: 'Sesi tidak valid atau sudah berakhir.' });
    return null;
  }
  return auth;
}
async function requireRole(req, res, roles) {
  const auth = await requireAuth(req, res);
  if (!auth) return null;
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(auth.user.role)) {
    sendJson(res, 403, { success: false, message: 'Akses ditolak untuk role ini.' });
    return null;
  }
  return auth;
}
function publicUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}
function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
module.exports = { issueSession, revokeSession, authenticate, requireAuth, requireRole, publicUser, sendJson, csrfValid, setAuthResponseCookies, clearAuthResponseCookies };

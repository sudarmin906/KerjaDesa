const crypto = require('crypto');
const { get } = require('../database/store');

const sessions = new Map();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SESSION_IDLE_MS = 30 * 60 * 1000;
const SESSION_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-kd_session' : 'kd_session';
const CSRF_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-kd_csrf' : 'kd_csrf';

function issueSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, createdAt: Date.now(), lastSeenAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}
function revokeSession(token) { if (token) sessions.delete(token); }
function cleanupSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) if (session.expiresAt <= now) sessions.delete(token);
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
function setAuthResponseCookies(res, token) {
  const secure=process.env.NODE_ENV==='production';
  const csrf=crypto.randomBytes(32).toString('hex');
  const sessionFlags=['Path=/','HttpOnly',secure?'Secure':'',secure?'SameSite=None':'SameSite=Lax','Max-Age='+(SESSION_TTL_MS/1000)].filter(Boolean).join('; ');
  const csrfFlags=['Path=/',secure?'Secure':'',secure?'SameSite=None':'SameSite=Lax','Max-Age='+(SESSION_TTL_MS/1000)].filter(Boolean).join('; ');
  res.setHeader('Set-Cookie',[
    SESSION_COOKIE+'='+encodeURIComponent(token)+'; '+sessionFlags,
    CSRF_COOKIE+'='+csrf+'; '+csrfFlags
  ]);
  return csrf;
}
function clearAuthResponseCookies(res) {
  const secure=process.env.NODE_ENV==='production';
  const flags=['Path=/',secure?'Secure':'',secure?'SameSite=None':'SameSite=Lax','Max-Age=0'].filter(Boolean).join('; ');
  res.setHeader('Set-Cookie',[
    SESSION_COOKIE+'=; '+flags,
    CSRF_COOKIE+'=; '+flags
  ]);
}
async function authenticate(req) {
  cleanupSessions();
  const token = getToken(req);
  if (!token) return null;
  const session = sessions.get(token);
  const now = Date.now();
  if (!session || session.expiresAt <= now || (session.lastSeenAt && now - session.lastSeenAt > SESSION_IDLE_MS)) { revokeSession(token); return null; }
  session.lastSeenAt = now;
  const user = await get('users', session.userId);
  if (!user || user.status === 'INACTIVE') { revokeSession(token); return null; }
  return { user, token };
}
async function requireAuth(req, res) {
  const auth = await authenticate(req);
  if (!auth) {
    sendJson(res, 401, { success: false, message: 'Sesi tidak valid atau sudah berakhir.' });
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

const crypto = require('crypto');
const { get } = require('../database/jsonStore');

const sessions = new Map();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function issueSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    userId: user.id,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
}

function revokeSession(token) {
  if (token) sessions.delete(token);
}

function cleanupSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

function getToken(req) {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

function authenticate(req) {
  cleanupSessions();
  const token = getToken(req);
  if (!token) return null;

  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    revokeSession(token);
    return null;
  }

  const user = get('users', session.userId);
  if (!user || user.status === 'INACTIVE') return null;

  return { user, token };
}

function requireAuth(req, res) {
  const auth = authenticate(req);
  if (!auth) {
    sendJson(res, 401, { success: false, message: 'Sesi tidak valid atau sudah berakhir.' });
    return null;
  }
  return auth;
}

function requireRole(req, res, roles) {
  const auth = requireAuth(req, res);
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

module.exports = {
  issueSession,
  revokeSession,
  authenticate,
  requireAuth,
  requireRole,
  publicUser,
  sendJson
};

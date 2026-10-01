// KerjaDesa Pro API Server
// Stage: Server-backed authentication + CRUD + dashboard.
// No external runtime dependency: Node.js built-ins only.

const http = require('http');
const { URL } = require('url');
const { ensureDatabase } = require('./database/store');
const { health: postgresHealth } = require('./database/postgres');
const { authenticate, requireAuth, sendJson } = require('./middleware/auth');
const { login, logout, dashboard, resourceHandler, seedAdmin } = require('./controllers/apiController');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

async function bootstrap() {
  await ensureDatabase();
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD wajib diisi pada production.');
  await seedAdmin();

const ALLOWED_METHODS = 'GET,POST,PATCH,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, Authorization';

function cors(res) {
  const origin = process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
  res.setHeader('Access-Control-Max-Age', '86400');
}

async function route(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (req.method === 'GET' && path === '/api/health') {
    return postgresHealth().then(db => sendJson(res, 200, {
      app: 'KerjaDesa Pro',
      status: 'online',
      stage: 'server-backed api',
      timestamp: new Date().toISOString(),
      database: db
    }));
  }

  if (req.method === 'POST' && path === '/api/auth/login') return login(req, res);
  if (req.method === 'POST' && path === '/api/auth/logout') return logout(req, res);
  if (req.method === 'GET' && path === '/api/auth/me') {
    const auth = requireAuth(req, res);
    return auth && sendJson(res, 200, { success: true, user: auth.user });
  }

  const auth = await authenticate(req);
  if (!auth) {
    return sendJson(res, 401, { success: false, message: 'Authentication diperlukan.' });
  }

  if (req.method === 'GET' && path === '/api/dashboard') {
    return dashboard(req, res);
  }

  const match = path.match(/^\/api\/(desa|kegiatan|monitoring|dokumen|laporan|users)(?:\/([^/]+))?$/);
  if (match) {
    return resourceHandler(req, res, match[1], match[2], req.method, auth);
  }

  return sendJson(res, 404, { success: false, message: 'API route not found.' });
}

const server = http.createServer((req, res) => {
  Promise.resolve(route(req, res)).catch(error => {
    console.error(error);
    if (!res.headersSent) {
      sendJson(res, 500, { success: false, message: 'Internal server error.' });
    }
  });
});

  server.listen(PORT, HOST, () => {
    console.log('KerjaDesa Pro API running at http://' + HOST + ':' + PORT);
  });
}
bootstrap().catch(error => {
  console.error('KerjaDesa bootstrap gagal:', error);
  process.exit(1);
});

module.exports = server;

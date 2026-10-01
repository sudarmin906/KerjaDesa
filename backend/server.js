const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { ensureDatabase } = require('./database/store');
const { health: postgresHealth } = require('./database/postgres');
const { authenticate, requireAuth, sendJson } = require('./middleware/auth');
const { login, logout, dashboard, resourceHandler, seedAdmin } = require('./controllers/apiController');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const ALLOWED_METHODS = 'GET,POST,PATCH,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, Authorization';
const WEB_ROOT = path.resolve(__dirname, '..');

function cors(req, res) {
  const configured = String(process.env.CORS_ORIGIN || '').split(',').map(x => x.trim()).filter(Boolean);
  const requestOrigin = req.headers.origin || '';
  const allow = configured.length ? (configured.includes(requestOrigin) ? requestOrigin : '') : '*';
  if (allow) res.setHeader('Access-Control-Allow-Origin', allow);
  if (requestOrigin && allow) res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
  res.setHeader('Access-Control-Max-Age', '86400');
}

function safeStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const relative = decoded.replace(/^\/+/, '');
  const candidate = path.resolve(WEB_ROOT, relative || 'index.html');
  if (candidate !== WEB_ROOT && !candidate.startsWith(WEB_ROOT + path.sep)) return null;
  return candidate;
}

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  let filePath;
  try { filePath = safeStaticPath(pathname); } catch { return false; }
  if (!filePath) return false;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8',
      '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
      '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp',
      '.svg':'image/svg+xml', '.ico':'image/x-icon', '.txt':'text/plain; charset=utf-8',
      '.pdf':'application/pdf'
    };
    res.statusCode = 200;
    res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (path.basename(filePath) === 'sw.js') res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    else res.setHeader('Cache-Control', ext === '.html' ? 'no-cache' : 'public, max-age=3600');
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(filePath).pipe(res);
  }
  if (pathname !== '/index.html' && !pathname.startsWith('/api/')) {
    return serveStatic(req, res, '/index.html');
  }
  return false;
}

async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathName = url.pathname.replace(/\/+$/, '') || '/';

  if (pathName.startsWith('/api/')) {
    cors(req, res);
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }

    if (req.method === 'GET' && pathName === '/api/health') {
      const db = await postgresHealth();
      return sendJson(res, 200, {
        app: 'KerjaDesa Pro',
        status: 'online',
        stage: 'server-backed api',
        timestamp: new Date().toISOString(),
        database: db
      });
    }

    if (req.method === 'POST' && pathName === '/api/auth/login') return login(req, res);
    if (req.method === 'POST' && pathName === '/api/auth/logout') return logout(req, res);
    if (req.method === 'GET' && pathName === '/api/auth/me') {
      const auth = await requireAuth(req, res);
      return auth && sendJson(res, 200, { success: true, user: auth.user });
    }

    const auth = await authenticate(req);
    if (!auth) return sendJson(res, 401, { success: false, message: 'Authentication diperlukan.' });

    if (req.method === 'GET' && pathName === '/api/dashboard') return dashboard(req, res);

    const match = pathName.match(/^\/api\/(desa|kegiatan|monitoring|dokumen|laporan|users)(?:\/([^/]+))?$/);
    if (match) return resourceHandler(req, res, match[1], match[2], req.method, auth);

    if (req.method === 'GET' && pathName === '/api/audit_log') {
      if (auth.user.role !== 'ADMIN') return sendJson(res, 403, { success: false, message: 'Role tidak memiliki hak akses.' });
      const { listAudit } = require('./middleware/audit');
      return sendJson(res, 200, { success: true, data: await listAudit(200) });
    }

    return sendJson(res, 404, { success: false, message: 'API route not found.' });
  }

  if (serveStatic(req, res, pathName)) return;
  res.statusCode = 404;
  res.end('Not found');
}

const server = http.createServer((req, res) => {
  Promise.resolve(route(req, res)).catch(error => {
    console.error(error);
    if (!res.headersSent) sendJson(res, 500, { success: false, message: 'Internal server error.' });
  });
});

async function bootstrap() {
  await ensureDatabase();
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD wajib diisi pada production.');
  }
  await seedAdmin();
  server.listen(PORT, HOST, () => {
    console.log('KerjaDesa Pro API/Web running at http://' + HOST + ':' + PORT);
  });
}

bootstrap().catch(error => {
  console.error('KerjaDesa bootstrap gagal:', error);
  process.exit(1);
});

module.exports = server;

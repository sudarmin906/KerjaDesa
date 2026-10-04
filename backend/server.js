const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { ensureDatabase } = require('./database/store');
const { health: postgresHealth } = require('./database/postgres');
const { authenticate, requireAuth, sendJson, csrfValid } = require('./middleware/auth');
const { login, bootstrapAdmin, resetAdminPassword, logout, dashboard, resourceHandler, seedAdmin, extractDrpPdf } = require('./controllers/apiController');
const { publicUser } = require('./middleware/auth');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const ALLOWED_METHODS = 'GET,POST,PATCH,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, X-CSRF-Token';
const WEB_ROOT = path.resolve(__dirname, '..');

function buildInfo() {
  return {
    app: 'KerjaDesa Pro',
    version: String(process.env.KERJADESA_VERSION || '2026.10.04'),
    commit: String(process.env.KERJADESA_COMMIT || process.env.GITHUB_SHA || 'unknown'),
    build: String(process.env.KERJADESA_BUILD || process.env.BUILD_ID || 'unknown'),
    environment: String(process.env.NODE_ENV || 'development')
  };
}

const API_RATE_WINDOW_MS = 60 * 1000;
const API_RATE_MAX = 180;
const apiRate = new Map();

function clientKey(req) {
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket?.remoteAddress || 'unknown';
}

function allowApiRequest(req) {
  const key = clientKey(req);
  const now = Date.now();
  const item = apiRate.get(key);
  if (!item || now - item.startedAt >= API_RATE_WINDOW_MS) {
    apiRate.set(key, { startedAt: now, count: 1 });
    return true;
  }
  item.count += 1;
  return item.count <= API_RATE_MAX;
}

function securityHeaders(res, sensitive=false) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), payment=(), usb=(), display-capture=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  if (sensitive) res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https:; font-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' https:; connect-src 'self' https:; worker-src 'self' blob:; manifest-src 'self'");
}

function cors(req, res) {
  const configured = String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map(x => x.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const requestOrigin = String(req.headers.origin || '').trim().replace(/\/$/, '');
  const trustedProductionOrigins = new Set([
    'https://sudarmin906.github.io'
  ]);
  // Keep the explicit environment allow-list, but always retain the known
  // KerjaDesa production frontend. This prevents a stale/misformatted
  // CORS_ORIGIN value from breaking the GitHub Pages -> Blitz login flow.
  const allowedOrigins = new Set([...configured, ...trustedProductionOrigins]);
  const allow = requestOrigin
    ? (allowedOrigins.has(requestOrigin) ? requestOrigin : '')
    : (process.env.NODE_ENV === 'production' ? '' : '*');

  if (allow) res.setHeader('Access-Control-Allow-Origin', allow);
  if (requestOrigin && allow) res.setHeader('Vary', 'Origin');
  if (allow) res.setHeader('Access-Control-Allow-Credentials', 'true');
  securityHeaders(res, true);
  res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
  res.setHeader('Access-Control-Max-Age', '600');
}

function safeStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const relative = decoded.replace(/^\/+/, '');
  const candidate = path.resolve(WEB_ROOT, relative || 'index.html');
  if (candidate !== WEB_ROOT && !candidate.startsWith(WEB_ROOT + path.sep)) return null;
  return candidate;
}

function isPublicStaticPath(pathname) {
  const normalized = String(pathname || '').replace(/\\/g, '/');
  if (!normalized || normalized === '/') return true;
  const clean = normalized.replace(/^\/+/, '');
  if (/^(backend|\.git|\.github|deploy|scripts|data)(?:\/|$)/i.test(clean)) return false;
  if (/(^|\/)(?:\.env(?:\.|$)|.*\.(?:pem|key|crt|p12|pfx|sqlite|db|log|bak|sql|yml|yaml|toml|ini|conf))$/i.test(clean)) return false;
  return true;
}
function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  if (!isPublicStaticPath(pathname)) return false;
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
    securityHeaders(res, ext === '.html');
    if (path.basename(filePath) === 'sw.js') res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    else res.setHeader('Cache-Control', ext === '.html' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600');
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
    if (!allowApiRequest(req)) {
      res.setHeader('Retry-After', '60');
      return sendJson(res, 429, { success: false, message: 'Terlalu banyak permintaan. Coba lagi nanti.' });
    }

    if (req.method === 'GET' && pathName === '/api/version') {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return sendJson(res, 200, { success: true, ...buildInfo() });
    }

    if (req.method === 'GET' && pathName === '/api/health') {
      const db = await postgresHealth();
      const { pdfEngineStatus } = require('./controllers/apiController');
      const pdf = pdfEngineStatus();
      const ok = db.status === 'healthy' || db.status === 'disabled';
      return sendJson(res, ok ? 200 : 503, {
        success: ok,
        ...buildInfo(),
        status: ok ? 'online' : 'degraded',
        stage: 'server-backed api',
        timestamp: new Date().toISOString(),
        database: db,
        pdf_extractor: pdf
      });
    }

    if (req.method === 'GET' && pathName === '/api/health/drp') {
      const db = await postgresHealth();
      const { pdfEngineStatus } = require('./controllers/apiController');
      const pdf = pdfEngineStatus();
      const ok = (db.status === 'healthy' || db.status === 'disabled') && (pdf.pdftotext || pdf.pdf_parse);
      return sendJson(res, ok ? 200 : 503, {
        success: ok,
        ...buildInfo(),
        database: db.status,
        pdf_extractor: pdf.extractor,
        pdftotext: pdf.pdftotext,
        pdf_parse: pdf.pdf_parse
      });
    }

    if (req.method === 'POST' && pathName === '/api/auth/bootstrap') return bootstrapAdmin(req, res);
    if (req.method === 'POST' && pathName === '/api/auth/reset-admin') return resetAdminPassword(req, res);
    if (req.method === 'POST' && pathName === '/api/auth/login') return login(req, res);
    if (req.method === 'POST' && pathName === '/api/auth/logout') {
      if (!csrfValid(req)) return sendJson(res, 403, { success: false, message: 'CSRF token tidak valid.' });
      res.setHeader('Clear-Site-Data', '"cache", "cookies"');
      return logout(req, res);
    }
    if (req.method === 'GET' && pathName === '/api/auth/me') {
      const auth = await requireAuth(req, res);
      return auth && sendJson(res, 200, { success: true, user: publicUser(auth.user) });
    }

    const auth = await authenticate(req);
    if (!auth) return sendJson(res, 401, { success: false, message: 'Authentication diperlukan.' });
    if (!csrfValid(req)) return sendJson(res, 403, { success: false, message: 'CSRF token tidak valid.' });

    if (req.method === 'GET' && pathName === '/api/dashboard') return dashboard(req, res, auth);
    if (req.method === 'POST' && pathName === '/api/drp/extract-pdf') return extractDrpPdf(req, res);

    const match = pathName.match(/^\/api\/(desa|kegiatan|monitoring|dokumen|laporan|sppd|wilayah|apbdes|rkpdes|rab|realisasi|lpj|penduduk|kpm|blt|stunting|bumdes|koperasi|agenda|notifications|ai_knowledge|gps_points|drp|users)(?:\/([^/]+))?$/);
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
  const adminPassword = process.env.ADMIN_PASSWORD || process.env['KATA SANDI ADMIN'] || '';
  if (adminPassword) {
    if (!process.env.ADMIN_PASSWORD) process.env.ADMIN_PASSWORD = adminPassword;
    await seedAdmin();
  } else if (String(process.env.NODE_ENV || '').toLowerCase() === 'production' && String(process.env.ADMIN_BOOTSTRAP_TOKEN || '').length < 32) {
    throw new Error('Set ADMIN_PASSWORD atau ADMIN_BOOTSTRAP_TOKEN pada production.');
  } else if (!process.env.ADMIN_BOOTSTRAP_TOKEN) {
    console.warn('ADMIN_PASSWORD dan ADMIN_BOOTSTRAP_TOKEN belum disetel; inisialisasi admin dilewati.');
  }
  server.listen(PORT, HOST, () => {
    console.log('KerjaDesa Pro API/Web running at http://' + HOST + ':' + PORT);
  });
}

bootstrap().catch(error => {
  console.error('KerjaDesa bootstrap gagal:', error);
  process.exit(1);
});

module.exports = server;
module.exports.buildInfo = buildInfo;
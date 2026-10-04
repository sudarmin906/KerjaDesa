'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const crypto = require('crypto');

const pdfPath = process.argv[2] || process.env.DRP_TEST_PDF;
if (!pdfPath) {
  console.error('DRP integration test requires a real PDF path: DRP_TEST_PDF=/path/to/DRP.pdf');
  process.exit(2);
}
if (!fs.existsSync(pdfPath)) throw new Error('DRP test PDF tidak ditemukan: ' + pdfPath);

const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'drp-golden.manifest.json'), 'utf8'));
const pdf = fs.readFileSync(pdfPath);
const sha256 = crypto.createHash('sha256').update(pdf).digest('hex');

assert.equal(pdf.length, manifest.bytes, 'Golden PDF byte size mismatch');
assert.equal(sha256, manifest.sha256, 'Golden PDF SHA-256 mismatch; wrong DRP file supplied');
assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-', 'PDF signature invalid');

const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
const pages = Number((info.match(/^Pages:\s+(\d+)$/m) || [])[1] || 0);
assert.equal(pages, manifest.pages, 'Expected the real September 2026 DRP to contain 5 pages');

const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' })
  .replace(/\u0000/g, ' ')
  .trim();
assert.ok(text.length > 0, 'PDF extractor returned empty text');
assert.match(text, new RegExp('Total Laporan Aktivitas\\s+' + manifest.declaredActivities + '\\s+laporan', 'i'));
assert.match(text, new RegExp('Total Laporan Kunjungan Lapangan\\s+' + manifest.declaredFieldVisits + '\\s+laporan', 'i'));

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('function cleanText(t)');
const end = html.indexOf('function kdAuditDrp', start);
assert.ok(start >= 0 && end > start, 'Frontend DRP parser functions not found');
const parserCode = html.slice(start, end);
const parseDRP = new Function(parserCode + '; return parseDRP;')();
const parsed = parseDRP(text);

assert.equal(parsed.count, manifest.total);
assert.equal(parsed.aktivitas.length, manifest.declaredActivities);
assert.equal(parsed.kunlap.length, manifest.declaredFieldVisits);
assert.equal(Number(parsed.header.totalLaporan), manifest.total);
assert.equal(parsed.diagnostics.declaredActivities, manifest.declaredActivities);
assert.equal(parsed.diagnostics.parsedActivities, manifest.declaredActivities);
assert.equal(parsed.diagnostics.declaredFieldVisits, manifest.declaredFieldVisits);
assert.equal(parsed.diagnostics.parsedFieldVisits, manifest.declaredFieldVisits);
assert.equal(parsed.diagnostics.declaredTotal, manifest.total);
assert.equal(parsed.diagnostics.parsedTotal, manifest.total);
assert.equal(parsed.diagnostics.totalDelta, 0);

const port = 4397;
const child = spawn(process.execPath, [path.join(root, 'backend', 'server.js')], {
  cwd: root,
  env: { ...process.env, PORT: String(port), ADMIN_PASSWORD: 'ci-golden-password-2026' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
child.stdout.on('data', b => { serverLog += b.toString(); });
child.stderr.on('data', b => { serverLog += b.toString(); });

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/api/health');
      if (r.ok) return;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Golden test server did not become ready.\\n' + serverLog);
}

function cookieParts(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie') || ''];
  return values.filter(Boolean);
}

function cookieValue(setCookies, name) {
  const row = setCookies.find(x => x.startsWith(name + '='));
  return row ? row.slice(name.length + 1).split(';')[0] : '';
}

(async () => {
  try {
    await waitForServer();

    const versionResponse = await fetch('http://127.0.0.1:' + port + '/api/version');
    const version = await versionResponse.json();
    assert.equal(version.success, true);
    assert.equal(version.app, 'KerjaDesa Pro');

    const loginResponse = await fetch('http://127.0.0.1:' + port + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'ci-golden-password-2026' })
    });
    assert.equal(loginResponse.status, 200);
    const login = await loginResponse.json();
    assert.equal(login.success, true);
    assert.ok(login.csrf_token);

    const setCookies = cookieParts(loginResponse);
    const sessionCookieName = setCookies.find(x => x.includes('__Host-kd_session='))
      ? '__Host-kd_session'
      : 'kd_session';
    const csrfCookieName = setCookies.find(x => x.includes('__Host-kd_csrf='))
      ? '__Host-kd_csrf'
      : 'kd_csrf';
    const sessionCookie = cookieValue(setCookies, sessionCookieName);
    const csrfCookie = cookieValue(setCookies, csrfCookieName);
    assert.ok(sessionCookie, 'Session cookie missing');
    assert.ok(csrfCookie, 'CSRF cookie missing');

    const cookieHeader = sessionCookieName + '=' + sessionCookie + '; ' + csrfCookieName + '=' + csrfCookie;
    const extractResponse = await fetch('http://127.0.0.1:' + port + '/api/drp/extract-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        'Accept': 'application/json',
        'Cookie': cookieHeader,
        'X-CSRF-Token': login.csrf_token
      },
      body: pdf
    });
    const extracted = await extractResponse.json();
    assert.equal(extractResponse.status, 200, JSON.stringify(extracted));
    assert.equal(extracted.success, true);
    assert.equal(extracted.pages, manifest.pages);
    assert.ok(extracted.text && extracted.text.length > 0);
    assert.ok(['pdftotext', 'pdf-parse'].includes(extracted.extractor));

    const parsedFromServerText = parseDRP(extracted.text);
    assert.equal(parsedFromServerText.count, manifest.total);
    assert.equal(parsedFromServerText.aktivitas.length, manifest.declaredActivities);
    assert.equal(parsedFromServerText.kunlap.length, manifest.declaredFieldVisits);

    console.log(JSON.stringify({
      test: 'DRP real PDF extraction + real server endpoint + frontend parser',
      pdf: path.basename(pdfPath),
      bytes: pdf.length,
      pages: extracted.pages,
      extractor: extracted.extractor,
      text_chars: extracted.text.length,
      total: parsedFromServerText.count,
      aktivitas: parsedFromServerText.aktivitas.length,
      kunjungan_lapangan: parsedFromServerText.kunlap.length,
      status: 'PASS'
    }, null, 2));
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve => child.once('exit', resolve));
  }
})().catch(error => {
  child.kill('SIGTERM');
  console.error(error);
  process.exit(1);
});

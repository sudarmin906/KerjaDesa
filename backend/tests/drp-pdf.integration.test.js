'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const crypto = require('crypto');

const pdfPath = process.argv[2] || process.env.DRP_TEST_PDF;
if (!pdfPath) {
  console.error('DRP integration test requires a real PDF path: DRP_TEST_PDF=/path/to/DRP.pdf');
  process.exit(2);
}
if (!fs.existsSync(pdfPath)) throw new Error('DRP test PDF tidak ditemukan: ' + pdfPath);

const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'drp-golden.manifest.json'), 'utf8'));
const sha256 = crypto.createHash('sha256').update(pdf).digest('hex');
assert.equal(pdf.length, manifest.bytes, 'Golden PDF byte size mismatch');
assert.equal(sha256, manifest.sha256, 'Golden PDF SHA-256 mismatch; wrong DRP file supplied');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pdf = fs.readFileSync(pdfPath);
assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-', 'PDF signature invalid');

const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
const pages = Number((info.match(/^Pages:\s+(\d+)$/m) || [])[1] || 0);
assert.equal(pages, manifest.pages, 'Expected the real September 2026 DRP to contain 5 pages');

const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' }).replace(/\u0000/g, ' ').trim();
assert.ok(text.length > 0, 'PDF extractor returned empty text');
assert.match(text, new RegExp('Total Laporan Aktivitas\\s+'+manifest.declaredActivities+'\\s+laporan','i'));
assert.match(text, new RegExp('Total Laporan Kunjungan Lapangan\\s+'+manifest.declaredFieldVisits+'\\s+laporan','i'));

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

console.log(JSON.stringify({
  test: 'DRP real PDF extraction + frontend parser',
  pdf: path.basename(pdfPath),
  bytes: pdf.length,
  pages,
  extractor: 'pdftotext',
  text_chars: text.length,
  total: parsed.count,
  aktivitas: parsed.aktivitas.length,
  kunjungan_lapangan: parsed.kunlap.length,
  status: 'PASS'
}, null, 2));

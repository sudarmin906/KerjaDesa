'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const pdfPath = process.argv[2] || process.env.DRP_TEST_PDF;
if (!pdfPath) {
  console.error('DRP integration test requires a real PDF path: DRP_TEST_PDF=/path/to/DRP.pdf');
  process.exit(2);
}
if (!fs.existsSync(pdfPath)) throw new Error('DRP test PDF tidak ditemukan: ' + pdfPath);

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pdf = fs.readFileSync(pdfPath);
assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-', 'PDF signature invalid');

const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
const pages = Number((info.match(/^Pages:\s+(\d+)$/m) || [])[1] || 0);
assert.equal(pages, 5, 'Expected the real September 2026 DRP to contain 5 pages');

const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' }).replace(/\u0000/g, ' ').trim();
assert.ok(text.length > 0, 'PDF extractor returned empty text');
assert.match(text, /Total Laporan Aktivitas\s+7\s+laporan/i);
assert.match(text, /Total Laporan Kunjungan Lapangan\s+17\s+laporan/i);

const start = html.indexOf('function cleanText(t)');
const end = html.indexOf('function kdAuditDrp', start);
assert.ok(start >= 0 && end > start, 'Frontend DRP parser functions not found');
const parserCode = html.slice(start, end);
const parseDRP = new Function(parserCode + '; return parseDRP;')();
const parsed = parseDRP(text);

assert.equal(parsed.count, 24);
assert.equal(parsed.aktivitas.length, 7);
assert.equal(parsed.kunlap.length, 17);
assert.equal(Number(parsed.header.totalLaporan), 24);

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

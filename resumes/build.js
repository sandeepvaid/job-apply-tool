#!/usr/bin/env node
/**
 * Renders each resume in resumes/content/*.json to PDF via headless Chrome,
 * auto-fitting content to exactly ONE full A4 page (binary-searched zoom).
 * Zero npm dependencies.
 *
 * Usage:
 *   node resumes/build.js            build all variants
 *   node resumes/build.js data       build one variant
 *
 * Content is edited in the UI's "Editor" tab (or directly in content/*.json).
 * resumes/variants.js is the original seed and is no longer read by the build.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { renderHTML } = require('./render');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CONTENT_DIR = path.join(__dirname, 'content');
const OUT_HTML = path.join(__dirname, 'html');
const OUT_PDF = path.join(__dirname, 'pdf');
fs.mkdirSync(OUT_HTML, { recursive: true });
fs.mkdirSync(OUT_PDF, { recursive: true });

function buildPdf(content, zoom, htmlPath, pdfPath) {
  fs.writeFileSync(htmlPath, renderHTML(content, zoom));
  execFileSync(CHROME, [
    '--headless', '--disable-gpu', '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`, `file://${htmlPath}`,
  ], { stdio: 'pipe' });
}

function pageCount(pdfPath) {
  const raw = fs.readFileSync(pdfPath).toString('latin1');
  const counts = [...raw.matchAll(/\/Count (\d+)/g)].map(m => +m[1]);
  return counts.length ? Math.max(...counts) : 1;
}

// Auto-fit: largest zoom that still fits on one page -> no blank bottom space.
function buildVariant(id) {
  const content = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, `${id}.json`), 'utf8'));
  const htmlPath = path.join(OUT_HTML, `${content.file}.html`);
  const pdfPath = path.join(OUT_PDF, `${content.file}.pdf`);

  let lo = 0.85, hi = 1.25;
  buildPdf(content, lo, htmlPath, pdfPath);
  if (pageCount(pdfPath) > 1) throw new Error(`${id}: content overflows even at zoom ${lo} — trim some bullets`);
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2;
    buildPdf(content, mid, htmlPath, pdfPath);
    if (pageCount(pdfPath) === 1) lo = mid; else hi = mid;
  }
  buildPdf(content, lo, htmlPath, pdfPath);
  return { id, pdf: pdfPath, zoom: +lo.toFixed(3), pages: pageCount(pdfPath) };
}

function listVariants() {
  return fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
}

if (require.main === module) {
  const only = process.argv[2];
  for (const id of listVariants()) {
    if (only && id !== only) continue;
    const r = buildVariant(id);
    console.log(`built ${r.pdf} (zoom ${r.zoom}, ${r.pages} page)`);
  }
}

module.exports = { buildVariant, listVariants };

#!/usr/bin/env node
/**
 * Bootstraps/refreshes scraper/companies.json from every CSV in output/.
 * Each job URL reveals the company's public job-board slug — so the 6figr
 * export doubles as a directory of ~450 boards we can scrape directly.
 *
 * Usage: node scraper/extract-companies.js
 * Safe to re-run any time: merges new companies, never removes existing ones.
 */
const fs = require('fs');
const path = require('path');
const { parseCSV } = require('../matcher/match');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'companies.json');

const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const byKey = new Map(existing.map(c => [c.ats + ':' + c.slug, c]));

function parseUrl(url, company) {
  let m;
  if ((m = url.match(/(?:job-boards|boards)\.greenhouse\.io\/([^/?#]+)/)))
    return { ats: 'greenhouse', slug: m[1], name: company };
  if ((m = url.match(/jobs\.lever\.co\/([^/?#]+)/)))
    return { ats: 'lever', slug: m[1], name: company };
  if ((m = url.match(/jobs\.ashbyhq\.com\/([^/?#]+)/)))
    return { ats: 'ashby', slug: m[1], name: company };
  if ((m = url.match(/ats\.rippling\.com\/([^/?#]+)/)))
    return { ats: 'rippling', slug: m[1], name: company };
  if ((m = url.match(/^https:\/\/([^.]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:([a-zA-Z]{2}-[a-zA-Z]{2})\/)?([^/?#]+)\/job\//)))
    return { ats: 'workday', slug: m[1], name: company, wd: m[2], site: m[4] };
  return null;
}

let added = 0, scanned = 0;
for (const file of fs.readdirSync(path.join(ROOT, 'output')).filter(f => f.endsWith('.csv'))) {
  const rows = parseCSV(fs.readFileSync(path.join(ROOT, 'output', file), 'utf8'));
  const header = rows[0];
  const iUrl = header.indexOf('url'), iCompany = header.indexOf('company');
  for (const r of rows.slice(1)) {
    if (r.length !== header.length) continue;
    scanned++;
    const c = parseUrl(r[iUrl] || '', r[iCompany] || '');
    if (!c) continue;
    const key = c.ats + ':' + c.slug;
    if (!byKey.has(key)) { byKey.set(key, c); added++; }
  }
}

const companies = [...byKey.values()].sort((a, b) =>
  a.ats.localeCompare(b.ats) || a.slug.localeCompare(b.slug));
fs.writeFileSync(OUT, JSON.stringify(companies, null, 2));

const byAts = {};
companies.forEach(c => { byAts[c.ats] = (byAts[c.ats] || 0) + 1; });
console.log(`scanned ${scanned} rows, added ${added} new companies -> ${companies.length} total`);
console.log(Object.entries(byAts).map(([k, v]) => `  ${k}: ${v}`).join('\n'));

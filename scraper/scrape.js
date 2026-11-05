#!/usr/bin/env node
/**
 * Daily job scraper — no AI, no tokens, no auth. Hits the PUBLIC json APIs of
 * each company job board in scraper/companies.json (bootstrapped from your
 * 6figr CSVs by extract-companies.js), filters to India/remote, dedupes
 * against everything seen before (scraper/seen.json), and writes a fresh
 *   output/scraped-YYYY-MM-DD.csv
 * in the same schema as fetch-jobs.js — so the UI picks it up automatically.
 *
 * Usage: node scraper/scrape.js
 * Progress is streamed to scraper/progress.json (polled by the UI).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const CONFIG = require('./config.json');
const COMPANIES = require('./companies.json');
const SEEN_PATH = path.join(__dirname, 'seen.json');
const PROGRESS_PATH = path.join(__dirname, 'progress.json');
const OUT_DIR = path.join(ROOT, 'output');

const KEYWORDS = CONFIG.locationKeywords.map(k => k.toLowerCase());
const EXCLUDE = (CONFIG.excludeLocationKeywords || []).map(k => k.toLowerCase());

// ---------- small utils ------------------------------------------------------
const stripHtml = (html) => (html || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').trim();

// greenhouse double-escapes its HTML content
const unescapeHtml = (s) => (s || '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const jobId = (url) => crypto.createHash('sha1').update(url).digest('hex').slice(0, 24);

const locationOk = (loc, isRemote) => {
  const l = (loc || '').toLowerCase();
  if (KEYWORDS.some(k => l.includes(k))) return true;           // explicitly India
  // remote/unlocated jobs pass only if no non-India region is named
  if ((isRemote || l.includes('remote')) && !EXCLUDE.some(k => l.includes(k))) return true;
  return false;
};

async function get(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), CONFIG.requestTimeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (job-finder-apply personal tool)' },
      ...opts,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

// ---------- per-ATS fetchers: return normalized rows -------------------------
// row: { title, company, location, ats, jobPostedDate, url, description }

async function greenhouse(c) {
  const data = await get(`https://boards-api.greenhouse.io/v1/boards/${c.slug}/jobs?content=true`);
  return (data.jobs || []).slice(0, CONFIG.maxJobsPerBoard)
    .filter(j => locationOk(j.location && j.location.name))
    .map(j => ({
      title: j.title, company: c.name, location: j.location && j.location.name,
      ats: 'greenhouse', jobPostedDate: j.updated_at || '',
      url: j.absolute_url, description: stripHtml(unescapeHtml(j.content)),
    }));
}

async function lever(c) {
  const data = await get(`https://api.lever.co/v0/postings/${c.slug}?mode=json`);
  return (Array.isArray(data) ? data : []).slice(0, CONFIG.maxJobsPerBoard)
    .filter(j => locationOk(j.categories && j.categories.location,
      /remote/i.test((j.workplaceType || '') + (j.categories?.location || ''))))
    .map(j => ({
      title: j.text, company: c.name, location: j.categories && j.categories.location,
      ats: 'lever', jobPostedDate: j.createdAt ? new Date(j.createdAt).toISOString() : '',
      url: j.hostedUrl, description: stripHtml(j.descriptionPlain || j.description || ''),
    }));
}

async function ashby(c) {
  const data = await get(`https://api.ashbyhq.com/posting-api/job-board/${c.slug}`);
  return (data.jobs || []).slice(0, CONFIG.maxJobsPerBoard)
    .filter(j => locationOk(
      [j.location, ...(j.secondaryLocations || []).map(s => s.location)].filter(Boolean).join('; '),
      j.isRemote))
    .map(j => ({
      title: j.title, company: c.name, location: j.location,
      ats: 'ashby', jobPostedDate: j.publishedAt || '',
      url: j.jobUrl || j.applyUrl, description: stripHtml(j.descriptionPlain || j.descriptionHtml || ''),
    }));
}

async function rippling(c) {
  const data = await get(`https://api.rippling.com/platform/api/ats/v1/board/${c.slug}/jobs`);
  return (Array.isArray(data) ? data : []).slice(0, CONFIG.maxJobsPerBoard)
    .filter(j => {
      const locs = (j.workLocations || (j.workLocation ? [j.workLocation] : []))
        .map(l => l.label || l.name || '').join('; ');
      return locationOk(locs, /remote/i.test(locs));
    })
    .map(j => ({
      title: j.name, company: c.name,
      location: (j.workLocations || (j.workLocation ? [j.workLocation] : []))
        .map(l => l.label || l.name || '').join('; '),
      ats: 'rippling', jobPostedDate: '',
      url: j.url, description: '', // board API has no description; matcher uses title
    }));
}

async function workday(c) {
  const base = `https://${c.slug}.${c.wd}.myworkdayjobs.com/wday/cxs/${c.slug}/${c.site}`;
  const post = (offset) => get(`${base}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ limit: 20, offset, searchText: '', appliedFacets: {} }),
  });

  const first = await post(0);
  const total = Math.min(first.total || 0, CONFIG.maxJobsPerBoard);
  let postings = first.jobPostings || [];
  for (let off = 20; off < total; off += 20) {
    postings = postings.concat((await post(off)).jobPostings || []);
  }
  const matches = postings.filter(j => locationOk(j.locationsText));

  // descriptions need one request per job — cap them
  const rows = [];
  for (const j of matches.slice(0, CONFIG.workdayMaxDetailFetches)) {
    try {
      const d = await get(base + j.externalPath);
      const info = d.jobPostingInfo || {};
      rows.push({
        title: j.title, company: c.name, location: info.location || j.locationsText,
        ats: 'workday', jobPostedDate: info.startDate || '',
        url: info.externalUrl || `https://${c.slug}.${c.wd}.myworkdayjobs.com/${c.site}${j.externalPath}`,
        description: stripHtml(info.jobDescription || ''),
      });
    } catch { /* single job failed; keep going */ }
  }
  return rows;
}

const FETCHERS = { greenhouse, lever, ashby, rippling, workday };

// ---------- progress + seen --------------------------------------------------
const progress = {
  running: true, done: 0, total: COMPANIES.length, found: 0, errors: 0,
  startedAt: new Date().toISOString(), finishedAt: null, csv: null,
  source: process.env.FETCH_SOURCE || 'scraper',
  stage: process.env.FETCH_STAGE_NAME || 'scraper',
  stageIndex: +(process.env.FETCH_STAGE_INDEX || 1),
  stageCount: +(process.env.FETCH_STAGE_COUNT || 1),
};
const writeProgress = () => fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress));

function loadSeen() {
  if (fs.existsSync(SEEN_PATH)) return JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8'));
  // first run: seed with every URL already in output/ so day 1 only surfaces NEW jobs
  const seen = {};
  const today = new Date().toISOString().slice(0, 10);
  for (const f of fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.csv'))) {
    for (const m of fs.readFileSync(path.join(OUT_DIR, f), 'utf8').matchAll(/https?:\/\/[^\s,"]+/g)) {
      seen[m[0]] = today;
    }
  }
  return seen;
}

// ---------- main -------------------------------------------------------------
const COLUMNS = ['relevancyScore', 'title', 'company', 'location', 'experienceLevel',
  'salaryMin', 'salaryMax', 'salaryCurrency', 'status', 'autoApplied', 'ats',
  'jobPostedDate', 'url', 'companyWebsite', 'companyLinkedin', 'id', 'description'];

const toCsvRow = (r) => COLUMNS.map(col => csvCell({
  relevancyScore: '', experienceLevel: '', salaryMin: '', salaryMax: '',
  salaryCurrency: '', status: 'SCRAPED', autoApplied: 'false',
  companyWebsite: '', companyLinkedin: '', id: jobId(r.url),
  ...r,
}[col])).join(',');

async function main() {
  // --limit N: only scrape the first N boards (testing); --dry: don't persist seen/csv
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg !== -1 ? +process.argv[limitArg + 1] : Infinity;
  const dry = process.argv.includes('--dry');

  const queue = COMPANIES.slice(0, limit);
  progress.total = queue.length;
  writeProgress();
  const seen = loadSeen();
  const today = new Date().toISOString().slice(0, 10);
  const fresh = [];
  async function worker() {
    while (queue.length) {
      const c = queue.shift();
      try {
        const rows = await FETCHERS[c.ats](c);
        for (const r of rows) {
          if (!r.url || seen[r.url]) continue;
          seen[r.url] = today;
          fresh.push(r);
          progress.found++;
        }
      } catch { progress.errors++; }
      progress.done++;
      if (progress.done % 10 === 0) writeProgress();
    }
  }
  await Promise.all(Array.from({ length: CONFIG.concurrency }, worker));

  if (dry) {
    progress.running = false; progress.finishedAt = new Date().toISOString(); writeProgress();
    console.log(`[dry] ${progress.found} new jobs from ${progress.done} boards (${progress.errors} failed)`);
    fresh.slice(0, 10).forEach(r => console.log(`  [${r.ats}] ${r.title} @ ${r.company} — ${r.location}`));
    return;
  }

  // write/merge today's CSV (re-runs on the same day append new finds)
  const outFile = path.join(OUT_DIR, `scraped-${today}.csv`);
  let lines = [];
  if (fs.existsSync(outFile)) {
    lines = fs.readFileSync(outFile, 'utf8').split('\n').slice(1).filter(Boolean);
  }
  lines = lines.concat(fresh.map(toCsvRow));
  fs.writeFileSync(outFile, [COLUMNS.join(','), ...lines].join('\n'));
  fs.writeFileSync(SEEN_PATH, JSON.stringify(seen));

  progress.running = false;
  progress.finishedAt = new Date().toISOString();
  progress.csv = path.basename(outFile);
  writeProgress();
  console.log(`done: ${progress.found} new jobs (${progress.errors} boards failed) -> ${outFile}`);
}

main().catch(err => {
  progress.running = false;
  progress.finishedAt = new Date().toISOString();
  progress.error = err.message;
  writeProgress();
  console.error('scrape failed:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * job-finder-apply — nextraise.ai fetcher
 * Pulls matched jobs from nextraise.ai's board API and writes a CSV whose
 * columns match the 6figr pipeline (matcher/match.js -> loadJobsCSV), so the
 * results drop straight into the same Jobs UI.
 *
 * Usage:
 *   node fetch-nextraise.js
 *
 * Auth + filters live in nextraise-config.json:
 *   { sessionToken, pageSize, query: { roleKeywords[], country, level } }
 * When the session token expires, grab a fresh __Secure-next-auth.session-token
 * cookie from the site's request headers and update it there.
 *
 * Filters can be overridden per-run via env (the UI does this):
 *   NEXTRAISE_ROLE_KEYWORDS  comma-separated
 *   NEXTRAISE_COUNTRY
 *   NEXTRAISE_LEVEL
 */

const fs = require('fs');
const path = require('path');

const API = 'https://nextraise.ai/api/board/jobs';
const MAX_PAGES = 100;       // safety cap (server caps total at ~500 anyway)

const config = require('./nextraise-config.json');

// Env overrides let the UI drive the filters without editing the file.
const roleKeywords = (process.env.NEXTRAISE_ROLE_KEYWORDS
  ? process.env.NEXTRAISE_ROLE_KEYWORDS.split(',')
  : config.query.roleKeywords || []
).map(s => s.trim()).filter(Boolean);
const country = process.env.NEXTRAISE_COUNTRY || config.query.country || '';
const level = process.env.NEXTRAISE_LEVEL || config.query.level || '';
const pageSize = +(config.pageSize || 50);

const PROGRESS_PATH = path.join(__dirname, 'scraper', 'progress.json');
const progress = {
  running: true, done: 0, total: null, found: 0, errors: 0,
  startedAt: new Date().toISOString(), finishedAt: null, csv: null,
  source: process.env.FETCH_SOURCE || 'nextraise',
  stage: process.env.FETCH_STAGE_NAME || 'nextraise',
  stageIndex: +(process.env.FETCH_STAGE_INDEX || 1),
  stageCount: +(process.env.FETCH_STAGE_COUNT || 1),
};
const writeProgress = () => fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress));

// Columns match matcher/match.js loadJobsCSV so the UI can score+render these.
const COLUMNS = [
  ['relevancyScore', j => j.match && j.match.overall],       // nextraise's own match %
  ['title', j => j.title],
  ['company', j => j.company],
  ['location', j => j.location],
  ['experienceLevel', j => j.level],
  ['salaryMin', () => ''],
  ['salaryMax', () => ''],
  ['salaryCurrency', () => ''],
  ['status', () => ''],
  ['autoApplied', () => ''],
  ['ats', j => j.applyUrlSource || j.sourceId || ''],
  ['jobPostedDate', j => j.postedAt],
  ['url', j => j.applyUrl],
  ['companyWebsite', j => j.companyLogoUrl || ''],
  ['companyLinkedin', () => ''],
  ['id', j => j.id],
  ['matchLabel', j => j.match && j.match.label],
  ['matchedSkills', j => (j.match && j.match.matchedSkills || []).join('; ')],
  ['missingSkills', j => (j.match && j.match.missingSkills || []).join('; ')],
  // Synthesized so the regex matcher + YoE parser have text to work on.
  ['description', j => buildDescription(j)],
];

const buildDescription = (j) => {
  const m = j.match || {};
  const parts = [
    j.title,
    j.employmentType ? j.employmentType.replace(/_/g, ' ') : '',
    j.remoteMode ? `${j.remoteMode} role` : '',
    j.experience ? `${j.experience} experience` : '',
    j.sector ? `sector: ${j.sector}` : '',
    m.matchedSkills && m.matchedSkills.length ? `Skills: ${m.matchedSkills.join(', ')}.` : '',
    m.missingSkills && m.missingSkills.length ? `Also needs: ${m.missingSkills.join(', ')}.` : '',
  ];
  return parts.filter(Boolean).join('. ').replace(/\s+/g, ' ').trim();
};

const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const buildUrl = (page) => {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  if (roleKeywords.length) params.set('roleKeywords', roleKeywords.join(','));
  if (country) params.set('country', country);
  if (level) params.set('level', level);
  return `${API}?${params.toString()}`;
};

const fetchPage = async (page) => {
  const res = await fetch(buildUrl(page), {
    headers: {
      'Accept': 'application/json',
      'Referer': 'https://nextraise.ai/jobs',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
      'Cookie': `__Secure-next-auth.session-token=${config.sessionToken}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} on page ${page}: ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  return json;
};

const main = async () => {
  writeProgress();
  const byId = new Map();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await fetchPage(page);
    const jobs = data.jobs || [];
    if (jobs.length === 0) break;

    let fresh = 0;
    for (const job of jobs) {
      if (!byId.has(job.id)) { byId.set(job.id, job); fresh++; }
    }
    console.log(`page ${page}: ${jobs.length} jobs (${fresh} new) — total ${byId.size}/${data.total}`);
    progress.done = page;
    progress.total = data.total || null;
    progress.found = byId.size;
    writeProgress();

    if (!data.hasMore) break;
    if (fresh === 0) break; // list wrapped / all dupes
  }

  const rows = [...byId.values()];
  rows.sort((a, b) => ((b.match && b.match.overall) || 0) - ((a.match && a.match.overall) || 0));

  const header = COLUMNS.map(([name]) => name).join(',');
  const lines = rows.map(job => COLUMNS.map(([, extract]) => csvCell(extract(job))).join(','));
  const csv = [header, ...lines].join('\n');

  const stamp = new Date().toISOString().slice(0, 10);
  const outFile = path.join(__dirname, 'output', `nextraise-${stamp}.csv`);
  if (fs.existsSync(outFile)) {
    fs.copyFileSync(outFile, outFile.replace(/\.csv$/, `.bak-${Date.now()}.csv`));
  }
  fs.writeFileSync(outFile, csv);
  console.log(`\nWrote ${rows.length} jobs to ${outFile}`);

  progress.running = false;
  progress.finishedAt = new Date().toISOString();
  progress.csv = path.basename(outFile);
  writeProgress();
};

main().catch((err) => {
  progress.running = false;
  progress.finishedAt = new Date().toISOString();
  progress.error = err.message;
  writeProgress();
  console.error('Failed:', err.message);
  process.exit(1);
});

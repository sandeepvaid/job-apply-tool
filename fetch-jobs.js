#!/usr/bin/env node
/**
 * job-finder-apply
 * Fetches all matched jobs from 6figr.com for your job hunt and writes a CSV
 * you can use to apply. No external dependencies (Node 18+ global fetch).
 *
 * Usage:
 *   node fetch-jobs.js
 *
 * Config lives in config.json (authToken, jobHuntId, filters). When the token
 * expires, grab a fresh one from the site's request headers and update it there.
 */

const fs = require('fs');
const path = require('path');

const API = 'https://6figr.com/api/v1/jobs/match';
const PAGE_LIMIT = 10;      // server ignores this and returns ~20; kept to mirror the site
const MAX_PAGES = 500;      // safety cap so a bad response can't loop forever

const config = require('./config.json');

const PROGRESS_PATH = path.join(__dirname, 'scraper', 'progress.json');
const progress = {
  running: true, done: 0, total: null, found: 0, errors: 0,
  startedAt: new Date().toISOString(), finishedAt: null, csv: null,
  source: process.env.FETCH_SOURCE || '6figr',
  stage: process.env.FETCH_STAGE_NAME || '6figr',
  stageIndex: +(process.env.FETCH_STAGE_INDEX || 1),
  stageCount: +(process.env.FETCH_STAGE_COUNT || 1),
};
const writeProgress = () => fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress));

// Columns written to the CSV, in order. [header, extractor(job)].
const COLUMNS = [
  ['relevancyScore', j => j.relevancyScore],
  ['title', j => j.title],
  ['company', j => j.company && j.company.name],
  ['location', j => j.location],
  ['experienceLevel', j => j.experienceLevel],
  ['salaryMin', j => j.salaryMin],
  ['salaryMax', j => j.salaryMax],
  ['salaryCurrency', j => j.salaryCurrency],
  ['status', j => j.status],
  ['autoApplied', j => j.autoApplied],
  ['ats', j => j.ats],
  ['jobPostedDate', j => j.jobPostedDate],
  ['url', j => j.url],
  ['companyWebsite', j => j.company && j.company.website_url],
  ['companyLinkedin', j => j.company && j.company.linkedin_url],
  ['id', j => j.id],
  ['description', j => stripHtml(j.description)],
];

const stripHtml = (html) =>
  (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const fetchPage = async (page) => {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': config.authToken,
      'Content-Type': 'application/json',
      'Origin': 'https://6figr.com',
    },
    body: JSON.stringify({
      page,
      limit: PAGE_LIMIT,
      filters: config.filters,
      jobHuntId: config.jobHuntId,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} on page ${page}: ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  if (!json.success) throw new Error(`API returned success=false on page ${page}`);
  return json.data.jobs || [];
};

const main = async () => {
  writeProgress();
  const byId = new Map();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const jobs = await fetchPage(page);
    if (jobs.length === 0) break;

    let fresh = 0;
    for (const job of jobs) {
      if (!byId.has(job.id)) { byId.set(job.id, job); fresh++; }
    }
    console.log(`page ${page}: ${jobs.length} jobs (${fresh} new) — total ${byId.size}`);
    progress.done = page;
    progress.found = byId.size;
    writeProgress();

    // If a whole page was already-seen duplicates, the list has wrapped; stop.
    if (fresh === 0) break;
  }

  const rows = [...byId.values()];
  // Most relevant first.
  rows.sort((a, b) => (b.relevancyScore || 0) - (a.relevancyScore || 0));

  const header = COLUMNS.map(([name]) => name).join(',');
  const lines = rows.map(job =>
    COLUMNS.map(([, extract]) => csvCell(extract(job))).join(',')
  );
  const csv = [header, ...lines].join('\n');

  const stamp = new Date().toISOString().slice(0, 10);
  const outFile = path.join(__dirname, 'output', `jobs-${stamp}.csv`);
  // Guard against a thin/short-lived API response clobbering a fuller earlier
  // fetch from the same day — back up instead of silently overwriting.
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

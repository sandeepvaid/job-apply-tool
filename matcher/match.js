/**
 * Pure-JS job matcher. No LLM, no network — safe to run forever for free.
 *
 * matchJob(job) -> {
 *   skip:    null | { reason }              hard disqualifier fired
 *   warn:    null | string                  soft seniority warning
 *   cluster: { id, name, pdf } | null       best resume variant
 *   score:   number                         raw cluster score
 *   matched: string[]                       keywords that fired (for the UI)
 * }
 */
const { TITLE_SKIPS, DESC_SKIPS, REQUIRED_PHRASE, CLUSTERS, SENIORITY_WARN } = require('./rules');

function matchJob(job) {
  const title = job.title || '';
  const desc = job.description || '';

  // 1. Hard skips on title
  for (const rule of TITLE_SKIPS) {
    if (rule.re.test(title)) return { skip: { reason: rule.reason }, warn: null, cluster: null, score: 0, matched: [] };
  }

  // 2. Description-based skips ("none" tech treated as required)
  for (const rule of DESC_SKIPS) {
    const hits = desc.match(rule.tech) || [];
    const required = hits.length > 0 && REQUIRED_PHRASE(rule.tech.source).test(desc);
    if (hits.length >= rule.minCount || required) {
      return { skip: { reason: rule.reason }, warn: null, cluster: null, score: 0, matched: [...new Set(hits.map(h => h.toLowerCase()))] };
    }
  }

  // 3. Soft seniority warning
  let warn = null;
  for (const rule of SENIORITY_WARN) {
    if (rule.re.test(title)) { warn = rule.warn; break; }
  }

  // 4. Score clusters: title hits x3, desc hits x1
  let best = null, bestScore = -1, bestMatched = [];
  for (const c of CLUSTERS) {
    let score = 0;
    const matched = [];
    for (const [re, w] of c.title) {
      if (re.test(title)) { score += w * 3; matched.push(`title:${re.source.slice(0, 24)}`); }
    }
    for (const [re, w] of c.desc) {
      if (re.test(desc)) { score += w; matched.push(re.source.slice(0, 24)); }
    }
    if (score > bestScore) { best = c; bestScore = score; bestMatched = matched; }
  }

  // Nothing matched at all -> generic cloud variant, low confidence
  if (bestScore <= 0) {
    const generic = CLUSTERS.find(c => c.id === 'cloud');
    return { skip: null, warn, cluster: { id: generic.id, name: generic.name, pdf: generic.pdf }, score: 0, matched: [] };
  }

  return {
    skip: null,
    warn,
    cluster: { id: best.id, name: best.name, pdf: best.pdf },
    score: bestScore,
    matched: bestMatched,
  };
}

// Minimum years-of-experience required, parsed from the description.
// Matches "5+ years", "3-5 yrs", "2 to 4 years of experience", etc.
// Returns null when nothing plausible is found (~20% of jobs).
const YOE_RE = new RegExp(
  '(\\d{1,2})(?:\\.\\d)?\\s*(?:\\+|plus)?\\s*(?:(?:[-–—~]|to)\\s*(\\d{1,2})\\s*)?\\+?\\s*(?:years?|yrs?)\\b' +
  "[^.;\\n]{0,60}?(?:experience|exp\\b|work(?:ing)?|building|develop|engineer|coding|programming|software|industry|relevant|professional|hands-on|track record|in\\b|of\\b)",
  'gi');

function extractYoe(desc) {
  for (const m of (desc || '').matchAll(YOE_RE)) {
    const v = parseInt(m[1], 10);
    if (v <= 20) return v; // >20 is company age ("for over 50 years..."), not a requirement
  }
  return null;
}

// Shared CSV parser (quoted cells, embedded newlines)
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQ = false;
      } else cell += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c !== '\r') cell += c;
    }
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function loadJobsCSV(text) {
  const rows = parseCSV(text);
  const header = rows[0];
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  return rows.slice(1)
    .filter(r => r.length === header.length)
    .map(r => ({
      id: r[idx.id],
      relevancyScore: parseFloat(r[idx.relevancyScore]) || 0,
      title: r[idx.title],
      company: r[idx.company],
      location: r[idx.location],
      experienceLevel: r[idx.experienceLevel],
      ats: r[idx.ats],
      jobPostedDate: r[idx.jobPostedDate],
      url: r[idx.url],
      companyWebsite: r[idx.companyWebsite],
      description: r[idx.description] || '',
    }));
}

module.exports = { matchJob, loadJobsCSV, parseCSV, extractYoe };

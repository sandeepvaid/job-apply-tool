#!/usr/bin/env node
/**
 * job-finder-apply UI server. Zero npm dependencies, zero LLM tokens.
 *
 * Usage: node app/server.js   ->  http://localhost:3210
 *
 * - Lists output/jobs-*.csv, scores every job with matcher/ (pure regex)
 * - "Apply" opens the job in Chrome (Simplify autofills) + reveals the
 *   matched resume PDF in Finder for drag-drop upload
 * - Applied/skipped state persisted in app/state.json
 * - Profile tab edits profile/skills.json (screening answers for questions)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { matchJob, loadJobsCSV, extractYoe } = require('../matcher/match');
const { renderHTML } = require('../resumes/render');
const { buildVariant, listVariants } = require('../resumes/build');

const ROOT = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'output');
const PDF_DIR = path.join(ROOT, 'resumes', 'pdf');
const CONTENT_DIR = path.join(ROOT, 'resumes', 'content');
const PROFILE_PATH = path.join(ROOT, 'profile', 'skills.json');
const STATE_PATH = path.join(__dirname, 'state.json');
const PORT = 3210;

// ---- state -----------------------------------------------------------------
const loadState = () => {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch { return {}; }
};
const saveState = (s) => fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));

// ---- jobs cache (per csv file) ----------------------------------------------
const jobsCache = {};
function getJobs(csvName) {
  const file = path.join(OUTPUT_DIR, path.basename(csvName)); // basename: no traversal
  const mtime = fs.statSync(file).mtimeMs;
  if (!jobsCache[file] || jobsCache[file].mtime !== mtime) {
    const jobs = loadJobsCSV(fs.readFileSync(file, 'utf8')).map(j => {
      const m = matchJob(j);
      return { ...j, match: m, yoe: extractYoe(j.description) };
    });
    jobsCache[file] = { mtime, jobs };
  }
  return jobsCache[file].jobs;
}

// ---- helpers -----------------------------------------------------------------
const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
};
const readBody = (req) => new Promise((resolve) => {
  let b = '';
  req.on('data', c => b += c);
  req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
});

// ---- server ------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  try {
    // React UI: serve app/ui/dist if built, else fall back to the legacy vanilla page
    const DIST = path.join(__dirname, 'ui', 'dist');
    if (p === '/' || p === '/index.html') {
      const file = fs.existsSync(DIST)
        ? path.join(DIST, 'index.html')
        : path.join(__dirname, 'public', 'index.html');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(fs.readFileSync(file));
    }
    if (p.startsWith('/assets/')) {
      const f = path.join(DIST, 'assets', path.basename(p));
      if (fs.existsSync(f)) {
        const mime = f.endsWith('.js') ? 'text/javascript'
          : f.endsWith('.css') ? 'text/css' : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        return res.end(fs.readFileSync(f));
      }
      return json(res, 404, { error: 'not found' });
    }

    if (p === '/api/csvs') {
      const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.csv')).sort().reverse();
      return json(res, 200, files);
    }

    if (p === '/api/jobs') {
      const csv = url.searchParams.get('csv');
      if (!csv) return json(res, 400, { error: 'csv param required' });
      const state = loadState();
      const jobs = getJobs(csv).map(j => ({
        ...j,
        description: undefined, // trimmed for list payload
        descPreview: j.description.slice(0, 1200),
        status: (state[j.id] && state[j.id].status) || null,
        note: (state[j.id] && state[j.id].note) || null,
      }));
      return json(res, 200, jobs);
    }

    // ---- job scraper --------------------------------------------------------
    const PROGRESS_PATH = path.join(ROOT, 'scraper', 'progress.json');
    const readProgress = () => {
      try { return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8')); }
      catch { return { running: false }; }
    };

    if (p === '/api/fetch-jobs' && req.method === 'POST') {
      if (readProgress().running) return json(res, 409, { error: 'fetch already running' });
      const source = url.searchParams.get('source') || '6figr';
      const CHAINS = {
        '6figr': [{ script: 'fetch-jobs.js', name: '6figr' }],
        scraper: [{ script: path.join('scraper', 'scrape.js'), name: 'scraper' }],
        nextraise: [{ script: 'fetch-nextraise.js', name: 'nextraise' }],
        both: [
          { script: 'fetch-jobs.js', name: '6figr' },
          { script: path.join('scraper', 'scrape.js'), name: 'scraper' },
        ],
      };
      const chain = CHAINS[source];
      if (!chain) return json(res, 400, { error: `unknown source "${source}"` });

      // nextraise filters can be driven from the UI; pass them via env so the
      // fetcher overrides its config.json defaults for this run only.
      const body = req.method === 'POST' ? await readBody(req) : {};
      const filterEnv = {};
      if (source === 'nextraise' && body.filters) {
        const f = body.filters;
        if (Array.isArray(f.roleKeywords)) filterEnv.NEXTRAISE_ROLE_KEYWORDS = f.roleKeywords.join(',');
        else if (typeof f.roleKeywords === 'string') filterEnv.NEXTRAISE_ROLE_KEYWORDS = f.roleKeywords;
        if (f.country) filterEnv.NEXTRAISE_COUNTRY = String(f.country);
        if (f.level) filterEnv.NEXTRAISE_LEVEL = String(f.level);
      }

      const runChain = (i) => {
        const step = chain[i];
        const child = spawn(process.execPath, [path.join(ROOT, step.script)], {
          detached: true, stdio: 'ignore', cwd: ROOT,
          env: {
            ...process.env,
            ...filterEnv,
            FETCH_SOURCE: source,
            FETCH_STAGE_NAME: step.name,
            FETCH_STAGE_INDEX: String(i + 1),
            FETCH_STAGE_COUNT: String(chain.length),
          },
        });
        child.unref();
        if (i + 1 < chain.length) child.on('exit', () => runChain(i + 1));
      };
      runChain(0);
      return json(res, 200, { started: true });
    }

    // Current nextraise filter defaults (from nextraise-config.json), so the UI
    // can pre-fill its filter inputs.
    if (p === '/api/nextraise-config' && req.method === 'GET') {
      try {
        const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'nextraise-config.json'), 'utf8'));
        return json(res, 200, cfg.query || {});
      } catch (e) {
        return json(res, 200, { roleKeywords: [], country: '', level: '' });
      }
    }

    if (p === '/api/fetch-status') {
      return json(res, 200, readProgress());
    }

    // ---- resume editor -----------------------------------------------------
    if (p === '/api/resume-content' && req.method === 'GET') {
      const id = url.searchParams.get('id');
      if (id) {
        const f = path.join(CONTENT_DIR, path.basename(id) + '.json');
        if (!fs.existsSync(f)) return json(res, 404, { error: 'unknown variant' });
        return json(res, 200, JSON.parse(fs.readFileSync(f, 'utf8')));
      }
      return json(res, 200, listVariants());
    }

    if (p === '/api/resume-content' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body.id || !body.content || !Array.isArray(body.content.jobs)) {
        return json(res, 400, { error: 'expected { id, content } with content.jobs[]' });
      }
      const f = path.join(CONTENT_DIR, path.basename(body.id) + '.json');
      if (!fs.existsSync(f)) return json(res, 404, { error: 'unknown variant' });
      fs.writeFileSync(f, JSON.stringify(body.content, null, 2));
      return json(res, 200, { ok: true });
    }

    if (p === '/api/resume-render' && req.method === 'POST') {
      // live preview: render (possibly unsaved) content to HTML
      const { content, zoom } = await readBody(req);
      if (!content) return json(res, 400, { error: 'content required' });
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(renderHTML(content, zoom || 1));
    }

    if (p === '/api/resume-build' && req.method === 'POST') {
      // auto-fit to one page + regenerate the PDF for this variant
      const { id } = await readBody(req);
      if (!id) return json(res, 400, { error: 'id required' });
      try {
        const r = buildVariant(path.basename(id));
        return json(res, 200, { ok: true, ...r, pdf: path.basename(r.pdf) });
      } catch (err) {
        return json(res, 422, { ok: false, error: err.message });
      }
    }

    if (p === '/api/state') {
      // full tracking log: { jobId: { status, title, company, at } }
      return json(res, 200, loadState());
    }

    if (p === '/api/resumes') {
      const files = fs.existsSync(PDF_DIR)
        ? fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf')).sort()
        : [];
      return json(res, 200, files);
    }

    if (p === '/api/profile' && req.method === 'GET') {
      return json(res, 200, JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf8')));
    }

    if (p === '/api/profile' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body || typeof body !== 'object' || !body.skills) {
        return json(res, 400, { error: 'invalid profile: must be JSON with a "skills" key' });
      }
      fs.writeFileSync(PROFILE_PATH, JSON.stringify(body, null, 2));
      return json(res, 200, { ok: true });
    }

    if (p === '/api/status' && req.method === 'POST') {
      const { id, status, title, company } = await readBody(req);
      if (!id) return json(res, 400, { error: 'id required' });
      const state = loadState();
      // outcome statuses require the job to have been opened first
      const OUTCOMES = ['applied', 'not_applicable', 'not_found'];
      if (OUTCOMES.includes(status)) {
        const cur = state[id] && state[id].status;
        if (!cur || cur === 'skipped') {
          return json(res, 409, { error: 'job not opened yet — click Apply first' });
        }
      }
      if (status === null) {
        // untrack: keep the entry alive if it carries a note
        if (state[id] && state[id].note) {
          const { note, noteAt, title: t, company: c } = state[id];
          state[id] = { note, noteAt, title: t, company: c };
        } else delete state[id];
      } else {
        state[id] = { ...state[id], status, title, company, at: new Date().toISOString() };
      }
      saveState(state);
      return json(res, 200, { ok: true });
    }

    if (p === '/api/note' && req.method === 'POST') {
      const { id, note, title, company } = await readBody(req);
      if (!id) return json(res, 400, { error: 'id required' });
      const state = loadState();
      const cur = state[id] || {};
      const text = (note || '').trim();
      if (!text) {
        // clearing the note: drop the entry entirely if nothing else tracked
        if (cur.status) { delete cur.note; delete cur.noteAt; state[id] = cur; }
        else delete state[id];
      } else {
        state[id] = {
          ...cur,
          title: cur.title || title,
          company: cur.company || company,
          note: text,
          noteAt: new Date().toISOString(),
        };
      }
      saveState(state);
      return json(res, 200, { ok: true });
    }

    if (p === '/api/apply' && req.method === 'POST') {
      const { id, url: jobUrl, pdf, title, company } = await readBody(req);
      if (!jobUrl || !/^https?:\/\//.test(jobUrl)) return json(res, 400, { error: 'bad url' });
      // open the job page in Chrome (where Simplify lives)
      execFile('open', ['-a', 'Google Chrome', jobUrl]);
      // reveal the matched resume PDF in Finder for the upload field
      if (pdf) {
        const pdfPath = path.join(PDF_DIR, path.basename(pdf));
        if (fs.existsSync(pdfPath)) execFile('open', ['-R', pdfPath]);
      }
      const state = loadState();
      state[id] = { ...state[id], status: 'opened', title, company, at: new Date().toISOString() };
      saveState(state);
      return json(res, 200, { ok: true });
    }

    if (p.startsWith('/resumes/')) {
      const f = path.join(PDF_DIR, path.basename(p));
      if (fs.existsSync(f)) {
        res.writeHead(200, { 'Content-Type': 'application/pdf' });
        return res.end(fs.readFileSync(f));
      }
      return json(res, 404, { error: 'not found' });
    }

    json(res, 404, { error: 'not found' });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`job-finder-apply UI -> http://localhost:${PORT}`);
});

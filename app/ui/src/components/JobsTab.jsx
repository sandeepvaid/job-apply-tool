import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const get = (o, k) => k.split('.').reduce((a, x) => (a && a[x] !== undefined && a[x] !== null ? a[x] : 0), o);

// statuses that hide a job from the default list ("done" states)
export const DONE = ['applied', 'skipped', 'not_applicable', 'not_found'];
export const STATUS_LABEL = {
  opened: 'opened', applied: 'applied', skipped: 'skipped',
  not_applicable: 'not applicable', not_found: 'job not found',
};

// free-text locations (412 variants in one CSV) normalized into filter buckets
const LOC_BUCKETS = [
  ['Remote', /remote|work from home|wfh/i],
  ['Bengaluru', /bengaluru|bangalore/i],
  ['Mumbai', /mumbai/i],
  ['Pune', /pune/i],
  ['Hyderabad', /hyderabad/i],
  ['Chennai', /chennai/i],
  ['Gurugram', /gurugram|gurgaon/i],
  ['Noida', /noida/i],
  ['Delhi', /delhi|\bncr\b/i],
];
const locMatches = (job, bucket) => {
  const loc = job.location || '';
  if (bucket === 'Other') return !LOC_BUCKETS.some(([, re]) => re.test(loc));
  const found = LOC_BUCKETS.find(([name]) => name === bucket);
  return found ? found[1].test(loc) : true;
};

const COLS = [
  ['match.score', 'Match'],
  ['title', 'Job'],
  ['yoe', 'YoE'],
  ['ats', 'ATS'],
  ['relevancyScore', '6figr'],
  ['jobPostedDate', 'Posted'],
  [null, 'Status / Actions'],
];

export default function JobsTab({ profile }) {
  const [csvs, setCsvs] = useState([]);
  const [csv, setCsv] = useState('');
  const [jobs, setJobs] = useState([]);
  const [q, setQ] = useState('');
  const [fCluster, setFCluster] = useState('');
  const [fAts, setFAts] = useState('');
  const [fYoe, setFYoe] = useState(''); // max years of experience ('' = any)
  const [fLoc, setFLoc] = useState('');
  const [hideSkip, setHideSkip] = useState(true);
  const [hideDone, setHideDone] = useState(true);
  const [sort, setSort] = useState({ key: 'match.score', dir: -1 });
  const [openId, setOpenId] = useState(null);
  const [scrape, setScrape] = useState(null); // progress object while running
  const [fetchSource, setFetchSource] = useState('6figr');
  // nextraise custom filters (drive the fetch query params)
  const [nrRoles, setNrRoles] = useState('');
  const [nrCountry, setNrCountry] = useState('');
  const [nrLevel, setNrLevel] = useState('mid');

  useEffect(() => {
    api.csvs().then(files => { setCsvs(files); if (files.length) setCsv(files[0]); });
    // resume progress display if a scrape is already running (e.g. page reload)
    api.fetchStatus().then(s => { if (s.running) { setScrape(s); pollScrape(); } });
    // pre-fill nextraise filters from its config defaults
    api.nextraiseConfig().then(cfg => {
      if (cfg.roleKeywords) setNrRoles((cfg.roleKeywords || []).join(', '));
      if (cfg.country) setNrCountry(cfg.country);
      if (cfg.level) setNrLevel(cfg.level);
    });
  }, []);

  const pollScrape = () => {
    const t = setInterval(async () => {
      const s = await api.fetchStatus();
      setScrape(s);
      if (!s.running) {
        clearInterval(t);
        const files = await api.csvs();
        setCsvs(files);
        if (s.csv && files.includes(s.csv)) setCsv(s.csv); // jump to today's scraped list
        setTimeout(() => setScrape(null), 8000);
      }
    }, 2000);
  };

  const startScrape = async () => {
    const filters = fetchSource === 'nextraise' ? {
      roleKeywords: nrRoles.split(',').map(s => s.trim()).filter(Boolean),
      country: nrCountry.trim(),
      level: nrLevel,
    } : undefined;
    const r = await api.fetchJobs(fetchSource, filters);
    if (r.started) {
      setScrape({
        running: true, done: 0, total: '?', found: 0,
        stage: fetchSource === 'both' ? '6figr' : fetchSource,
        stageIndex: 1, stageCount: fetchSource === 'both' ? 2 : 1,
      });
      pollScrape();
    } else if (r.error) alert(r.error);
  };
  useEffect(() => { if (csv) api.jobs(csv).then(setJobs); }, [csv]);

  const atsOptions = useMemo(() => [...new Set(jobs.map(j => j.ats))].sort(), [jobs]);
  const locOptions = useMemo(() => {
    const opts = LOC_BUCKETS.map(([name]) => [name, jobs.filter(j => locMatches(j, name)).length])
      .filter(([, n]) => n > 0);
    const other = jobs.filter(j => locMatches(j, 'Other')).length;
    if (other > 0) opts.push(['Other', other]);
    return opts;
  }, [jobs]);

  const rows = useMemo(() => jobs.filter(j => {
    if (hideSkip && j.match.skip && j.status !== 'applied') return false;
    if (hideDone && DONE.includes(j.status)) return false;
    if (fCluster && (!j.match.cluster || j.match.cluster.id !== fCluster)) return false;
    if (fAts && j.ats !== fAts) return false;
    // unknown YoE (~20% of jobs) stays visible — only filter out explicit mismatches
    if (fYoe !== '' && j.yoe !== null && j.yoe > +fYoe) return false;
    if (fLoc && !locMatches(j, fLoc)) return false;
    const hay = (j.title + ' ' + j.company + ' ' + j.location).toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    return true;
  }).sort((a, b) => (get(b, sort.key) > get(a, sort.key) ? 1 : -1) * -sort.dir), [jobs, q, fCluster, fAts, fYoe, fLoc, hideSkip, hideDone, sort]);

  const applied = jobs.filter(j => j.status === 'applied').length;
  const skippable = jobs.filter(j => j.match.skip).length;

  const patch = (id, status) => setJobs(js => js.map(j => j.id === id ? { ...j, status } : j));
  const patchNote = (id, note) => setJobs(js => js.map(j => j.id === id ? { ...j, note } : j));
  const onApply = async (e, j) => { e.stopPropagation(); await api.apply(j); patch(j.id, 'opened'); };
  const onStatus = async (e, j, s) => {
    e.stopPropagation();
    const next = j.status === s ? null : s;
    const r = await api.setStatus(j, next);
    if (r.ok) patch(j.id, next);
    else alert(r.error); // e.g. "job not opened yet — click Apply first"
  };
  const onSort = (key) => key && setSort(s => s.key === key ? { ...s, dir: -s.dir } : { key, dir: -1 });

  return (
    <section>
      <div className="bar">
        <select value={csv} onChange={e => setCsv(e.target.value)}>
          {csvs.map(f => <option key={f}>{f}</option>)}
        </select>
        <select value={fetchSource} onChange={e => setFetchSource(e.target.value)}
          disabled={!!(scrape && scrape.running)} title="where to fetch new jobs from">
          <option value="6figr">6figr API</option>
          <option value="nextraise">nextraise.ai API</option>
          <option value="scraper">Company scraper</option>
          <option value="both">Both</option>
        </select>
        <button className="b-apply" onClick={startScrape} disabled={!!(scrape && scrape.running)}>
          {scrape && scrape.running ? '⟳ Fetching…' : '⟳ Fetch jobs'}
        </button>
        {scrape && (
          <span className={'msg ' + (scrape.error ? 'err' : 'ok')}>
            {scrape.error ? 'failed: ' + scrape.error
              : scrape.running
                ? `${scrape.stageCount > 1 ? `[${scrape.stageIndex}/${scrape.stageCount}] ` : ''}` +
                  (scrape.stage === '6figr'
                    ? `fetching 6figr — page ${scrape.done}, ${scrape.found} jobs`
                    : scrape.stage === 'nextraise'
                      ? `fetching nextraise.ai — page ${scrape.done}, ${scrape.found} jobs`
                      : `scraping boards ${scrape.done}/${scrape.total} — ${scrape.found} new jobs (${scrape.errors || 0} failed)`)
                : `done: ${scrape.found} new jobs → ${scrape.csv}`}
          </span>
        )}
        <input type="text" placeholder="Search title / company / location" value={q} onChange={e => setQ(e.target.value)} />
        <select value={fCluster} onChange={e => setFCluster(e.target.value)}>
          <option value="">All variants</option>
          <option value="backend">Backend</option>
          <option value="fullstack">Full-stack</option>
          <option value="cloud">Cloud/SWE</option>
        </select>
        <select value={fAts} onChange={e => setFAts(e.target.value)}>
          <option value="">All ATS</option>
          {atsOptions.map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={fYoe} onChange={e => setFYoe(e.target.value)} title="hide jobs asking for more years than this (unknown YoE stays visible)">
          <option value="">Any YoE</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15].map(n => <option key={n} value={n}>≤ {n} yrs</option>)}
        </select>
        <select value={fLoc} onChange={e => setFLoc(e.target.value)}>
          <option value="">All locations</option>
          {locOptions.map(([name, n]) => <option key={name} value={name}>{name} ({n})</option>)}
        </select>
        <label className="chk"><input type="checkbox" checked={hideSkip} onChange={e => setHideSkip(e.target.checked)} /> hide auto-skipped</label>
        <label className="chk"><input type="checkbox" checked={hideDone} onChange={e => setHideDone(e.target.checked)} /> hide applied/skipped</label>
        <span className="stats">
          <b>{rows.length}</b> shown · <b>{jobs.length - skippable}</b> apply-able · <b>{skippable}</b> auto-skipped · <b>{applied}</b> applied
        </span>
      </div>
      {fetchSource === 'nextraise' && (
        <div className="bar">
          <span className="stats" style={{ marginLeft: 0 }}>nextraise filters:</span>
          <input type="text" style={{ minWidth: 320, flex: 1 }}
            placeholder="Role keywords (comma-separated) e.g. Full Stack Engineer, Node.js Engineer"
            value={nrRoles} onChange={e => setNrRoles(e.target.value)}
            disabled={!!(scrape && scrape.running)} />
          <input type="text" style={{ width: 140 }} placeholder="Country e.g. India"
            value={nrCountry} onChange={e => setNrCountry(e.target.value)}
            disabled={!!(scrape && scrape.running)} />
          <select value={nrLevel} onChange={e => setNrLevel(e.target.value)}
            disabled={!!(scrape && scrape.running)} title="experience level">
            <option value="">Any level</option>
            <option value="entry">Entry</option>
            <option value="junior">Junior</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
            <option value="lead">Lead</option>
          </select>
          <span className="stats" style={{ marginLeft: 0 }}>
            change filters, then click <b>Fetch jobs</b>
          </span>
        </div>
      )}
      <table>
        <thead><tr>{COLS.map(([key, label]) => <th key={label} onClick={() => onSort(key)}>{label}</th>)}</tr></thead>
        <tbody>
          {rows.map(j => (
            <JobRow key={j.id} job={j} open={openId === j.id} profile={profile}
              onToggle={() => setOpenId(openId === j.id ? null : j.id)}
              onApply={onApply} onStatus={onStatus} onNote={patchNote} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function JobRow({ job: j, open, profile, onToggle, onApply, onStatus, onNote }) {
  const m = j.match;
  const done = DONE.includes(j.status);
  // validation: until the job has been opened (Apply), outcome actions are locked
  const opened = !!j.status && j.status !== 'skipped';
  const lockTitle = opened ? undefined : 'Open the job first (Apply) before recording an outcome';
  return (
    <>
      <tr className={'row' + (done ? ' done' : '')} onClick={onToggle}>
        <td>
          {m.skip
            ? <span className="badge b-skip">{m.skip.reason}</span>
            : <>
                <span className={'badge b-' + m.cluster.id}>{m.cluster.id} · {m.score}</span>
                {m.warn && <> <span className="badge b-warn">{m.warn}</span></>}
              </>}
        </td>
        <td><div className="t">{j.title}{j.note && <span title={j.note}> 📝</span>}</div><div className="c">{j.company} — {j.location}</div></td>
        <td>{j.yoe !== null ? `${j.yoe}+` : <span className="c">—</span>}</td>
        <td><span className="badge b-ats">{j.ats}</span></td>
        <td>{Math.round(j.relevancyScore)}</td>
        <td className="c">{(j.jobPostedDate || '').slice(0, 10)}</td>
        <td>
          {j.status && <><span className={'badge b-' + j.status}>{STATUS_LABEL[j.status] || j.status}</span>{' '}</>}
          <button className="b-apply" onClick={e => onApply(e, j)}>Apply</button>{' '}
          <button className="b-mark" disabled={!opened} title={lockTitle}
            onClick={e => onStatus(e, j, 'applied')}>✓</button>{' '}
          <button className="b-na" disabled={!opened} title={lockTitle || 'not applicable'}
            onClick={e => onStatus(e, j, 'not_applicable')}>NA</button>{' '}
          <button className="b-nf" disabled={!opened} title={lockTitle || 'job not found (posting gone/404)'}
            onClick={e => onStatus(e, j, 'not_found')}>404</button>{' '}
          <button className="b-sk" title="skip (not interested)"
            onClick={e => onStatus(e, j, 'skipped')}>✗</button>
        </td>
      </tr>
      {open && <DetailRow job={j} profile={profile} onNote={onNote} />}
    </>
  );
}

function DetailRow({ job: j, profile, onNote }) {
  const answers = Object.entries(profile?.screeningAnswers || {}).filter(([k]) => k !== '_comment');
  return (
    <tr className="detail">
      <td colSpan={7}>
        <div className="inner">
          <div>
            <h4>Description</h4>
            <div className="desc">{j.descPreview}…</div>
            <div className="kws">matched: {(j.match.matched || []).slice(0, 12).join(', ') || '—'}</div>
            <div style={{ marginTop: 6 }}>
              <a href={j.url} target="_blank" rel="noreferrer">open posting ↗</a>
              {j.match.cluster && <> · resume: <a href={'/resumes/' + j.match.cluster.pdf} target="_blank" rel="noreferrer">{j.match.cluster.pdf}</a></>}
            </div>
          </div>
          <div className="side">
            <h4>Screening answers (click value to copy)</h4>
            <div className="ans">
              {answers.length === 0 && <i>fill screeningAnswers in Profile tab</i>}
              {answers.map(([k, v]) => (
                <div key={k}>
                  <span>{k}</span>
                  <span title="click to copy" onClick={() => navigator.clipboard.writeText(String(v))}>{String(v)}</span>
                </div>
              ))}
            </div>
            <h4>Notes</h4>
            <NoteBox job={j} onNote={onNote} />
          </div>
        </div>
      </td>
    </tr>
  );
}

// Editable per-job note; saved to app/state.json via /api/note.
export function NoteBox({ job, onNote }) {
  const [text, setText] = useState(job.note || '');
  const [msg, setMsg] = useState('');
  useEffect(() => { setText(job.note || ''); }, [job.id]);

  const save = async (value) => {
    const r = await api.setNote(job, value);
    if (r.ok) {
      onNote(job.id, value.trim() || null);
      setMsg('saved');
      setTimeout(() => setMsg(''), 2000);
    } else setMsg(r.error || 'failed');
  };

  return (
    <div>
      <textarea className="eta" rows={3} placeholder="Add a note about this job…"
        value={text} onChange={e => setText(e.target.value)} />
      <div className="savebar" style={{ margin: '6px 0 0' }}>
        <button className="b-apply" disabled={(text.trim() || '') === (job.note || '')}
          onClick={() => save(text)}>Save note</button>
        {job.note && <button className="b-sk" onClick={() => { setText(''); save(''); }}>Delete</button>}
        {msg && <span className={'msg ' + (msg === 'saved' ? 'ok' : 'err')}>{msg}</span>}
      </div>
    </div>
  );
}

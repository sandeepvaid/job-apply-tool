import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { STATUS_LABEL, NoteBox } from './JobsTab.jsx';

// Shows jobs you've already applied to (from app/state.json), enriched with
// url/ats/location when the job is present in the latest CSV.
export default function AppliedTab() {
  const [state, setState] = useState(null);   // { id: {status, title, company, at} }
  const [jobsById, setJobsById] = useState({});
  const [fStatus, setFStatus] = useState('applied');

  useEffect(() => {
    api.state().then(setState);
    api.csvs().then(files => {
      if (!files.length) return;
      api.jobs(files[0]).then(jobs =>
        setJobsById(Object.fromEntries(jobs.map(j => [j.id, j]))));
    });
  }, []);

  const rows = useMemo(() => {
    if (!state) return [];
    return Object.entries(state)
      .map(([id, s]) => ({ id, ...s, job: jobsById[id] }))
      .filter(r => !fStatus || r.status === fStatus)
      .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  }, [state, jobsById, fStatus]);

  const counts = useMemo(() => {
    const c = { applied: 0, opened: 0, skipped: 0, not_applicable: 0, not_found: 0 };
    Object.values(state || {}).forEach(s => { if (c[s.status] !== undefined) c[s.status]++; });
    return c;
  }, [state]);

  const setStatus = async (r, status) => {
    const target = { id: r.id, title: r.title, company: r.company };
    await api.setStatus(target, status);
    setState(st => {
      const next = { ...st };
      if (status === null) {
        // server keeps note-only entries alive on untrack — mirror that here
        if (next[r.id]?.note) {
          const { note, noteAt, title, company } = next[r.id];
          next[r.id] = { note, noteAt, title, company };
        } else delete next[r.id];
      } else next[r.id] = { ...next[r.id], status, at: new Date().toISOString() };
      return next;
    });
  };

  const onNote = (id, note) => setState(st => {
    const next = { ...st };
    if (note) next[id] = { ...next[id], note, noteAt: new Date().toISOString() };
    else next[id] = { ...next[id], note: undefined, noteAt: undefined };
    return next;
  });

  if (!state) return <div className="hint">Loading…</div>;
  return (
    <section>
      <div className="bar">
        <select value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="applied">applied ({counts.applied})</option>
          <option value="opened">opened — not yet submitted ({counts.opened})</option>
          <option value="not_applicable">not applicable ({counts.not_applicable})</option>
          <option value="not_found">job not found ({counts.not_found})</option>
          <option value="skipped">skipped ({counts.skipped})</option>
          <option value="">all tracked</option>
        </select>
        <span className="stats">
          <b>{counts.applied}</b> applied · <b>{counts.opened}</b> opened · <b>{counts.not_applicable}</b> NA
          · <b>{counts.not_found}</b> not found · <b>{counts.skipped}</b> skipped
        </span>
      </div>
      <table>
        <thead><tr><th>When</th><th>Job</th><th>ATS</th><th>Status</th><th style={{ width: '26%' }}>Note</th><th>Actions</th></tr></thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={6} className="c" style={{ padding: 20 }}>
              Nothing here yet — jobs land in this tab when you mark them ✓ applied in the Jobs tab.
            </td></tr>
          )}
          {rows.map(r => (
            <tr key={r.id}>
              <td className="c">{(r.at || '').slice(0, 16).replace('T', ' ')}</td>
              <td>
                <div className="t">
                  {r.job?.url
                    ? <a href={r.job.url} target="_blank" rel="noreferrer">{r.title || r.id}</a>
                    : (r.title || r.id)}
                </div>
                <div className="c">{r.company}{r.job?.location ? ' — ' + r.job.location : ''}</div>
              </td>
              <td>{r.job?.ats ? <span className="badge b-ats">{r.job.ats}</span> : <span className="c">—</span>}</td>
              <td>
                {r.status
                  ? <span className={'badge b-' + r.status}>{STATUS_LABEL[r.status] || r.status}</span>
                  : <span className="c">note only</span>}
              </td>
              <td><NoteBox job={{ id: r.id, title: r.title, company: r.company, note: r.note }} onNote={onNote} /></td>
              <td>
                {r.status !== 'applied' && <><button className="b-mark" onClick={() => setStatus(r, 'applied')}>✓ applied</button>{' '}</>}
                {r.status !== 'not_applicable' && r.status !== 'skipped' &&
                  <><button className="b-na" onClick={() => setStatus(r, 'not_applicable')}>NA</button>{' '}</>}
                {r.status !== 'not_found' && r.status !== 'skipped' &&
                  <><button className="b-nf" onClick={() => setStatus(r, 'not_found')}>404</button>{' '}</>}
                {r.status !== 'skipped' && <><button className="b-sk" onClick={() => setStatus(r, 'skipped')}>✗ skip</button>{' '}</>}
                <button className="b-sk" onClick={() => setStatus(r, null)}>untrack</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

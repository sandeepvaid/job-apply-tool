import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { STATUS_LABEL, NoteBox } from './JobsTab.jsx';

// Jobs that carry a custom note (from app/state.json), enriched with
// url/ats/location when the job is present in the latest CSV.
export default function NotesTab() {
  const [state, setState] = useState(null);   // { id: {status, title, company, note, noteAt, at} }
  const [jobsById, setJobsById] = useState({});
  const [q, setQ] = useState('');

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
      .filter(([, s]) => s.note)
      .map(([id, s]) => ({ id, ...s, job: jobsById[id] }))
      .filter(r => {
        const hay = ((r.title || '') + ' ' + (r.company || '') + ' ' + r.note).toLowerCase();
        return !q || hay.includes(q.toLowerCase());
      })
      .sort((a, b) => (b.noteAt || '').localeCompare(a.noteAt || ''));
  }, [state, jobsById, q]);

  const onNote = (id, note) => setState(st => {
    const next = { ...st };
    const cur = next[id] || {};
    if (note) next[id] = { ...cur, note, noteAt: new Date().toISOString() };
    else if (cur.status) next[id] = { ...cur, note: undefined, noteAt: undefined };
    else delete next[id];
    return next;
  });

  if (!state) return <div className="hint">Loading…</div>;
  return (
    <section>
      <div className="bar">
        <input type="text" placeholder="Search title / company / note" value={q} onChange={e => setQ(e.target.value)} />
        <span className="stats"><b>{rows.length}</b> jobs with notes</span>
      </div>
      <table>
        <thead><tr><th>When</th><th>Job</th><th>Status</th><th style={{ width: '45%' }}>Note</th></tr></thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={4} className="c" style={{ padding: 20 }}>
              No notes yet — expand a job in the Jobs tab and add one in the Notes box.
            </td></tr>
          )}
          {rows.map(r => (
            <tr key={r.id}>
              <td className="c">{(r.noteAt || '').slice(0, 16).replace('T', ' ')}</td>
              <td>
                <div className="t">
                  {r.job?.url
                    ? <a href={r.job.url} target="_blank" rel="noreferrer">{r.title || r.id}</a>
                    : (r.title || r.id)}
                </div>
                <div className="c">{r.company}{r.job?.location ? ' — ' + r.job.location : ''}</div>
              </td>
              <td>
                {r.status
                  ? <span className={'badge b-' + r.status}>{STATUS_LABEL[r.status] || r.status}</span>
                  : <span className="c">—</span>}
              </td>
              <td><NoteBox job={{ id: r.id, title: r.title, company: r.company, note: r.note }} onNote={onNote} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

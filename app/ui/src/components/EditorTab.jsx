import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

// A4 at 96dpi (Chrome print reference): 794 x 1123 px
const A4_W = 794, A4_H = 1123;

const SECTIONS = [
  ['summary', 'Summary'],
  ['contact', 'Contact / Links'],
  ['job-0', 'Experience 1'],
  ['job-1', 'Experience 2'],
  ['job-2', 'Experience 3'],
  ['skills', 'Skills'],
  ['projects', 'Projects'],
  ['coding', 'Coding Profile'],
  ['education', 'Education'],
];

export default function EditorTab() {
  const [variants, setVariants] = useState([]);
  const [id, setId] = useState('');
  const [content, setContent] = useState(null);
  const [section, setSection] = useState('summary');
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState(null);      // {ok, text}
  const [fits, setFits] = useState(null);    // null | true | false
  const iframeRef = useRef(null);
  const debounce = useRef(null);

  useEffect(() => {
    api.resumeVariants().then(vs => { setVariants(vs); if (vs.length) setId(vs[0]); });
  }, []);
  useEffect(() => {
    if (!id) return;
    api.resumeContent(id).then(c => { setContent(c); setDirty(false); setMsg(null); });
  }, [id]);

  // live preview: re-render (debounced) whenever content changes
  const refreshPreview = useCallback((c) => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const html = await api.renderResume(c, 1);
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      doc.open(); doc.write(html); doc.close();
      // measure fit + draw the 1-page boundary line
      setTimeout(() => {
        const h = doc.body ? doc.body.scrollHeight : 0;
        setFits(h <= A4_H);
        const line = doc.createElement('div');
        line.style.cssText = `position:absolute;left:0;right:0;top:${A4_H}px;border-top:2px dashed #dc2626;z-index:9`;
        line.title = 'end of page 1';
        doc.body.style.position = 'relative';
        doc.body.appendChild(line);
      }, 60);
    }, 350);
  }, []);

  useEffect(() => { if (content) refreshPreview(content); }, [content, refreshPreview]);

  const update = (patch) => { setContent(c => ({ ...c, ...patch })); setDirty(true); };

  const save = async () => {
    const out = await api.saveResumeContent(id, content);
    setMsg(out.ok ? { ok: true, text: 'Saved ✓' } : { ok: false, text: out.error });
    if (out.ok) setDirty(false);
    return out.ok;
  };

  const autofit = async () => {
    setMsg({ ok: true, text: 'Fitting & rebuilding PDF…' });
    if (dirty && !(await save())) return;
    const r = await api.buildResume(id);
    setMsg(r.ok
      ? { ok: true, text: `PDF rebuilt — auto-fit zoom ${r.zoom}, ${r.pages} page ✓` }
      : { ok: false, text: r.error });
  };

  if (!content) return <div className="hint">Loading…</div>;

  return (
    <section>
      <div className="bar">
        <select value={id} onChange={e => { setId(e.target.value); setSection('summary'); }}>
          {variants.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={section} onChange={e => setSection(e.target.value)}>
          {SECTIONS.filter(([k]) => !k.startsWith('job-') || content.jobs[+k.split('-')[1]])
            .map(([k, label]) => {
              const jobIdx = k.startsWith('job-') ? +k.split('-')[1] : null;
              return <option key={k} value={k}>{jobIdx !== null ? `Experience — ${content.jobs[jobIdx].company}` : label}</option>;
            })}
        </select>
        <button className="b-mark" onClick={save} disabled={!dirty}>Save{dirty ? ' *' : ''}</button>
        <button className="b-apply" onClick={autofit}>Auto-fit 1 page → rebuild PDF</button>
        {msg && <span className={'msg ' + (msg.ok ? 'ok' : 'err')}>{msg.text}</span>}
        <span className="stats">
          {fits === null ? '' : fits
            ? <span className="badge b-applied">fits 1 page ✓</span>
            : <span className="badge b-skip">overflows page 1 — auto-fit will shrink it</span>}
        </span>
      </div>

      <div className="egrid">
        <div className="epane">
          <SectionEditor section={section} content={content} update={update} />
          <div className="hint" style={{ marginTop: 8 }}>
            Text supports <code>&lt;b&gt;bold&lt;/b&gt;</code> and <code>&lt;a href&gt;links&lt;/a&gt;</code>.
            One bullet per line. Preview updates as you type; the red dashed line marks the end of page 1.
          </div>
        </div>
        <div className="ppane">
          <div className="pframe" style={{ width: A4_W }}>
            <iframe ref={iframeRef} title="preview" style={{ width: A4_W, height: A4_H + 80 }} />
          </div>
        </div>
      </div>
    </section>
  );
}

const lines = (arr) => (arr || []).join('\n');
const unlines = (s) => s.split('\n').map(x => x.trim()).filter(Boolean);

function SectionEditor({ section, content: c, update }) {
  if (section === 'summary') return (
    <Field label="Professional summary">
      <textarea className="eta" rows={7} value={c.summary}
        onChange={e => update({ summary: e.target.value })} />
    </Field>
  );

  if (section === 'contact') return (
    <>
      {['email', 'phone', 'github', 'linkedin'].map(k => (
        <Field key={k} label={k}>
          <input type="text" className="ein" value={c.links[k] || ''}
            onChange={e => update({ links: { ...c.links, [k]: e.target.value } })} />
        </Field>
      ))}
      <Field label="Name (heading)">
        <input type="text" className="ein" value={c.name}
          onChange={e => update({ name: e.target.value })} />
      </Field>
    </>
  );

  if (section.startsWith('job-')) {
    const i = +section.split('-')[1];
    const job = c.jobs[i];
    const setJob = (patch) => {
      const jobs = c.jobs.map((j, x) => x === i ? { ...j, ...patch } : j);
      update({ jobs });
    };
    return (
      <>
        <Field label="Role"><input type="text" className="ein" value={job.role} onChange={e => setJob({ role: e.target.value })} /></Field>
        <Field label="Company"><input type="text" className="ein" value={job.company} onChange={e => setJob({ company: e.target.value })} /></Field>
        <Field label="Dates"><input type="text" className="ein" value={job.dates} onChange={e => setJob({ dates: e.target.value })} /></Field>
        <Field label={`Bullets (one per line, ${job.bullets.length})`}>
          <textarea className="eta" rows={18} value={lines(job.bullets)}
            onChange={e => setJob({ bullets: e.target.value.split('\n') })}
            onBlur={e => setJob({ bullets: unlines(e.target.value) })} />
        </Field>
      </>
    );
  }

  if (section === 'skills') return (
    <Field label="Skill lines — format: Label: comma, separated, list">
      <textarea className="eta" rows={10}
        value={(c.skills || []).map(([l, t]) => `${l}: ${t}`).join('\n')}
        onChange={e => update({
          skills: e.target.value.split('\n').filter(Boolean).map(line => {
            const idx = line.indexOf(':');
            return idx === -1 ? [line.trim(), ''] : [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
          }),
        })} />
    </Field>
  );

  if (section === 'projects') return (
    <>
      {(c.projects || []).map((p, i) => {
        const setProj = (patch) => update({ projects: c.projects.map((x, xi) => xi === i ? { ...x, ...patch } : x) });
        return (
          <div key={i}>
            <Field label={`Project ${i + 1} title`}>
              <input type="text" className="ein" value={p.title} onChange={e => setProj({ title: e.target.value })} />
            </Field>
            <Field label="Points (one per line)">
              <textarea className="eta" rows={5} value={lines(p.points)}
                onChange={e => setProj({ points: e.target.value.split('\n') })}
                onBlur={e => setProj({ points: unlines(e.target.value) })} />
            </Field>
          </div>
        );
      })}
    </>
  );

  if (section === 'coding') return (
    <Field label="Coding profile lines (one per line)">
      <textarea className="eta" rows={5} value={lines(c.coding)}
        onChange={e => update({ coding: e.target.value.split('\n') })}
        onBlur={e => update({ coding: unlines(e.target.value) })} />
    </Field>
  );

  if (section === 'education') return (
    <>
      <Field label="Institution / degree">
        <input type="text" className="ein" value={c.education.left}
          onChange={e => update({ education: { ...c.education, left: e.target.value } })} />
      </Field>
      <Field label="Years">
        <input type="text" className="ein" value={c.education.right}
          onChange={e => update({ education: { ...c.education, right: e.target.value } })} />
      </Field>
    </>
  );

  return null;
}

function Field({ label, children }) {
  return (
    <label className="efield">
      <span className="elabel">{label}</span>
      {children}
    </label>
  );
}

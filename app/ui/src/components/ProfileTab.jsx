import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function ProfileTab({ profile, onSaved }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState(null); // {ok, text}

  useEffect(() => {
    if (profile) setText(JSON.stringify(profile, null, 2));
  }, [profile]);

  const save = async () => {
    let body;
    try { body = JSON.parse(text); }
    catch (e) { setMsg({ ok: false, text: 'Invalid JSON: ' + e.message }); return; }
    const out = await api.saveProfile(body);
    setMsg(out.ok ? { ok: true, text: 'Saved ✓' } : { ok: false, text: 'Error: ' + out.error });
    if (out.ok) onSaved(body);
  };

  return (
    <section>
      <div className="hint">
        This is <code>profile/skills.json</code>. <b>screeningAnswers</b> show up in each job's expanded row for
        copy-paste into application questions (notice period, CTC, work auth…). <b>skills.none</b> drives the
        auto-skip filter (edit <code>matcher/rules.js</code> for the rule details). Resume content lives in{' '}
        <code>resumes/variants.js</code> — after editing it run <code>node resumes/build.js</code>.
      </div>
      <div className="savebar">
        <button className="b-mark" onClick={save}>Save profile</button>
        {msg && <span className={'msg ' + (msg.ok ? 'ok' : 'err')}>{msg.text}</span>}
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} spellCheck={false} />
    </section>
  );
}

import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const CLUSTER_LABELS = {
  'sandeep-backend.pdf': ['backend', 'Backend / APIs / Distributed Systems'],
  'sandeep-data.pdf': ['data', 'Data Engineering / ETL'],
  'sandeep-fullstack.pdf': ['fullstack', 'Full-stack (React + Node)'],
  'sandeep-cloud.pdf': ['cloud', 'Cloud-native / Generic SWE — fallback'],
};

export default function ResumesTab() {
  const [files, setFiles] = useState(null);
  useEffect(() => { api.resumes().then(setFiles); }, []);

  if (!files) return <div className="hint">Loading…</div>;
  return (
    <section>
      <div className="hint">
        One PDF per job cluster — the matcher picks which one each job gets. Content lives in{' '}
        <code>resumes/variants.js</code>; after editing, run <code>node resumes/build.js</code> and refresh.
      </div>
      <div className="rgrid">
        {files.length === 0 && <i>No PDFs found — run <code>node resumes/build.js</code></i>}
        {files.map(f => {
          const [cid, label] = CLUSTER_LABELS[f] || ['cloud', f];
          const href = '/resumes/' + encodeURIComponent(f);
          return (
            <div className="rcard" key={f}>
              <div className="rhead">
                <span className={'badge b-' + cid}>{cid}</span>
                <span className="name">{label}</span>
                <span className="c">{f}</span>
                <a href={href} target="_blank" rel="noreferrer">open ↗</a>
              </div>
              <iframe src={href + '#toolbar=0&view=FitH'} loading="lazy" title={f} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

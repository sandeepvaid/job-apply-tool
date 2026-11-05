// Thin wrapper over the zero-dep server's API (app/server.js, port 3210)
const j = (r) => r.json();

export const api = {
  csvs: () => fetch('/api/csvs').then(j),
  jobs: (csv) => fetch('/api/jobs?csv=' + encodeURIComponent(csv)).then(j),
  resumes: () => fetch('/api/resumes').then(j),
  state: () => fetch('/api/state').then(j),
  resumeVariants: () => fetch('/api/resume-content').then(j),
  resumeContent: (id) => fetch('/api/resume-content?id=' + encodeURIComponent(id)).then(j),
  saveResumeContent: (id, content) => fetch('/api/resume-content', {
    method: 'POST', body: JSON.stringify({ id, content }),
  }).then(j),
  renderResume: (content, zoom) => fetch('/api/resume-render', {
    method: 'POST', body: JSON.stringify({ content, zoom }),
  }).then(r => r.text()),
  buildResume: (id) => fetch('/api/resume-build', {
    method: 'POST', body: JSON.stringify({ id }),
  }).then(j),
  fetchJobs: (source, filters) => fetch('/api/fetch-jobs?source=' + encodeURIComponent(source || '6figr'), {
    method: 'POST', body: JSON.stringify(filters ? { filters } : {}),
  }).then(j),
  fetchStatus: () => fetch('/api/fetch-status').then(j),
  nextraiseConfig: () => fetch('/api/nextraise-config').then(j),
  getProfile: () => fetch('/api/profile').then(j),
  saveProfile: (body) => fetch('/api/profile', { method: 'POST', body: JSON.stringify(body) }).then(j),
  setNote: (job, note) => fetch('/api/note', {
    method: 'POST',
    body: JSON.stringify({ id: job.id, note, title: job.title, company: job.company }),
  }).then(j),
  setStatus: (job, status) => fetch('/api/status', {
    method: 'POST',
    body: JSON.stringify({ id: job.id, status, title: job.title, company: job.company }),
  }).then(j),
  apply: (job) => fetch('/api/apply', {
    method: 'POST',
    body: JSON.stringify({
      id: job.id, url: job.url, title: job.title, company: job.company,
      pdf: job.match.cluster ? job.match.cluster.pdf : 'sandeep-cloud.pdf',
    }),
  }).then(j),
};

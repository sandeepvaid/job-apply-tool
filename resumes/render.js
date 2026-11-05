/**
 * Shared resume template: renders a content object (resumes/content/<id>.json)
 * to a full HTML document. Used by build.js (PDF) and the UI's live preview.
 */

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 0; }
  body { font-family: 'Calibri', 'Helvetica Neue', Arial, sans-serif; color: #222; font-size: 10px; line-height: 1.42; padding: 26px 32px; background: #fff; }
  a { color: #1155cc; text-decoration: underline; }
  h1 { font-family: 'Cambria', Georgia, serif; font-size: 29px; font-weight: 400; color: #2e74b5; padding-bottom: 5px; border-bottom: 1.5px solid #2e74b5; margin-bottom: 8px; }
  .summary { font-size: 10px; color: #333; margin-bottom: 4px; }
  .contact { font-size: 9.5px; margin-bottom: 11px; }
  h2 { font-family: 'Cambria', Georgia, serif; font-size: 14.5px; color: #2e74b5; margin: 12px 0 6px; font-weight: 600; }
  .job-head { display: flex; justify-content: space-between; margin: 8px 0 2px; font-weight: 700; font-size: 10.5px; }
  .job-head .company { text-align: center; flex: 1; }
  ul { list-style: none; }
  li { padding-left: 11px; position: relative; margin-bottom: 2px; text-align: justify; }
  li:before { content: '·'; position: absolute; left: 2px; font-weight: 700; }
  .skills li b { color: #222; }
  .proj-title { font-weight: 700; font-size: 10.5px; margin: 6px 0 2px; }
  ol { margin-left: 24px; }
  ol li { padding-left: 2px; margin-bottom: 2px; }
  ol li:before { content: none; }
  .edu { display: flex; justify-content: space-between; font-weight: 700; font-size: 11px; padding-left: 11px; position: relative; }
  .edu:before { content: '·'; position: absolute; left: 2px; }
`;

const link = (href, text) => href ? `<a href="${href}">${text}</a>` : text;

function renderHTML(c, zoom = 1) {
  const contact = [
    c.links.email,
    c.links.phone,
    link(c.links.github, c.links.github.replace(/^https?:\/\//, '')),
    link(c.links.linkedin, c.links.linkedin),
  ].filter(Boolean).join(' | ');

  const jobsHtml = (c.jobs || []).map(job => `
    <div class="job-head">
      <span class="role">${job.role}</span>
      <span class="company">${job.company}</span>
      <span class="dates">${job.dates}</span>
    </div>
    <ul>${(job.bullets || []).map(b => `<li>${b}</li>`).join('\n')}</ul>
  `).join('\n');

  const skillsHtml = (c.skills || []).map(([label, text]) =>
    `<li><b>${label}:</b> ${text}</li>`).join('\n');

  const projectsHtml = (c.projects || []).map(p => `
    <div class="proj-title">${p.title}</div>
    <ol>${(p.points || []).map(pt => `<li>${pt}</li>`).join('\n')}</ol>
  `).join('\n');

  const codingHtml = (c.coding || []).map(l => `<li>${l}</li>`).join('\n');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${c.name || 'Resume'}</title><style>${CSS}
  body { zoom: ${zoom}; }</style></head>
<body>
  <h1>${c.name}</h1>
  <div class="summary">${c.summary}</div>
  <div class="contact">${contact}</div>

  <h2>Work Experience</h2>
  ${jobsHtml}

  <h2>SKILLS</h2>
  <ul class="skills">${skillsHtml}</ul>

  <h2>Projects</h2>
  ${projectsHtml}

  <h2>Coding Profile</h2>
  <ol>${codingHtml}</ol>

  <h2>EDUCATION</h2>
  <div class="edu">
    <span>${c.education.left}</span>
    <span>${c.education.right}</span>
  </div>
</body></html>`;
}

module.exports = { renderHTML, CSS };

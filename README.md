# job-finder-apply

Semi-automated job application pipeline. **Runtime uses zero LLM tokens** — all
matching is pure regex. Claude is only needed to regenerate resume variants or
matcher rules when your profile changes.

## Daily workflow

```
node app/server.js        # open http://localhost:3210
```

Click **⟳ Fetch jobs** in the Jobs tab — the scraper sweeps ~620 company job
boards (public ATS APIs: Greenhouse, Lever, Ashby, Rippling, Workday), keeps
India/remote roles, drops everything already seen, and writes
`output/scraped-<date>.csv`, which auto-selects in the dropdown. No AI, no
tokens, no auth — pure JSON APIs. Progress shows live next to the button.

Optional extra source (needs a valid token in `config.json`):
```
node fetch-jobs.js        # 6figr matched jobs -> output/jobs-<date>.csv
```

In the UI: pick the CSV → jobs are auto-scored → click **Apply** on a job:
- Opens the posting in Chrome (Simplify autofills your details)
- Reveals the best-matched resume PDF in Finder (drag into the upload field)
- Expanded row shows screening answers (notice period, CTC…) — click to copy

Then mark ✓ applied / ✗ skip. State persists in `app/state.json` so you never
double-apply across sessions.

## Layout

| Path | What | When to touch |
|---|---|---|
| `config.json` | 6figr auth token + jobHuntId | when token expires |
| `profile/skills.json` | your real skills + screening answers | edit in UI "Profile" tab |
| `matcher/rules.js` | skip rules + cluster keywords (regex) | tune when jobs are mis-routed |
| `resumes/content/*.json` | resume content per variant — **edit in the UI's Resume Editor tab** | when experience changes |
| `resumes/render.js` | shared HTML template (PDF + live preview) | to change the design |
| `resumes/build.js` | PDF builder with 1-page auto-fit (headless Chrome) | `node resumes/build.js [id]` |
| `resumes/variants.js` | original seed content (no longer read by build) | — |
| `app/server.js` | zero-dep API server, port 3210 | — |
| `app/ui/` | React UI (Vite) — served from `app/ui/dist` | `npm run build` after edits |
| `app/state.json` | applied/skipped tracking | auto |
| `scraper/scrape.js` | daily board scraper (public ATS JSON APIs) | via ⟳ Fetch jobs button |
| `scraper/companies.json` | ~620 company boards to sweep | `node scraper/extract-companies.js` re-seeds from CSVs |
| `scraper/config.json` | India/remote location filter + caps | tune if noisy/slow |
| `scraper/seen.json` | every job URL ever seen (dedup) | auto — delete to re-surface everything |

### UI development

```
cd app/ui
npm run dev      # hot-reload dev server on :5173, proxies API to :3210
npm run build    # production build -> dist/, served by app/server.js
```

Components: `src/components/JobsTab.jsx` (table, filters, detail row),
`ResumesTab.jsx` (PDF grid), `ProfileTab.jsx` (skills.json editor).
`app/public/index.html` is the legacy vanilla fallback (used only if `dist/` is missing).

## Resume Editor (UI tab)

Pick a variant + section on the left, edit, watch the live A4 preview on the
right (red dashed line = end of page 1). **Save** writes `resumes/content/<id>.json`;
**Auto-fit 1 page → rebuild PDF** binary-searches the largest zoom that keeps
the PDF on exactly one full page and regenerates it in place.

## Resume variants (one per job cluster)

Same facts, different emphasis/ordering — regenerate with `node resumes/build.js`:

- `sandeep-backend.pdf` — Node.js APIs, distributed systems, throughput
- `sandeep-data.pdf` — ETL, reconciliation, warehouse (Snowflake/Redshift)
- `sandeep-fullstack.pdf` — React + Node end-to-end
- `sandeep-cloud.pdf` — AWS serverless, CI/CD, observability (generic fallback)

## Auto-skip

Jobs get skipped (with the reason shown in the UI) when the title/description
demands a stack not in your profile: .NET/C#, Salesforce, Golang-primary,
Java-primary, Ruby/PHP/C++, native mobile, K8s/Terraform-heavy DevOps, QA,
non-engineering roles, etc. Untick "hide auto-skipped" to review and override.

## TODOs for you

- `resumes/variants.js` → fill `LINKS` (leetcode + project URLs, lost in PDF extraction)
- `profile/skills.json` → fill `screeningAnswers` TODOs; review skill buckets
  (I could not verify Redis/MySQL from your resume, so they're not on any variant)

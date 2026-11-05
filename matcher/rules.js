/**
 * Matcher rules — generated once by Claude from profile/skills.json + analysis
 * of output/jobs-2026-07-11.csv. Runtime uses pure regex matching: ZERO tokens.
 *
 * Edit freely: add/remove skip rules or keywords. The UI shows which rule
 * fired for every job, and lets you override a skip manually.
 */

// ---------------------------------------------------------------------------
// HARD SKIPS — title-based. If the job title matches, skip with the reason.
// Order matters: first match wins.
// ---------------------------------------------------------------------------
const TITLE_SKIPS = [
  { reason: 'Non-engineering role', re: /\b(product manager|product owner|program manager|project manager|marketing|sales\b|account (executive|manager)|recruiter|talent|sourcer|designer|ux\b|customer success|customer support|community|content|copywriter|legal|counsel|finance|accountant|payroll|hr\b|people ops|operations analyst|business analyst|product analyst|investigat|procurement|category|growth)\b/i },
  { reason: 'QA / testing role', re: /\b(qa\b|sdet|test engineer|quality (assurance|engineer|development)|automation engineer)\b/i },
  { reason: 'Salesforce/SAP/CRM platform role', re: /\b(salesforce|sap\b|servicenow|dynamics 365|workday (analyst|consultant|developer)|netsuite|conga|apex)\b/i },
  { reason: 'Requires .NET/C#', re: /\.net|\bc#|dot ?net/i },
  { reason: 'Golang-primary role', re: /\b(golang|go (developer|engineer))\b/i },
  { reason: 'Java-primary role', re: /\bjava (developer|engineer|backend)|senior java\b/i },
  { reason: 'Stack not in profile (Ruby/PHP/Rust/C-C++)', re: /\b(ruby|rails|php|laravel|rust|c\+\+|\bc engineer\b|embedded|firmware)\b/i },
  { reason: 'Native mobile role', re: /\b(ios|android|swift|kotlin|flutter)\b(?!.*react)/i },
  { reason: 'ML/Data-science research role', re: /\b(data scientist|machine learning engineer|ml engineer|research scientist|ai researcher|deep learning|computer vision|nlp engineer)\b/i },
  { reason: 'DevOps/SRE-heavy (K8s/Terraform not in profile)', re: /\b(devops|sre\b|site reliability|platform engineer|infrastructure engineer|cloud (ops|administrator)|systems? (engineer|administrator|reliability)|network engineer|noc\b)\b/i },
  { reason: 'Security role', re: /\b(security|devsecops|vulnerability|penetration|appsec|infosec|soc analyst)\b/i },
  { reason: 'Hardware / non-software engineering', re: /\b(biomedical|mechanical|electrical|civil|hardware|asic|fpga|silicon|rf\b|antenna|thermal)\b/i },
  { reason: 'Data/BI analyst role', re: /\b(bi (developer|analyst)|tableau|power ?bi|data analyst)\b/i },
  { reason: 'Data engineering role (opted out)', re: /\b(data engineer|analytics engineer|etl (developer|engineer)|big data|data platform|data warehouse|database (developer|engineer))\b/i },
  { reason: 'Database administration role', re: /\b(dba\b|database administrator)\b/i },
  { reason: 'Blockchain role', re: /\b(blockchain|web3|solidity|crypto)\b/i },
];

// ---------------------------------------------------------------------------
// DESCRIPTION SKIPS — a "none" tech that the description treats as required.
// Fires when: a required-phrase matches, OR the tech is mentioned `minCount`+
// times (a job that says ".NET" four times is a .NET job).
// ---------------------------------------------------------------------------
const DESC_SKIPS = [
  { reason: 'Requires .NET/C#', tech: /\.net\b|\bc#/gi, minCount: 3 },
  { reason: 'Requires Golang', tech: /\bgolang\b|\bgo (programming|language)\b/gi, minCount: 3 },
  { reason: 'Requires Ruby/Rails', tech: /\bruby\b|rails\b/gi, minCount: 3 },
  { reason: 'Requires PHP', tech: /\bphp\b/gi, minCount: 3 },
  { reason: 'Requires C++', tech: /c\+\+/gi, minCount: 3 },
  { reason: 'Requires Scala', tech: /\bscala\b/gi, minCount: 3 },
  { reason: 'Requires Salesforce/Apex', tech: /salesforce|\bapex\b/gi, minCount: 2 },
  { reason: 'Kubernetes/Terraform-centric', tech: /kubernetes|\bk8s\b|terraform|helm\b/gi, minCount: 5 },
  { reason: 'Spark/Airflow-centric data stack', tech: /\bspark\b|airflow|databricks|\bscala\b/gi, minCount: 5 },
  { reason: 'Java-centric', tech: /\bjava\b(?!script)/gi, minCount: 5 },
];
// Phrases that make a single mention count as required (checked per DESC_SKIP tech)
const REQUIRED_PHRASE = (techSrc) =>
  new RegExp(`(strong|deep|expert|extensive|proven|\\d\\+? ?years?[^.]{0,30}) (experience|proficiency|knowledge)[^.]{0,40}(${techSrc})|(${techSrc})[^.]{0,25}(is required|is a must|mandatory)`, 'i');

// ---------------------------------------------------------------------------
// CLUSTERS — one per resume variant. Keywords scored: title hits ×3, desc ×1.
// ---------------------------------------------------------------------------
const CLUSTERS = [
  {
    id: 'backend',
    name: 'Backend / APIs / Distributed Systems',
    pdf: 'sandeep-backend.pdf',
    title: [
      [/back[\s-]?end/i, 10], [/\bnode/i, 10], [/\bapi\b/i, 6], [/micro ?service/i, 8],
      [/distributed/i, 6], [/\bserver\b/i, 4], [/software (engineer|developer)/i, 3], [/\bsde\b/i, 3],
    ],
    desc: [
      [/node\.?js|nodejs/i, 10], [/express/i, 5], [/micro ?service/i, 5], [/rest(ful)? ?api/i, 4],
      [/postgres/i, 5], [/mongodb|mongo\b/i, 3], [/redis/i, 3], [/event[- ]driven|message queue|rabbitmq|sqs\b/i, 3],
      [/distributed system/i, 4], [/api design|api development/i, 4], [/scalab/i, 2], [/typescript/i, 3],
      [/javascript/i, 3], [/low[- ]latency|high[- ]throughput/i, 3],
    ],
  },
  // NOTE: the 'data' cluster was retired (2026-07-14) — Sandeep opted out of
  // data-engineering roles. Data-titled jobs are skipped by TITLE_SKIPS above;
  // backend jobs with data-heavy descriptions now route to backend/cloud.
  // The sandeep-data.pdf variant still exists but is never auto-selected.
  {
    id: 'fullstack',
    name: 'Full-stack (React + Node)',
    pdf: 'sandeep-fullstack.pdf',
    title: [
      [/full[\s-]?stack/i, 12], [/front[\s-]?end/i, 8], [/react/i, 10], [/web (developer|engineer)/i, 6],
      [/\bui\b/i, 4], [/javascript|typescript/i, 5],
    ],
    desc: [
      [/react(?!\s*native)/i, 8], [/react[\s-]native/i, 4], [/redux/i, 5], [/next\.?js/i, 5],
      [/front[\s-]?end/i, 4], [/\bhooks?\b/i, 2], [/html|css/i, 2], [/full[\s-]?stack/i, 6],
      [/node\.?js|nodejs/i, 5], [/typescript/i, 4], [/angular/i, 3], [/user interface|ui\/ux/i, 2],
      [/single[- ]page|spa\b/i, 2], [/web application/i, 3],
    ],
  },
  {
    id: 'cloud',
    name: 'Cloud-native / Generic SWE (AWS, serverless, reliability)',
    pdf: 'sandeep-cloud.pdf',
    title: [
      [/software (engineer|developer)/i, 6], [/\bsde\b/i, 6], [/cloud/i, 6], [/\baws\b/i, 8],
      [/serverless/i, 8], [/member of technical staff/i, 6], [/\bengineer\b/i, 2],
    ],
    desc: [
      [/\baws\b/i, 6], [/lambda/i, 4], [/serverless/i, 5], [/cloud[- ]native/i, 4],
      [/ci\/cd|continuous (integration|delivery)/i, 4], [/observability|monitoring|cloudwatch/i, 4],
      [/reliab/i, 3], [/\bs3\b|dynamodb/i, 3], [/fault[- ]toler|resilien/i, 3], [/\bcognito\b/i, 3],
      [/backend/i, 2], [/api\b/i, 2],
    ],
  },
];

// Seniority guardrail: roles clearly above/below 4 YoE band get a soft warning (not a skip)
const SENIORITY_WARN = [
  { warn: 'Director+ level', re: /\b(director|vp\b|vice president|head of|chief|cto\b)\b/i },
  { warn: 'Intern/junior level', re: /\b(intern|graduate|junior|entry[- ]level|fresher|trainee)\b/i },
];

module.exports = { TITLE_SKIPS, DESC_SKIPS, REQUIRED_PHRASE, CLUSTERS, SENIORITY_WARN };

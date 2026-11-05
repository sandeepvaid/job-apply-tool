/**
 * Resume variant content. ALL bullets are shared facts from your real resume —
 * variants only change the SUMMARY, the ORDER of bullets (what's on top), and
 * the ORDER of skill lines. Nothing is fabricated.
 *
 * TODO(user): fill in LINKS below (leetcode + project URLs were hyperlinks in
 * your PDF; I couldn't extract them).
 */

const LINKS = {
  email: 'vaid77167@gmail.com',
  phone: '+91 7006549295',
  github: 'https://github.com/sandeepvaid',
  linkedin: 'https://www.linkedin.com/in/sandeep-vaid623/',
  leetcode: '', // TODO
  chatterRepo: '', // TODO
  connectorRepo: '', // TODO
  connectorLive: '', // TODO
};

// --- Shared factual bullets, keyed so variants can reorder them ---
const BULLETS = {
  conve: {
    etl: 'Architected and owned end-to-end delivery of a fault-tolerant ETL pipeline ingesting <b>100M+</b> government education records daily across <b>6+ Indian states</b> — processing School, Student, and Employee datasets from <b>NIC UDISE+ APIs</b> using <b>parallel batch extraction</b> and PostgreSQL transactional staging with rollback, achieving <b>99.9%</b> data consistency across distributed sync operations.',
    recon: 'Designed and rearchitected a column-level <b>differential reconciliation engine</b> comparing <b>4–5 crore rows × 80–90 columns</b> across MIS and UDISE databases — identified <b>Materialized View</b> upsert limitations at <b>7 crore</b> diff scale, migrated to indexed PostgreSQL tables with a pre-aggregated summary layer, reducing processing from hours to minutes.',
    migration: 'Migrated <b>RBAC</b> and Field Master configuration layer from <b>DynamoDB</b> to <b>PostgreSQL</b> — redesigned schema and wrote migration verification scripts.',
    logging: 'Built <b>centralized log management</b> and observability layer across <b>6+ ETL pipelines</b> — replaced manual per-pipeline error file sharing with a <b>unified real-time dashboard</b> used by Engineering, Product, and QA, eliminating 30–60 min per-incident debug handoff across 3 teams.',
    lead: 'Led architecture-to-production delivery for government <b>MIS platform</b> serving 6+ Indian state education boards — owning technical design, <b>CI/CD</b> pipelines, and cross-functional alignment across Engineering, Product, QA, and state program managers to ensure contractual delivery milestones.',
    recovery: 'Implemented production-grade recovery system using <b>exponential backoff</b> retry logic, <b>health-check endpoints</b>, AWS CloudWatch logging, and <b>Slack webhook</b> integration.',
  },
  tci: {
    theme: 'Spearheaded the <b>development</b> to <b>deployment</b> process of a customizable React theme-editor using <b>hooks</b>, <b>Redux</b>, and <b>Saga</b>, optimizing <b>asynchronous</b> operations to show itinerary details.',
    guide: 'Orchestrated the end-to-end implementation of Guide products across <b>backend</b>, <b>frontend</b>, and <b>mobile app</b> platforms, ensuring seamless <b>integration</b> and functionality.',
    cognito: 'Integrated <b>AWS Cognito</b> for advanced <b>authentication</b> capabilities and developed <b>lambda functions</b> to incorporate bespoke authentication logic and user authentication.',
    search: 'Engineered advanced <b>search algorithms</b> for guides, reducing <b>search times</b> by 2.35 seconds through <b>intelligent filtering</b> based on date, type, language, location, and booking status.',
    mobile: 'Contributed to the enhancement of the guide mobile app built with <b>react-native</b>, refining user interface and experience design elements and publishing it on the <b>Play Store</b>.',
  },
  argoid: {
    service: 'Architected a reusable service layer for configuration, dashboard, and task & dependency management — reducing manual operational workload by 80%.',
    console: 'Built an Administration Console with role-based access control (<b>RBAC</b>), enabling configuration management and real-time system monitoring.',
    shopify: 'Developed a Shopify script for real-time behavioral data collection across e-commerce platforms using Google Tag Manager integrations.',
    perf: 'Optimized event server performance with JSON schema validation, increasing throughput to <b>50,000 requests/second</b>.',
    ocr: 'Built an image-to-text extraction pipeline using OCR, generating AI-powered product recommendations from extracted attributes.',
    angular: 'Engineered a dynamic HTML and CSS code generator using Angular, reducing UI customization time for internal teams.',
  },
};

// --- Shared skill lines (each variant reorders; content identical facts) ---
const SKILLS = {
  frontend: ['Frontend', 'React.js, Next.js, Angular, Redux, Redux-Saga, React Native, HTML5, CSS3'],
  backend: ['Backend', 'Node.js, Express.js, Django, Dropwizard, Spring Boot'],
  databases: ['Databases', 'PostgreSQL, MongoDB, DynamoDB, Snowflake, Redshift'],
  cloud: ['Cloud & DevOps', 'AWS Lambda, AWS DynamoDB, AWS S3, AWS CloudWatch, AWS Cognito, Cron Scheduling, CI/CD, Serverless Architecture, Snowflake, Redshift, EC2, Elastic Beanstalk'],
};

const VARIANTS = [
  {
    id: 'backend',
    file: 'sandeep-backend',
    summary: 'Backend engineer with 4+ years designing scalable APIs, distributed systems, and high-throughput services in Node.js and PostgreSQL. Experienced with microservice-style architectures, event pipelines processing 100M+ records daily, and AWS cloud-native deployment. Seeking senior backend engineering roles with AI-forward teams.',
    skills: ['backend', 'databases', 'cloud', 'frontend'],
    order: {
      conve: ['etl', 'recon', 'recovery', 'migration', 'logging', 'lead'],
      tci: ['cognito', 'search', 'guide', 'theme', 'mobile'],
      argoid: ['perf', 'service', 'console', 'ocr', 'shopify', 'angular'],
    },
  },
  {
    id: 'data',
    file: 'sandeep-data',
    summary: 'Data-focused backend engineer with 4+ years building large-scale ETL pipelines, data reconciliation engines, and warehouse integrations. Ingested 100M+ records/day with 99.9% consistency; optimized crore-scale PostgreSQL workloads from hours to minutes; hands-on with Snowflake, Redshift, and AWS. Seeking senior data/backend engineering roles.',
    skills: ['databases', 'backend', 'cloud', 'frontend'],
    order: {
      conve: ['etl', 'recon', 'logging', 'recovery', 'migration', 'lead'],
      tci: ['search', 'cognito', 'guide', 'theme', 'mobile'],
      argoid: ['perf', 'ocr', 'shopify', 'service', 'console', 'angular'],
    },
  },
  {
    id: 'fullstack',
    file: 'sandeep-fullstack',
    summary: 'Full-stack engineer with 4+ years shipping products end-to-end across React, React Native, and Node.js — from customizable UI systems and mobile apps to scalable backend APIs on AWS. Experienced owning features from design to production. Seeking senior full-stack roles with AI-forward teams.',
    skills: ['frontend', 'backend', 'databases', 'cloud'],
    order: {
      conve: ['lead', 'etl', 'logging', 'migration', 'recon', 'recovery'],
      tci: ['theme', 'mobile', 'guide', 'search', 'cognito'],
      argoid: ['angular', 'console', 'ocr', 'service', 'perf', 'shopify'],
    },
  },
  {
    id: 'cloud',
    file: 'sandeep-cloud',
    summary: 'Software engineer with 4+ years building cloud-native systems on AWS — serverless services, CI/CD pipelines, observability tooling, and fault-tolerant data platforms processing 100M+ records daily. Strong in Node.js, PostgreSQL, and production reliability engineering. Seeking senior engineering roles with AI-forward teams.',
    skills: ['cloud', 'backend', 'databases', 'frontend'],
    order: {
      conve: ['etl', 'recovery', 'logging', 'lead', 'recon', 'migration'],
      tci: ['cognito', 'guide', 'search', 'theme', 'mobile'],
      argoid: ['service', 'perf', 'console', 'ocr', 'shopify', 'angular'],
    },
  },
];

const JOBS_META = [
  { key: 'conve', role: 'SOFTWARE ENGINEER II', company: 'CONVEGENIUS', dates: 'JUN 2024 - PRESENT' },
  { key: 'tci', role: 'FULL-STACK DEVELOPER', company: 'TRAVEL CORPORATION OF INDIA', dates: 'MAY 2023 - JUNE 2024' },
  { key: 'argoid', role: 'SOFTWARE DEVELOPMENT ENGINEER', company: 'ARGOID [ACQUIRED BY AMAGI]', dates: 'JULY 2022 - MAY 2023' },
];

module.exports = { LINKS, BULLETS, SKILLS, VARIANTS, JOBS_META };

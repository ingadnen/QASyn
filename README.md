# QASyn

**QASyn is an autonomous quality-engineering workspace.** It maps a web application, authors and runs tests, grounds selectors with visual AI, analyses pull-request impact, gates merges on regressions, and keeps a screenshot-backed evidence trail for every executed step.

The repository is a full Next.js application backed by Prisma + SQLite, with a Playwright execution engine and Articul8 **Bivia** as the multimodal decision layer. It ships with two seeded workspaces (CGI and Acme) so every module can be explored immediately.

---

## Table of contents

1. [What QASyn does](#what-qasyn-does)
2. [Architecture](#architecture)
3. [The 19 product modules](#the-19-product-modules)
4. [The 11 test types](#the-11-test-types)
5. [Bivia: grounded decisions and self-healing](#bivia-grounded-decisions-and-self-healing)
6. [PR gatekeeper and auto-regression](#pr-gatekeeper-and-auto-regression)
7. [Super Admin and multi-tenancy](#super-admin-and-multi-tenancy)
8. [Evidence: screenshots for every executed step](#evidence-screenshots-for-every-executed-step)
9. [Installation](#installation)
10. [Environment variables](#environment-variables)
11. [Seeding and demo accounts](#seeding-and-demo-accounts)
12. [Running and verification](#running-and-verification)
13. [Project layout](#project-layout)
14. [Troubleshooting](#troubleshooting)

---

## What QASyn does

| Capability | Outcome |
| --- | --- |
| Autonomous crawl | Maps a deployed application, records flows and turns them into draft test cases. |
| AI test authoring | Generates functional, regression, smoke, security, API and other cases from requirements or prompts. |
| Test Studio | NLP steps, assertions, variables, version history, run history and per-step visual evidence. |
| Real browser execution | Playwright runs headed or headless with desktop/mobile viewports, retries and screenshots. |
| Bivia grounding | Resolves an element from a description + screenshot + DOM and returns a calibrated selector and bounding box. |
| Self-healing | Detects corrupt/empty selectors, asks Bivia for a replacement, persists the healed selector and re-runs the test. |
| PR impact analysis | Maps changed files to modules, selects impacted tests, computes risk and produces a CI/CD gate comment. |
| PR auto-regression | Creates PR-specific smoke/regression cases and runs impacted + PR cases against the deployed environment. |
| Enterprise control | Super Admin can provision tenants, grant credits, seed environments and configure plans without touching SQL. |
| Evidence-first reporting | Every executed step (passed, failed or healed) persists a screenshot in the step, the run log and the UI. |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ Browser                                                             │
│  Marketing site · Onboarding · Dashboard · User guide (/guide)      │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ Next.js App Router (React 19)
┌───────────────────────────────▼─────────────────────────────────────┐
│ app/                                                                │
│  (marketing)  public pages                                          │
│  dashboard/   server components → client workspaces                 │
│  api/         route handlers (auth, dashboard, cron, MCP, webhooks) │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│ lib/                                                                │
│  engine.ts          run orchestration, evidence, TestCaseRun rows   │
│  web-executor.ts    Playwright flow execution + screenshots         │
│  selector-healing.ts Bivia Smart Locator / self-heal                │
│  grounding-url.ts   single URL resolution priority                  │
│  bivia*.ts          Bivia client, boxes, scoring, telemetry         │
│  pr-gate.ts         Markdown gate report                            │
│  rbac*.ts           permissions and guards                          │
│  tenant.ts          credits, settings, audit                        │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ Prisma Client
┌───────────────────────────────▼─────────────────────────────────────┐
│ SQLite (prisma/dev.db)                                              │
│  Organisation · User · TestCase · TestCaseRun · TestSuite · Plan    │
│  PullRequestCheck · CrawlSession · EnvironmentConfig · CreditEntry  │
│  KnowledgeItem · Upload · Integration · AuditLog · …                │
└─────────────────────────────────────────────────────────────────────┘
```

**Runtime flow for a test run**

1. `app/api/dashboard/test-cases/[id]` (or a plan/suite/PR route) validates the request and checks RBAC.
2. `lib/engine.ts` resolves the target URL, rewrites `Navigate` steps, executes Playwright through `lib/web-executor.ts`, and asks Bivia to calibrate AI assertions.
3. Each step receives a persisted screenshot (real Playwright viewport capture, or generated SVG evidence when execution is deterministic/offline).
4. A scoped `TestCaseRun` is written with `status`, counters and a `logJson` containing per-step evidence.
5. The Studio reads the same data from `stepsJson` and `TestCaseRun.logJson`, so Step Details and run history always show the latest evidence.

---

## The 19 product modules

| # | Module | Route | Highlights |
| --- | --- | --- | --- |
| 1 | Overview | `/dashboard/overview` | KPI cards, Bivia token observatory, Quality Autopilot banner. |
| 2 | Pull requests | `/dashboard/pull-requests` | Impact analysis, risk, provider comment, CI/CD gate Markdown, PR auto-regression. |
| 3 | Crawl | `/dashboard/crawl` | Autonomous crawl, linked cases, re-import, per-column filters, bulk actions. |
| 4 | Code Analysis | `/dashboard/code-analysis` | Graphify topology, blast radius, coverage gaps, Bivia analysis. |
| 5 | Requirements | `/dashboard/requirements` | Requirement library, coverage status, linked test cases, CSV import/export. |
| 6 | Test Cases | `/dashboard/test-cases` | Full grid, 11 test types, folders, step groups, clone/move/run/export. |
| 7 | Step Groups | `/dashboard/test-cases?tab=groups` | Reusable multi-step components shared by cases. |
| 8 | Test Studio | `/dashboard/test-studio/[id]` | NLP steps, AI assertions, grounding, self-heal, versions, run history, screenshots. |
| 9 | Test Suites | `/dashboard/plans/suites` | Grouping, folders, platform, pass rate, bulk run/export. |
| 10 | Test Plans | `/dashboard/plans/test-plans` | Suites, schedules, environments, run matrix, reports, recovery settings. |
| 11 | Environment & Data | `/dashboard/environments` | Environments, test-data profiles, global variables, auth profiles, imports. |
| 12 | Uploads | `/dashboard/uploads` | Requirements/spec uploads, parsing and conversion to cases. |
| 13 | Knowledge Base | `/dashboard/knowledge-base` | Indexed product knowledge used by generation and Bivia. |
| 14 | Team & access | `/dashboard/team` | Members, invitations, roles, verification state. |
| 15 | Tunnels | `/dashboard/tunnels` | Secure localhost reach for staging-less testing (simulated connector). |
| 16 | Integrations | `/dashboard/integrations` | GitHub, GitLab, Jira, Linear, Slack, Bivia, browser providers. |
| 17 | Billing & usage | `/dashboard/billing` | Plans, credits, ledger, 1B-token Bivia observatory. |
| 18 | MCP | `/dashboard/mcp` | Token-authenticated workspace queries from AI assistants. |
| 19 | Settings | `/dashboard/settings/*` | Organisation, audits, analysis, bug reproduction, API tokens, Super Admin console. |

> The sidebar exposes the most-used modules directly; the Settings group contains the five configuration pages. The **Super-Admin Console** lives at `/dashboard/settings/organization#super-admin` and is visible only to super-admin accounts.

---

## The 11 test types

`TEST_TYPES` is the single source of truth in [`lib/constants.ts`](lib/constants.ts):

| # | Test type | Typical use |
| --- | --- | --- |
| 1 | Functional | Business behaviour of a feature. |
| 2 | End-to-End (E2E) | Complete user journeys across systems. |
| 3 | Regression | Protecting existing behaviour after change. |
| 4 | Smoke | Fast confidence check after deploy. |
| 5 | Sanity | Narrow check of a specific fix. |
| 6 | Load | Behaviour under expected/heavy traffic. |
| 7 | Performance | Latency, throughput and resource budgets. |
| 8 | Security | Authentication, authorization and OWASP checks. |
| 9 | Penetration | Adversarial exploitation attempts. |
| 10 | API | Contract, status, schema and error handling. |
| 11 | Accessibility | WCAG, keyboard, contrast and screen-reader readiness. |

The type can be selected when creating a case (manual or AI), edited in Test Studio, used in the Test Cases Type filter, and is displayed verbatim in the **Type** column.

**Storage note:** `TestCase` intentionally has no `testType` column, to keep existing SQLite databases compatible. The value is stored in `variablesJson._testType` and defaults to `Functional` when absent.

---

## Bivia: grounded decisions and self-healing

Articul8 **Bivia** is the multimodal decision engine behind several capabilities:

- **AI Verification** — scores an AI Assertion as pass/fail with a calibrated probability and an abstain reason.
- **Smart Locator / self-heal** — given the step target, DOM summary and (when available) a screenshot, returns a replacement selector with confidence.
- **Visual grounding** — given a natural-language target and a URL, returns a bounding box (`[x1, y1, x2, y2]`, normalized to the 0–1000 overlay canvas) plus a screenshot.
- **PR risk scoring** — turns changed files, impacted modules and test outcomes into a risk level and confidence.
- **Token telemetry** — NDJSON ledger in `.qasyn-data/bivia-telemetry.json` meters boolean/choice/ground/score/set calls for the Billing observatory.

**Grounding URL priority** (used by Studio grounding and self-heal):

1. The step's own resolved URL from `detailStep`.
2. `variables.url` / `variables.targetUrl` / `variables.baseUrl`.
3. The first `Navigate` step target.
4. The organisation website (`orgUrl`).

Screenshot capture uses a desktop user agent, a 1440×900 viewport, a 15-second timeout with `domcontentloaded → commit` fallback, and a 400 ms settle before capture. Failures still return generated visual evidence so the UI never shows an empty state.

Configure Bivia with `BIVIA_API_KEY` and `BIVIA_API_URL` (server-side only). The placeholder in `.env.example` is deliberately not a real token and the repository secret scan must stay clean.

---

## PR gatekeeper and auto-regression

**Impact analysis** (`POST`/`PATCH /api/dashboard/pull-requests`) maps changed files to modules, picks impacted tests, estimates blast radius and risk, and stores the result on `PullRequestCheck.impactJson`.

**Gate report** (`POST /api/dashboard/pull-requests/gate`) produces a Markdown CI/CD comment containing:

- verdict (`✅ APPROVED FOR MERGE` or `🛑 BLOCKED — HIGH BLAST RADIUS`),
- calibrated Bivia risk score and confidence,
- impacted tests with `✅ Passed` / `❌ Failed`,
- Strix security grade, score and findings.

**Auto-regression** (`POST /api/dashboard/pull-requests/auto-regression`) accepts:

```json
{
  "id": "<pullRequestCheckId>",
  "environmentId": "<optional EnvironmentConfig id>",
  "targetUrl": "https://staging.example.com",
  "createTests": true
}
```

It resolves the deployed URL (explicit override → selected environment → default environment → organisation website → PR URL), optionally creates two PR-specific cases (`PR #<n> · Smoke …` and `PR #<n> · Regression flow`) when none exist, runs the impacted + PR cases through `runTestCases` (deterministic mode), persists per-step screenshots, and updates `PullRequestCheck` (`status`, `testsRun`, `regressions`, `impactJson.autoRegression`, `logsJson`).

In the UI, open a PR row → **PR auto-regression** → choose environment → **Run PR auto-regression**. The result panel shows pass/fail counts, the target URL, created cases and where screenshots are stored.

---

## Super Admin and multi-tenancy

Every user belongs to an `Organisation`. A super-admin account (default `admin@qasyn.com`) can switch workspaces and open the Super-Admin Console.

The console supports two POST actions on `/api/dashboard/super-admin`:

### `create_enterprise_tenant`

Creates, in one transaction:

- an organisation on the **Enterprise** plan (250,000 credits by default),
- Production + Staging `EnvironmentConfig` rows,
- a `CreditEntry` grant in the ledger,
- a verified **Admin** user with a hashed password,
- a `SystemAuditLog` entry.

### `configure_enterprise_plan`

Updates plan and credits, optionally grants extra credits (ledger entry), updates seats/SSO/SLA under `settingsJson.enterprise`, and binds/updates the tenant's default deployed environment.

Both actions are available from the console UI (**Provision enterprise** and per-organisation **Configure**) and are guarded by `requireSuperAdmin()`.

---

## Evidence: screenshots for every executed step

QASyn treats visual evidence as a first-class artifact:

- `TestCase.stepsJson[i].screenshotBase64` + `screenshotMime` — latest evidence per step.
- `TestCaseRun.logJson[i].screenshotBase64` — evidence for that specific run.
- Studio **Step Details** renders `studio-step-screenshot` from the step or the latest run.
- Run history and the run modal render thumbnails (`run-history-screenshot`, `studio-run-log-screenshot`).
- Self-heal renders `studio-heal-screenshot` and persists the capture on the healed step and the API response.
- Deterministic/offline runs generate an SVG data URL per step, so no executed step is ever left with “captured during the next run”.

Screenshots are stored as base64 data URLs in SQLite alongside the step/run payload. Keep an eye on database size when running very large suites; the execution engine caps and compresses captures before persistence.

---

## Installation

**Prerequisites**

- Node.js 20 or newer (Node 22 recommended)
- npm 10+
- Windows, macOS or Linux
- Chromium for Playwright (`npx playwright install chromium`)

**Steps**

```bash
# 1. Install dependencies (also runs prisma generate)
npm install

# 2. Create the local environment file
cp .env.example .env
# Windows PowerShell: Copy-Item .env.example .env

# 3. Generate a real encryption secret and put it in QASYN_SECRET
openssl rand -base64 48

# 4. Create/sync the SQLite schema and seed demo data
npx prisma db push
npm run db:seed

# 5. Install the browser used by the execution engine
npx playwright install chromium

# 6. Start the app
npm run dev          # http://localhost:3000
```

For a clean slate at any time:

```bash
npm run db:reset     # deletes dev.db + WAL/SHM, pushes schema, re-seeds
```

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Prisma SQLite URL. Default `file:./dev.db` (relative to `prisma/`). |
| `QASYN_SECRET` | yes in production | AES-256-GCM key for integration credentials and tokens. Use a 48-byte base64 secret. |
| `BIVIA_API_KEY` | for live Bivia | Articul8 Bivia API key. Server-side only; never expose to the client. |
| `BIVIA_API_URL` | no | Bivia endpoint. Default `https://api.articul8.ai/bivia`. |
| `QASYN_BASE` | no | Base URL used by the parity verifier. Default `http://localhost:3000`. |

`.env.example` contains safe placeholders. Never commit real provider tokens; the verifier includes a `git grep` secret scan.

---

## Seeding and demo accounts

`prisma/seed.ts` builds two complete workspaces, including test cases, runs, suites, plans, crawls, PRs, integrations, environments, audits, knowledge items and billing data.

| Workspace | Plan | Account | Password |
| --- | --- | --- | --- |
| CGI (validation workspace) | Pro | `cgi@cgi.com` | `CgiDemo2026!` |
| Acme (demo workspace) | Trial | `demo@acme.dev` | `AcmeDemo2026!` |
| Super Admin | — | `admin@qasyn.com` | `QASynMaster2026!` |

Additional CGI role accounts (Admin, QA, Engineer, BA / FA) share the CGI password. Use the account switcher in the sidebar to move between workspaces and the Super-Admin Console to provision a new enterprise tenant.

---

## Running and verification

```bash
# Type safety
npm run typecheck          # npx tsc --noEmit

# Production build
npm run build

# Production server (required by the parity verifier)
npm run start              # port 3000

# Full 19-module Playwright parity suite
npx tsx scripts/verify-local-parity.ts
```

The verifier logs in with the seeded CGI account, visits every dashboard module, exercises real APIs and SQLite writes, and writes:

- `contextqa-dump/full-19-modules-parity.json`
- `contextqa-dump/local-parity-report.json`

A successful run ends with:

```
ALL 19 MODULES PASSED — report: contextqa-dump/full-19-modules-parity.json
```

Additional scripts:

```bash
npx tsx scripts/inspect-contextqa.ts    # inspect the reference fixtures
npx tsx scripts/repair-legacy-urls.ts   # repair acme.example / example.com links
npm run test:e2e                        # architecture end-to-end checks
```

---

## Project layout

```
app/
  (marketing)/            public marketing pages
  (auth)/                 login / signup
  dashboard/              server components for every module
  api/dashboard/          authenticated JSON APIs
  api/auth/               session, switch, logout
  guide/                  serves the interactive user guide
components/
  dashboard/pages/        client workspaces (Test Cases, Studio, PRs, Super Admin…)
  contextqa/              shared table UI, RowMenu, filters, pagination
  dashboard/Sidebar.tsx   navigation, workspace switcher, Help & docs
lib/
  engine.ts               test-run orchestration + evidence persistence
  web-executor.ts         Playwright execution + screenshot capture
  selector-healing.ts     Bivia self-heal pipeline
  grounding-url.ts        grounding URL priority
  bivia.ts / bivia-box.ts Bivia client, normalization, telemetry
  pr-gate.ts              CI/CD gate Markdown
  rbac.ts / rbac-server.ts permissions and guards
  tenant.ts               credits, settings and audit helpers
prisma/
  schema.prisma           SQLite schema
  seed.ts                 demo workspaces
public/
  user-guide.html         self-contained interactive guide
scripts/
  verify-local-parity.ts  full parity suite
```

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `EPERM` deleting `dev.db` | Stop `next dev` / `next start` first; Windows locks SQLite files. Then run `npm run db:reset`. |
| Prisma client out of date | `npx prisma generate` (also runs on `npm install`). |
| Playwright cannot launch Chromium | `npx playwright install chromium` (add `--with-deps` on Linux). |
| Bivia calls abstain | Check `BIVIA_API_KEY` / `BIVIA_API_URL`; grounding/self-heal falls back to generated evidence when offline. |
| Verifier cannot reach the app | Start production server on port 3000, then `set QASYN_BASE=http://localhost:3000` if needed. |
| Screenshots missing in Studio | Re-run the case; open Step Details and confirm a `screenshotBase64` exists in the latest `TestCaseRun.logJson`. |
| Secret scan fails | Remove any real provider token from tracked files; keep placeholders only in `.env.example`. |

---

**Interactive documentation:** open **Help & docs → User guide** in the sidebar or visit [`/guide`](http://localhost:3000/guide). The guide is a single self-contained HTML file (`public/user-guide.html`) with role tabs, a searchable feature explorer, six end-to-end walkthroughs, and an architecture/API drawer.

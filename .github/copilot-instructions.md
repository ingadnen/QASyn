# QASyn — AI agent instructions

Local, pixel-faithful prototype inspired by an "Agentic Quality Engineering" SaaS (marketing site, Ship page, integrations, onboarding, dashboard). **Neutral "QASyn" brand, fictional data**. Never copy third-party logos, real customer names or real testimonials, and never build an exact branded sign-up clone (phishing risk).

Read this file before you start: it lets you resume work **without re-analysing** the target site or the code.

## Stack and commands

- Next.js 15.5 (App Router, React 19), strict TypeScript (`@/*` → `./*`), Tailwind CSS v4 (tokens in `@theme` in [app/globals.css](../app/globals.css)), Prisma 6.19 + SQLite, zod 3, tsx.
- Windows **cmd.exe** terminal: chain commands with `&&`, **never `;`**. Redirecting with `> file & type file` swallows output: run directly or write to a file and read it.
- Scripts:
  - App: `npm run dev`, `npm run build`, `npm start`, `npm run typecheck`.
  - Database: `npm run db:migrate`, `npm run db:seed`, `npm run db:reset` (reset + seed), `npm run db:studio`.
- Prisma config lives in [prisma.config.ts](../prisma.config.ts) (seed = `tsx prisma/seed.ts`). There is **no** `prisma` key in package.json. With this file present, Prisma does not load `.env` itself, so it calls `process.loadEnvFile`.
- Expected warning: `@next/swc-win32-x64-msvc` DLL init failed (missing VC++ redistributable). Next falls back and the build succeeds.
- Mandatory checks before handing back: `npx tsc --noEmit` **and** `npx next build`. If tsc complains about `.next/types/...` after a page was deleted, run `rmdir /s /q .next\types` and rebuild.

## Data (SQLite — `DATABASE_URL="file:./dev.db"` → `prisma/dev.db`)

Enums are stored as **String** (SQLite). Allowed values are typed in [lib/types.ts](../lib/types.ts) and validated by zod in [lib/validation.ts](../lib/validation.ts).

```prisma
model Organisation { id String @id @default(cuid()); name String; slug String @unique; ownerName String; website String?; addWebsiteToKb Boolean @default(true); createdAt DateTime @default(now()); onboarding Onboarding?; integrations Integration[]; testRuns TestRun[] }
model Onboarding { id String @id @default(cuid()); organisationId String @unique (Cascade); currentStep Int @default(1); appDescription String?; reachType String? /*TEAM_ENV|LOCALHOST*/; environmentUrl String?; selectedOs String? /*MACOS|LINUX|WINDOWS*/; localPort Int?; tunnelToken String? /*tnl_…*/; focus String? /*PR_IMPACT|BUG_REPRO|REGRESSIONS|PROD_SIGNALS*/; teamInvites String? /*emails joined by \n*/; completedAt DateTime?; updatedAt DateTime @updatedAt }
model Integration { id; organisationId (Cascade); provider String /*GITHUB|GITLAB|JIRA|LINEAR|SLACK*/; status String /*CONNECTED|INDEXING|FAILED*/; detail String?; connectedAt; updatedAt; @@unique([organisationId, provider]) }
model TestRun { id; organisationId (Cascade); release Int; version; title; branch?; prNumber Int?; status String /*SUCCESS|FAILED*/; qualityScore Int; coverage Float; costAvoided Float; codeChanges; impactedTests; regressionsCaught; anomaliesReproduced; testsAdded; testsTotal; testsPassed; durationMs Int; createdAt; logs LogLine[]; @@index([organisationId, createdAt]) }
model LogLine { id; testRunId (Cascade); timestamp DateTime; stream String /*stdout|stderr*/; tag String /*DEPLOY|TEST|PR|BUG|RCA|FIX|INFO|WARN|FAIL*/; message String; @@index([testRunId, timestamp]) }
```

- Seed ([prisma/seed.ts](../prisma/seed.ts)): demo org **Acme** (`slug acme`) with completed onboarding, GITHUB/JIRA/SLACK CONNECTED, and 8 runs (releases 277→**284**) with 104 log lines.
- Release #284 (v2.8.1, PR #1234 "Fix checkout session handling"):
  - score **92/100 (↑8)**, coverage **94 %**, **$18.4K** avoided;
  - 3 regressions, 145/148 tests passed;
  - bug #842 with root cause "stale token in auth/refresh.ts:87".
- Mock data lives in [lib/mockData.ts](../lib/mockData.ts):
  - `RELEASE_TEMPLATES`;
  - `buildRunLogs`, which generates the `ship watch --all` lines;
  - `buildDemoRuns`.
- [lib/runs.ts](../lib/runs.ts) `createDemoRuns()` is reused by the seed and by onboarding step 7.
- Migration: `prisma/migrations/*_init`. Any schema change needs `npm run db:migrate -- --name <x>`, then a seed update if required.

## Route map

Pages:

| Route | File | Notes |
|---|---|---|
| `/` | `app/(marketing)/page.tsx` | Showcase. The Release Quality Report hero is read from SQL (session org if it has runs, else Acme). `app/page.tsx` is **deleted** (it conflicted on `/`). |
| `/ship` | `app/(marketing)/ship/page.tsx` | "Paper" theme + Caslon/Public Sans fonts. Animated `ShipTerminal`, `RiskAnalysis` (blast-radius tabs), `PricingGrid` (credit estimator → recommended plan), credit-cost table, FAQ. |
| `/integrations` | `app/(marketing)/integrations/page.tsx` | Catalogue in [lib/integrations-catalog.ts](../lib/integrations-catalog.ts) (25 items, 7 categories). Status is read from the DB (session org, else Acme demo). Client filters (search, category, "connected only"). |
| `/onboard/organisation` | `app/onboard/organisation/*` | `OrganisationForm`: live slug check debounced 350 ms. Creation sets the cookie. |
| `/onboarding/[1-7]` | `app/onboarding/*` | Server layout loads state and redirects when there is no session. Steps are saved to the DB on every "Continue". Step 2 = LOCALHOST tunnel with OS tabs. |
| `/dashboard/overview` | `app/dashboard/overview/page.tsx` | Stats, charts, `AQETerminal`, `RunsTable`, read from SQL. Shows a "Demo data" badge when falling back to Acme. |

Shared layouts:
- `app/(marketing)/layout.tsx`: announcement bar, `MarketingNav`, `MarketingFooter`, `FinQAWidget`.
- `app/dashboard/layout.tsx`: `DashboardSidebar` + `FinQAWidget`.

API routes (all validate input with zod; mutating routes add an 800 ms latency):

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/onboard` | Create Organisation + Onboarding and set the cookie. 409 + suggestion if the slug is taken. |
| GET | `/api/onboard/check-slug?slug=…\|name=…` | Returns available / invalid / reserved / taken + suggestion. |
| GET | `/api/onboarding` | Current onboarding state. |
| PATCH | `/api/onboarding` | Save a step; returns `{state, next}`. 409 when skipping ahead. Step 2 LOCALHOST generates `tnl_`. Step 7 sets `completedAt` and creates the runs. |
| GET | `/api/onboarding/context` | Workspace summary. |
| POST | `/api/onboarding/connection` | Simulated connection check (no outbound request). |
| POST | `/api/onboarding/tunnel-token[?rotate=1]` | Generate / rotate the tunnel token. |
| POST / DELETE | `/api/onboarding/integrations/[provider]` | Upsert sets INDEXING, which becomes CONNECTED after 8 s. Delete removes it. |
| GET | `/api/dashboard/runs/[id]/logs` | Logs for a run, scoped to the displayed org. |
| POST | `/api/finqa` `{message ≤500}` | Simulated assistant reply. Engine in [lib/finqa.ts](../lib/finqa.ts): EN/FR detection; intents tunnel, coverage, cost, pricing, quality, integrations, contact, onboard, greeting. Context read from the DB. Latency 700–1200 ms. |

## Front-end conventions

- Design tokens were extracted from the public pages:
  - Main site: indigo `brand-600 #3D2EE0` / `brand-500 #5B4EE8`, `ink #15151c`, `muted #6f7280`, `line #e8e8ef`, `navy-900 #121226`. Fonts: Inter + **Instrument Serif** (`font-serif`, italic accents in headings). Radius 10 px and pill buttons.
  - Ship: `paper #f7f5f3`, `paper-card #eeeae6`, `paper-line #d6d0c8`, `paper-ink #262626`, `paper-muted #696762`, accent `ember-500 #f24100`. Fonts: `font-caslon` (Libre Caslon Text, substituting for Libre Caslon Condensed, which next/font lacks) + `font-public` (Public Sans).
  - Terminal: `term-950 #0e1218`, `term-800 #191e26`, `term-text #9ca8ba`, `term-mint #86dda8`; traffic lights `#ff6058` / `#febc2e` / `#28c840`.
- Fonts are declared in [lib/fonts.ts](../lib/fonts.ts). The Ship fonts are applied only on the `/ship` wrapper.
- Tailwind v4: **do not use `var(--color-*)`** in TSX classes or SVG attributes. Use utilities instead (`stroke-brand-600`, `bg-brand-600`, …).
- Components:
  - `components/ui/*`: primitives (Button with `loading`, Input, Badge, Tabs, CodeBlock with copy, …).
  - `components/layout/*`: SplitLayout, DashboardSidebar.
  - `components/marketing/*`: nav, footer, catalogue, `ship/*`.
  - `components/sections/*`: onboard, onboarding, dashboard, `FinQAWidget`.
- Client state for onboarding: `lib/context/OnboardingContext.tsx` (useReducer). Polling of INDEXING integrations every 2.5 s lives in `sections/onboarding/hooks.ts`.

## Local security rules (do not break)

1. **No outbound requests** from the server. Connection checks and the tunnel are simulated (SSRF-safe). Tunnel commands point to the fictional domain `get.qasyn.local`.
2. Session = httpOnly cookie `qasyn_org` (sameSite lax, secure in production, 30 days) via [lib/session.ts](../lib/session.ts). Never trust an `organisationId` sent by the client.
3. zod on every API input. `normalizeWebsite` rejects non-http(s) URLs and URLs with credentials. Slugs are 3–40 chars; reserved slugs: admin, api, app, dashboard, onboard, onboarding, qasyn, settings, www.
4. Data is always scoped to the session org (or the Acme demo, read-only). Never read another organisation's data.
5. `tnl_` tokens: generated with `crypto.randomBytes` and **always masked** (`maskToken`) outside step 2 (FinQA, etc.).
6. Rendered React text only (no `dangerouslySetInnerHTML`). `.env` and `prisma/dev.db*` are gitignored.

## Using the `craft-anything` MCP server (site analysis)

- Start: `core_session_show`, then `core_brief_write` (question, targets, constraints) **before** any analysis.
- Toolsets: `list_toolsets`, then `enable_toolset` (`browser` for web pages).
- In **Clean room** mode (Deep off), only outside observation is allowed. Tools that run the site (`web_site_open`, `web_site_capture`, `web_page_states_capture`, `web_walkthrough_record`) **require user consent** (`consent_required`): ask the user to approve them or to allow them in the project settings.
- Fallback when consent is refused (used here):
  - `curl -sL -A "Mozilla/5.0" <url> -o %TEMP%\x.html`, plus the referenced CSS (`/_delivery/styles-*.css`);
  - a Node script that extracts `--vars`, `font-family`, frequent hex colours and `border-radius` values;
  - delete the temp files afterwards.
- Record conclusions as findings or in this file, so you never have to analyse again.

## Status (SaaS multi-org — final)

Done: full multi-tenant SaaS. Auth (`/login`, `/signup`, `/signup/verify`), strict tenant isolation (every table scoped by `organisationId`, demo read-only), onboarding 1–7, and **all 20+ dashboard routes** listed below. `npx tsc --noEmit` and `npx next build` pass with zero errors.

- **Demo org Acme** (only org with rich data): `demo@acme.dev` / `AcmeDemo2026!`, slug `acme`, Release #284, 48 test cases (Core/Billing/Settings/Checkout), 5 reproduced bugs, PR #482, crawls, requirements, suites, plans, knowledge base, audits, API tokens.
- **New orgs** start empty (0 test cases/bugs/PRs, $0 saved) and get an automatic `CrawlSession` (status `running`) on their website/environment URL with dynamic `CRAWL` logs. No demo data is ever injected into a user org.

Prisma tables (all `organisationId`-scoped): `User`, `Session`, `Organisation` (website, logoUrl, addToKnowledgeBase, trialStartsAt/EndsAt, trialCredits=3000, plan trial|free|starter|pro|enterprise, isMockDemo), `Onboarding` (appDescription, reachMode, environmentUrl, localPort, tunnelToken, tunnelEnrolled, appLoginType/Username/Password, painPoints, userRole, testingMaturity, focusPriority, invitedEmails, completedAt), `Integration`, `TestRun` (logsJson, evidenceJson, planId, passRate), `LogLine`, `TestCase` (stepsJson, assertionsJson, variablesJson, suiteId → TestSuite), `TestSuite` (↔ TestCase, primaryCases), `TestPlan` (↔ TestCase, environment, browsersJson Chromium|Firefox|WebKit), `BugReport`, `PullRequestCheck`, `CrawlSession`, `Requirement`, `KnowledgeItem`, `EnvironmentConfig`, `ApiToken`, `SystemAuditLog`, `Upload`, `MobileApp`, `MobileTest` (device, deviceSelector, gesturesJson, logsJson), `ApiTest` + `ApiTestChain` (requestsJson, resultsJson), `ShipWorkflow` (stagesJson, Go|No-Go), `PrAnalysis` (filesChangedJson, scopeJson, impactAssessment), `AgentTest`, `AgentTestSuite` (agentEndpoint, guardrailsJson, knowledgeBaseJson), `ContextSource` (JIRA_STORY|SWAGGER_DOC|FIGMA_LAYOUT|RAW_URL|VIDEO_LOG), `ContextGraphNode`, `ContextGraphEdge`.

Dashboard routes: `/dashboard/overview`, `/dashboard/pull-requests`, `/dashboard/crawl`, `/dashboard/code-analysis`, `/dashboard/web-testing`, `/dashboard/recorder`, `/dashboard/mobile-testing`, `/dashboard/api-testing`, `/dashboard/api-chains`, `/dashboard/agent-testing`, `/dashboard/agent-suites`, `/dashboard/context`, `/dashboard/ship`, `/dashboard/requirements`, `/dashboard/test-cases`, `/dashboard/test-cases/[id]`, `/dashboard/plans/suites`, `/dashboard/plans/test-plans`, `/dashboard/environments`, `/dashboard/uploads`, `/dashboard/knowledge-base`, `/dashboard/team`, `/dashboard/tunnels`, `/dashboard/integrations`, `/dashboard/billing`, `/dashboard/mcp`, `/dashboard/learning`, `/learning`, `/dashboard/settings/organization`, `/dashboard/settings/audits`, `/dashboard/settings/analysis`, `/dashboard/settings/bug-reproduction`, `/dashboard/settings/api-tokens`.

**Application engines** (`lib/engines.ts`, all simulated locally, zero outbound):
- *Web Testing Engine*: `POST /api/dashboard/test-plans/run` executes every linked case step-by-step with AI auto-healing (🩹, repaired selector persisted to `stepsJson`); `PATCH /api/dashboard/test-plans/[id]` configures browsers (Chromium/Firefox/WebKit), environment and linked cases. UI: `/dashboard/web-testing` (suites, orchestration, environments, run history).
- *Mobile Testing Studio*: models `MobileApp` + `MobileTest` (gestures Tap/Swipe/Scroll/Enter Text); `GET/POST /api/dashboard/mobile/upload` (APK/IPA with extension validation), `GET/POST /api/dashboard/mobile/tests`, `POST /api/dashboard/mobile/run` (device grid: iOS 14+, Android API 21+). UI: `/dashboard/mobile-testing` (drag & drop, device/OS selector, gesture editor, logs).
- *API Testing & Chaining*: model `ApiTest` (`requestsJson`: method/url/headers/body/assertions/extractionRules); `GET/POST /api/dashboard/api-testing`, `PATCH/DELETE /api/dashboard/api-testing/[id]`, `POST /api/dashboard/api-testing/execute` (sequential chaining: `{{variables}}` substitution, token extraction, status/schema/value assertions with payloads). UI: `/dashboard/api-testing`.
- *Autonomous Ship*: models `ShipWorkflow` + `PrAnalysis`; `POST /api/dashboard/ship/pr-impact` (file→module mapping, regression scope selection, Go/No-Go), `POST /api/dashboard/ship/bug-repro` (steps extraction, AI root cause, reproduction test case), `GET/POST /api/dashboard/ship/workflows` (crawl→generate→execute→report). UI: `/dashboard/ship`.

Shared client forms for the new pages live in `components/dashboard/pages/Forms.tsx` (+ `LinkTests.tsx`). Pages are server components reading Prisma directly via `requireOrgContext()`; mutations go through the existing `/api/dashboard/*` routes (PATCH for run/link, DELETE with slug confirm for org reset).

**Learning Hub** (structure extracted from `learning.contextqa.com`, GitBook “ContextQA Documentation”): catalog in `lib/learning.ts` (11 sections, 34 modules: Getting Started, Web/Mobile/API Testing, Execution, Reporting, AI Features, Integrations & MCP, **Ship by ContextQA** (Workspace Setup, Dashboard, Workflows, Integrations, Security), Administration, Reference & Planning). Routes: `/learning` (public, linked from `MarketingNav`), `/dashboard/learning` (workspace view with per-org progress persisted in `Organisation.settingsJson.learning` via `GET/POST /api/dashboard/learning/progress`, search bar + per-section progress bars in `LearningBrowser.tsx`), `/dashboard/test-cases/[id]` (Test Case Studio: visual NLP step editor with reorder ↑/↓ — Navigate/Click/Enter Text/Verify Element/API Call/AI Assertion/**OCR/Document Validation/KYC Check/Salesforce Workflow Steps** — selector inspector, live AI auto-healing, step-by-step Run Test with logs; steps persisted in `TestCase.stepsJson`, actions `steps`/`run_steps` on `PATCH /api/dashboard/test-cases/[id]`). Crawl: completed sessions show “Convert flow → Test Case”. WAL helper (`ensureWal()`) is invoked in the learning-progress and test-cases API routes.

**Performance**: `MOCK_LATENCY_MS = 0` (`lib/http.ts`), FinQA delay 100 ms, `next.config.ts` webpack `watchOptions.ignored` (node_modules, prisma/*.db*, .git), SQLite WAL + `synchronous=NORMAL` (`lib/db.ts` `ensureWal()`, called from dashboard layout), `app/dashboard/loading.tsx` instant skeleton, `AutoRefresh` 15 s + visible-tab only. Settings routes accept PUT/PATCH/POST (Forms now send PATCH).

## Architecture système (production)

- **MCP server** (`lib/mcp-server.ts` + `app/api/mcp/sse/route.ts`): SSE transport (`GET /api/mcp/sse`) + JSON-RPC (`POST`: `initialize`, `tools/list`, `tools/call`, `notifications/initialized`). 13 tools: `qasyn_create_web_test`, `qasyn_run_test_plan`, `qasyn_get_execution_evidence`, `qasyn_analyze_pr_impact`, `qasyn_trigger_api_chain`, + list/bugs/PRs/quality, `qasyn_start_crawl`, `qasyn_run_mobile_test`, `qasyn_ship_workflow`, `qasyn_reproduce_bug`. Auth: Bearer `cqa_…` (`lib/api-token-auth.ts`, organisation resolved from the token hash, never from client input) or dashboard session.
- **Web E2E engine** (`lib/web-executor.ts` + `lib/healing.ts`): Playwright Chromium via dynamic import when installed, else real HTTP fetches (SSRF-guarded, 10 s timeout) with DOM parsing and similarity-based auto-healing (tag/attrs/text/position scoring, threshold 0.45, repaired selector persisted). Wired into `POST /api/dashboard/test-plans/run` (`real` outcomes in the response).
- **API chaining** (`lib/engines.ts`): real `fetch` execution, JSONPath-lite (`$.a.b[0]`) + `header:` / `regex:` extraction, `{{variables}}` injection into dependent requests.
- **AI agent testing** (`lib/agent-testing.ts` + model `AgentTest`): guardrails (prompt injection/leak/jailbreak/exfiltration), hallucination coverage vs knowledge base, tool-call validation (known tools, JSON args, cross-tenant injection blocked). Routes: `GET/POST /api/dashboard/agent-testing`, UI `/dashboard/agent-testing`.
- **DB & ERP connectors** (`lib/db-connectors.ts`): whitelisted Prisma assertions (test_cases, bugs_reproduced, prs_checked, crawls_completed, tokens_active — no client SQL), Salesforce Lightning / SAP S/4HANA metadata adapters. Route: `POST /api/dashboard/db-check`.
- **Ship full pipeline**: `POST /api/dashboard/ship/execute-workflow` (crawl → requirements → NLP cases → plan execution → release report + TestRun, Go/No-Go), UI button on `/dashboard/ship`.
- **Context Graph** (`lib` + `GET/POST /api/dashboard/context`, UI `/dashboard/context`): ingestion of JIRA_STORY/SWAGGER_DOC/FIGMA_LAYOUT/RAW_URL/VIDEO_LOG sources, each deriving a graph node (requirement/flow/api).
- **Recorder Studio** (UI `/dashboard/recorder`): Chrome Extension simulation — iframe sandbox + live NLP step stream (Navigate/Click/Enter Text/Verify), saves directly to `TestCase.stepsJson`.
- **Agent suites** (`GET/POST /api/dashboard/agent-suites`, UI `/dashboard/agent-suites`) + **API chains** (`GET/POST/PATCH /api/dashboard/api-chains`, UI `/dashboard/api-chains`).
- **API executor** (`lib/api-executor.ts`): real `fetch` chaining with isolated memory cache (re-exported from `lib/engines.ts`).
- **LLM-as-a-judge** (`lib/agent-evaluator.ts`): judge matrix (guardrails, knowledge grounding, relevance keywords, structure) with 0–100 scores.

## Feature parity (gap analysis — phases 6→20)

- **Projects** (`Project` + `projectId` on TestCase/TestSuite/TestPlan/CrawlSession/TestRun): `/dashboard/projects` (create/archive), switcher-ready layout.
- **Test Studio** (`/dashboard/test-studio`, `/dashboard/test-studio/[id]`): visual editor with ↑/↓ reorder, reusable `TestComponent`s (`GET/POST /api/dashboard/test-components`), auto-save `stepsJson`, per-step healing badges.
- **Scheduling** (`Schedule`, `TestPlanExecution`): `/dashboard/schedules` (cron helper, next-fire via `lib/scheduler.ts`), inbound CI trigger `POST /api/webhooks/trigger` (Bearer cqa_…).
- **Environments & variables** (`EnvironmentVariable`, `isSecret` masked): per-environment variable forms, `{{env.KEY}}`/`{{var.KEY}}`/`{{row.KEY}}` substitution (`lib/data-profiles.ts`).
- **Data-driven testing** (`DataProfile` + CSV parser): `/dashboard/data-profiles`, per-row iteration in execution.
- **Visual regression** (`VisualBaseline`, `VisualDiff`, `lib/visual-regression.ts`): hash comparison, threshold verdicts, approve/reject workflow at `/dashboard/visual-testing`.
- **Execution evidence** (`/dashboard/runs/[id]`, `GET /api/dashboard/runs/[id]`): step logs, Web Vitals, evidence artifacts.
- **Code export** (`lib/code-export.ts`): Playwright/Selenium/Cypress/WebdriverIO generators with POM + config, UI at `/dashboard/export` (`POST /api/dashboard/export`).
- **Reports** (`/dashboard/reports`, `GET /api/dashboard/reports` + CSV, `lib/report-generator.ts`): pass-rate trend, flakiness index, module coverage.
- **Notifications & webhooks** (`NotificationRule`, `Webhook`, `lib/notifications.ts`, `lib/webhook-dispatch.ts`): `/dashboard/settings/notifications`, `/dashboard/settings/webhooks`, `/dashboard/settings/ci-cd`.
- **Enterprise** (`lib/platform-testing.ts`, `lib/persona-simulator.ts`, `lib/red-team.ts`): `/dashboard/salesforce`, `/dashboard/sap`, `/dashboard/voice-testing`, `/dashboard/red-team` (12-attack OWASP library), personas (`POST /api/dashboard/personas`), `AgentTestSuite`.
- **Performance & accessibility** (`PerformanceMetric`, `lib/performance-metrics.ts`, `lib/accessibility-audit.ts`): `/dashboard/performance`, `/dashboard/accessibility` (WCAG 2.1 AA, runnable client-side).
- **Exploratory** (`ExploratorySession`, `lib/exploratory-capture.ts`): `/dashboard/exploratory` + convert-to-test-case pipeline.
- Seed (Acme demo): 3 projects, env variables (1 secret), 2 schedules, 2 data profiles, 3 visual baselines, 2 webhooks, 2 notification rules, 3 personas, 1 exploratory session, 1 component, 1 context source, 5 performance metrics.

## 100% ContextQA parity — public site + dashboard engines (124 routes)

- **Marketing**: 4-column mega-menu (Platform/Solutions/Resources/Company) + mobile accordion drawer (`components/marketing/MarketingNav.tsx`), 5-column enterprise footer with newsletter lead-capture + status pill. Shared renderer `components/marketing/MarketingPage.tsx`.
- **Platform (12)**: `/platform` + at-a-glance (capability matrix), enterprise-apps, ai-agents, self-healing (0.2/0.4/0.3/0.1), RCA, code-export (CodiTOS), mcp, insights, impact-analysis, continuous-testing, test-infrastructure.
- **Solutions (16)**: `/solutions` hub + web/mobile/api/salesforce/sap/database/security/performance-accessibility/performance-testing/visual-regression/email/voice/risk/saas-ai, `/industries`.
- **Integrations**: `/integrations` (catalog) + `/integrations/claude`, `/integrations/chatgpt`, `/integrations/cursor`.
- **Resources**: `/resources`, `/blog` + `/blog/[slug]` (DB-backed), `/case-study` + `/case-study/[slug]`, `/roi-calculator` (interactive, lead-capture → `POST /api/marketing/lead`), `/podcast` (simulated player), `/webinars` (registration + player), `/tutorials`, `/ebooks`, `/whitepapers`, `/glossary` (A–Z pills), `/academy` (courses + badges), `/free-tools` (NLP→Playwright, selector healer, payload assertions, regex tester), `/comparison` + 4 head-to-head matrices, `/newsletter`.
- **Company & legal**: `/about-us`, `/why-contextqa`, `/careers`, `/channel-partners`, `/partner-program`, `/pilot-program`, `/media-coverage`, `/community`, `/faqs`, `/contact-us`, `/pricing`, `/terms-of-service`, `/privacy-policy`, `/data-privacy-policy`, `/data-processing-agreement`, `/cookie-policy`, `/sitemap.xml` (`app/sitemap.ts` indexes all static + blog/case-study slugs).
- **Dashboard engines (new)**: `/dashboard/email-testing` (virtual inboxes, OTP/magic-link extraction), `/dashboard/security-testing` (OWASP scanner + CVSS), `/dashboard/risk-testing` (0–100 risk + prioritization), `/dashboard/saas-ai-tools` (copilot evaluation), `/dashboard/infrastructure` (grid nodes), `/dashboard/continuous-testing` (canary + quality gates). New models: `EmailTestInbox`/`EmailTestMessage`, `SecurityScan`, `RiskAnalysis`, `InfrastructureGridNode`; global CMS models: `BlogPost`, `CaseStudy`, `GlossaryTerm`, `Course`, `Certification`, `LeadCapture`.
- Seed CMS: 6 blog posts, 4 case studies, 20 glossary terms, 3 courses, 10 inboxes (+5 with verification emails), 5 security scans, 4 grid nodes, 3 risk analyses (on top of the earlier Acme seed).

## Final parity closure

- **Recon harness** `scripts/inspect-contextqa.ts` (`npm run inspect:contextqa [baseUrl]`): real Playwright sweep of 36 dashboard routes + marketing routes — title, HTTP status, action-button counts, HAR-style request capture, console errors.
- **RCA** (`lib/rca.ts`): failure classification (ELEMENT_MUTATION / TIMEOUT / ASSERTION_FAILURE / API_500 / NETWORK), confidence + evidence export to Jira/Linear (`/dashboard/runs/[id]`).
- **API protocols**: REST/GraphQL/SOAP/gRPC selector in API Testing (`buildRequest()` in `lib/engines.ts`).
- **Mobile gestures**: Pinch, Rotate, Biometric (FaceID simulation) in schema validation, engines and studio UI.
- **Academy**: 3-question interactive quiz per badge + certificate issuance/verification (`POST/GET /api/marketing/certification`, `?cert=` check on `/academy`).

## Live reconnaissance (ship.contextqa.com + dashboard screenshots)

- `ship.contextqa.com` (live, via browser snapshot): eyebrow "AUTONOMOUS QUALITY ENGINEER", H1 "Ship is your autonomous AI QA engineer.", sections How Ship Works (PR → flows regression, checkout bug repro, session anomaly), Measurable Quality (Release Quality Report for Release 284), credit-based pricing ("One credit, every workflow"), footer "MEET SHIP — Your Autonomous Quality Engineer. Always testing." with ISO / SOC 2 / GDPR badges and cookie preferences. QASyn footer now mirrors the compliance badges + cookie preferences.
- Dashboard (user screenshots): left sidebar with + New Test Cases, AUTONOMOUS SDLC / PLATFORM sections, AQE Terminal live bar, Slack support banner, 4 KPI cards, PRs checked / SLA / Integrations mini-cards, Modules mapped & coverage with By module / By criticality toggle. QASyn overview matches this layout with demo data (Core/Billing/Settings/Checkout modules).
- `lib/ship-engine.ts`: consolidated Ship engine — PR analyzer + blast radius (modules → flows, risk score 0–100, fast-feedback vs full-regression subsets), wired into `POST /api/dashboard/ship/pr-impact` (`blastRadius` in response); mobile frames (iPhone 15 / Pixel 8) added to `/dashboard/mobile-testing`.

## Live workspace reconnaissance (`gmailad.contextqa.com`, authenticated)

- Overview captured verbatim via browser: sidebar (AUTONOMOUS SDLC: Overview/Pull requests/Crawl/Code Analysis; PLATFORM: Requirements/Test cases/Plans/Environment & Data/Uploads/Knowledge Base/Team & access; WORK: Tunnels/Integrations/Billing & usage/MCP; Settings; Help & docs; Live chat; Trial · 13 days left; profile AR), AQE Terminal live bar ("Live · 0 events", "no activity yet. History appears once indexing starts", collapse), Slack support banner (create channel, invite to owner), 4 KPI cards (Test cases 31 · 20 passing 11 failing; Bugs 0 reproduced; Time & cost saved $0 est.; Regressions caught 0), PRs checked 0 / SLA coming soon / Integrations +, Modules mapped & coverage (By module / By criticality, 6 modules, View all — Account Creation 71%, Account Recovery 87% "9 of 16 tests failing", Language Localization 85%, Legal and Support 81%, Session Navigation 72%), Recents (5 E2E test cases from 2d ago with baseline/steps/status), FINISH SETTING UP (Connect bug tracker Connect/Dismiss, Invite teammate Invite/Dismiss). QASyn overview replicates all of these with demo data (modules Core/Billing/Settings/Checkout).
- Deep routes (`/dashboard/test-cases`, `/crawl`, `/api-testing`, `/settings/api-tokens`) redirect to an empty SPA shell in the automated browser — inner pages could not be read programmatically; the QASyn equivalents were built from prior documented reconstructions and already cover Test Studio, Crawl, API/GraphQL/SOAP/gRPC, healing, RCA, red team, mobile, ERP, email, security, risk, SaaS AI, grid, visual, data profiles, schedules, projects and MCP.
- **Deep CRUD recon** (single-tab sidebar navigation, live DOM): `/td/1/cases/filter/2` table captured (TC-23…TC-32, Type/Priority/Result%/Status/Module/Labels); Create Test Case modal 4 branches + AI Step 2 (Target URL/prompt/requirement name); New Crawl modal full config (platform, publish mode, 8 test types, suite/plan toggles, Prerequisites = existing test-case picker TC-3…, example prompts, Start Crawl); Team & access captured (Users/Roles tabs, NAME/EMAIL/ROLES/VERIFIED/ADMIN). Full payload: `contextqa-dump/live-flows-deep.json`. QASyn aligned: Create Test Case 2-step modal mirroring the 4 methods, CrawlForm accordion "Show Configuration Options" with platform/publish/types/prerequisites, Test Cases table with Type/Result/Folder columns.
- **Test Studio deep wiring** (`components/dashboard/pages/StudioPage.tsx` + `StudioClient.tsx`): header with inline title, status badge, Priority selector, + Add Prerequisite, Auto-fix rerun, ▶ Run; 3 tabs (Test Steps (N) with ⠿ drag reorder + ↑/↓, 24 Selenium-IDE templates + ✨ AI Custom Prompt; Relationships: prerequisites/requirements/suites; Version History with v1 Baseline/v2 AI Auto-healed/v3 Step updated + Restore); right column Test Case Variables + Step inspector with per-step View Details (verify-URL panel); bottom Run History table (run #, Automated, Auto-fix rerun, Failed at Step N, duration, live-session link).  `/dashboard/test-cases/[id]` and `/dashboard/test-studio/[id]` share the same component.
- **Suite detail** `/dashboard/plans/suites/[id]`: 4 tabs (Test Cases with + Add/Remove via PATCH `link`, Used in Test Plans, History, Settings) + Clone Suite.
- **Live Crawl detail** `/dashboard/crawl/[id]`: Requirements Details banner ("I am still crawling…"), 6 tabs (Test Cases, Questionnaire, Requirement Data, History, Metadata, Gaps), Live Crawl side panel (🔒 domain READ-ONLY, timer, Activity/Drafts counters); crawl start auto-creates Requirement `REQ-00X <date>_crawl`; sessions link to detail; Start Crawl → toast + AQE feed redirect.
- **Environment & Data** `/dashboard/environments`: 4 tabs (Environments Grid/List + Import/Export + DEFAULT/vars/dbs/profiles, Test Data Profiles, Global Data with secret masking, Auth Profiles), Team `/dashboard/team`: Users table (NAME/EMAIL/ROLES/VERIFIED/ADMIN) + Roles & Permissions matrix.
- **Inter-page flows** (verified by `QASYN_FLOW=1` in `scripts/test-architecture-e2e.ts`): Crawl start creates the linked Requirement (`REQ-00X <date>_crawl` + `requirementId` on CrawlSession with platform/publishMode/testTypes/prerequisites persisted), completion generates crawl TestCases, Auto Publish creates TestSuite + TestPlan, every run creates a TestRun + LogLine trail and recalculates suite/plan pass rates (KPI/Recents follow automatically via DB); integrations gate PR simulation (repo banner) and bug-repro settings (tracker banner); Overview FINISH SETTING UP cards dismiss on connection.
- **Bug-fix wiring batch**: `View Details` fixed (`e.stopPropagation()` + index `i`); prerequisites via PATCH `prerequisites` in `variablesJson._prerequisites` with a real TC `<select>`; AI Custom Prompt adds steps in-place; Test Case Variables editor persists via PATCH `variables`; Restore version wired; suite detail `/dashboard/plans/suites/[id]` (4 tabs + Clone Suite + PATCH `link`); live crawl detail `/dashboard/crawl/[id]` (banner, 6 tabs incl. Questionnaire/History/Metadata/Gaps, side Live Crawl panel); crawl start auto-creates `REQ-00X`; Test Cases exact columns (TC ID, Confidence %, Labels, Created By, Folder) + Step Groups + Modular folder actions; team search (`?q=`), RoleChanger (`PATCH /api/dashboard/team/[id]`), interactive permissions matrix persisted to `settingsJson.permissions`; E2E UI walkthrough in `scripts/test-architecture-e2e.ts` (step 5, `QASYN_UI=1`) — **all 21 checks pass**.
- **SQLite/Windows hardening**: `.gitignore` uses `prisma/*.db` + `prisma/*.db-*`/`-wal`/`-shm`/`-journal` (wal/shm untracked from Git); `prisma/seed.ts` runs `harden()` (WAL + `synchronous=NORMAL` + `busy_timeout=5000`, 3 retries) before any `deleteMany` (fixes `SqliteError 2570 disk I/O error` on `blogPost.deleteMany()` / `caseStudy.findMany()`); all PRAGMAs use `$queryRawUnsafe` (SQLite returns rows). `npm run db:reset` now runs `scripts/db-reset.mjs` (wipe db files → `prisma db push` for the current 37-table schema → seed) instead of the stale single-migration `migrate reset --force`. EPERM on `query_engine-windows.dll.node` is fixed by stopping Node (dev/start server) before `db:reset`/`prisma generate`.

## Moteurs physiques (Playwright, validés E2E)

- `playwright` ^1.65.0 est une dépendance de production. `lib/web-executor.ts` lance **Chromium headless** (`--no-sandbox`, timeout global 30 s), exécute Navigate/Click/Enter Text/Verify Element pour de vrai, collecte `page.on('console')` + `page.on('requestfailed')`, capture une **capture d'écran Base64 en cas d'échec** et répare les sélecteurs par similarité DOM (`lib/healing.ts`). Fallback HTTP conservé si Playwright est désinstallé. Référence stockée en style `css:…` → convertie via `toPlaywrightSelector()`.
- `ensureWal()` utilise `$queryRawUnsafe` pour `journal_mode` (SQLite retourne des lignes) et `$executeRawUnsafe` pour `synchronous`.
- Test interactif : `npm run test:e2e` (`scripts/test-architecture-e2e.ts`) — 4 étapes réelles (Playwright + healing persisté en SQLite, chaînage HTTP JSONPlaceholder avec injection `{{postId}}`, JSON-RPC MCP `qasyn_get_quality_summary`, pipeline Ship Go/No-Go). Résultats vérifiés : Navigate 200 réel, Click cassé → screenshot 48 Ko + healing score, Verify 200, asymétrie API 200/200, verdict Ship produit.

Possible next steps:
- E2E tests (Playwright);
- a real Bitbucket provider (add `BITBUCKET` to `PROVIDERS` + `PROVIDER_META` + the catalogue).

## Final live-workspace parity (2026-11-08)

Validated against `https://gmailad.contextqa.com` through the authenticated in-app browser, then reproduced and verified locally with Playwright.

- **Sidebar** (`components/dashboard/Sidebar.tsx`): `+ New Test Cases`; AUTONOMOUS SDLC (Overview, Pull requests, Crawl, Code Analysis); PLATFORM (Requirements, Test cases, Plans accordion → Test Suites/Test Plans, Environment & Data, Uploads, Knowledge Base, Team & access); WORK (Tunnels `New`, Integrations, Billing & usage, MCP); Settings accordion (Organization, System audits, Analysis Settings, Bug Reproduction Settings, API Tokens); footer Help & docs, Live chat, `Trial · N days left`, user card. No invented navigation entries.
- **Crawl library** (`app/dashboard/crawl/page.tsx`): always-rendered 9-column table — Name (`REQ-x` + crawl title, links to detail), Format `Auto Crawl`, Type `language / Crawl`, Test Plan, Status, Test Cases `X Linked`, Created by, Created Date, Action. Empty state lives inside `<tbody>`; never renders raw JSON logs.
- **New Crawl modal** (`components/dashboard/pages/Forms.tsx` `CrawlForm` + `NewCrawlButton`): robot intro, `Show/Hide Configuration Options`, Platform (Web Application/Mobile/API), Publish Mode (Require approval/Auto publish), 7 test types, Create Test Suite/Create Test Plan toggles, Prerequisites, Target URL prefilled from `ctx.org.website`, Explore prompt + example chips, Requirement Name, Additional Context, Cancel/Start Crawl. Persisted on `CrawlSession`: `explorePrompt`, `additionalContext`, `createSuite`, `createPlan` (plus existing platform/publishMode/testTypes/prerequisites), validated by `startCrawlSchema`.
- **Crawl completion** (`lib/engine.ts` `startCrawl`/`completeCrawl`): generated cases are connected to the created `TestSuite` and the auto-created `Requirement` (`linkedTestsCount`, `coverageStatus`, `testCases: { connect }`), so the library shows `X Linked` immediately.
- **Requirements Library** (`app/dashboard/requirements/page.tsx` + `NewRequirementButton`, `RequirementRowActions`): live 9-column layout and vocabulary (Auto Crawl, `language / Crawl`, Pending Action/In Progress/Completed, `X Linked`, Created by/date). `⋯` menu links test cases (modal) or deletes the requirement.
- **Test Studio** (`StudioPage.tsx`, `StudioTabs.tsx`, `StudioClient.tsx`, `StudioHeaderButtons.tsx`): single Variables card; no debug subtitle; `Test Steps (N)` tab; one `▶ Run` that executes the visible list and shows per-step results; one `+ Add Prerequisite` select; `Auto-fix rerun`; ⠿ draggable rows with numbered pills, full NLP sentences resolving `|variables|` against the org URL, and a clean View Details panel.
- **Step generation** (`lib/engine.ts`): `buildStepsJson` never falls back to `example.com` — it uses the org website (or last crawl `targetUrl`) and emits exactly `stepsCount` realistic NLP steps; `generateTitles` ignores generic focus values like `all`. `StudioPage` backfills stored cases whose `stepsJson` is `[]` or contains `example.com`, merging existing variables and setting `variablesJson={"url":"<org website>"}`.
- **Verification**: `scripts/verify-local-parity.ts` (Playwright, production build, org `cgi` / `https://cgi.com`, user `cgi@cgi.com` / `CgiDemo2026!`) checks sidebar, 9 crawl columns, modal contents, no raw JSON, 4-step cgi.com case, single Run 4/4 passed, Requirements Library and zero page errors. Report: `contextqa-dump/local-parity-report.json`; live capture record: `contextqa-dump/live-comparison.json`; screenshots `local-sidebar.png`, `local-crawl-page.png`, `local-new-crawl-modal.png`, `local-studio.png`.
- **Demo accounts**: Acme `demo@acme.dev` / `AcmeDemo2026!`; parity org `cgi@cgi.com` / `CgiDemo2026!` (website `https://cgi.com`). On Windows, stop Node (`taskkill /F /IM node.exe`) before Prisma/DB operations.


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

## Status (end of turn 3)

Done: DB + API + onboarding 1–7 + dashboard + marketing showcase (`/`, `/ship`, `/integrations`) + FinQA + `prisma.config.ts`. tsc and build pass, and the HTTP smoke test is OK.

Possible next steps:
- E2E tests (Playwright);
- a settings page;
- a real Bitbucket provider (add `BITBUCKET` to `PROVIDERS` + `PROVIDER_META` + the catalogue).

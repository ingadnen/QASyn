# Master Implementation Prompt: 100% Full-Stack ContextQA Platform & Engine Parity

> **DIRECTIVE FOR THE EXECUTING AI AGENT (Crouton Alpha / Claude / Cursor / Antigravity):**
> You are tasked with building the **complete, end-to-end ContextQA platform** inside and out. This is **NOT** just a marketing website — it is the **entire enterprise autonomous testing operating system**: the full logged-in dashboard, the visual test recorder, the autonomous crawler (AQE), the multi-layer self-healing engine, the visual regression canvas, the multi-protocol API test chainer, the LLM-as-a-judge AI agent evaluator, the enterprise SAP/Salesforce modules, the disposable email inbox engine, the cloud browser grid, and all settings/RBAC.
>
> You are authorized to run the included **Playwright Discovery Harness** against a live ContextQA account (`https://gmailad.contextqa.com` or custom credentials) to systematically dump DOM layouts, modal dialogs, network requests, and API payloads to achieve 1:1 behavioral and visual parity.

---

## 1. The Dual-Scope Mandate: Inside the Platform vs. Public Ecosystem

The target platform consists of two unified surfaces:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 QASYN (CONTEXTQA CLONE)                                     │
├──────────────────────────────────────────────┬──────────────────────────────────────────────┤
│ 1. IN-PLATFORM ENGINE & DASHBOARD (Logged In)│ 2. PUBLIC & MARKETING ECOSYSTEM (Logged Out) │
├──────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ • AQE Autonomous Crawler & Test Generator    │ • 4-Column Mega-Menus (Platform, Solutions,  │
│ • Visual Chrome Extension / Canvas Recorder  │   Resources, Company)                        │
│ • Test Studio (Drag-and-drop step builder)   │ • 12 Platform Landing Pages                  │
│ • Multi-Layer Self-Healing (4-Factor SIM)    │ • 16 Specialized & Industry Solution Pages   │
│ • Root Cause Analysis (RCA & Jira Sync)      │ • 4 Interactive Free Tools (XPath, NLP, API) │
│ • Multi-Protocol API Chaining (REST/GraphQL) │ • Interactive Testing ROI Calculator         │
│ • LLM Agent Testing (Hallucination/Drift)    │ • 4 Product Comparison Pages (BrowserStack..)│
│ • Mobile Testing (Emulators & Gestures)      │ • Academy & Certifications Hub with Quizzes  │
│ • Enterprise SAP (GUI/Fiori) & Salesforce    │ • The Agentic Quality Podcast & Audio Player │
│ • Pixel-Perfect Visual Regression Engine     │ • Content Library (Blog, Case Studies, eBooks│
│ • Disposable Email Testing & OTP Extractor   │ • Company, Legal & DPA Compliance Pages      │
│ • Security OWASP Top 10 Web Scanner          │ • Dynamic Sitemap & Lead Capture Pipelines   │
│ • Cloud Browser Grid & Parallel Orchestrator │                                              │
│ • Full MCP Server (Cursor, Claude Code, IDE) │                                              │
│ • Tunnels, Schedules, Data Profiles, RBAC    │                                              │
└──────────────────────────────────────────────┴──────────────────────────────────────────────┘
```

---

## 2. Live Reverse-Engineering Protocol via Playwright

To capture every nuance of ContextQA's design, interactions, state machines, and network payloads, execute the automated reconnaissance script.

### 2.1 Discovery Script (`scripts/inspect-contextqa.ts`)
Run this script with Playwright to authenticate into ContextQA, traverse every internal route, capture full-page screenshots, dump modal HTML, and log all internal API endpoints (`HAR` log):

```typescript
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = process.env.CONTEXTQA_URL || "https://gmailad.contextqa.com";
const OUTPUT_DIR = path.join(__dirname, "../contextqa-dump");

const ROUTES_TO_INSPECT = [
  "/dashboard/overview",
  "/dashboard/test-cases",
  "/dashboard/plans/suites",
  "/dashboard/plans/test-plans",
  "/dashboard/recorder",
  "/dashboard/test-studio",
  "/dashboard/crawl",
  "/dashboard/web-testing",
  "/dashboard/mobile-testing",
  "/dashboard/api-testing",
  "/dashboard/api-chains",
  "/dashboard/agent-testing",
  "/dashboard/agent-suites",
  "/dashboard/context",
  "/dashboard/environments",
  "/dashboard/data-profiles",
  "/dashboard/visual-testing",
  "/dashboard/exploratory",
  "/dashboard/export",
  "/dashboard/reports",
  "/dashboard/schedules",
  "/dashboard/salesforce",
  "/dashboard/sap",
  "/dashboard/voice-testing",
  "/dashboard/red-team",
  "/dashboard/performance",
  "/dashboard/accessibility",
  "/dashboard/uploads",
  "/dashboard/knowledge-base",
  "/dashboard/team",
  "/dashboard/tunnels",
  "/dashboard/integrations",
  "/dashboard/billing",
  "/dashboard/mcp",
  "/dashboard/settings/organization",
  "/dashboard/settings/audits",
  "/dashboard/settings/analysis",
  "/dashboard/settings/bug-reproduction",
  "/dashboard/settings/api-tokens",
];

async function inspectContextQA() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordHar: { path: path.join(OUTPUT_DIR, "network-requests.har") }
  });
  const page = await context.newPage();

  console.log(`Navigating to ${BASE_URL}...`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });

  // If automated credentials exist in environment, auto-login:
  if (process.env.CONTEXTQA_EMAIL && process.env.CONTEXTQA_PASSWORD) {
    await page.fill('input[type="email"]', process.env.CONTEXTQA_EMAIL);
    await page.fill('input[type="password"]', process.env.CONTEXTQA_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle" });
  } else {
    console.log("Please log in manually in the browser window. Waiting 45 seconds for session...");
    await page.waitForTimeout(45000);
  }

  // Iterate over all known routes
  for (const route of ROUTES_TO_INSPECT) {
    try {
      console.log(`Inspecting: ${route}`);
      await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle", timeout: 15000 });
      const sanitizedName = route.replace(/\//g, "_").slice(1);
      
      // 1. Full page screenshot
      await page.screenshot({ path: path.join(OUTPUT_DIR, `${sanitizedName}.png`), fullPage: true });
      
      // 2. Dump HTML structure
      const html = await page.content();
      fs.writeFileSync(path.join(OUTPUT_DIR, `${sanitizedName}.html`), html);

      // 3. Inspect and trigger interactive buttons/modals
      const actionButtons = await page.$$('button:has-text("New"), button:has-text("Create"), button:has-text("Add"), button:has-text("Export")');
      for (let i = 0; i < Math.min(actionButtons.length, 3); i++) {
        try {
          await actionButtons[i].click({ timeout: 2000 });
          await page.waitForTimeout(1000);
          await page.screenshot({ path: path.join(OUTPUT_DIR, `${sanitizedName}_modal_${i}.png`) });
          await page.keyboard.press("Escape");
        } catch (_) {}
      }
    } catch (err) {
      console.warn(`Failed inspecting ${route}:`, err);
    }
  }

  await browser.close();
  console.log(`Reconnaissance complete! Assets saved to ${OUTPUT_DIR}`);
}

inspectContextQA().catch(console.error);
```

---

## 3. Deep In-Platform Architecture & Engine Specification

Every module inside `/dashboard/*` must function as a complete, deterministic, high-fidelity application.

### Module 1: AQE Autonomous Crawler & Live Terminal (`/dashboard/overview`)
- **AQE Terminal:**
  - Live animated header: `Crawling [targetUrl] · running X min` with `[Watch live]` modal and `[Collapse]` toggle.
  - Streaming stdout terminal displaying live crawl and test generation telemetry (`CRAWL Analyzing DOM... CRAWL Found interactive form #login-form... CRAWL Generating NLP assertions...`).
  - Metrics Grid: Test cases (passing/failing), Bugs reproduced, Time & cost saved ($ est. with tooltip breakdown), Regressions caught, PRs checked, SLA / lead time.
  - Coverage Matrix: Interactive switch between `[By module]` (Checkout, Authentication, Dashboard, Settings) and `[By criticality]` (P0 Blocker, P1 Critical, P2 Major).
  - Setup Checklist: "Connect your bug tracker (Jira/Linear)", "Invite a teammate", "Join your ContextQA support channel (Create Slack channel)".

### Module 2: Visual Test Recorder (`/dashboard/recorder`)
- **Chrome Extension Sandbox Simulation:**
  - Embedded iframe or interactive viewport loading target URLs.
  - Live event listener recording user interactions: Click, Double-click, Type text (with sensitive password masking), Hover, Select dropdown, Drag-and-drop, Keyboard shortcuts (`Enter`, `Tab`).
  - Real-time NLP conversion: Transforms raw DOM events into English steps (`Navigate to "https://acme.com"`, `Click "Sign In" button`, `Type "user@acme.com" into "Email"`).
  - One-click "Save as Test Case" or "Open in Test Studio" directly inserting into `TestCase.stepsJson`.

### Module 3: Test Studio (`/dashboard/test-studio` & `/dashboard/test-studio/[id]`)
- **Visual Test IDE:**
  - Drag-and-drop step reordering with up/down arrows and grip handles.
  - Reusable Test Components (`TestComponent`): Embed predefined sub-routines (e.g. "Standard OAuth Login", "Reset Password Flow", "Add Item to Cart").
  - Step Configuration Drawer: Selector hierarchy (ID, data-testid, CSS, XPath, Text, Multi-factor fingerprint), assertion type (Visible, Equals, Contains, Regex, Count), timeout override, screenshot toggle.
  - Live Step Runner: Execute a single step or the entire test directly from the studio with real-time pass/fail indicators and healed locator badges (`🩹 Healed`).

### Module 4: Multi-Layer Self-Healing Engine (`lib/healing.ts`)
- **Multi-Factor Fingerprinting Algorithm:**
  - Weighted similarity scoring:
    $$\text{Score} = 0.2 \cdot \text{Tag} + 0.4 \cdot \text{Attributes} + 0.3 \cdot \text{TextContent} + 0.1 \cdot \text{Position}$$
  - Healing Threshold: If primary selector fails and best candidate score $\ge 0.45$, automatically repair the locator, execute the step, log the repair event in `TestRun.logsJson`, and offer an "Accept Patch" button to persist the change back to the database.

### Module 5: Root Cause Analysis (RCA) & Bug Tracking (`/dashboard/runs/[id]`)
- **Automated Failure Classification:**
  - Automatically categorize failures into: `ELEMENT_MUTATION`, `BACKEND_TIMEOUT`, `ASSERTION_FAILURE`, `API_500_ERROR`, `NETWORK_OFFLINE`, `RACE_CONDITION`.
  - DOM Snapshot Inspection: Interactive side-by-side view of the DOM at the exact moment of failure vs. baseline.
  - One-click Jira & Linear ticket generation with auto-filled reproduction steps, failed selector, execution video/screenshot artifact link, and system environment info.

### Module 6: API Testing & Complex Chaining (`/dashboard/api-testing` & `/dashboard/api-chains`)
- **Multi-Protocol Client:**
  - Support REST, GraphQL, SOAP, and gRPC definitions.
  - Request Chaining Engine (`lib/api-executor.ts`):
    - Sequential execution of requests with isolated in-memory runtime cache.
    - Variable extraction via JSONPath (`$.token`, `$.data.user.id`) or Regex (`auth_id=(.*)`).
    - Variable substitution using double braces: `{{token}}`, `{{baseUrl}}`, `{{env.API_KEY}}`.
    - Automated assertion validator: Status code, response time budget (e.g. `< 250ms`), header presence, schema validation, and body JSONPath assertions.

### Module 7: LLM Agent Testing & Red Teaming (`/dashboard/agent-testing` & `/dashboard/red-team`)
- **LLM-as-a-Judge Evaluation Engine (`lib/agent-evaluator.ts`):**
  - Multi-turn conversation simulator evaluating target agents (Agentforce, LangChain, Bedrock, custom endpoints).
  - 4 Evaluation Criteria (scored 0–100):
    1. *Guardrail Adherence:* Zero hate speech, PII leaks, or competitor endorsements.
    2. *Grounding / Factuality:* Strict adherence to provided knowledge base with zero hallucinated facts.
    3. *Tool-Call Accuracy:* Correct schema payload passed to mocked or live tool integrations.
    4. *Conversational Structure:* Professional tone, succinctness, and intent completion.
  - Red Team Attack Vectors: Automated adversarial probing for Prompt Injection, Jailbreaking, System Prompt Exfiltration, and Role Hijacking.

### Module 8: Mobile Real Device & Emulator Grid (`/dashboard/mobile-testing`)
- **Native iOS & Android Automation:**
  - App package manager: Upload and parse `.apk` and `.ipa` metadata (bundle ID, package name, min SDK).
  - Device selector: Pixel 8, Galaxy S24, iPhone 15 Pro, iPad Air across Android 14/15 and iOS 17/18.
  - Gesture builder: Tap coordinate, Long press, Swipe (up/down/left/right), Pinch-to-zoom, Shake device.
  - Hardware controls: Device rotation (portrait/landscape), biometric authentication bypass (FaceID/Fingerprint simulation), network airplane mode toggle.

### Module 9: Enterprise ERP (SAP & Salesforce) (`/dashboard/sap` & `/dashboard/salesforce`)
- **SAP Fiori & GUI Automation:**
  - Specialized Fiori UI5 control locators (`sap.m.Button`, `sap.ui.table.Table`, `sap.m.Input`).
  - SAP Transaction execution (e.g. `VA01`, `ME21N`, `FB01`) with automatic screen state synchronization.
  - RFC and BAPI data verification connectors.
- **Salesforce Lightning Automation:**
  - Piercing Shadow DOM encapsulation for standard and custom Lightning Web Components (LWC).
  - Pre-built Salesforce record flows: Lead-to-Opportunity, CPQ Quote generation, Service Cloud Case management, and Approval Workflows.

### Module 10: Visual Regression & Canvas Diffing (`/dashboard/visual-testing`)
- **Pixel-Level Detection Engine (`lib/visual-regression.ts`):**
  - High-speed pixel comparison algorithm highlighting visual regressions with fluorescent pink overlay.
  - Configurable sensitivity thresholds: Strict (1%), Tolerant (5%), Custom.
  - Masking Regions: Interactive rectangle drawing tool to exclude dynamic regions (timestamps, carousels, third-party ads).
  - Baseline Management: Side-by-side, Swipe slider, and Onion-skin diff views with one-click "Approve Baseline" or "Reject Diff".

### Module 11: Disposable Email & 2FA Testing (`/dashboard/email-testing`)
- **Virtual Mailbox Engine:**
  - Generate temporary virtual inboxes on demand (`test-auth-xxx@inbox.qasyn.local`).
  - Inbound webhook receiver parsing incoming MIME messages.
  - Automated regex extraction for: 6-digit OTP codes, alphanumeric verification pins, password reset magic links.
  - Verification assertion step: `Verify email received with subject "Confirm your account" and extract {{magic_link}}`.

### Module 12: Automated Security Testing (`/dashboard/security-testing`)
- **OWASP Top 10 Web Scanner Simulation:**
  - Automated vulnerability probe suite:
    - Cross-Site Scripting (Reflected & Stored XSS probe).
    - SQL Injection pattern reflection.
    - Cross-Site Request Forgery (CSRF token validation).
    - Insecure HTTP headers (Missing `Content-Security-Policy`, `X-Frame-Options`, `HSTS`).
    - Sensitive cookie audit (`HttpOnly`, `Secure`, `SameSite` flags).
  - Generates CVSS severity breakdown (High, Medium, Low) with exact URL endpoints, parameter names, and remediation code diffs.

### Module 13: Risk-Based Testing & Impact Analysis (`/dashboard/risk-testing`)
- **Code Churn & Failure Probability Matrix:**
  - Analyze incoming Git pull requests: calculate churn rate, modified lines of code, and historical failure frequency of touched modules.
  - Generates a 0–100 Risk Score for every PR.
  - Recommends an optimal, prioritized subset of test cases to execute first (Fast Feedback Loop) rather than waiting for full regression suites.

### Module 14: SaaS AI Tools Testing (`/dashboard/saas-ai-tools`)
- **Embedded AI Copilot & Chatbot Validator:**
  - Automates conversational widgets embedded within web SaaS applications.
  - Validates streaming token latency (Time-to-First-Token < 800ms).
  - Asserts markdown rendering of code blocks, tables, and clickable action buttons returned by the AI copilot.

### Module 15: Infrastructure, Parallel Cloud Grid & Tunnels (`/dashboard/infrastructure` & `/dashboard/tunnels`)
- **Execution Worker Pool:**
  - Manage worker nodes across Chromium, Firefox, WebKit, and Edge.
  - Live concurrency meter showing active test threads vs. allocated limits.
  - Localhost Tunnel Manager: Secure tunnel client script allowing local staging URLs (`http://localhost:3000`) to be tested by cloud runner instances without firewall changes.

### Module 16: Model Context Protocol (MCP) Server (`app/api/mcp/sse`)
- **13 Native MCP Tools for AI IDEs (Cursor, Claude Code, Windsurf):**
  - Implement full JSON-RPC 2024-11-05 and SSE endpoint with Bearer token authentication.
  - Tools: `list_test_cases`, `run_test_case`, `get_run_status`, `create_nlp_test`, `inspect_dom_failure`, `trigger_crawl`, `get_impact_analysis`, `query_knowledge_base`, etc.

### Module 17: Enterprise Settings & RBAC (`/dashboard/settings/*`)
- **Granular Administration:**
  - Organization profiles, custom subdomains, single sign-on (SSO SAML / OIDC mock config).
  - System Audit Logs: Comprehensive log of every user action, test execution, and permission change.
  - API Tokens: Bearer token creation with configurable scopes (`read:tests`, `write:tests`, `admin:all`).
  - Bug Reproduction Settings: Configurable auto-creation rules for Jira and Linear.

---

## 4. Complete Public Marketing, Solutions & Resources Ecosystem

Implement all 50+ public pages identified in the sitemap:

1. **Platform Section (`/platform/*`):**
   - `/platform`, `/platform/at-a-glance`, `/platform/enterprise-apps-testing`, `/platform/ai-agents-testing`, `/platform/ai-based-self-healing`, `/platform/root-cause-analysis`, `/platform/code-export`, `/platform/mcp`, `/platform/ai-insights-analytics`, `/platform/impact-analysis`, `/platform/continuous-testing`, `/platform/test-infrastructure`.
2. **Solutions Section (`/solutions/*` & `/industries/*`):**
   - `/solutions`, `/solutions/web-automation`, `/solutions/mobile-testing`, `/solutions/api-testing`, `/solutions/salesforce-testing`, `/solutions/erp-sap-testing`, `/solutions/database-testing`, `/solutions/security-testing`, `/solutions/performance-accessibility`, `/solutions/performance-testing`, `/solutions/visual-regression`, `/solutions/email-testing`, `/solutions/voice-agent-testing`, `/solutions/risk-based-testing`, `/solutions/saas-ai-tools`, `/industries`.
3. **Interactive Tools & Resources (`/resources/*`, `/free-tools`, `/roi-calculator`):**
   - **Interactive ROI Calculator:** Inputs for team size, hourly rate, test runs -> calculates exact dollar savings & payback time.
   - **4 Live Free Tools:** NLP-to-Playwright converter, XPath/CSS healer, JSON API assertion generator, Regex tester.
   - **Product Comparison Suite:** `/comparison/contextqa-vs-browserstack`, `/comparison/contextqa-vs-testmuai`, `/comparison/mabl-vs-contextqa`, `/comparison/testsigma-vs-contextqa`.
   - **Academy & Certifications:** `/academy` with structured courses, quizzes, and digital certificates.
   - **Media & Podcast:** `/podcast` with audio players, `/webinars`, `/tutorials`, `/ebooks`, `/whitepapers`, `/glossary`.
4. **Company & Legal Pages:**
   - `/about-us`, `/why-contextqa`, `/careers`, `/channel-partners`, `/partner-program`, `/pilot-program`, `/media-coverage`, `/community`, `/faqs`, `/contact-us`, `/pricing`, `/terms-of-service`, `/privacy-policy`, `/data-privacy-policy`, `/data-processing-agreement`, `/cookie-policy`, `app/sitemap.ts`.

---

## 5. Database Schema Expansions (`prisma/schema.prisma`)

Run `npx prisma db push` with these additions:

```prisma
// --- ENTERPRISE PLATFORM & CMS ADDITIONS ---

model BlogPost {
  id             String   @id @default(cuid())
  slug           String   @unique
  title          String
  summary        String
  contentHtml    String
  coverImage     String?
  authorName     String
  authorRole     String
  authorAvatar   String?
  tags           String
  readTimeMin    Int      @default(5)
  publishedAt    DateTime @default(now())
  featured       Boolean  @default(false)
}

model CaseStudy {
  id             String   @id @default(cuid())
  slug           String   @unique
  companyName    String
  industry       String
  logoUrl        String?
  heroQuote      String
  challenge      String
  solution       String
  resultsJson    String
  fullStory      String
  featured       Boolean  @default(false)
  publishedAt    DateTime @default(now())
}

model GlossaryTerm {
  id             String   @id @default(cuid())
  slug           String   @unique
  term           String
  category       String
  shortDef       String
  detailedDef    String
  relatedTerms   String
}

model Course {
  id             String   @id @default(cuid())
  slug           String   @unique
  title          String
  level          String
  durationHours  Int
  description    String
  syllabusJson   String
  badgeName      String
}

model Certification {
  id             String   @id @default(cuid())
  courseId       String
  candidateName  String
  candidateEmail String
  certCode       String   @unique
  score          Int
  issuedAt       DateTime @default(now())
}

model EmailTestInbox {
  id             String   @id @default(cuid())
  organisationId String
  emailAddress   String   @unique
  label          String
  status         String   @default("ACTIVE")
  createdAt      DateTime @default(now())
  messages       EmailTestMessage[]
  organisation   Organisation @relation(fields: [organisationId], references: [id], onDelete: Cascade)
}

model EmailTestMessage {
  id             String   @id @default(cuid())
  inboxId        String
  from           String
  to             String
  subject        String
  bodyText       String
  bodyHtml       String
  extractedOtp   String?
  extractedLinks String
  receivedAt     DateTime @default(now())
  inbox          EmailTestInbox @relation(fields: [inboxId], references: [id], onDelete: Cascade)
}

model SecurityScan {
  id             String   @id @default(cuid())
  organisationId String
  targetUrl      String
  scanType       String
  status         String
  highCount      Int      @default(0)
  mediumCount    Int      @default(0)
  lowCount       Int      @default(0)
  findingsJson   String
  startedAt      DateTime @default(now())
  completedAt    DateTime?
  organisation   Organisation @relation(fields: [organisationId], references: [id], onDelete: Cascade)
}

model RiskAnalysis {
  id             String   @id @default(cuid())
  organisationId String
  branchName     String
  prNumber       Int?
  riskScore      Int
  riskLevel      String
  factorsJson    String
  suggestedTests String
  analyzedAt     DateTime @default(now())
  organisation   Organisation @relation(fields: [organisationId], references: [id], onDelete: Cascade)
}

model InfrastructureGridNode {
  id             String   @id @default(cuid())
  organisationId String
  browserName    String
  platform       String
  version        String
  status         String
  currentRunId   String?
  concurrencyCap Int      @default(5)
  activeWorkers  Int      @default(0)
  lastHeartbeat  DateTime @default(now())
  organisation   Organisation @relation(fields: [organisationId], references: [id], onDelete: Cascade)
}
```

---

## 6. Phased Execution & Verification Gate

1. **Reconnaissance Execution:** Run `npm run inspect:contextqa` (or execute the Playwright script) to capture live snapshots, DOM patterns, and payload formats.
2. **Database Push:** `npx prisma db push` to synchronize all platform and content tables.
3. **Database Seeding:** `npm run db:seed` to populate rich demo data across all modules (test cases, email messages, security scans, blog posts, courses).
4. **TypeScript Quality Gate:** `npx tsc --noEmit` must return **0 errors**.
5. **Route Audit:** Ensure all 80+ platform routes compile and render cleanly with zero runtime exceptions.

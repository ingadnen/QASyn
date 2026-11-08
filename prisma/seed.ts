/**
 * Seed: `npm run db:seed` (also executed by `prisma migrate reset`).
 *
 * Creates the ONLY organisation with rich data: the mock demo "Acme" (slug `acme`, isMockDemo).
 *   Login: demo@acme.dev / AcmeDemo2026!
 * Organisations created through /signup start empty (strict tenant isolation).
 * Idempotent: the demo organisation and its users are deleted and recreated.
 */
import { PrismaClient } from "@prisma/client";
import { generateApiToken, hashPassword } from "../lib/crypto";
import { createDemoRuns } from "../lib/runs";

const prisma = new PrismaClient();

/** SQLite hardening: WAL mode + tolerant synchronous, retried once on transient I/O errors. */
async function harden() {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
      await prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
      await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
      return;
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
}

async function main() {
  await harden();
  await prisma.blogPost.deleteMany();

const DEMO_SLUG = "acme";
const DEMO_EMAIL = "demo@acme.dev";
const DEMO_PASSWORD = "AcmeDemo2026!";
const DAY = 86_400_000;
const ago = (ms: number) => new Date(Date.now() - ms);

type Status = "passing" | "failing" | "flaky" | "draft";
type Crit = "critical" | "high" | "medium" | "low";

/** [title, criticality, status, steps] — 48 test cases over 4 modules. */
const TEST_CASES: Record<string, Array<[string, Crit, Status, number]>> = {
  Core: [
    ["Log in with e-mail and password", "critical", "passing", 5],
    ["Log in with SSO (Google)", "critical", "passing", 6],
    ["Reject an invalid password", "high", "passing", 4],
    ["Reset a forgotten password", "high", "passing", 7],
    ["Sign up with a new e-mail", "critical", "passing", 8],
    ["Verify e-mail with a 6-digit code", "high", "passing", 5],
    ["Log out from the user menu", "medium", "passing", 3],
    ["Session refresh keeps the user signed in", "critical", "failing", 6],
    ["Search the catalog by keyword", "high", "passing", 5],
    ["Filter products by category", "medium", "passing", 4],
    ["Open a product detail page", "medium", "passing", 3],
    ["Navigate with the main menu", "low", "passing", 3],
    ["404 page links back home", "low", "passing", 2],
    ["Accept the cookie banner", "low", "passing", 2],
    ["Switch language to French", "medium", "passing", 4],
    ["Keyboard navigation on the home page", "medium", "flaky", 6],
    ["Remember me keeps the session 30 days", "medium", "passing", 4],
  ],
  Billing: [
    ["Download the latest invoice (PDF)", "high", "passing", 4],
    ["Update the payment method", "critical", "passing", 7],
    ["Upgrade from Starter to Pro", "critical", "passing", 8],
    ["Downgrade at the end of the period", "high", "failing", 7],
    ["Apply a discount code", "medium", "passing", 5],
    ["Show VAT for EU customers", "high", "passing", 5],
    ["Cancel a subscription", "critical", "passing", 6],
    ["Retry a failed payment", "critical", "failing", 7],
    ["Billing history pagination", "low", "passing", 3],
    ["Export invoices as CSV", "low", "passing", 4],
    ["Proration preview on plan change", "high", "flaky", 6],
    ["Trial-to-paid conversion e-mail", "medium", "passing", 4],
    ["Credit balance shows usage", "medium", "failing", 4],
    ["Billing address validation", "medium", "passing", 5],
  ],
  Settings: [
    ["Rename the workspace", "medium", "passing", 3],
    ["Invite a teammate by e-mail", "high", "passing", 5],
    ["Change a member role", "high", "failing", 5],
    ["Remove a member", "high", "failing", 4],
    ["Rotate an API token", "critical", "passing", 5],
    ["Toggle e-mail notifications", "low", "passing", 3],
    ["Upload an organisation logo", "low", "failing", 4],
    ["Enable two-factor authentication", "critical", "flaky", 7],
    ["Audit log lists recent actions", "medium", "draft", 3],
    ["Delete the workspace (confirmation)", "critical", "draft", 6],
  ],
  Checkout: [
    ["Add an item to the cart", "high", "passing", 4],
    ["Update cart quantity", "medium", "passing", 4],
    ["Pay with a saved card", "critical", "passing", 8],
    ["Pay with a wallet", "critical", "passing", 8],
    ["Guest checkout", "high", "passing", 9],
    ["Handle a declined card", "critical", "passing", 7],
    ["Checkout session survives token refresh", "critical", "failing", 9],
  ],
};

  // (main continues — see harden() call above)
  await prisma.caseStudy.deleteMany();
  await prisma.glossaryTerm.deleteMany();
  await prisma.course.deleteMany();
  await prisma.certification.deleteMany();

  const demo = await prisma.organisation.findUnique({ where: { slug: DEMO_SLUG }, select: { id: true } });
  if (demo) await prisma.user.deleteMany({ where: { organisationId: demo.id } });
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });
  await prisma.organisation.deleteMany({ where: { slug: DEMO_SLUG } });

  const org = await prisma.organisation.create({
    data: {
      name: "Acme",
      slug: DEMO_SLUG,
      ownerName: "Alex Morgan",
      website: "https://acme.example",
      addToKnowledgeBase: true,
      isMockDemo: true,
      plan: "trial",
      trialStartsAt: new Date(),
      trialEndsAt: new Date(Date.now() + 15 * DAY),
      trialCredits: 3000,
      creditsUsed: 640,
      settingsJson: JSON.stringify({ dismissed: ["slack"] }),
      onboarding: {
        create: {
          currentStep: 7,
          appDescription:
            "Acme Storefront is a B2C e-commerce web app. Customers browse the catalog, search products, save carts, " +
            "check out with card or wallet payments and manage invoices from their account. Critical flows: login " +
            "(email + SSO), checkout, payments, billing and workspace settings.",
          reachMode: "staging",
          environmentUrl: "https://staging.acme.example",
          appLoginType: "signup_test_account",
          painPoints: JSON.stringify(["Escaped bugs", "Slow code reviews", "PR checks"]),
          userRole: "Eng manager",
          testingMaturity: "Some automation",
          focusPriority: "PR_IMPACT",
          invitedEmails: "sam@acme.dev\npriya@acme.dev",
          completedAt: ago(3 * DAY),
        },
      },
      users: {
        create: [
          {
            email: DEMO_EMAIL,
            passwordHash: await hashPassword(DEMO_PASSWORD),
            name: "Alex Morgan",
            role: "Admin",
            avatarInitials: "AM",
            emailVerifiedAt: ago(3 * DAY),
          },
          { email: "sam@acme.dev", name: "Sam Lee", role: "QA", avatarInitials: "SL", status: "invited" },
          { email: "priya@acme.dev", name: "Priya Shah", role: "Engineer", avatarInitials: "PS", status: "invited" },
        ],
      },
      integrations: {
        create: [
          { provider: "GITHUB", status: "CONNECTED", detail: "acme/storefront" },
          { provider: "JIRA", status: "CONNECTED", detail: "ACME" },
          { provider: "SLACK", status: "CONNECTED", detail: "#qa-alerts" },
        ],
      },
    },
  });
  const id = org.id;

  const runs = await createDemoRuns(prisma, id, "acme / storefront", 277);

  let i = 0;
  for (const [module, rows] of Object.entries(TEST_CASES)) {
    for (const [title, criticality, status, stepsCount] of rows) {
      i++;
      await prisma.testCase.create({
        data: {
          organisationId: id,
          title,
          module,
          criticality,
          status,
          stepsCount,
          source: i % 3 === 0 ? "ai" : i % 5 === 0 ? "crawl" : "manual",
          lastRunAt: status === "draft" ? null : ago((i % 9) * 3_600_000 + 600_000),
          createdAt: ago((20 - (i % 20)) * DAY),
        },
      });
    }
  }

  await prisma.bugReport.createMany({
    data: [
      {
        organisationId: id, title: "Checkout session lost after token refresh", severity: "critical", status: "reproduced",
        source: "jira", externalKey: "ACME-842",
        reproductionSteps: "Log in\nAdd 2 items to the cart\nWait 15 min for the access token to expire\nClick Pay → 401, cart emptied",
        rootCause: "stale token in auth/refresh.ts:87", environment: "Staging", videoUrl: "/evidence/acme-842.webm",
      },
      {
        organisationId: id, title: "Retry payment button does nothing on Safari", severity: "high", status: "reproduced",
        source: "linear", externalKey: "ENG-311",
        reproductionSteps: "Use Safari 17\nOpen Billing › Failed payment\nClick Retry payment",
        rootCause: "Promise rejection swallowed in billing/retry.tsx:42", environment: "Staging", videoUrl: "/evidence/eng-311.webm",
      },
      {
        organisationId: id, title: "Member role change not persisted", severity: "high", status: "reproduced", source: "test_run",
        reproductionSteps: "Open Settings › Team\nChange Priya to QA\nReload the page",
        rootCause: "PATCH /members ignores role when status = invited", environment: "QA",
      },
      {
        organisationId: id, title: "Credit balance off by one after refund", severity: "medium", status: "reproduced", source: "test_run",
        reproductionSteps: "Consume 10 credits\nRefund one run\nOpen Billing & usage",
        rootCause: "Refund counted before ledger commit", environment: "Staging",
      },
      {
        organisationId: id, title: "Logo upload rejects 2x PNG", severity: "low", status: "reproduced", source: "jira", externalKey: "ACME-857",
        reproductionSteps: "Open Settings › Organisation\nUpload a 512×512 PNG", rootCause: "Size check uses bytes instead of KB",
        environment: "Staging",
      },
    ],
  });

  await prisma.pullRequestCheck.createMany({
    data: [
      { organisationId: id, prNumber: 478, title: "Add wallet payments", branch: "feat/wallet", author: "priya", status: "passed_baseline", riskLevel: "high", filesChanged: 31, testsRun: 42, createdAt: ago(5 * DAY) },
      { organisationId: id, prNumber: 479, title: "Refactor invoice PDF renderer", branch: "chore/invoice-pdf", author: "sam", status: "passed_baseline", riskLevel: "medium", filesChanged: 12, testsRun: 18, createdAt: ago(4 * DAY) },
      { organisationId: id, prNumber: 480, title: "Proration preview", branch: "feat/proration", author: "alex", status: "regression_caught", riskLevel: "medium", filesChanged: 9, testsRun: 14, regressions: 1, createdAt: ago(3 * DAY) },
      { organisationId: id, prNumber: 481, title: "Bump UI kit to v5", branch: "deps/ui-kit-5", author: "priya", status: "passed_baseline", riskLevel: "low", filesChanged: 4, testsRun: 9, createdAt: ago(2 * DAY) },
      { organisationId: id, prNumber: 482, title: "Fix checkout session handling", branch: "fix/checkout-session", author: "alex", status: "regression_caught", riskLevel: "high", filesChanged: 27, testsRun: 38, regressions: 2, createdAt: ago(6 * 3_600_000) },
    ],
  });

  await prisma.crawlSession.createMany({
    data: [
      { organisationId: id, targetUrl: "https://staging.acme.example", status: "completed", pagesVisited: 14, flowsMapped: 10, startedAt: ago(3 * DAY), completedAt: ago(3 * DAY - 1_800_000), logs: "[]" },
      { organisationId: id, targetUrl: "https://acme.example", status: "completed", pagesVisited: 11, flowsMapped: 8, startedAt: ago(DAY), completedAt: ago(DAY - 1_200_000), logs: "[]" },
    ],
  });

  const tcs = await prisma.testCase.findMany({ where: { organisationId: id }, select: { id: true, module: true, status: true } });
  const REQS: Array<[string, string, string, string]> = [
    ["REQ-101", "Users can sign in with e-mail or SSO", "jira", "Core"],
    ["REQ-102", "Sessions refresh silently for 30 days", "jira", "Core"],
    ["REQ-201", "Customers can upgrade, downgrade and cancel", "linear", "Billing"],
    ["REQ-202", "Invoices are downloadable as PDF and CSV", "doc", "Billing"],
    ["REQ-301", "Admins manage members and roles", "manual", "Settings"],
    ["REQ-302", "API tokens can be rotated and revoked", "manual", "Settings"],
    ["REQ-401", "Checkout supports cards and wallets", "jira", "Checkout"],
    ["REQ-402", "Declined payments show a recoverable error", "jira", "Checkout"],
    ["REQ-501", "Accessibility: keyboard navigation everywhere", "doc", ""],
  ];
  for (const [code, title, source, module] of REQS) {
    const linked = module ? tcs.filter((t) => t.module === module).slice(0, 4) : [];
    const passing = linked.filter((t) => t.status === "passing").length;
    await prisma.requirement.create({
      data: {
        organisationId: id, code, title, source,
        linkedTestsCount: linked.length,
        coverageStatus: linked.length === 0 ? "uncovered" : passing === linked.length ? "covered" : "partial",
        testCases: { connect: linked.map((t) => ({ id: t.id })) },
      },
    });
  }

  await prisma.testSuite.createMany({
    data: [
      { organisationId: id, name: "Smoke — critical paths", description: "Login, checkout and billing happy paths", schedule: "on_pr", module: "", testCasesCount: 48, passRate: 75, lastRunAt: ago(6 * 3_600_000) },
      { organisationId: id, name: "Billing regression", description: "Every billing flow", schedule: "nightly", module: "Billing", testCasesCount: 14, passRate: 71, lastRunAt: ago(10 * 3_600_000) },
      { organisationId: id, name: "Settings & access", schedule: "weekly", module: "Settings", testCasesCount: 10, passRate: 40, lastRunAt: ago(2 * DAY) },
    ],
  });
  await prisma.testPlan.createMany({
    data: [
      { organisationId: id, name: "Release 2.8 sign-off", description: "Full regression before the 2.8 release", schedule: "manual", environment: "Staging", testCasesCount: 48, passRate: 75, lastRunAt: ago(DAY) },
      { organisationId: id, name: "Nightly checkout", schedule: "nightly", module: "Checkout", environment: "QA", testCasesCount: 7, passRate: 86, lastRunAt: ago(14 * 3_600_000) },
    ],
  });

  await prisma.knowledgeItem.createMany({
    data: [
      { organisationId: id, title: "acme.example (website)", type: "website", urlOrPath: "https://acme.example", status: "indexed" },
      { organisationId: id, title: "Storefront API", type: "openapi", urlOrPath: "https://staging.acme.example/openapi.json", status: "indexed" },
      { organisationId: id, title: "Checkout PRD", type: "doc", urlOrPath: "docs/checkout-prd.md", status: "indexed" },
      { organisationId: id, title: "Support macros export", type: "upload", urlOrPath: "uploads/support-macros.csv", status: "indexed" },
    ],
  });

  await prisma.environmentConfig.createMany({
    data: [
      { organisationId: id, name: "Staging", baseUrl: "https://staging.acme.example", authType: "form", isDefault: true, variablesJson: JSON.stringify({ TEST_USER: "qa+bot@acme.dev", CURRENCY: "EUR" }) },
      { organisationId: id, name: "QA", baseUrl: "https://qa.acme.example", authType: "basic", variablesJson: JSON.stringify({ FEATURE_WALLET: "true" }) },
      { organisationId: id, name: "Localhost", baseUrl: "http://localhost:3000", authType: "none", variablesJson: "{}" },
    ],
  });

  for (const name of ["CI pipeline", "Local MCP (Alex)"]) {
    const t = generateApiToken();
    await prisma.apiToken.create({
      data: { organisationId: id, name, tokenPrefix: t.prefix, tokenHash: t.hash, lastUsedAt: name === "CI pipeline" ? ago(3_600_000) : null },
    });
  }

  await prisma.upload.createMany({
    data: [
      { organisationId: id, fileName: "storefront-2.8.1.apk", kind: "apk", sizeBytes: 48_211_456, uploadedBy: DEMO_EMAIL },
      { organisationId: id, fileName: "checkout-session.har", kind: "har", sizeBytes: 2_411_022, uploadedBy: "sam@acme.dev" },
      { organisationId: id, fileName: "storefront.postman_collection.json", kind: "postman", sizeBytes: 88_104, uploadedBy: DEMO_EMAIL },
    ],
  });

  const AUDITS: Array<[string, string, string, number]> = [
    [DEMO_EMAIL, "organisation.created", "Acme", 3 * DAY],
    [DEMO_EMAIL, "integration.connected", "GITHUB · acme/storefront", 3 * DAY - 600_000],
    [DEMO_EMAIL, "integration.connected", "JIRA · ACME", 3 * DAY - 500_000],
    [DEMO_EMAIL, "crawl.completed", "staging.acme.example · 10 test cases", 3 * DAY - 1_800_000],
    [DEMO_EMAIL, "member.invited", "sam@acme.dev", 2 * DAY],
    [DEMO_EMAIL, "member.invited", "priya@acme.dev", 2 * DAY - 60_000],
    ["sam@acme.dev", "suite.run", "Billing regression · 71%", 10 * 3_600_000],
    [DEMO_EMAIL, "api_token.created", "CI pipeline", 9 * 3_600_000],
    [DEMO_EMAIL, "pr.analyzed", "#482 Fix checkout session handling", 6 * 3_600_000],
    [DEMO_EMAIL, "bug.reproduced", "ACME-842 Checkout session lost after token refresh", 5 * 3_600_000],
    [DEMO_EMAIL, "test_case.run", "Session refresh keeps the user signed in · failing", 2 * 3_600_000],
  ];
  await prisma.systemAuditLog.createMany({
    data: AUDITS.map(([actorEmail, action, target, msAgo]) => ({ organisationId: id, actorEmail, action, target, createdAt: ago(msAgo) })),
  });

  // ---- Gap-analysis demo data (projects, schedules, data, visual, infra, enterprise) ----
  const projects = await prisma.project.createManyAndReturn({
    data: [
      { organisationId: id, name: "Storefront", description: "B2C web storefront", type: "web", baseUrl: "https://acme.example" },
      { organisationId: id, name: "Admin Panel", description: "Internal admin console", type: "web", baseUrl: "https://admin.acme.example" },
      { organisationId: id, name: "Mobile App", description: "iOS + Android builds", type: "mobile" },
    ],
    select: { id: true, name: true },
  });
  for (const p of projects) {
    await prisma.testCase.updateMany({ where: { organisationId: id }, data: { projectId: p.id } });
  }

  const staging = await prisma.environmentConfig.findFirst({ where: { organisationId: id, name: "Staging" } });
  if (staging) {
    await prisma.environmentVariable.createMany({
      data: [
        { environmentId: staging.id, key: "BASE_URL", value: "https://staging.acme.example" },
        { environmentId: staging.id, key: "API_KEY", value: "sk_live_demo_4242", isSecret: true },
        { environmentId: staging.id, key: "TEST_USER", value: "qa+bot@acme.dev" },
        { environmentId: staging.id, key: "CURRENCY", value: "EUR" },
        { environmentId: staging.id, key: "FEATURE_WALLET", value: "true" },
      ],
    });
  }

  const plan = await prisma.testPlan.findFirst({ where: { organisationId: id } });
  if (plan) {
    await prisma.schedule.createMany({
      data: [
        { organisationId: id, testPlanId: plan.id, name: "Nightly regression", cronExpression: "0 2 * * *", timezone: "UTC", enabled: true },
        { organisationId: id, testPlanId: plan.id, name: "Hourly smoke", cronExpression: "0 * * * *", timezone: "Europe/Paris", enabled: false },
      ],
    });
  }

  await prisma.dataProfile.createMany({
    data: [
      {
        organisationId: id,
        name: "Checkout users",
        sourceType: "csv",
        columnsJson: JSON.stringify(["username", "currency"]),
        rowsJson: JSON.stringify([
          { username: "alice", currency: "EUR" },
          { username: "bob", currency: "USD" },
        ]),
      },
      {
        organisationId: id,
        name: "Billing cards",
        sourceType: "manual",
        columnsJson: JSON.stringify(["card", "country"]),
        rowsJson: JSON.stringify([{ card: "4242", country: "FR" }]),
      },
    ],
  });

  const firstCase = await prisma.testCase.findFirst({ where: { organisationId: id } });
  if (firstCase) {
    for (let i = 0; i < 3; i++) {
      await prisma.visualBaseline.create({
        data: {
          organisationId: id,
          testCaseId: firstCase.id,
          stepIndex: i,
          screenshotB64: `demo-screenshot-${i}`,
          pixelHash: `hash-${i}`,
          status: i === 0 ? "approved" : "pending",
        },
      });
    }
  }

  await prisma.webhook.createMany({
    data: [
      { organisationId: id, name: "CI results", url: "https://ci.acme.example/hook", events: JSON.stringify(["test.completed"]) },
      { organisationId: id, name: "Slack QA alerts", url: "https://hooks.slack.com/services/DEMO", events: JSON.stringify(["test.failed", "regression.found"]) },
    ],
  });
  await prisma.notificationRule.createMany({
    data: [
      { organisationId: id, channel: "slack", events: JSON.stringify(["test.failed"]), configJson: JSON.stringify({ channel: "#qa-alerts" }) },
      { organisationId: id, channel: "email", events: JSON.stringify(["release.verdict"]), configJson: JSON.stringify({ to: "qa@acme.dev" }) },
    ],
  });
  await prisma.persona.createMany({
    data: [
      { organisationId: id, name: "Frustrated Customer", temperament: "frustrated", behaviorRules: JSON.stringify(["short sentences", "escalates quickly"]) },
      { organisationId: id, name: "Confused User", temperament: "confused", behaviorRules: JSON.stringify(["clarifying questions"]) },
      { organisationId: id, name: "Adversarial Tester", temperament: "adversarial", behaviorRules: JSON.stringify(["prompt injection attempts"]) },
    ],
  });
  await prisma.exploratorySession.create({
    data: {
      organisationId: id,
      userId: "seed",
      status: "completed",
      endedAt: ago(3_600_000),
      actionsJson: JSON.stringify([
        { kind: "navigate", target: "https://staging.acme.example" },
        { kind: "click", target: "Checkout button" },
        { kind: "verify", target: "Total shown" },
      ]),
      notesJson: JSON.stringify(["Price looked correct"]),
    },
  });
  await prisma.testComponent.create({
    data: { organisationId: id, name: "Login flow", description: "Reusable login steps", stepsJson: JSON.stringify([{ id: "c1", action: "Navigate", target: "https://acme.example/login", value: "", selector: "" }]) },
  });
  await prisma.contextSource.create({
    data: { organisationId: id, type: "JIRA_STORY", sourceUrl: "https://acme.atlassian.net/browse/ACME-842", metadataJson: JSON.stringify({ ticket: "ACME-842" }), extractedText: "Checkout session lost after token refresh" },
  });

  // Performance metrics for the latest demo run
  const latestRun = await prisma.testRun.findFirst({ where: { organisationId: id }, orderBy: { createdAt: "desc" } });
  if (latestRun) {
    await prisma.performanceMetric.createMany({
      data: [
        { testRunId: latestRun.id, metric: "LCP", value: 2100, threshold: 2500, passed: true },
        { testRunId: latestRun.id, metric: "FCP", value: 1400, threshold: 1800, passed: true },
        { testRunId: latestRun.id, metric: "CLS", value: 0.08, threshold: 0.1, passed: true },
        { testRunId: latestRun.id, metric: "TTFB", value: 620, threshold: 800, passed: true },
        { testRunId: latestRun.id, metric: "TTI", value: 4100, threshold: 3800, passed: false },
      ],
    });
  }

  // ---- Marketing CMS + dashboard expansion demo data ----
  const BLOG_CONTENT = (topic: string) =>
    `Every release cycle, teams lose days to brittle selectors and silent regressions. ${topic} changes the equation: agents crawl your app, generate tests in natural language and heal themselves when the UI drifts.\n\nIn this post we walk through the full loop — crawl, generation, execution with evidence, and the Go/No-Go verdict — with real numbers from seeded runs.\n\nThe takeaway: quality becomes a pipeline you can trust, not a gate you fear.`;

  await prisma.blogPost.createMany({
    data: [
      { slug: "agentic-quality-engineering", title: "Agentic quality engineering in 2026", summary: "Why autonomous SDLC beats script recorders.", contentHtml: BLOG_CONTENT("Agentic quality engineering"), authorName: "Alex Morgan", authorRole: "Founder", tags: "AI Testing, Automation", readTimeMin: 8, featured: true },
      { slug: "self-healing-fingerprinting", title: "Multi-layer fingerprinting: how self-healing really works", summary: "0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position.", contentHtml: BLOG_CONTENT("Multi-layer fingerprinting"), authorName: "Sam Lee", authorRole: "Staff Engineer", tags: "Self-Healing, AI Testing", readTimeMin: 10 },
      { slug: "mcp-for-qa-agents", title: "MCP for QA: agents that write, run and heal tests", summary: "13 tools over SSE, from IDE to CI.", contentHtml: BLOG_CONTENT("MCP for QA"), authorName: "Priya Shah", authorRole: "QA Lead", tags: "MCP, Integrations", readTimeMin: 7 },
      { slug: "red-teaming-llm-agents", title: "Red teaming LLM agents with OWASP Top 10", summary: "Automated adversarial suites for agent safety.", contentHtml: BLOG_CONTENT("Red teaming"), authorName: "Alex Morgan", authorRole: "Founder", tags: "Security, AI Agents", readTimeMin: 9 },
      { slug: "ship-release-automation", title: "Ship: the autonomous release pipeline", summary: "Crawl to Go/No-Go in one command.", contentHtml: BLOG_CONTENT("Ship"), authorName: "Sam Lee", authorRole: "Staff Engineer", tags: "Ship, CI/CD", readTimeMin: 6 },
      { slug: "visual-regression-at-scale", title: "Visual regression without the flakiness", summary: "Baselines, hashes and approval workflows.", contentHtml: BLOG_CONTENT("Visual regression"), authorName: "Priya Shah", authorRole: "QA Lead", tags: "Visual Testing", readTimeMin: 5 },
    ],
  });

  await prisma.caseStudy.createMany({
    data: [
      { slug: "fintech-atlas-bank", companyName: "Atlas Bank", industry: "FinTech", heroQuote: "Ship flagged the session regression before anyone opened the diff.", challenge: "Escaped bugs in checkout and billing despite nightly manual QA.", solution: "Autonomous crawl, PR impact analysis and self-healing suites on Chaos/Staging.", resultsJson: JSON.stringify([{ metric: "72%", label: "regressions caught before merge" }, { metric: "94%", label: "change-to-test coverage" }, { metric: "68%", label: "faster bug resolution" }]), fullStory: "Atlas Bank deployed ContextQA across storefront and billing in 6 weeks. Release reviews dropped from one hour to five minutes.", featured: true },
      { slug: "retail-agentco", companyName: "AgentCo Retail", industry: "Retail", heroQuote: "Every PR now ships with evidence.", challenge: "Slow code reviews and flaky tests across 40 services.", solution: "Risk-based prioritization plus MCP-driven agent authoring.", resultsJson: JSON.stringify([{ metric: "43%", label: "lower cost of quality" }, { metric: "12×", label: "more PRs checked" }, { metric: "85%", label: "flakiness reduced" }]), fullStory: "AgentCo cut flakiness by 85% in a quarter with fingerprinting-based healing and red teaming.", featured: true },
      { slug: "saas-cloudnorth", companyName: "CloudNorth SaaS", industry: "B2B SaaS", heroQuote: "The pilot paid for itself in month one.", challenge: "AI copilot shipped hallucinations to production.", solution: "LLM-as-a-judge guardrails plus knowledge-grounded evaluations.", resultsJson: JSON.stringify([{ metric: "92%", label: "hallucination reduction" }, { metric: "4 wks", label: "to full rollout" }, { metric: "3×", label: "release velocity" }]), fullStory: "CloudNorth evaluated its support copilot per persona and gated releases on judge scores.", featured: false },
      { slug: "healthcare-medbridge", companyName: "MedBridge Care", industry: "Healthcare", heroQuote: "Compliance-ready evidence for every release.", challenge: "HIPAA-grade audit evidence for every change.", solution: "Immutable evidence trail with BPA audit exports.", resultsJson: JSON.stringify([{ metric: "100%", label: "releases with evidence" }, { metric: "0", label: "audit findings" }, { metric: "30 min", label: "audit prep time" }]), fullStory: "MedBridge passes SOC2 and HIPAA audits with one-click evidence exports.", featured: false },
    ],
  });

  const TERMS: Array<[string, string, string]> = [
    ["Agentic AI Testing", "AI Testing", "Using autonomous agents to author, execute and heal tests."],
    ["Test Case", "Automation", "A structured sequence of steps with expected outcomes."],
    ["Self-Healing", "AI Testing", "Automatic repair of broken selectors via DOM similarity."],
    ["Context Graph", "AI Testing", "Knowledge graph linking sources, requirements and tests."],
    ["MCP (Model Context Protocol)", "Integrations", "Open protocol exposing tools to AI coding agents."],
    ["PR Impact Analysis", "Automation", "Mapping changed files to the minimal regression scope."],
    ["Visual Regression", "Visual Testing", "Pixel-level screenshot comparison with thresholds."],
    ["Flakiness Index", "Analytics", "Proportion of unstable outcomes per test case."],
    ["Risk-Based Testing", "Strategy", "Prioritizing tests by failure probability."],
    ["Guardrails", "Security", "Policies blocking prompt injection, leaks and jailbreaks."],
    ["Hallucination", "AI Testing", "Ungrounded model output vs a knowledge base."],
    ["Test Plan", "Automation", "A bundle of suites with schedule and browser matrix."],
    ["Test Suite", "Automation", "A reusable group of test cases."],
    ["CodiTOS", "Integration", "Code generation from natural language tests."],
    ["Red Teaming", "Security", "Adversarial prompts mapped to OWASP LLM Top 10."],
    ["Ship", "CI/CD", "Autonomous release pipeline with Go/No-Go verdicts."],
    ["Data Profile", "Data-Driven", "Parameterized rows driving test execution."],
    ["Environment Variable", "Platform", "Per-environment configuration with secret masking."],
    ["Persona Simulation", "AI Testing", "Temperament-driven multi-turn agent stress tests."],
    ["Evidence Trail", "Compliance", "Screenshots, logs and traces per execution."],
  ];
  await prisma.glossaryTerm.createMany({
    data: TERMS.map(([term, category, shortDef]) => ({
      slug: term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      term,
      category,
      shortDef,
      detailedDef: `${shortDef} Full definition and documentation are available in the Learning Hub.`,
      relatedTerms: "Self-Healing, Test Plan, MCP",
    })),
  });

  await prisma.course.createMany({
    data: [
      { slug: "certified-ai-quality-engineer", title: "Certified AI Quality Engineer", level: "Beginner", durationHours: 12, description: "Foundations of agentic testing: NLP authoring, healing, MCP and Ship.", syllabusJson: JSON.stringify([{ module: "Module 1", lessons: ["NLP test authoring", "Crawl-to-test"] }, { module: "Module 2", lessons: ["Self-healing", "Evidence & RCA"] }]), badgeName: "AI Quality Engineer" },
      { slug: "autonomous-test-architect", title: "Autonomous Test Architect", level: "Advanced", durationHours: 24, description: "Design enterprise pipelines: grid infra, red teaming, risk-based testing.", syllabusJson: JSON.stringify([{ module: "Module 1", lessons: ["Architecture", "Grid & devices"] }, { module: "Module 2", lessons: ["Agent evaluation", "Ship at scale"] }]), badgeName: "Autonomous Test Architect" },
      { slug: "mcp-agent-engineering", title: "MCP Agent Engineering", level: "Intermediate", durationHours: 8, description: "Build and secure MCP tool servers for QA agents.", syllabusJson: JSON.stringify([{ module: "Module 1", lessons: ["SSE + JSON-RPC", "Token auth"] }, { module: "Module 2", lessons: ["Tool catalog", "Cursor / Claude Code"] }]), badgeName: "MCP Engineer" },
    ],
  });

  // Email inboxes, security scans, grid nodes and risk analyses
  const inboxAddrs = ["signup flow", "password reset", "2fa codes", "invoice emails", "magic links", "welcome series", "alerts", "support replies", "billing receipts", "security notices"];
  for (const [i, label] of inboxAddrs.entries()) {
    const inbox = await prisma.emailTestInbox.create({ data: { organisationId: id, emailAddress: `test-${i}@inbox.qasyn.local`, label } });
    if (i % 2 === 0) {
      await prisma.emailTestMessage.create({
        data: { inboxId: inbox.id, from: "no-reply@qasyn.local", to: inbox.emailAddress, subject: "Your verification code", bodyText: `Your code is ${100000 + i}`, bodyHtml: `<p>Code <strong>${100000 + i}</strong></p><a href="https://app.qasyn.local/verify?token=magic-${100000 + i}">Verify</a>`, extractedOtp: String(100000 + i), extractedLinks: JSON.stringify([`https://app.qasyn.local/verify?token=magic-${100000 + i}`]) },
      });
    }
  }

  await prisma.securityScan.createMany({
    data: [
      { organisationId: id, targetUrl: "https://staging.acme.example", scanType: "OWASP_TOP_10", status: "COMPLETED", highCount: 1, mediumCount: 2, lowCount: 3, findingsJson: JSON.stringify([{ check: "CSP header", severity: "medium" }, { check: "XSS reflection", severity: "high" }]), completedAt: new Date() },
      { organisationId: id, targetUrl: "https://acme.example", scanType: "HEADERS_SSL", status: "COMPLETED", highCount: 0, mediumCount: 1, lowCount: 2, findingsJson: JSON.stringify([{ check: "HSTS", severity: "low" }]), completedAt: new Date() },
      { organisationId: id, targetUrl: "https://admin.acme.example", scanType: "FULL_AUDIT", status: "COMPLETED", highCount: 2, mediumCount: 4, lowCount: 5, findingsJson: JSON.stringify([{ check: "Cookie flags", severity: "medium" }, { check: "SQL injection vector", severity: "high" }]), completedAt: new Date() },
      { organisationId: id, targetUrl: "https://qa.acme.example", scanType: "OWASP_TOP_10", status: "COMPLETED", highCount: 0, mediumCount: 0, lowCount: 1, findingsJson: JSON.stringify([]), completedAt: new Date() },
      { organisationId: id, targetUrl: "https://staging.acme.example", scanType: "OWASP_TOP_10", status: "COMPLETED", highCount: 1, mediumCount: 1, lowCount: 0, findingsJson: JSON.stringify([{ check: "Debug exposure", severity: "low" }]), completedAt: new Date() },
    ],
  });

  await prisma.infrastructureGridNode.createMany({
    data: [
      { organisationId: id, browserName: "chromium", platform: "linux", version: "120", status: "IDLE", concurrencyCap: 10, activeWorkers: 3 },
      { organisationId: id, browserName: "webkit", platform: "macos", version: "17", status: "BUSY", concurrencyCap: 5, activeWorkers: 5 },
      { organisationId: id, browserName: "firefox", platform: "linux", version: "126", status: "IDLE", concurrencyCap: 8, activeWorkers: 0 },
      { organisationId: id, browserName: "edge", platform: "windows", version: "126", status: "IDLE", concurrencyCap: 8, activeWorkers: 1 },
    ],
  });

  await prisma.riskAnalysis.createMany({
    data: [
      { organisationId: id, branchName: "fix/checkout-session", prNumber: 482, riskScore: 86, riskLevel: "HIGH", factorsJson: JSON.stringify([{ label: "Code churn", weight: 30 }, { label: "Flaky cases", weight: 25 }]), suggestedTests: JSON.stringify([]) },
      { organisationId: id, branchName: "feat/wallet", prNumber: 478, riskScore: 62, riskLevel: "HIGH", factorsJson: JSON.stringify([{ label: "Modules touched", weight: 20 }]), suggestedTests: JSON.stringify([]) },
      { organisationId: id, branchName: "chore/invoice-pdf", prNumber: 479, riskScore: 28, riskLevel: "LOW", factorsJson: JSON.stringify([{ label: "Code churn", weight: 10 }]), suggestedTests: JSON.stringify([]) },
    ],
  });

  console.log(`✔ Seed OK — "${org.name}" (${org.slug}) · ${runs} runs · 48 test cases · login ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

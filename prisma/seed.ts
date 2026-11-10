/**
 * Seed: `npm run db:seed` (also executed by `prisma migrate reset`).
 *
 * Creates two rich workspaces:
 *  - the shared mock demo "Acme" (slug `acme`, isMockDemo) — demo@acme.dev / AcmeDemo2026!
 *  - the validation workspace "CGI" (slug `cgi`, plan `pro`) — cgi@cgi.com / CgiDemo2026!
 *    with Admin, QA, Engineer and BA / FA accounts (same password).
 * Organisations created through /signup start empty (strict tenant isolation).
 * Idempotent: each workspace and its users are deleted and recreated.
 */
import { PrismaClient } from "@prisma/client";
import { generateApiToken, hashPassword } from "../lib/crypto";
import { createDemoRuns } from "../lib/runs";
import { ensureSuperAdmin } from "../lib/super-admin";

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

function stepsFor(baseUrl: string, count: number) {
  const base = baseUrl.replace(/\/$/, "");
  const host = base.replace(/^https?:\/\//, "");
  const templates: Array<{ action: string; target: string; value?: string }> = [
    { action: "Navigate", target: `Navigate to ${base}` },
    { action: "Verify Element", target: `Verify that the ${host} home page is visible` },
    { action: "Click", target: "Click on the Sign in link" },
    { action: "Enter Text", target: "Enter the e-mail address in the E-mail field", value: "qa@example.test" },
    { action: "Enter Text", target: "Enter the password in the Password field", value: "••••••••" },
    { action: "Click", target: "Click the Continue button" },
    { action: "Verify Element", target: "Verify that the account dashboard is displayed" },
    { action: "Click", target: "Click the primary navigation item" },
    { action: "Verify Element", target: `Verify that the ${host} page URL is loaded` },
    { action: "Click", target: "Click the Save button" },
    { action: "Verify Element", target: "Verify that the confirmation toast is displayed" },
    { action: "AI Assertion", target: `Assert that the ${host} workflow completed without errors` },
  ];
  return Array.from({ length: count }, (_, index) => ({
    id: `s${index + 1}`,
    ...templates[index % templates.length],
    value: templates[index % templates.length].value ?? "",
    selector: "",
  }));
}

interface Workspace {
  slug: string;
  name: string;
  ownerName: string;
  website: string;
  plan: "trial" | "pro";
  isMockDemo: boolean;
  email: string;
  password: string;
  projectLabel: string;
  releaseSeed: number;
  users: Array<{ email: string; name: string; role: string; initials: string }>;
  integrations: Array<{ provider: string; detail: string; config: Record<string, string> }>;
}

const WORKSPACES: Workspace[] = [
  {
    slug: "acme",
    name: "Acme",
    ownerName: "Alex Morgan",
    website: "https://acme.example",
    plan: "trial",
    isMockDemo: true,
    email: "demo@acme.dev",
    password: "AcmeDemo2026!",
    projectLabel: "acme / storefront",
    releaseSeed: 277,
    users: [
      { email: "demo@acme.dev", name: "Alex Morgan", role: "Admin", initials: "AM" },
      { email: "sam@acme.dev", name: "Sam Lee", role: "QA", initials: "SL" },
      { email: "priya@acme.dev", name: "Priya Shah", role: "Engineer", initials: "PS" },
    ],
    integrations: [
      {
        provider: "GITHUB",
        detail: "acme/storefront",
        config: { organization: "acme", repository: "storefront", baseBranch: "main" },
      },
      { provider: "JIRA", detail: "ACME", config: { siteUrl: "https://acme.atlassian.net", projectKey: "ACME" } },
      { provider: "SLACK", detail: "#qa-alerts", config: { channel: "#qa-alerts" } },
    ],
  },
  {
    slug: "cgi",
    name: "CGI",
    ownerName: "Claire Girard",
    website: "https://www.cgi.com",
    plan: "pro",
    isMockDemo: false,
    email: "cgi@cgi.com",
    password: "CgiDemo2026!",
    projectLabel: "cgi / digital-portal",
    releaseSeed: 284,
    users: [
      { email: "cgi@cgi.com", name: "Claire Girard", role: "Admin", initials: "CG" },
      { email: "qa@cgi.com", name: "Sam Lee", role: "QA", initials: "SL" },
      { email: "engineer@cgi.com", name: "Priya Shah", role: "Engineer", initials: "PS" },
      { email: "ba@cgi.com", name: "Nadia Benali", role: "BA / FA", initials: "NB" },
    ],
    integrations: [
      {
        provider: "GITHUB",
        detail: "cgi/digital-portal",
        config: { organization: "cgi", repository: "digital-portal", baseBranch: "main" },
      },
      {
        provider: "GITLAB",
        detail: "cgi/digital-portal",
        config: { instanceUrl: "https://gitlab.com", projectPath: "cgi/digital-portal", baseBranch: "main" },
      },
      {
        provider: "AZURE_DEVOPS",
        detail: "cgi / Digital Portal",
        config: { organization: "cgi", project: "Digital Portal", repository: "digital-portal", baseBranch: "main" },
      },
      { provider: "JIRA", detail: "https://cgi.atlassian.net · DP", config: { siteUrl: "https://cgi.atlassian.net", projectKey: "DP" } },
      { provider: "SLACK", detail: "#qa-alerts", config: { channel: "#qa-alerts" } },
    ],
  },
];

const DAY = 86_400_000;
const ago = (ms: number) => new Date(Date.now() - ms);

async function seedWorkspace(cfg: Workspace) {
  const host = cfg.website.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const staging = `https://staging.${host}`;
  const base = cfg.website.replace(/\/$/, "");

  const existing = await prisma.organisation.findUnique({ where: { slug: cfg.slug }, select: { id: true } });
  if (existing) await prisma.user.deleteMany({ where: { organisationId: existing.id } });
  await prisma.user.deleteMany({ where: { email: { in: cfg.users.map((u) => u.email) } } });
  await prisma.organisation.deleteMany({ where: { slug: cfg.slug } });

  const org = await prisma.organisation.create({
    data: {
      name: cfg.name,
      slug: cfg.slug,
      ownerName: cfg.ownerName,
      website: cfg.website,
      addToKnowledgeBase: true,
      isMockDemo: cfg.isMockDemo,
      plan: cfg.plan,
      trialStartsAt: new Date(),
      trialEndsAt: new Date(Date.now() + 30 * DAY),
      trialCredits: cfg.plan === "pro" ? 5000 : 3000,
      creditsUsed: cfg.plan === "pro" ? 1140 : 640,
      settingsJson: JSON.stringify({ dismissed: ["slack"] }),
      onboarding: {
        create: {
          currentStep: 7,
          appDescription:
            `${cfg.name} Digital Portal is a customer-facing web application. Customers sign in, manage their profile, ` +
            "browse services, complete checkout and manage invoices. Critical flows: login (email + SSO), checkout, " +
            "payments, billing and workspace settings.",
          reachMode: "staging",
          environmentUrl: staging,
          appLoginType: "signup_test_account",
          painPoints: JSON.stringify(["Escaped bugs", "Slow code reviews", "PR checks"]),
          userRole: "Eng manager",
          testingMaturity: "Some automation",
          focusPriority: "PR_IMPACT",
          invitedEmails: cfg.users.slice(1).map((u) => u.email).join("\n"),
          completedAt: ago(3 * DAY),
        },
      },
      users: {
        create: await Promise.all(
          cfg.users.map(async (user) => ({
            email: user.email,
            passwordHash: await hashPassword(cfg.password),
            name: user.name,
            role: user.role,
            avatarInitials: user.initials,
            emailVerifiedAt: ago(3 * DAY),
            status: "active",
          })),
        ),
      },
      integrations: {
        create: cfg.integrations.map((integration) => ({
          provider: integration.provider,
          status: "CONNECTED",
          detail: integration.detail,
          configJson: JSON.stringify(integration.config),
          lastSyncAt: ago(2 * 3_600_000),
        })),
      },
    },
  });
  const id = org.id;

  const runs = await createDemoRuns(prisma, id, cfg.projectLabel, cfg.releaseSeed);

  let i = 0;
  const createdCases: Array<{ id: string; module: string; status: string }> = [];
  for (const [module, rows] of Object.entries(TEST_CASES)) {
    for (const [title, criticality, status, stepsCount] of rows) {
      i++;
      const steps = stepsFor(base, stepsCount);
      const created = await prisma.testCase.create({
        data: {
          organisationId: id,
          title,
          module,
          criticality,
          status,
          stepsCount,
          stepsJson: JSON.stringify(steps),
          variablesJson: JSON.stringify({ url: base }),
          description: `Validate the ${module} workflow for "${title}" on ${base}, including navigation, verification steps and locale persistence.`,
          labelsJson: JSON.stringify([module.toLowerCase(), status === "failing" ? "regression" : "smoke"]),
          environment: "Staging",
          source: i % 3 === 0 ? "ai" : i % 5 === 0 ? "crawl" : "manual",
          lastRunAt: status === "draft" ? null : ago((i % 9) * 3_600_000 + 600_000),
          createdAt: ago((20 - (i % 20)) * DAY),
        },
        select: { id: true, module: true, status: true },
      });
      createdCases.push(created);
    }
  }

  await prisma.bugReport.createMany({
    data: [
      {
        organisationId: id, title: "Checkout session lost after token refresh", severity: "critical", status: "reproduced",
        source: "jira", externalKey: `${cfg.slug.toUpperCase()}-842`,
        reproductionSteps: "Log in\nAdd 2 items to the cart\nWait 15 min for the access token to expire\nClick Pay → 401, cart emptied",
        rootCause: "stale token in auth/refresh.ts:87", environment: "Staging", videoUrl: "/evidence/session.webm",
      },
      {
        organisationId: id, title: "Retry payment button does nothing on Safari", severity: "high", status: "reproduced",
        source: "linear", externalKey: "ENG-311",
        reproductionSteps: "Use Safari 17\nOpen Billing → Failed payment\nClick Retry payment",
        rootCause: "Promise rejection swallowed in billing/retry.tsx:42", environment: "Staging", videoUrl: "/evidence/retry.webm",
      },
      {
        organisationId: id, title: "Member role change not persisted", severity: "high", status: "reproduced", source: "test_run",
        reproductionSteps: "Open Settings → Team\nChange a member role\nReload the page",
        rootCause: "PATCH /members ignores role when status = invited", environment: "QA",
      },
      {
        organisationId: id, title: "Credit balance off by one after refund", severity: "medium", status: "reproduced", source: "test_run",
        reproductionSteps: "Consume 10 credits\nRefund one run\nOpen Billing & usage",
        rootCause: "Refund counted before ledger commit", environment: "Staging",
      },
      {
        organisationId: id, title: "Logo upload rejects 2x PNG", severity: "low", status: "reproduced", source: "jira", externalKey: `${cfg.slug.toUpperCase()}-857`,
        reproductionSteps: "Open Settings → Organisation\nUpload a 512×512 PNG", rootCause: "Size check uses bytes instead of KB",
        environment: "Staging",
      },
    ],
  });

  await prisma.pullRequestCheck.createMany({
    data: [
      { organisationId: id, prNumber: 478, title: "Add wallet payments", branch: "feat/wallet", branchTarget: "main", provider: "GITHUB", repository: `${cfg.slug}/digital-portal`, author: "priya", status: "passed_baseline", riskLevel: "high", filesChanged: 31, testsRun: 42, createdAt: ago(5 * DAY) },
      { organisationId: id, prNumber: 479, title: "Refactor invoice PDF renderer", branch: "chore/invoice-pdf", branchTarget: "main", provider: "GITHUB", repository: `${cfg.slug}/digital-portal`, author: "sam", status: "passed_baseline", riskLevel: "medium", filesChanged: 12, testsRun: 18, createdAt: ago(4 * DAY) },
      { organisationId: id, prNumber: 480, title: "Proration preview", branch: "feat/proration", branchTarget: "main", provider: "GITHUB", repository: `${cfg.slug}/digital-portal`, author: "alex", status: "regression_caught", riskLevel: "medium", filesChanged: 9, testsRun: 14, regressions: 1, createdAt: ago(3 * DAY) },
      { organisationId: id, prNumber: 481, title: "Bump UI kit to v5", branch: "deps/ui-kit-5", branchTarget: "main", provider: "GITHUB", repository: `${cfg.slug}/digital-portal`, author: "priya", status: "passed_baseline", riskLevel: "low", filesChanged: 4, testsRun: 9, createdAt: ago(2 * DAY) },
      { organisationId: id, prNumber: 482, title: "Fix checkout session handling", branch: "fix/checkout-session", branchTarget: "main", provider: "GITHUB", repository: `${cfg.slug}/digital-portal`, author: "alex", status: "regression_caught", riskLevel: "high", filesChanged: 27, testsRun: 38, regressions: 2, createdAt: ago(6 * 3_600_000) },
    ],
  });

  await prisma.crawlSession.createMany({
    data: [
      { organisationId: id, targetUrl: staging, status: "completed", pagesVisited: 14, flowsMapped: 10, startedAt: ago(3 * DAY), completedAt: ago(3 * DAY - 1_800_000), logs: "[]" },
      { organisationId: id, targetUrl: base, status: "completed", pagesVisited: 11, flowsMapped: 8, startedAt: ago(DAY), completedAt: ago(DAY - 1_200_000), logs: "[]" },
    ],
  });

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
    const linked = module ? createdCases.filter((t) => t.module === module).slice(0, 4) : [];
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

  const suiteDefs = [
    { name: "Smoke — critical paths", description: "Login, checkout and billing happy paths", schedule: "on_pr", module: "", cases: createdCases },
    { name: "Billing regression", description: "Every billing flow", schedule: "nightly", module: "Billing", cases: createdCases.filter((t) => t.module === "Billing") },
    { name: "Settings & access", description: "Workspace, team and token settings", schedule: "weekly", module: "Settings", cases: createdCases.filter((t) => t.module === "Settings") },
    { name: "Checkout regression", description: "Cart, payments and checkout recovery", schedule: "nightly", module: "Checkout", cases: createdCases.filter((t) => t.module === "Checkout") },
  ];
  const seededSuites: Array<{ id: string; name: string; module: string }> = [];
  for (const def of suiteDefs) {
    const passing = def.cases.filter((t) => t.status === "passing").length;
    const suite = await prisma.testSuite.create({
      data: {
        organisationId: id,
        name: def.name,
        description: def.description,
        schedule: def.schedule,
        module: def.module,
        testCasesCount: def.cases.length,
        passRate: def.cases.length ? Math.round((passing / def.cases.length) * 100) : 0,
        lastRunAt: ago(6 * 3_600_000),
        labelsJson: JSON.stringify([def.module ? def.module.toLowerCase() : "smoke"]),
        testCases: { connect: def.cases.map((testCase) => ({ id: testCase.id })) },
      },
      select: { id: true, name: true, module: true },
    });
    seededSuites.push(suite);
  }

  const planDefs = [
    {
      name: "Release 2.8 sign-off",
      description: "Full regression before the 2.8 release",
      schedule: "manual",
      module: "",
      environment: "Staging",
      suites: seededSuites,
      cases: createdCases,
      lastRunAt: ago(DAY),
    },
    {
      name: "Nightly checkout",
      description: "Every checkout and payment flow",
      schedule: "nightly",
      module: "Checkout",
      environment: "QA",
      suites: seededSuites.filter((suite) => suite.module === "Checkout"),
      cases: createdCases.filter((testCase) => testCase.module === "Checkout"),
      lastRunAt: ago(14 * 3_600_000),
    },
  ];
  const seededPlans: Array<{ id: string }> = [];
  for (const def of planDefs) {
    const passing = def.cases.filter((testCase) => testCase.status === "passing").length;
    const plan = await prisma.testPlan.create({
      data: {
        organisationId: id,
        name: def.name,
        description: def.description,
        schedule: def.schedule,
        module: def.module,
        environment: def.environment,
        testCasesCount: def.cases.length,
        passRate: def.cases.length ? Math.round((passing / def.cases.length) * 100) : 0,
        lastRunAt: def.lastRunAt,
        testCases: { connect: def.cases.map((testCase) => ({ id: testCase.id })) },
        suites: { connect: def.suites.map((suite) => ({ id: suite.id })) },
      },
      select: { id: true },
    });
    seededPlans.push(plan);
  }

  await prisma.knowledgeItem.createMany({
    data: [
      { organisationId: id, title: `${host} (website)`, type: "website", urlOrPath: base, status: "indexed" },
      { organisationId: id, title: "Portal API", type: "openapi", urlOrPath: `${staging}/openapi.json`, status: "indexed" },
      { organisationId: id, title: "Checkout PRD", type: "doc", urlOrPath: "docs/checkout-prd.md", status: "indexed" },
      { organisationId: id, title: "Support macros export", type: "upload", urlOrPath: "uploads/support-macros.csv", status: "indexed" },
    ],
  });

  await prisma.environmentConfig.createMany({
    data: [
      { organisationId: id, name: "Staging", baseUrl: staging, authType: "form", isDefault: true, variablesJson: JSON.stringify({ TEST_USER: `qa+bot@${host}`, CURRENCY: "EUR" }) },
      { organisationId: id, name: "QA", baseUrl: `https://qa.${host}`, authType: "basic", variablesJson: JSON.stringify({ FEATURE_WALLET: "true" }) },
      { organisationId: id, name: "Localhost", baseUrl: "http://localhost:3000", authType: "none", variablesJson: "{}" },
    ],
  });

  for (const name of ["CI pipeline", "Local MCP (Claire)"]) {
    const t = generateApiToken();
    await prisma.apiToken.create({
      data: { organisationId: id, name, tokenPrefix: t.prefix, tokenHash: t.hash, lastUsedAt: name === "CI pipeline" ? ago(3_600_000) : null },
    });
  }

  await prisma.upload.createMany({
    data: [
      { organisationId: id, fileName: "portal-2.8.1.apk", kind: "apk", sizeBytes: 48_211_456, uploadedBy: cfg.email },
      { organisationId: id, fileName: "checkout-session.har", kind: "har", sizeBytes: 2_411_022, uploadedBy: cfg.users[1]?.email ?? cfg.email },
      { organisationId: id, fileName: "portal.postman_collection.json", kind: "postman", sizeBytes: 88_104, uploadedBy: cfg.email },
    ],
  });

  const AUDITS: Array<[string, string, string, number]> = [
    [cfg.email, "organisation.created", cfg.name, 3 * DAY],
    [cfg.email, "integration.connected", `GITHUB → ${cfg.slug}/digital-portal`, 3 * DAY - 600_000],
    [cfg.email, "integration.connected", "JIRA → DP", 3 * DAY - 500_000],
    [cfg.email, "crawl.completed", `${staging} → 10 test cases`, 3 * DAY - 1_800_000],
    [cfg.email, "member.invited", cfg.users[1]?.email ?? cfg.email, 2 * DAY],
    [cfg.email, "member.invited", cfg.users[2]?.email ?? cfg.email, 2 * DAY - 60_000],
    [cfg.users[1]?.email ?? cfg.email, "suite.run", "Billing regression → 71%", 10 * 3_600_000],
    [cfg.email, "api_token.created", "CI pipeline", 9 * 3_600_000],
    [cfg.email, "pr.analyzed", "#482 Fix checkout session handling", 6 * 3_600_000],
    [cfg.email, "bug.reproduced", "Checkout session lost after token refresh", 5 * 3_600_000],
    [cfg.email, "test_case.run", "Session refresh keeps the user signed in → failing", 2 * 3_600_000],
  ];
  await prisma.systemAuditLog.createMany({
    data: AUDITS.map(([actorEmail, action, target, msAgo]) => ({ organisationId: id, actorEmail, action, target, createdAt: ago(msAgo) })),
  });

  // ---- Gap-analysis demo data (projects, schedules, data, visual, infra, enterprise) ----
  const projects = await prisma.project.createManyAndReturn({
    data: [
      { organisationId: id, name: "Digital Portal", description: "Customer-facing web portal", type: "web", baseUrl: base },
      { organisationId: id, name: "Admin Panel", description: "Internal admin console", type: "web", baseUrl: `https://admin.${host}` },
      { organisationId: id, name: "Mobile App", description: "iOS + Android builds", type: "mobile" },
    ],
    select: { id: true, name: true },
  });
  for (const p of projects) {
    await prisma.testCase.updateMany({ where: { organisationId: id }, data: { projectId: p.id } });
  }

  const stagingEnv = await prisma.environmentConfig.findFirst({ where: { organisationId: id, name: "Staging" } });
  if (stagingEnv) {
    await prisma.environmentVariable.createMany({
      data: [
        { environmentId: stagingEnv.id, key: "BASE_URL", value: staging },
        { environmentId: stagingEnv.id, key: "API_KEY", value: "sk_live_demo_4242", isSecret: true },
        { environmentId: stagingEnv.id, key: "TEST_USER", value: `qa+bot@${host}` },
        { environmentId: stagingEnv.id, key: "CURRENCY", value: "EUR" },
        { environmentId: stagingEnv.id, key: "FEATURE_WALLET", value: "true" },
      ],
    });
  }

  const schedulePlan = seededPlans[0];
  if (schedulePlan) {
    await prisma.schedule.createMany({
      data: [
        { organisationId: id, testPlanId: schedulePlan.id, name: "Nightly regression", cronExpression: "0 2 * * *", timezone: "UTC", enabled: true },
        { organisationId: id, testPlanId: schedulePlan.id, name: "Hourly smoke", cronExpression: "0 * * * *", timezone: "Europe/Paris", enabled: false },
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

  const firstCase = createdCases[0];
  if (firstCase) {
    for (let v = 0; v < 3; v++) {
      await prisma.visualBaseline.create({
        data: {
          organisationId: id,
          testCaseId: firstCase.id,
          stepIndex: v,
          screenshotB64: `demo-screenshot-${v}`,
          pixelHash: `hash-${v}`,
          status: v === 0 ? "approved" : "pending",
        },
      });
    }
  }

  await prisma.webhook.createMany({
    data: [
      { organisationId: id, name: "CI results", url: `https://ci.${host}/hook`, events: JSON.stringify(["test.completed"]) },
      { organisationId: id, name: "Slack QA alerts", url: "https://hooks.slack.com/services/DEMO", events: JSON.stringify(["test.failed", "regression.found"]) },
    ],
  });
  await prisma.notificationRule.createMany({
    data: [
      { organisationId: id, channel: "slack", events: JSON.stringify(["test.failed"]), configJson: JSON.stringify({ channel: "#qa-alerts" }) },
      { organisationId: id, channel: "email", events: JSON.stringify(["release.verdict"]), configJson: JSON.stringify({ to: `qa@${host}` }) },
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
        { kind: "navigate", target: staging },
        { kind: "click", target: "Checkout button" },
        { kind: "verify", target: "Total shown" },
      ]),
      notesJson: JSON.stringify(["Price looked correct"]),
    },
  });
  await prisma.testComponent.create({
    data: { organisationId: id, name: "Login flow", description: "Reusable login steps", stepsJson: JSON.stringify([{ id: "c1", action: "Navigate", target: `${base}/login`, value: "", selector: "" }]) },
  });
  await prisma.contextSource.create({
    data: { organisationId: id, type: "JIRA_STORY", sourceUrl: `https://${cfg.slug}.atlassian.net/browse/${cfg.slug.toUpperCase()}-842`, metadataJson: JSON.stringify({ ticket: `${cfg.slug.toUpperCase()}-842` }), extractedText: "Checkout session lost after token refresh" },
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

  // Email inboxes, security scans, grid nodes and risk analyses
  const inboxAddrs = ["signup flow", "password reset", "2fa codes", "invoice emails", "magic links", "welcome series", "alerts", "support replies", "billing receipts", "security notices"];
  for (const [index, label] of inboxAddrs.entries()) {
    const inbox = await prisma.emailTestInbox.create({ data: { organisationId: id, emailAddress: `${cfg.slug}-test-${index}@inbox.qasyn.local`, label } });
    if (index % 2 === 0) {
      await prisma.emailTestMessage.create({
        data: { inboxId: inbox.id, from: "no-reply@qasyn.local", to: inbox.emailAddress, subject: "Your verification code", bodyText: `Your code is ${100000 + index}`, bodyHtml: `<p>Code <strong>${100000 + index}</strong></p><a href="https://app.qasyn.local/verify?token=magic-${100000 + index}">Verify</a>`, extractedOtp: String(100000 + index), extractedLinks: JSON.stringify([`https://app.qasyn.local/verify?token=magic-${100000 + index}`]) },
      });
    }
  }

  await prisma.securityScan.createMany({
    data: [
      { organisationId: id, targetUrl: staging, scanType: "OWASP_TOP_10", status: "COMPLETED", highCount: 1, mediumCount: 2, lowCount: 3, findingsJson: JSON.stringify([{ check: "CSP header", severity: "medium" }, { check: "XSS reflection", severity: "high" }]), completedAt: new Date() },
      { organisationId: id, targetUrl: base, scanType: "HEADERS_SSL", status: "COMPLETED", highCount: 0, mediumCount: 1, lowCount: 2, findingsJson: JSON.stringify([{ check: "HSTS", severity: "low" }]), completedAt: new Date() },
      { organisationId: id, targetUrl: `https://admin.${host}`, scanType: "FULL_AUDIT", status: "COMPLETED", highCount: 2, mediumCount: 4, lowCount: 5, findingsJson: JSON.stringify([{ check: "Cookie flags", severity: "medium" }, { check: "SQL injection vector", severity: "high" }]), completedAt: new Date() },
      { organisationId: id, targetUrl: `https://qa.${host}`, scanType: "OWASP_TOP_10", status: "COMPLETED", highCount: 0, mediumCount: 0, lowCount: 1, findingsJson: JSON.stringify([]), completedAt: new Date() },
      { organisationId: id, targetUrl: staging, scanType: "OWASP_TOP_10", status: "COMPLETED", highCount: 1, mediumCount: 1, lowCount: 0, findingsJson: JSON.stringify([{ check: "Debug exposure", severity: "low" }]), completedAt: new Date() },
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

  console.log(`✔ Seed OK — "${org.name}" (${org.slug}) · ${runs} runs · ${createdCases.length} test cases · login ${cfg.email} / ${cfg.password}`);
}

async function seedMarketing() {
  await prisma.blogPost.deleteMany();
  await prisma.caseStudy.deleteMany();
  await prisma.glossaryTerm.deleteMany();
  await prisma.course.deleteMany();
  await prisma.certification.deleteMany();

  const BLOG_CONTENT = (topic: string) =>
    `Every release cycle, teams lose days to brittle selectors and silent regressions. ${topic} changes the equation: agents crawl your app, generate tests in natural language and heal themselves when the UI drifts.\n\nIn this post we walk through the full loop — crawl, generation, execution with evidence, and the Go/No-Go verdict — with real numbers from seeded runs.\n\nThe takeaway: quality becomes a pipeline you can trust, not a gate you fear.`;

  await prisma.blogPost.createMany({
    data: [
      { slug: "agentic-quality-engineering", title: "Agentic quality engineering in 2026", summary: "Why autonomous SDLC beats script recorders.", contentHtml: BLOG_CONTENT("Agentic quality engineering"), authorName: "Alex Morgan", authorRole: "Founder", tags: "AI Testing, Automation", readTimeMin: 8, featured: true },
      { slug: "self-healing-fingerprinting", title: "Multi-layer fingerprinting: how self-healing really works", summary: "0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position.", contentHtml: BLOG_CONTENT("Multi-layer fingerprinting"), authorName: "Sam Lee", authorRole: "Staff Engineer", tags: "Self-Healing, AI Testing", readTimeMin: 10 },
      { slug: "mcp-for-qa-agents", title: "MCP for QA: agents that write, run and heal tests", summary: "Tools over SSE, from IDE to CI.", contentHtml: BLOG_CONTENT("MCP for QA"), authorName: "Priya Shah", authorRole: "QA Lead", tags: "MCP, Integrations", readTimeMin: 7 },
      { slug: "red-teaming-llm-agents", title: "Red teaming LLM agents with OWASP Top 10", summary: "Automated adversarial suites for agent safety.", contentHtml: BLOG_CONTENT("Red teaming"), authorName: "Alex Morgan", authorRole: "Founder", tags: "Security, AI Agents", readTimeMin: 9 },
      { slug: "ship-release-automation", title: "Ship: the autonomous release pipeline", summary: "Crawl to Go/No-Go in one command.", contentHtml: BLOG_CONTENT("Ship"), authorName: "Sam Lee", authorRole: "Staff Engineer", tags: "Ship, CI/CD", readTimeMin: 6 },
      { slug: "visual-regression-at-scale", title: "Visual regression without the flakiness", summary: "Baselines, hashes and approval workflows.", contentHtml: BLOG_CONTENT("Visual regression"), authorName: "Priya Shah", authorRole: "QA Lead", tags: "Visual Testing", readTimeMin: 5 },
    ],
  });

  await prisma.caseStudy.createMany({
    data: [
      { slug: "fintech-atlas-bank", companyName: "Atlas Bank", industry: "FinTech", heroQuote: "Ship flagged the session regression before anyone opened the diff.", challenge: "Escaped bugs in checkout and billing despite nightly manual QA.", solution: "Autonomous crawl, PR impact analysis and self-healing suites on staging.", resultsJson: JSON.stringify([{ metric: "72%", label: "regressions caught before merge" }, { metric: "94%", label: "change-to-test coverage" }, { metric: "68%", label: "faster bug resolution" }]), fullStory: "Atlas Bank deployed QASyn across storefront and billing in 6 weeks. Release reviews dropped from one hour to five minutes.", featured: true },
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
}

async function main() {
  await harden();
  await seedMarketing();
  for (const workspace of WORKSPACES) {
    await seedWorkspace(workspace);
  }
  await ensureSuperAdmin();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

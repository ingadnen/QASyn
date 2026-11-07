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

async function main() {
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

  console.log(`✔ Seed OK — "${org.name}" (${org.slug}) · ${runs} runs · 48 test cases · login ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

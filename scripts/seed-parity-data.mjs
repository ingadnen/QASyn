import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const VIEWPORTS = [
  ["Mobile S", 375, 667, "Mobile"],
  ["Mobile M", 390, 844, "Mobile"],
  ["Mobile L", 412, 915, "Mobile"],
  ["Tablet Portrait", 768, 1024, "Tablet"],
  ["Tablet Landscape", 1024, 768, "Tablet"],
  ["iPad Pro", 1024, 1366, "Tablet"],
  ["Laptop S", 1280, 720, "Laptop"],
  ["Laptop M", 1366, 768, "Laptop"],
  ["Laptop L", 1440, 900, "Laptop"],
  ["Default", 1280, 720, "Desktop"],
  ["Full HD", 1920, 1080, "Desktop"],
  ["2K / QHD", 2560, 1440, "Desktop"],
  ["4K / UHD", 3840, 2160, "Desktop"],
];

async function seedOrg(org) {
  // Default viewport presets (only once).
  const viewportCount = await prisma.viewportSetting.count({ where: { organisationId: org.id } });
  if (viewportCount === 0) {
    await prisma.viewportSetting.createMany({
      data: VIEWPORTS.map(([name, width, height, category]) => ({
        organisationId: org.id,
        name,
        width,
        height,
        category,
      })),
    });
  }

  const cases = await prisma.testCase.findMany({
    where: { organisationId: org.id },
    select: {
      id: true,
      title: true,
      module: true,
      criticality: true,
      status: true,
      source: true,
      stepsCount: true,
      stepsJson: true,
      variablesJson: true,
      description: true,
      labelsJson: true,
      environment: true,
      version: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  if (cases.length === 0) return;

  // Every organisation needs at least one environment so Studio, test plans and
  // Bug Reproduction can all resolve a real target instead of a placeholder.
  const environmentCount = await prisma.environmentConfig.count({ where: { organisationId: org.id } });
  if (environmentCount === 0) {
    const baseUrl = (org.website ?? "").trim().replace(/\/$/, "");
    await prisma.environmentConfig.createMany({
      data: [
        {
          organisationId: org.id,
          name: "Staging",
          baseUrl,
          description: `Default staging environment for ${org.name}.`,
          isDefault: true,
          variablesJson: JSON.stringify(baseUrl ? { url: baseUrl } : {}),
        },
        {
          organisationId: org.id,
          name: "Production",
          baseUrl,
          description: `Production verification environment for ${org.name}.`,
          variablesJson: "{}",
        },
      ],
    });
  }

  const defaultEnvironment = await prisma.environmentConfig.findFirst({
    where: { organisationId: org.id, isDefault: true },
    select: { name: true },
  });
  const environmentName = defaultEnvironment?.name ?? "Staging";

  const suites = await prisma.testSuite.findMany({ where: { organisationId: org.id } });
  for (const suite of suites) {
    const inSuite = suite.module
      ? cases.filter((c) => c.module.toLowerCase() === suite.module.toLowerCase())
      : cases;
    if (inSuite.length) {
      await prisma.testSuite.update({
        where: { id: suite.id },
        data: { testCases: { connect: inSuite.map((c) => ({ id: c.id })) } },
      });
    }
  }

  const plans = await prisma.testPlan.findMany({ where: { organisationId: org.id } });
  for (const plan of plans) {
    const inPlan = plan.module
      ? cases.filter((c) => c.module.toLowerCase() === plan.module.toLowerCase())
      : cases;
    if (inPlan.length) {
      await prisma.testPlan.update({
        where: { id: plan.id },
        data: { testCases: { connect: inPlan.map((c) => ({ id: c.id })) } },
      });
    }
    const matchingSuites = plan.module
      ? suites.filter((s) => s.module.toLowerCase() === plan.module.toLowerCase())
      : suites;
    const suiteSet = matchingSuites.length ? matchingSuites : suites.slice(0, 1);
    if (suiteSet.length) {
      await prisma.testPlan.update({
        where: { id: plan.id },
        data: { suites: { set: suiteSet.map((s) => ({ id: s.id })) } },
      });
    }
  }

  // Primary suite (the singular suiteId relation shown on test-case rows).
  const defaultSuite = suites.find((s) => !s.module) ?? suites[0];
  if (defaultSuite) {
    for (const c of cases) {
      const match = suites.find((s) => s.module && s.module.toLowerCase() === c.module.toLowerCase());
      await prisma.testCase.update({
        where: { id: c.id },
        data: { suiteId: (match ?? defaultSuite).id },
      });
    }
  }

  // Requirement ↔ test case coverage.
  const requirements = await prisma.requirement.findMany({
    where: { organisationId: org.id },
    orderBy: { code: "asc" },
  });
  const moduleForCode = (code) => {
    const n = Number(code.replace(/\D/g, "")) || 0;
    if (n >= 400) return "Checkout";
    if (n >= 300) return "Settings";
    if (n >= 200) return "Billing";
    if (n >= 100) return "Core";
    return null;
  };
  let cursor = 0;
  for (const req of requirements) {
    const module = moduleForCode(req.code);
    let picks;
    if (module) {
      picks = cases.filter((c) => c.module.toLowerCase() === module.toLowerCase()).slice(0, req.linkedTestsCount || 4);
    } else {
      const count = req.linkedTestsCount || 8;
      picks = cases.slice(cursor, cursor + count);
      cursor = (cursor + count) % Math.max(cases.length, 1);
    }
    if (picks.length) {
      await prisma.requirement.update({
        where: { id: req.id },
        data: { testCases: { connect: picks.map((c) => ({ id: c.id })) }, linkedTestsCount: picks.length },
      });
    }
  }

  // Test Studio: steps, descriptions, labels, run history and version history.
  const baseUrl = (org.website ?? "").trim().replace(/\/$/, "");
  const host = baseUrl.replace(/^https?:\/\//, "");
  const actor = await prisma.user.findFirst({ where: { organisationId: org.id }, select: { name: true } });
  const actorName = actor?.name || "System";
  const lastNumberedRun = await prisma.testCaseRun.findFirst({
    where: { organisationId: org.id },
    orderBy: { runNumber: "desc" },
    select: { runNumber: true },
  });
  let nextTestCaseRunNumber = (lastNumberedRun?.runNumber ?? 0) + 1;
  const stepFlow = [
    ["Navigate", "Navigate to *|url|"],
    ["Verify Element", `Verify that the current page URL contains ${host || "/"}`],
    ["AI Assertion", "Verify that the main heading is visible"],
    ["Click", "Click on the primary navigation link"],
    ["AI Assertion", "Verify that the page content is visible"],
    ["Enter Text", "Enter test-data in the search field"],
    ["Click", "Click on the Continue button"],
    ["Verify Element", "Verify that the current page URL contains /settings"],
    ["Click", "Click on English (United Kingdom) option in the language selector dropdown menu"],
    ["AI Assertion", "Verify that the language selection menu is visible"],
    ["Click", "Click on English (United Kingdom)"],
    ["Verify Element", "Verify that the current page URL contains hl=en-GB"],
    ["AI Assertion", 'Verify that the footer language selector displays "English (United Kingdom)"'],
  ];
  for (const [index, c] of cases.entries()) {
    const stepCount = Math.max(3, Math.min(stepFlow.length, c.stepsCount));
    const steps = Array.from({ length: stepCount }, (_, i) => {
      const [action, target] = stepFlow[i % stepFlow.length];
      return { id: `s${i + 1}`, action, target, value: "", selector: "" };
    });
    let hasSteps = false;
    try {
      hasSteps = JSON.parse(c.stepsJson || "[]").length > 0;
    } catch {
      hasSteps = false;
    }
    const needsDetails = !c.description || c.labelsJson === "[]" || !c.environment;
    if (!hasSteps || needsDetails) {
      await prisma.testCase.update({
        where: { id: c.id },
        data: {
          ...(hasSteps ? {} : { stepsJson: JSON.stringify(steps), stepsCount: steps.length, variablesJson: JSON.stringify({ url: baseUrl }) }),
          ...(c.description
            ? {}
            : {
                description: `Validate the ${c.module} workflow for "${c.title}" on ${baseUrl || "the application"}, including navigation, verification steps and locale persistence.`,
              }),
          ...(c.labelsJson === "[]"
            ? {
                labelsJson: JSON.stringify(
                  c.source === "crawl" || c.source === "ai"
                    ? ["End To End", "auto_crawl", c.module.toLowerCase().replace(/\s+/g, "_")]
                    : [c.module.toLowerCase().replace(/\s+/g, "_"), "regression"],
                ),
              }
            : {}),
          ...(c.environment ? {} : { environment: environmentName }),
          version: c.version || "1.0",
          platform: "web",
        },
      });
    }

    const versionCount = await prisma.testCaseVersion.count({ where: { testCaseId: c.id } });
    if (versionCount === 0) {
      const addedStep = steps[Math.min(8, steps.length - 1)];
      const versions = [
        { version: 1, summary: "Test case created from requirement", added: [], removed: [], offset: 0 },
        { version: 2, summary: "Bulk operation on steps", added: [], removed: [], offset: 2 },
        {
          version: 3,
          summary: "Before auto-fix (attempt 1)",
          added: [],
          removed: [],
          offset: 3,
        },
        { version: 4, summary: "Auto-fix (attempt 1)", added: [], removed: [], offset: 4 },
        {
          version: 5,
          summary: "Bulk operation on steps",
          added: [`${addedStep.action}: ${addedStep.target}`],
          removed: ['AI Agent Click the "English (United Kingdom)" option in the language menu'],
          offset: 5,
        },
      ];
      for (const v of versions) {
        const snapshot =
          v.version >= 5
            ? steps
            : v.version === 4
              ? steps.slice(0, -1)
              : v.version === 1
                ? steps.slice(0, 1)
                : steps.slice(0, -2);
        await prisma.testCaseVersion.create({
          data: {
            organisationId: org.id,
            testCaseId: c.id,
            version: v.version,
            summary: v.summary,
            author: "System",
            addedJson: JSON.stringify(v.added),
            removedJson: JSON.stringify(v.removed),
            stepsJson: JSON.stringify(snapshot),
            createdAt: new Date(c.createdAt.getTime() + v.offset * 60 * 1000),
          },
        });
      }
    }

    const runCount = await prisma.testCaseRun.count({ where: { testCaseId: c.id } });
    if (runCount === 0) {
      const planForCase = plans.find((p) => p.testCases?.some?.((tc) => tc.id === c.id));
      const failing = c.status === "failing" || c.status === "flaky" || c.status === "draft";
      const failedStep = failing ? Math.max(1, Math.ceil(steps.length * 0.7)) : null;
      const runs = [
        {
          daysAgo: 1 + (index % 3),
          autoFix: failing,
          status: failing ? "FAILED" : "PASSED",
          mode: planForCase?.name ?? "Standalone Run",
        },
        {
          daysAgo: 4 + (index % 4),
          autoFix: false,
          status: "FAILED",
          mode: "Standalone Run",
        },
        {
          daysAgo: 6 + (index % 5),
          autoFix: false,
          status: "PASSED",
          mode: "Standalone Run",
        },
      ];
      for (const [runIndex, run] of runs.entries()) {
        const startedAt = new Date(Date.now() - run.daysAgo * 24 * 3600 * 1000 - runIndex * 3600 * 1000);
        const log = steps.map((s, i) => {
          const stepNo = i + 1;
          const failed = run.status === "FAILED" && failedStep === stepNo;
          return {
            step: stepNo,
            action: s.action,
            target: s.target,
            status: failed ? "failed" : run.status === "FAILED" && failedStep && stepNo > failedStep ? "skipped" : "passed",
            healed: run.autoFix && run.status === "PASSED",
            message: failed ? "Assertion failed: expected the target to be visible within 15s." : "OK",
          };
        });
        await prisma.testCaseRun.create({
          data: {
            organisationId: org.id,
            testCaseId: c.id,
            runNumber: nextTestCaseRunNumber++,
            status: run.status,
            trigger: "Automated",
            mode: run.mode,
            durationMs: 36_000 + steps.length * 1_900 + runIndex * 2_400,
            failedStep: run.status === "FAILED" ? failedStep : null,
            failedStepText: run.status === "FAILED" && failedStep ? steps[failedStep - 1]?.target ?? null : null,
            autoFix: run.autoFix,
            createdBy: actorName,
            logJson: JSON.stringify(log),
            createdAt: startedAt,
          },
        });
      }
    }
  }

  // A short execution history so runs/reports/matrix screens have real data.
  const existingExecutions = await prisma.testPlanExecution.count({ where: { organisationId: org.id } });
  if (existingExecutions === 0) {
    for (const plan of plans) {
      const planCases = plan.module
        ? cases.filter((c) => c.module.toLowerCase() === plan.module.toLowerCase())
        : cases;
      for (let run = 0; run < 3; run++) {
        const startedAt = new Date(Date.now() - (run + 1) * 26 * 3600 * 1000);
        const casesResult = planCases.map((c, index) => {
          const failing = run === 0 ? c.status === "failing" || c.status === "flaky" : (index + run) % 4 === 0;
          return { id: c.id, status: failing ? "failed" : "passed" };
        });
        const passed = casesResult.filter((c) => c.status === "passed").length;
        const failed = casesResult.filter((c) => c.status === "failed").length;
        await prisma.testPlanExecution.create({
          data: {
            organisationId: org.id,
            testPlanId: plan.id,
            status: failed ? "FAILED" : "PASSED",
            triggeredBy: "manual",
            startedAt,
            finishedAt: new Date(startedAt.getTime() + 30 * 60 * 1000),
            resultsJson: JSON.stringify({
              total: casesResult.length,
              passed,
              failed,
              notExecuted: 0,
              autoFixed: run === 0 ? 0 : 2,
              durationMs: 30 * 60 * 1000,
              cases: casesResult,
            }),
          },
        });
      }
    }
  }

  // Rich API-token metadata for already-created demo tokens.
  const tokens = await prisma.apiToken.findMany({ where: { organisationId: org.id } });
  for (const token of tokens) {
    if (token.scopesJson === "[]") {
      await prisma.apiToken.update({
        where: { id: token.id },
        data: {
          scopesJson: JSON.stringify(
            token.name.toLowerCase().includes("mcp")
              ? ["TEST_CASE_READ", "TEST_PLAN_READ", "TEST_SUITE_READ", "TEST_STEP_READ"]
              : ["TEST_PLAN_EXECUTE", "TEST_PLAN_RESULTS_READ", "TEST_CASE_RESULTS_READ"],
          ),
          expiresAt: new Date(Date.now() + (token.name.toLowerCase().includes("mcp") ? 90 : 30) * 86400000),
          ipAllowlistJson: "[]",
        },
      });
    }
  }

  // A useful audit trail when the workspace is still nearly empty.
  const auditCount = await prisma.systemAuditLog.count({ where: { organisationId: org.id } });
  if (auditCount < 40) {
    const user = await prisma.user.findFirst({ where: { organisationId: org.id }, select: { name: true, email: true } });
    const actor = user ?? { name: org.ownerName, email: `owner@${org.slug}.test` };
    const rows = [];
    const now = Date.now();
    const suiteNames = [...new Set(suites.map((s) => s.name))];
    const planNames = [...new Set(plans.map((p) => p.name))];
    for (let i = 0; i < 48; i++) {
      const c = cases[i % cases.length];
      const suiteName = suiteNames[i % Math.max(1, suiteNames.length)] ?? c.module;
      const planName = planNames[i % Math.max(1, planNames.length)] ?? c.module;
      const variants = [
        ["test_case.created", "created Test case", c.title],
        ["test_case.updated", "updated Test case", c.title],
        ["test_case.executed", "performed EXECUTED action on Test case", c.title],
        ["test_case.root_cause", "performed ROOT_CAUSE action on Test case", c.title],
        ["steps.created", "created Steps", "navigateToUrl"],
        ["test_suite.updated", "updated Test suite", suiteName],
        ["test_plan.executed", "performed EXECUTED action on Test plan", planName],
        ["environment.updated", "updated Environment", "default_environment"],
      ];
      const [action, verb, subject] = variants[i % variants.length];
      rows.push({
        organisationId: org.id,
        actorEmail: actor.email,
        action,
        target: `${verb} with data: ${subject}`,
        createdAt: new Date(now - i * 47 * 60 * 1000),
      });
    }
    await prisma.systemAuditLog.createMany({ data: rows });
  }
}

const orgs = await prisma.organisation.findMany();
for (const org of orgs) {
  await seedOrg(org);
  console.log(`seeded ${org.slug}`);
}
await prisma.$disconnect();

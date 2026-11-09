import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  TestPlanDetail,
  type PlanCaseRow,
  type PlanDetailData,
  type PlanExecutionRow,
  type PlanSettingsData,
  type Tab,
} from "@/components/dashboard/pages/TestPlanDetail";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Test plan" };
export const dynamic = "force-dynamic";

const DEFAULT_SETTINGS: PlanSettingsData = {
  parallelNodes: 1,
  captureScreenshots: "None",
  pageLoadTimeout: 30,
  elementTimeout: 15,
  knowledgeBaseId: "",
  environment: "default_environment",
  showScrollbars: false,
  clickPressHold: false,
  hideOnDashboard: false,
  sendNotification: true,
  notificationEmails: [],
  proxyId: "",
  remoteBrowserId: "",
  recovery: {
    majorStepFailure: "abort",
    stepPrereqFailure: "continue",
    testCasePrereqFailure: "abort_plan",
    testCaseAbort: "reuse_session",
    suitePrereqFailure: "stop",
  },
};

const TAB_MAP: Record<string, Tab> = {
  overview: "overview",
  runs: "runs",
  reports: "reports",
  schedules: "schedules",
  cicd: "cicd",
  "ci-cd": "cicd",
  settings: "settings",
  "execution-history": "execution-history",
  history: "history",
};

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default async function TestPlanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const { tab } = await searchParams;
  const [plan, allPlans, allSuites, environments, knowledge, proxies, remotes] = await Promise.all([
    prisma.testPlan.findFirst({
      where: { id, organisationId: ctx.org.id },
      include: {
        suites: { orderBy: { createdAt: "asc" }, include: { testCases: { select: { id: true } } } },
        testCases: { orderBy: [{ module: "asc" }, { createdAt: "desc" }] },
      },
    }),
    prisma.testPlan.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "asc" }, select: { id: true } }),
    prisma.testSuite.findMany({
      where: { organisationId: ctx.org.id },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { testCases: true } } },
    }),
    prisma.environmentConfig.findMany({ where: { organisationId: ctx.org.id }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.knowledgeItem.findMany({ where: { organisationId: ctx.org.id }, select: { id: true, title: true }, orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.proxyProfile.findMany({ where: { organisationId: ctx.org.id }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    prisma.remoteBrowserProfile.findMany({ where: { organisationId: ctx.org.id }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
  ]);
  if (!plan) notFound();

  const [executions, schedules, allCases] = await Promise.all([
    prisma.testPlanExecution.findMany({ where: { organisationId: ctx.org.id, testPlanId: plan.id }, orderBy: { startedAt: "desc" } }),
    prisma.schedule.findMany({ where: { organisationId: ctx.org.id, testPlanId: plan.id }, orderBy: { createdAt: "desc" } }),
    prisma.testCase.findMany({ where: { organisationId: ctx.org.id }, orderBy: [{ module: "asc" }, { createdAt: "desc" }], select: { id: true, title: true, module: true, status: true, lastRunAt: true } }),
  ]);

  const planIndex = allPlans.findIndex((p) => p.id === plan.id);
  const suiteCode = new Map(allSuites.map((s, index) => [s.id, `TS-${index + 1}`]));
  const caseCode = new Map(allCases.map((c, index) => [c.id, `TC-${String(allCases.length - index).padStart(3, "0")}`]));

  const suiteCaseIds = plan.suites.flatMap((s) => s.testCases?.map((c) => c.id) ?? []);
  let planCases = plan.testCases;
  if (planCases.length === 0 && suiteCaseIds.length) {
    planCases = await prisma.testCase.findMany({ where: { organisationId: ctx.org.id, id: { in: suiteCaseIds } }, orderBy: [{ module: "asc" }, { createdAt: "desc" }] });
  }

  const parsedSettings = parseJson<Partial<PlanSettingsData>>(plan.settingsJson, {});
  const settings: PlanSettingsData = {
    ...DEFAULT_SETTINGS,
    ...parsedSettings,
    environment: parsedSettings.environment || plan.environment || "default_environment",
    notificationEmails: parsedSettings.notificationEmails ?? [ctx.user.email],
    recovery: { ...DEFAULT_SETTINGS.recovery, ...(parsedSettings.recovery ?? {}) },
  };

  const executionsData: PlanExecutionRow[] = executions.map((e) => {
    const results = parseJson<{
      total?: number;
      passed?: number;
      failed?: number;
      notExecuted?: number;
      autoFixed?: number;
      durationMs?: number;
      cases?: Array<{ id: string; status: string }>;
    }>(e.resultsJson, {});
    const finished = e.finishedAt?.getTime() ?? e.startedAt.getTime();
    return {
      id: e.id,
      status: e.status,
      triggeredBy: e.triggeredBy,
      startedAt: e.startedAt.toISOString(),
      finishedAt: e.finishedAt?.toISOString() ?? null,
      total: results.total ?? planCases.length,
      passed: results.passed ?? 0,
      failed: results.failed ?? 0,
      notExecuted: results.notExecuted ?? 0,
      autoFixed: results.autoFixed ?? 0,
      durationMs: results.durationMs ?? Math.max(0, finished - e.startedAt.getTime()),
      cases: results.cases ?? [],
    };
  });

  const cases: PlanCaseRow[] = planCases.map((c) => ({
    id: c.id,
    code: caseCode.get(c.id) ?? "TC-—",
    title: c.title,
    status: c.status,
    module: c.module,
    lastRunAt: c.lastRunAt?.toISOString() ?? null,
  }));

  const planData: PlanDetailData = {
    id: plan.id,
    code: `TP-${planIndex + 1}`,
    planId: String(planIndex + 1),
    name: plan.name,
    description: plan.description ?? "",
    environment: plan.environment ?? "default_environment",
    browsers: parseJson<string[]>(plan.browsersJson, ["Chromium"]),
    passRate: plan.passRate,
    lastRunAt: plan.lastRunAt?.toISOString() ?? null,
    createdAt: plan.createdAt.toISOString(),
    settings,
  };

  return (
    <TestPlanDetail
      plan={planData}
      suites={plan.suites.map((s) => ({
        id: s.id,
        code: suiteCode.get(s.id) ?? "TS-—",
        name: s.name,
        casesCount: s.testCasesCount,
        platform: s.platform,
      }))}
      cases={cases}
      executions={executionsData}
      schedules={schedules.map((s) => ({
        id: s.id,
        name: s.name,
        cronExpression: s.cronExpression,
        timezone: s.timezone,
        enabled: s.enabled,
        nextFireAt: s.nextFireAt?.toISOString() ?? null,
      }))}
      allSuites={allSuites.map((s) => ({
        id: s.id,
        code: suiteCode.get(s.id) ?? "TS-—",
        name: s.name,
        casesCount: s._count.testCases,
        platform: s.platform,
      }))}
      environments={environments}
      knowledge={knowledge}
      proxies={proxies}
      remotes={remotes}
      currentUserEmail={ctx.user.email}
      orgSlug={ctx.org.slug}
      defaultTab={TAB_MAP[tab ?? ""] ?? "overview"}
      readOnly={ctx.readOnly}
    />
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudioWorkspace, type StudioStep, type StudioVersion } from "@/components/dashboard/pages/StudioWorkspace";
import { buildStepsJson } from "@/lib/engine";
import { prisma } from "@/lib/db";
import {
  DEFAULT_ORGANIZATION_PREFERENCES,
  readSettings,
  requireOrgContext,
  type OrganizationPreferences,
} from "@/lib/tenant";

export const metadata: Metadata = { title: "Test Studio" };
export const dynamic = "force-dynamic";

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try {
    return JSON.parse(value || "") as T;
  } catch {
    return fallback;
  }
}

function statusLabel(status: string) {
  if (status === "passing") return "Ready";
  if (status === "failing" || status === "flaky") return "In Review";
  return "Draft";
}

/** Shared Test Studio page used by /dashboard/test-cases/[id] and /dashboard/test-studio/[id]. */
export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const [tc, allCases, environment, knowledge, proxies, remotes, viewport] = await Promise.all([
    prisma.testCase.findFirst({
      where: { id, organisationId: ctx.org.id },
      include: {
        versions: { orderBy: { version: "desc" } },
        runs: { orderBy: { createdAt: "desc" }, take: 8 },
        testPlans: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, passRate: true, lastRunAt: true } },
        testSuites: { orderBy: { createdAt: "asc" }, select: { id: true, name: true } },
      },
    }),
    prisma.testCase.findMany({
      where: { organisationId: ctx.org.id },
      orderBy: [{ module: "asc" }, { createdAt: "desc" }],
      select: { id: true, title: true, module: true, status: true, variablesJson: true },
    }),
    prisma.environmentConfig.findFirst({ where: { organisationId: ctx.org.id, isDefault: true }, select: { name: true } }),
    prisma.knowledgeItem.findMany({ where: { organisationId: ctx.org.id }, select: { id: true, title: true }, orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.proxyProfile.findMany({ where: { organisationId: ctx.org.id }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    prisma.remoteBrowserProfile.findMany({ where: { organisationId: ctx.org.id }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    prisma.viewportSetting.findFirst({
      where: { organisationId: ctx.org.id, name: "Default" },
      select: { name: true, width: true, height: true },
    }),
  ]);
  if (!tc) notFound();

  const orgUrl = ctx.org.website ?? "";
  const settings = readSettings(ctx.org);
  const preferences: OrganizationPreferences = { ...DEFAULT_ORGANIZATION_PREFERENCES, ...(settings.organization ?? {}) };
  const knowledgeName = knowledge.find((k) => k.id === preferences.knowledgeBaseId)?.title ?? knowledge[0]?.title ?? "None";
  const environmentName = tc.environment || environment?.name || "Staging";

  let steps = parseJson<StudioStep[]>(tc.stepsJson, []);
  if (steps.length === 0) {
    const stepsJson = buildStepsJson(orgUrl, Math.max(1, tc.stepsCount), tc.module, tc.title);
    const variablesJson = tc.variablesJson && tc.variablesJson !== "{}" ? tc.variablesJson : JSON.stringify(orgUrl ? { url: orgUrl } : {});
    await prisma.testCase.update({ where: { id: tc.id }, data: { stepsJson, variablesJson } });
    steps = parseJson<StudioStep[]>(stepsJson, []);
    tc.variablesJson = variablesJson;
  }

  const variables = parseJson<Record<string, string>>(tc.variablesJson, {});
  const prerequisiteIds = Array.isArray((variables as Record<string, unknown>)._prerequisites)
    ? ((variables as Record<string, unknown>)._prerequisites as string[])
    : [];
  const prerequisites = allCases.filter((c) => prerequisiteIds.includes(c.id)).map((c) => ({ id: c.id, title: c.title, module: c.module }));
  const prerequisiteOf = allCases
    .filter((c) => {
      if (c.id === tc.id) return false;
      const vars = parseJson<Record<string, unknown>>(c.variablesJson, {});
      const ids = Array.isArray(vars._prerequisites) ? (vars._prerequisites as string[]) : [];
      return ids.includes(tc.id);
    })
    .map((c) => ({ id: c.id, title: c.title, module: c.module, status: statusLabel(c.status) }));

  const latestVersion = tc.versions[0]?.version ?? 0;
  const versions: StudioVersion[] = tc.versions.map((v) => ({
    id: v.id,
    version: v.version,
    summary: v.summary,
    author: v.author,
    added: parseJson<string[]>(v.addedJson, []),
    removed: parseJson<string[]>(v.removedJson, []),
    steps: parseJson<StudioStep[]>(v.stepsJson, []),
    createdAt: v.createdAt.toISOString(),
    current: v.version === latestVersion,
  }));

  return (
    <StudioWorkspace
      readOnly={ctx.readOnly}
      orgUrl={orgUrl}
      currentUser={ctx.user.name || ctx.user.email}
      data={{
        id: tc.id,
        title: tc.title,
        description: tc.description ?? "",
        module: tc.module,
        criticality: tc.criticality,
        status: statusLabel(tc.status),
        rawStatus: tc.status,
        environment: environmentName,
        version: tc.version || "1.0",
        platform: tc.platform || "web",
        labels: parseJson<string[]>(tc.labelsJson, []),
        createdAt: tc.createdAt.toISOString(),
        steps,
        variables: Object.fromEntries(Object.entries(variables).filter(([key]) => !key.startsWith("_"))),
        caseOptions: allCases.filter((c) => c.id !== tc.id).map((c) => ({ id: c.id, title: c.title, module: c.module })),
        prerequisites,
        plans: tc.testPlans.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.lastRunAt ? (p.passRate >= 99 ? "Passed" : "Failure") : "Not Executed",
        })),
        suites: tc.testSuites.map((s) => ({ id: s.id, name: s.name })),
        prerequisiteOf,
        runs: tc.runs.map((r) => ({
          id: r.id,
          runNumber: r.runNumber,
          status: r.status,
          trigger: r.trigger,
          mode: r.mode,
          durationMs: r.durationMs,
          failedStep: r.failedStep,
          failedStepText: r.failedStepText,
          autoFix: r.autoFix,
          createdBy: r.createdBy,
          createdAt: r.createdAt.toISOString(),
        })),
        versions,
        settings: {
          environment: environmentName,
          defaultBrowser: preferences.defaultBrowser,
          viewportName: viewport?.name ?? "Default",
          viewportWidth: viewport?.width ?? 1280,
          viewportHeight: viewport?.height ?? 720,
          proxyName: proxies[0]?.name ?? "None",
          remoteName: remotes[0]?.name ?? "None",
          knowledgeName,
          aiSmartness: preferences.aiSmartness,
          defaultAiAction: preferences.defaultAiAction,
          useAiMetadata: preferences.useAiMetadata,
          autoApproveAutoHeal: preferences.autoApproveAutoHeal,
          clickPressHold: preferences.clickPressHold,
          retryFailedSteps: preferences.retryFailedSteps,
          testcaseTimeout: preferences.testcaseTimeout,
          waitTimeoutLocators: preferences.waitTimeoutLocators,
        },
      }}
    />
  );
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveDashboardOrg } from "@/lib/dashboard";
import { answer, type FinqaContext } from "@/lib/finqa";
import { readJson, validationError } from "@/lib/http";
import { getCurrentOrgId } from "@/lib/session";
import type { OsKey } from "@/lib/types";
import { delay, maskToken } from "@/lib/utils";

const bodySchema = z.object({
  message: z.string().trim().min(1, "Message is required.").max(500, "Message is too long (500 characters max)."),
});

/** Contexte lu en base : dernier run de l'org affichée + tunnel de l'org de session. */
async function loadContext(): Promise<FinqaContext> {
  const [dashboard, organisationId] = await Promise.all([resolveDashboardOrg(), getCurrentOrgId()]);

  let latest: FinqaContext["latest"] = null;
  let totals: FinqaContext["totals"] = null;
  if (dashboard) {
    const [runs, agg] = await Promise.all([
      prisma.testRun.findMany({ where: { organisationId: dashboard.org.id }, orderBy: { createdAt: "desc" }, take: 2 }),
      prisma.testRun.aggregate({
        where: { organisationId: dashboard.org.id },
        _count: { _all: true },
        _sum: { costAvoided: true },
        _avg: { coverage: true },
      }),
    ]);
    const [last, previous] = runs;
    if (last) {
      latest = {
        release: last.release,
        version: last.version,
        title: last.title,
        prNumber: last.prNumber,
        qualityScore: last.qualityScore,
        delta: previous ? last.qualityScore - previous.qualityScore : 0,
        coverage: last.coverage,
        costAvoided: last.costAvoided,
        regressionsCaught: last.regressionsCaught,
        testsPassed: last.testsPassed,
        testsTotal: last.testsTotal,
      };
      totals = { runs: agg._count._all, costAvoided: agg._sum.costAvoided ?? 0, avgCoverage: agg._avg.coverage ?? 0 };
    }
  }

  // Le tunnel n'est exposé que pour l'organisation de la session (jamais celle d'un autre utilisateur), jeton masqué.
  let tunnel: FinqaContext["tunnel"] = null;
  if (organisationId) {
    const onboarding = await prisma.onboarding.findUnique({ where: { organisationId } });
    if (onboarding) {
      tunnel = {
        os: (onboarding.selectedOs as OsKey | null) ?? null,
        port: onboarding.localPort ?? 3000,
        maskedToken: onboarding.tunnelToken ? maskToken(onboarding.tunnelToken) : null,
      };
    }
  }

  return { orgName: dashboard?.org.name ?? null, isDemo: dashboard?.isDemo ?? true, latest, totals, tunnel };
}

/** POST /api/finqa — réponse simulée de l'assistant (latence réaliste 700–1200 ms). */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const started = Date.now();
  const reply = answer(parsed.data.message, await loadContext());
  const target = 700 + Math.min(parsed.data.message.length * 6, 300) + Math.floor(Math.random() * 200);
  await delay(Math.max(0, target - (Date.now() - started)));

  return NextResponse.json({ reply });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { answer, type FinqaContext } from "@/lib/finqa";
import { readJson, validationError } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { jsonError } from "@/lib/http";
import { resolveOrgContext } from "@/lib/tenant";
import { delay, maskToken } from "@/lib/utils";

const bodySchema = z.object({ message: z.string().trim().min(1, "Type a question.").max(500) });

/** Context for the assistant: the displayed org (own or demo), else the Acme demo. Tokens are always masked. */
async function loadContext(): Promise<FinqaContext> {
  const ctx = await resolveOrgContext();
  const org = ctx?.org ?? (await prisma.organisation.findFirst({ where: { isMockDemo: true } }));
  if (!org) return { orgName: null, isDemo: true, latest: null, totals: null, tunnel: null };

  const runs = await prisma.testRun.findMany({ where: { organisationId: org.id }, orderBy: { createdAt: "desc" }, take: 50 });
  const [latest, previous] = runs;
  const onboarding = ctx && !ctx.readOnly ? await prisma.onboarding.findUnique({ where: { organisationId: org.id } }) : null;

  return {
    orgName: org.name,
    isDemo: org.isMockDemo,
    latest: latest
      ? {
          release: latest.release,
          version: latest.version,
          title: latest.title,
          prNumber: latest.prNumber,
          qualityScore: latest.qualityScore,
          delta: previous ? latest.qualityScore - previous.qualityScore : 0,
          coverage: latest.coverage,
          costAvoided: latest.costAvoided,
          regressionsCaught: latest.regressionsCaught,
          testsPassed: latest.testsPassed,
          testsTotal: latest.testsTotal,
        }
      : null,
    totals: runs.length
      ? {
          runs: runs.length,
          costAvoided: runs.reduce((s, r) => s + r.costAvoided, 0),
          avgCoverage: runs.reduce((s, r) => s + r.coverage, 0) / runs.length,
        }
      : null,
    tunnel: onboarding
      ? { os: null, port: onboarding.localPort ?? 3000, maskedToken: onboarding.tunnelToken ? maskToken(onboarding.tunnelToken) : null }
      : null,
  };
}

/** POST /api/finqa { message } — simulated assistant (no external LLM call). */
export async function POST(request: Request) {
  if (!rateLimit(`finqa:${clientKey(request)}`, 30, 60_000)) return jsonError("Too many questions. Try again in a minute.", 429);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const context = await loadContext();
  await delay(100);
  return NextResponse.json({ reply: answer(parsed.data.message, context) });
}

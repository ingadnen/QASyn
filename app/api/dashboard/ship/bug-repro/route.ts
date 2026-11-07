import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { reproduceBug } from "@/lib/engines";
import { MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi, spendCredits } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { bugReproSchema } from "@/lib/validation";

/**
 * POST /api/dashboard/ship/bug-repro { title, description }
 * Extracts reproduction steps from a support ticket, generates the bug report
 * and a matching test case, with an AI-detected probable root cause.
 */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();

  const parsed = bugReproSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { title, description } = parsed.data;

  await delay(MOCK_LATENCY_MS * 2);
  const { steps, rootCause, severity } = reproduceBug(description, title);
  const bug = await prisma.bugReport.create({
    data: {
      organisationId: ctx.org.id,
      title,
      severity,
      status: "reproduced",
      reproductionSteps: steps.join("\n"),
      rootCause,
      environment: "Staging",
      source: "manual",
    },
  });
  const testCase = await prisma.testCase.create({
    data: {
      organisationId: ctx.org.id,
      title: `Repro: ${title}`,
      module: "Core",
      criticality: severity === "critical" ? "critical" : "high",
      status: "failing",
      stepsCount: steps.length,
      source: "ai",
      stepsJson: JSON.stringify(
        steps.map((s, i) => ({ id: `repro-${i}`, action: i === 0 ? "Navigate" : "Click", target: s, value: "", selector: "" })),
      ),
    },
  });
  await spendCredits(prisma, ctx.org.id, 15);
  await audit(prisma, ctx, "ship.bug_repro", `${title} · ${severity} · ${rootCause}`);
  return NextResponse.json({ bug, testCase, rootCause, severity }, { status: 201 });
}

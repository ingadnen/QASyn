import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { ATTACK_LIBRARY, runRedTeam, safeTarget } from "@/lib/red-team";
import { readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

const schema = z.object({ name: z.string().trim().min(2).max(120).default("OWASP LLM Top 10 suite"), targetResponse: z.string().max(20000).default("") });

/** GET /api/dashboard/red-team — suites of the displayed organisation + library size. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const suites = await prisma.redTeamSuite.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ suites, librarySize: ATTACK_LIBRARY.length });
}

/** POST /api/dashboard/red-team — run the adversarial library against the target response. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { name, targetResponse } = parsed.data;
  const { results, score } = runRedTeam(() => targetResponse || safeTarget());
  const suite = await prisma.redTeamSuite.create({
    data: { organisationId: ctx.org.id, name, attacksJson: JSON.stringify(ATTACK_LIBRARY), resultsJson: JSON.stringify(results), score },
  });
  await audit(prisma, ctx, "red_team.run", `${name} · score ${score}%`);
  return NextResponse.json({ suite, results, score }, { status: 201 });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { importRequirementsSchema } from "@/lib/validation";

const MAX_LINES = 100;
const LINE = /^\s*([A-Za-z][A-Za-z0-9]*-\d+)\s*[:\-–|]\s*(.{3,160})\s*$/;

/**
 * POST /api/dashboard/requirements/import { text }
 * One requirement per line: "CODE-12: Title" (also "-", "–" or "|" as separator). Existing codes are skipped.
 */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = importRequirementsSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const rows = parsed.data.text
    .split(/\r?\n/)
    .map((l) => LINE.exec(l))
    .filter((m): m is RegExpExecArray => Boolean(m))
    .slice(0, MAX_LINES)
    .map((m) => ({ code: m[1].toUpperCase().slice(0, 20), title: m[2].trim() }));
  if (rows.length === 0) return jsonError('No requirement found. Use one per line: "AUTH-1: Users can sign in".', 400);

  await delay(MOCK_LATENCY_MS);
  const existing = new Set(
    (await prisma.requirement.findMany({ where: { organisationId: ctx.org.id }, select: { code: true } })).map((r) => r.code),
  );
  const seen = new Set<string>();
  const fresh = rows.filter((r) => !existing.has(r.code) && !seen.has(r.code) && seen.add(r.code));
  if (fresh.length) {
    await prisma.requirement.createMany({ data: fresh.map((r) => ({ organisationId: ctx.org.id, ...r, source: "import" })) });
  }
  await audit(prisma, ctx, "requirement.imported", `${fresh.length} imported · ${rows.length - fresh.length} skipped`);
  return NextResponse.json({ imported: fresh.length, skipped: rows.length - fresh.length });
}

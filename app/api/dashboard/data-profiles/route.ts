import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { parseCsv } from "@/lib/data-profiles";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  sourceType: z.enum(["manual", "csv", "excel"]).default("manual"),
  /** Manual rows (JSON object per row) or CSV text when sourceType is csv/excel. */
  rows: z.union([z.array(z.record(z.string(), z.string())).max(500), z.string().max(50000)]).default([]),
});

/** GET /api/dashboard/data-profiles — profiles of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const profiles = await prisma.dataProfile.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ profiles });
}

/** POST /api/dashboard/data-profiles — create from manual rows or CSV text. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { name, sourceType, rows } = parsed.data;
  const data = typeof rows === "string" ? parseCsv(rows) : { columns: rows[0] ? Object.keys(rows[0]) : [], rows };
  if (data.rows.length === 0) return jsonError("No data rows provided.", 400);
  const profile = await prisma.dataProfile.create({
    data: { organisationId: ctx.org.id, name, sourceType, columnsJson: JSON.stringify(data.columns), rowsJson: JSON.stringify(data.rows) },
  });
  await audit(prisma, ctx, "data_profile.created", `${name} · ${data.rows.length} rows`);
  return NextResponse.json({ profile }, { status: 201 });
}

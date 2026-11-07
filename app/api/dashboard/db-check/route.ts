import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { runDbAssertions, salesforceMetadata, sapMetadata } from "@/lib/db-connectors";
import { readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { z } from "zod";

const schema = z.object({
  assertions: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        check: z.enum(["test_cases", "bugs_reproduced", "prs_checked", "crawls_completed", "tokens_active"]),
        expected: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(20),
  erp: z.enum(["none", "salesforce", "sap"]).default("none"),
});

/** POST /api/dashboard/db-check — run whitelisted Prisma assertions + ERP metadata. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { assertions, erp } = parsed.data;
  const { results, passed } = await runDbAssertions(ctx.org.id, assertions);
  const erpMetadata = erp === "salesforce" ? salesforceMetadata() : erp === "sap" ? sapMetadata() : [];
  await audit(prisma, ctx, "db_check.run", `${assertions.length} assertions · ERP: ${erp} · ${passed ? "passed" : "failed"}`);
  return NextResponse.json({ results, passed, erpMetadata });
}

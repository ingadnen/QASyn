import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { guardApi } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** GET /api/dashboard/requirements/[id]/export?format=csv|json — linked test cases. */
export async function GET(request: Request, { params }: Params) {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format") === "json" ? "json" : "csv";

  const requirement = await prisma.requirement.findFirst({
    where: { id, organisationId: ctx.org.id },
    include: { testCases: { orderBy: { createdAt: "asc" } } },
  });
  if (!requirement) return jsonError("Requirement not found.", 404);

  const payload = requirement.testCases.map((testCase, index) => ({
    code: `TC-${String(index + 1).padStart(3, "0")}`,
    title: testCase.title,
    module: testCase.module,
    criticality: testCase.criticality,
    status: testCase.status,
    steps: testCase.stepsCount,
    source: testCase.source,
  }));
  const base = requirement.code.toLowerCase().replace(/[^\w-]+/g, "_");

  if (format === "json") {
    return new NextResponse(JSON.stringify({ requirement: { code: requirement.code, title: requirement.title }, testCases: payload }, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${base}-test-cases.json"`,
      },
    });
  }

  const body = [
    ["Code", "Title", "Module", "Priority", "Status", "Steps", "Source"].join(","),
    ...payload.map((row) => [row.code, row.title, row.module, row.criticality, row.status, row.steps, row.source].map(csvCell).join(",")),
  ].join("\r\n");
  return new NextResponse(`\uFEFF${body}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${base}-test-cases.csv"`,
    },
  });
}

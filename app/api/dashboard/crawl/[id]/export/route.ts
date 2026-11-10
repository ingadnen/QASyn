import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { guardApi } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** GET /api/dashboard/crawl/[id]/export?format=csv|json — test cases produced by this crawl. */
export async function GET(request: Request, { params }: Params) {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format") === "json" ? "json" : "csv";

  const crawl = await prisma.crawlSession.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!crawl) return jsonError("Crawl not found.", 404);

  const testCases = await prisma.testCase.findMany({
    where: {
      organisationId: ctx.org.id,
      ...(crawl.requirementId ? { requirements: { some: { id: crawl.requirementId } } } : { source: "crawl" }),
    },
    orderBy: { createdAt: "asc" },
  });

  const host = crawl.targetUrl.replace(/^https?:\/\//, "").replace(/[^\w.-]+/g, "_") || "crawl";
  const payload = testCases.map((testCase, index) => ({
    code: `TC-${String(index + 1).padStart(3, "0")}`,
    title: testCase.title,
    module: testCase.module,
    criticality: testCase.criticality,
    status: testCase.status,
    steps: testCase.stepsCount,
    source: testCase.source,
  }));

  if (format === "json") {
    return new NextResponse(JSON.stringify({ crawl: { id: crawl.id, targetUrl: crawl.targetUrl, status: crawl.status }, testCases: payload }, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${host}-test-cases.json"`,
      },
    });
  }

  const headers = ["Code", "Title", "Module", "Priority", "Status", "Steps", "Source"];
  const body = [
    headers.join(","),
    ...payload.map((row) => [row.code, row.title, row.module, row.criticality, row.status, row.steps, row.source].map(csvCell).join(",")),
  ].join("\r\n");
  return new NextResponse(`\uFEFF${body}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${host}-test-cases.csv"`,
    },
  });
}

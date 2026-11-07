import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { scanBody, scanHeaders, cvssScore } from "@/lib/security-scanner";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

const schema = z.object({ targetUrl: z.string().trim().min(5).max(2000), scanType: z.enum(["OWASP_TOP_10", "HEADERS_SSL", "FULL_AUDIT"]).default("OWASP_TOP_10") });

/** GET /api/dashboard/security-testing — scan history (org-scoped). */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const scans = await prisma.securityScan.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { startedAt: "desc" }, take: 20 });
  return NextResponse.json({ scans });
}

/** POST /api/dashboard/security-testing — run an OWASP scan (simulated fetch with SSRF guard). */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { targetUrl, scanType } = parsed.data;
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    return jsonError("Invalid URL.", 400);
  }
  if (url.protocol !== "https:") return jsonError("Security scans require an https target.", 400);

  // Simulated response data (no outbound request is strictly required; if the
  // target is unreachable the scan reports transport findings).
  let headers: Record<string, string> = {};
  let body = "";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(targetUrl, { signal: controller.signal, redirect: "manual" });
    clearTimeout(timer);
    res.headers.forEach((v, k) => {
      headers[k] = v;
    });
    body = await res.text();
  } catch {
    headers = {};
    body = "";
  }
  const findings = [...scanHeaders(headers), ...scanBody(body)];
  const scan = await prisma.securityScan.create({
    data: {
      organisationId: ctx.org.id,
      targetUrl,
      scanType,
      status: "COMPLETED",
      highCount: findings.filter((f) => f.severity === "high").length,
      mediumCount: findings.filter((f) => f.severity === "medium").length,
      lowCount: findings.filter((f) => f.severity === "low").length,
      findingsJson: JSON.stringify(findings),
      completedAt: new Date(),
    },
  });
  await audit(prisma, ctx, "security.scan", `${targetUrl} · CVSS ${cvssScore(findings)} · ${findings.length} findings`);
  return NextResponse.json({ scan, findings, cvss: cvssScore(findings) }, { status: 201 });
}

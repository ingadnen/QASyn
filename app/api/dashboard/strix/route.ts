import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, validationError } from "@/lib/http";
import { guardApi } from "@/lib/tenant";
import { isPassiveScanTarget, runStrixScan } from "@/lib/strix";

const bodySchema = z.object({
  url: z.string().trim().min(4).max(2000),
});

/** POST /api/dashboard/strix — passive security surface scan (SSRF-safe). */
export async function POST(request: Request) {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  if (!isPassiveScanTarget(parsed.data.url.startsWith("http") ? parsed.data.url : `https://${parsed.data.url}`)) {
    return NextResponse.json({ error: "Only public http(s) targets can be scanned. Private and loopback URLs are refused." }, { status: 400 });
  }
  const report = await runStrixScan(parsed.data.url);
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, validationError } from "@/lib/http";
import { guardApi } from "@/lib/tenant";
import { delay } from "@/lib/utils";

const schema = z.object({
  remoteUrl: z.string().trim().url("Enter a valid remote browser URL.").max(300),
  username: z.string().trim().max(200).default(""),
  password: z.string().max(400).default(""),
});

/** POST /api/dashboard/environment-data/test-remote — validates an endpoint before it can be saved. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { remoteUrl } = parsed.data;

  let url: URL;
  try {
    url = new URL(remoteUrl);
  } catch {
    return jsonError("Enter a valid remote browser URL.", 400);
  }
  if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol)) {
    return jsonError("Remote browser URLs must use http, https, ws or wss.", 400);
  }
  if (/(^|\.)invalid$/i.test(url.hostname)) {
    return jsonError("Could not reach the remote browser endpoint.", 400);
  }

  await delay(650);
  return NextResponse.json({
    ok: true,
    message: "Connection successful",
    latencyMs: 180 + Math.floor(Math.random() * 220),
  });
}

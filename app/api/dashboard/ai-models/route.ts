import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { invalidateTenantModelCache } from "@/lib/model-router";
import { guardPermission } from "@/lib/rbac-server";
import { readSettings, writeSettings } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const modelSchema = z.object({
  id: z.string().max(80).optional(),
  name: z.string().trim().min(2).max(120),
  provider: z.enum(["OpenAI", "Anthropic Claude", "Google Gemini", "DeepSeek", "Azure OpenAI", "Custom OpenAI-Compatible"]),
  modelId: z.string().trim().min(1).max(160),
  apiKey: z.string().trim().max(500).optional(),
  role: z.enum(["Execution", "Grounding", "PR Review"]).default("Execution"),
});

export async function GET() {
  const guard = await guardPermission("settingsManage");
  if (!guard.ok) return guard.response;
  const models = (readSettings(guard.ctx.org).customModels ?? []).map(({ apiKey, ...model }) => ({ ...model, hasApiKey: Boolean(apiKey) }));
  return NextResponse.json({ models });
}

export async function POST(request: Request) {
  const guard = await guardPermission("settingsManage", { write: true });
  if (!guard.ok) return guard.response;
  const parsed = modelSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const settings = readSettings(guard.ctx.org);
  const current = settings.customModels ?? [];
  const model = {
    id: randomUUID(),
    name: parsed.data.name,
    provider: parsed.data.provider,
    modelId: parsed.data.modelId,
    apiKey: parsed.data.apiKey ?? "",
    role: parsed.data.role,
    createdAt: new Date().toISOString(),
  };
  const next = await writeSettings(prisma, guard.ctx.org, { customModels: [...current, model] });
  invalidateTenantModelCache(guard.ctx.org.id);
  return NextResponse.json({ model, models: next.customModels }, { status: 201 });
}

export async function PATCH(request: Request) {
  const guard = await guardPermission("settingsManage", { write: true });
  if (!guard.ok) return guard.response;
  const parsed = modelSchema.extend({ id: z.string().min(1) }).safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const current = readSettings(guard.ctx.org).customModels ?? [];
  const existing = current.find((model) => model.id === parsed.data.id);
  if (!existing) return jsonError("AI model not found.", 404);
  const updated = { ...existing, ...parsed.data, apiKey: parsed.data.apiKey || existing.apiKey };
  const next = current.map((model) => (model.id === existing.id ? updated : model));
  await writeSettings(prisma, guard.ctx.org, { customModels: next });
  invalidateTenantModelCache(guard.ctx.org.id);
  return NextResponse.json({ model: { ...updated, apiKey: undefined, hasApiKey: Boolean(updated.apiKey) } });
}

export async function DELETE(request: Request) {
  const guard = await guardPermission("settingsManage", { write: true });
  if (!guard.ok) return guard.response;
  const body = (await readJson(request)) as { id?: string } | null;
  if (!body?.id) return jsonError("Missing model id.", 400);
  const current = readSettings(guard.ctx.org).customModels ?? [];
  const next = current.filter((model) => model.id !== body.id);
  await writeSettings(prisma, guard.ctx.org, { customModels: next });
  invalidateTenantModelCache(guard.ctx.org.id);
  return NextResponse.json({ ok: true, models: next });
}

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { guardPermission } from "@/lib/rbac-server";
import { readSettings, writeSettings } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const skillSchema = z.object({
  id: z.string().max(80).optional(),
  name: z.string().trim().min(2).max(120),
  trigger: z.string().trim().max(240).default(""),
  systemPrompt: z.string().trim().min(10).max(12_000),
  model: z.string().trim().max(160).default("QASyn Vision AI"),
  enabled: z.boolean().default(true),
});

export async function GET() {
  const guard = await guardPermission("mcp");
  if (!guard.ok) return guard.response;
  return NextResponse.json({ skills: readSettings(guard.ctx.org).customSkills ?? [] });
}

export async function POST(request: Request) {
  const guard = await guardPermission("mcpTokens", { write: true });
  if (!guard.ok) return guard.response;
  const parsed = skillSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const current = readSettings(guard.ctx.org).customSkills ?? [];
  const skill = { id: randomUUID(), ...parsed.data, createdAt: new Date().toISOString() };
  const next = await writeSettings(prisma, guard.ctx.org, { customSkills: [...current, skill] });
  return NextResponse.json({ skill, skills: next.customSkills }, { status: 201 });
}

export async function PATCH(request: Request) {
  const guard = await guardPermission("mcpTokens", { write: true });
  if (!guard.ok) return guard.response;
  const parsed = skillSchema.extend({ id: z.string().min(1) }).safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const current = readSettings(guard.ctx.org).customSkills ?? [];
  const existing = current.find((skill) => skill.id === parsed.data.id);
  if (!existing) return jsonError("Custom skill not found.", 404);
  const updated = { ...existing, ...parsed.data };
  const next = current.map((skill) => (skill.id === existing.id ? updated : skill));
  await writeSettings(prisma, guard.ctx.org, { customSkills: next });
  return NextResponse.json({ skill: updated });
}

export async function DELETE(request: Request) {
  const guard = await guardPermission("mcpTokens", { write: true });
  if (!guard.ok) return guard.response;
  const body = (await readJson(request)) as { id?: string } | null;
  if (!body?.id) return jsonError("Missing skill id.", 400);
  const current = readSettings(guard.ctx.org).customSkills ?? [];
  const next = current.filter((skill) => skill.id !== body.id);
  await writeSettings(prisma, guard.ctx.org, { customSkills: next });
  return NextResponse.json({ ok: true, skills: next });
}

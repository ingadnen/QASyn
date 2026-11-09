import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

const environment = z.object({
  kind: z.literal("environment"),
  name: z.string().trim().min(1).max(50),
  baseUrl: z.string().trim().max(300).default(""),
  description: z.string().max(2000).default(""),
  accent: z.string().trim().max(30).default("#5b4ee8"),
  isDefault: z.boolean().default(false),
});

const profile = z.object({
  kind: z.literal("profile"),
  name: z.string().trim().min(1).max(60),
  description: z.string().max(1000).default(""),
  permission: z.enum(["RO", "RW"]).default("RO"),
  columns: z.number().int().min(1).max(50).default(2),
  rows: z.number().int().min(1).max(200).default(3),
  environmentIds: z.array(z.string().max(60)).max(20).default([]),
});

const globalVariable = z.object({
  kind: z.literal("global"),
  name: z.string().trim().regex(/^[A-Za-z_][A-Za-z0-9_]{0,60}$/, "Use letters, numbers and underscores; start with a letter or underscore."),
  type: z.enum(["String", "Number", "Boolean", "Secret"]).default("String"),
  permission: z.enum(["RO", "RW"]).default("RO"),
  value: z.string().max(2000).default(""),
  tags: z.array(z.string().max(30)).max(20).default([]),
  description: z.string().max(1000).default(""),
});

const authProfile = z.object({
  kind: z.literal("auth"),
  name: z.string().trim().min(1).max(60),
  appUrl: z.string().trim().min(1).max(300),
  loginUrl: z.string().trim().max(300).default(""),
  method: z.string().trim().max(60).default("Username and password"),
  username: z.string().trim().max(200).default(""),
  password: z.string().max(400).default(""),
  autoSignIn: z.boolean().default(true),
  advanced: z.record(z.unknown()).default({}),
});

const proxy = z.object({
  kind: z.literal("proxy"),
  name: z.string().trim().min(1).max(60),
  proxyUrl: z.string().trim().max(300).optional(),
  host: z.string().trim().max(200).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().trim().max(200).default(""),
  password: z.string().max(400).default(""),
  enabled: z.boolean().default(true),
});

const viewport = z.object({
  kind: z.literal("viewport"),
  name: z.string().trim().min(1).max(60),
  width: z.number().int().min(100).max(5000),
  height: z.number().int().min(100).max(5000),
  category: z.enum(["Mobile", "Tablet", "Laptop", "Desktop"]).default("Desktop"),
});

const remoteBrowser = z.object({
  kind: z.literal("remote"),
  name: z.string().trim().min(1).max(60),
  remoteUrl: z.string().trim().url("Enter a valid remote browser URL.").max(300),
  username: z.string().trim().max(200).default(""),
  password: z.string().max(400).default(""),
  verified: z.boolean().default(false),
});

const bodySchema = z.discriminatedUnion("kind", [environment, profile, globalVariable, authProfile, proxy, viewport, remoteBrowser]);

export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;

  if (input.kind === "environment") {
    const count = await prisma.environmentConfig.count({ where: { organisationId: ctx.org.id } });
    const makeDefault = input.isDefault || count === 0;
    if (makeDefault) await prisma.environmentConfig.updateMany({ where: { organisationId: ctx.org.id }, data: { isDefault: false } });
    const created = await prisma.environmentConfig.create({
      data: {
        organisationId: ctx.org.id,
        name: input.name,
        baseUrl: input.baseUrl,
        description: input.description,
        accent: input.accent,
        isDefault: makeDefault,
        variablesJson: "{}",
      },
    });
    await audit(prisma, ctx, "environment.created", created.name);
    return NextResponse.json({ environment: created }, { status: 201 });
  }

  if (input.kind === "profile") {
    const created = await prisma.dataProfile.create({
      data: {
        organisationId: ctx.org.id,
        name: input.name,
        description: input.description,
        permission: input.permission,
        columnsJson: JSON.stringify(Array.from({ length: input.columns }, (_, i) => `column_${i + 1}`)),
        rowsJson: JSON.stringify(Array.from({ length: input.rows }, () => ({}))),
        environmentIds: JSON.stringify(input.environmentIds),
      },
    });
    await audit(prisma, ctx, "data_profile.created", created.name);
    return NextResponse.json({ profile: created }, { status: 201 });
  }

  if (input.kind === "global") {
    const exists = await prisma.globalVariable.findFirst({ where: { organisationId: ctx.org.id, name: input.name } });
    if (exists) return jsonError("A global variable with this name already exists.", 409);
    const created = await prisma.globalVariable.create({
      data: {
        organisationId: ctx.org.id,
        name: input.name,
        type: input.type,
        permission: input.permission,
        value: input.value,
        tags: JSON.stringify(input.tags),
        description: input.description,
      },
    });
    await audit(prisma, ctx, "global_variable.created", created.name);
    return NextResponse.json({ variable: created }, { status: 201 });
  }

  if (input.kind === "auth") {
    const created = await prisma.authProfile.create({
      data: {
        organisationId: ctx.org.id,
        name: input.name,
        appUrl: input.appUrl,
        loginUrl: input.loginUrl,
        method: input.method,
        username: input.username,
        passwordCipher: Buffer.from(input.password || "", "utf8").toString("base64"),
        autoSignIn: input.autoSignIn,
        advancedJson: JSON.stringify(input.advanced),
      },
    });
    await audit(prisma, ctx, "auth_profile.created", created.name);
    return NextResponse.json({ profile: created }, { status: 201 });
  }

  if (input.kind === "proxy") {
    const proxyUrl = input.proxyUrl?.trim() || (input.host ? `http://${input.host}:${input.port ?? 8080}` : "");
    if (!proxyUrl) return jsonError("Proxy URL is required.", 400);
    let host = input.host ?? proxyUrl;
    let port = input.port ?? 8080;
    try {
      const parsedUrl = new URL(proxyUrl);
      host = parsedUrl.hostname;
      port = Number(parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80));
    } catch {
      return jsonError("Enter a valid proxy URL (http://host:port).", 400);
    }
    const created = await prisma.proxyProfile.create({
      data: {
        organisationId: ctx.org.id,
        name: input.name,
        url: proxyUrl,
        host,
        port,
        username: input.username,
        passwordCipher: Buffer.from(input.password || "", "utf8").toString("base64"),
        enabled: input.enabled,
      },
    });
    await audit(prisma, ctx, "proxy_profile.created", created.name);
    return NextResponse.json({ proxy: created, password: undefined }, { status: 201 });
  }

  if (input.kind === "remote") {
    const created = await prisma.remoteBrowserProfile.create({
      data: {
        organisationId: ctx.org.id,
        name: input.name,
        remoteUrl: input.remoteUrl,
        username: input.username,
        password: input.password,
        status: input.verified ? "verified" : "unverified",
        lastCheckedAt: input.verified ? new Date() : null,
      },
    });
    await audit(prisma, ctx, "remote_browser.created", created.name);
    return NextResponse.json({ remoteBrowser: created }, { status: 201 });
  }

  const created = await prisma.viewportSetting.create({
    data: { organisationId: ctx.org.id, name: input.name, width: input.width, height: input.height, category: input.category },
  });
  await audit(prisma, ctx, "viewport.created", created.name);
  return NextResponse.json({ viewport: created }, { status: 201 });
}

const patchSchema = z.object({
  kind: z.literal("environment"),
  id: z.string().min(1).max(60),
  action: z.enum(["update", "duplicate", "default"]).default("update"),
  name: z.string().trim().min(1).max(50).optional(),
  baseUrl: z.string().trim().max(300).optional(),
  description: z.string().max(2000).optional(),
  accent: z.string().trim().max(30).optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = patchSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  const env = await prisma.environmentConfig.findFirst({ where: { id: input.id, organisationId: ctx.org.id } });
  if (!env) return jsonError("Environment not found.", 404);

  if (input.action === "duplicate") {
    const created = await prisma.environmentConfig.create({
      data: {
        organisationId: ctx.org.id,
        name: `${env.name} copy`.slice(0, 50),
        baseUrl: env.baseUrl,
        description: env.description,
        accent: env.accent,
        authType: env.authType,
        variablesJson: env.variablesJson,
        isDefault: false,
      },
    });
    await audit(prisma, ctx, "environment.duplicated", created.name);
    return NextResponse.json({ environment: created }, { status: 201 });
  }

  if (input.action === "default") {
    await prisma.$transaction([
      prisma.environmentConfig.updateMany({ where: { organisationId: ctx.org.id }, data: { isDefault: false } }),
      prisma.environmentConfig.update({ where: { id: env.id }, data: { isDefault: true } }),
    ]);
    await audit(prisma, ctx, "environment.default", env.name);
    return NextResponse.json({ ok: true });
  }

  const makeDefault = input.isDefault === true;
  if (makeDefault) await prisma.environmentConfig.updateMany({ where: { organisationId: ctx.org.id }, data: { isDefault: false } });
  const updated = await prisma.environmentConfig.update({
    where: { id: env.id },
    data: {
      name: input.name ?? env.name,
      baseUrl: input.baseUrl ?? env.baseUrl,
      description: input.description ?? env.description,
      accent: input.accent ?? env.accent,
      isDefault: input.isDefault ?? env.isDefault,
    },
  });
  await audit(prisma, ctx, "environment.updated", updated.name);
  return NextResponse.json({ environment: updated });
}

export async function DELETE(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const id = url.searchParams.get("id");
  if (!kind || !id) return jsonError("kind and id are required.", 400);

  if (kind === "environment") {
    await prisma.environmentConfig.deleteMany({ where: { id, organisationId: ctx.org.id } });
  } else if (kind === "profile") {
    await prisma.dataProfile.deleteMany({ where: { id, organisationId: ctx.org.id } });
  } else if (kind === "global") {
    await prisma.globalVariable.deleteMany({ where: { id, organisationId: ctx.org.id } });
  } else if (kind === "auth") {
    await prisma.authProfile.deleteMany({ where: { id, organisationId: ctx.org.id } });
  } else if (kind === "proxy") {
    await prisma.proxyProfile.deleteMany({ where: { id, organisationId: ctx.org.id } });
  } else if (kind === "viewport") {
    await prisma.viewportSetting.deleteMany({ where: { id, organisationId: ctx.org.id } });
  } else if (kind === "remote") {
    await prisma.remoteBrowserProfile.deleteMany({ where: { id, organisationId: ctx.org.id } });
  } else {
    return jsonError("Unknown kind.", 400);
  }
  await audit(prisma, ctx, `${kind}.deleted`, id);
  return NextResponse.json({ ok: true });
}

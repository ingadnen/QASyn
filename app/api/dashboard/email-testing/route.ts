import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { generateInboxAddress, simulateVerificationEmail, extractOtp, extractLinks } from "@/lib/email-testing";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

const createSchema = z.object({ label: z.string().trim().min(2).max(80) });
const simulateSchema = z.object({ inboxId: z.string().min(1).max(60), subject: z.string().trim().min(2).max(200).default("Your verification code"), from: z.string().trim().min(3).max(200).default("no-reply@qasyn.local") });

/** GET /api/dashboard/email-testing — inboxes + messages (org-scoped). */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const inboxes = await prisma.emailTestInbox.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" }, include: { messages: { orderBy: { receivedAt: "desc" }, take: 20 } } });
  return NextResponse.json({ inboxes });
}

/** POST /api/dashboard/email-testing — create inbox or simulate an incoming email. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const body = (await readJson(request)) as { action?: string; label?: string; inboxId?: string; subject?: string; from?: string };

  if (body?.action === "simulate") {
    const parsed = simulateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const inbox = await prisma.emailTestInbox.findFirst({ where: { id: parsed.data.inboxId, organisationId: ctx.org.id } });
    if (!inbox) return jsonError("Inbox not found in this organisation.", 400);
    const { bodyText, bodyHtml } = simulateVerificationEmail(inbox.emailAddress, parsed.data.subject);
    const message = await prisma.emailTestMessage.create({
      data: {
        inboxId: inbox.id,
        from: parsed.data.from,
        to: inbox.emailAddress,
        subject: parsed.data.subject,
        bodyText,
        bodyHtml,
        extractedOtp: extractOtp(bodyText),
        extractedLinks: JSON.stringify(extractLinks(bodyHtml)),
      },
    });
    await audit(prisma, ctx, "email.simulated", `${inbox.emailAddress} · ${parsed.data.subject}`);
    return NextResponse.json({ message }, { status: 201 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const inbox = await prisma.emailTestInbox.create({
    data: { organisationId: ctx.org.id, emailAddress: generateInboxAddress(parsed.data.label), label: parsed.data.label },
  });
  await audit(prisma, ctx, "email.inbox_created", inbox.emailAddress);
  return NextResponse.json({ inbox }, { status: 201 });
}

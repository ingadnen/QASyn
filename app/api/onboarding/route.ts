import { NextResponse } from "next/server";
import { TOTAL_STEPS } from "@/lib/constants";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { initialsOf } from "@/lib/auth";
import { startCrawl } from "@/lib/engine";
import { buildCrawlLogs } from "@/lib/crawl";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { loadOnboardingState } from "@/lib/onboarding-state";
import { audit, guardOwnOrg, type OrgContext } from "@/lib/tenant";
import { delay, normalizeWebsite } from "@/lib/utils";
import { stepPayloadSchema } from "@/lib/validation";

/** GET /api/onboarding — onboarding state of the user's own organisation. */
export async function GET() {
  const guard = await guardOwnOrg();
  if (!guard.ok) return guard.response;
  const state = await loadOnboardingState(guard.ctx.org.id);
  return NextResponse.json({ state }, { headers: { "Cache-Control": "no-store" } });
}

/** Points the running crawl at the app endpoint (or starts one). No outbound request is made. */
async function crawlTarget(ctx: OrgContext, targetUrl: string) {
  const running = await prisma.crawlSession.findFirst({ where: { organisationId: ctx.org.id, status: "running" } });
  if (running) {
    if (running.targetUrl !== targetUrl) {
      await prisma.crawlSession.update({
        where: { id: running.id },
        data: { targetUrl, startedAt: new Date(), logs: JSON.stringify(buildCrawlLogs(targetUrl)) },
      });
    }
    return;
  }
  const completed = await prisma.crawlSession.findFirst({ where: { organisationId: ctx.org.id, targetUrl, status: "completed" } });
  if (!completed) await startCrawl(prisma, ctx, targetUrl);
}

/**
 * PATCH /api/onboarding — saves one step and advances `currentStep`.
 * Returns { state, next }. Skipping ahead of `currentStep` is rejected (409).
 */
export async function PATCH(request: Request) {
  const guard = await guardOwnOrg();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = stepPayloadSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const payload = parsed.data;

  const onboarding = await prisma.onboarding.findUnique({ where: { organisationId: ctx.org.id } });
  if (!onboarding) return jsonError("Onboarding not found.", 404);
  if (onboarding.completedAt) return jsonError("Onboarding is already complete.", 409, { next: "/dashboard/overview" });
  if (payload.step > onboarding.currentStep) {
    return jsonError("Complete the previous steps first.", 409, { next: `/onboarding/${onboarding.currentStep}` });
  }

  await delay(MOCK_LATENCY_MS);
  const nextStep = Math.min(TOTAL_STEPS, Math.max(onboarding.currentStep, payload.step + 1));

  switch (payload.step) {
    case 1: {
      let environmentUrl: string | null = null;
      let localPort: number | null = onboarding.localPort;
      let target: string;
      if (payload.reachMode === "staging") {
        environmentUrl = normalizeWebsite(payload.environmentUrl ?? "");
        if (!environmentUrl) return jsonError("Enter a valid app endpoint, e.g. https://staging.example.com", 400);
        target = environmentUrl;
      } else {
        if (!onboarding.tunnelEnrolled) return jsonError("Waiting for the tunnel to enrol. Run the command first.", 400);
        localPort = payload.localPort ?? onboarding.localPort ?? 3000;
        target = `http://localhost:${localPort}`;
      }

      const username = payload.appLoginType === "credentials" ? payload.appLoginUsername?.trim() ?? "" : "";
      if (payload.appLoginType === "credentials" && !username) return jsonError("Enter the username QASyn should log in with.", 400);
      const password =
        payload.appLoginType !== "credentials"
          ? null
          : payload.appLoginPassword
            ? encryptSecret(payload.appLoginPassword)
            : onboarding.appLoginPassword;

      await prisma.onboarding.update({
        where: { id: onboarding.id },
        data: {
          appDescription: payload.appDescription,
          reachMode: payload.reachMode,
          environmentUrl,
          localPort,
          appLoginType: payload.appLoginType,
          appLoginUsername: username || null,
          appLoginPassword: password,
          currentStep: nextStep,
        },
      });
      await crawlTarget(ctx, target);
      break;
    }
    case 2:
      await prisma.onboarding.update({
        where: { id: onboarding.id },
        data: payload.skip
          ? { currentStep: nextStep }
          : {
              painPoints: JSON.stringify(payload.painPoints),
              userRole: payload.userRole ?? null,
              testingMaturity: payload.testingMaturity ?? null,
              currentStep: nextStep,
            },
      });
      if (!payload.skip && payload.userRole) {
        await prisma.user.update({ where: { id: ctx.user.id }, data: { role: payload.userRole === "Founder" ? "Admin" : payload.userRole } });
      }
      break;
    case 3:
    case 4:
      await prisma.onboarding.update({ where: { id: onboarding.id }, data: { currentStep: nextStep } });
      break;
    case 5:
      await prisma.onboarding.update({
        where: { id: onboarding.id },
        data: payload.skip ? { currentStep: nextStep } : { focusPriority: payload.focusPriority ?? null, currentStep: nextStep },
      });
      break;
    case 6: {
      const emails = payload.skip ? [] : [...new Set(payload.invitedEmails)].filter((e) => e !== ctx.user.email);
      await prisma.$transaction(async (tx) => {
        for (const email of emails) {
          const existing = await tx.user.findUnique({ where: { email } });
          if (existing) continue; // never attach someone who already has an account elsewhere
          await tx.user.create({
            data: {
              email,
              name: email.split("@")[0],
              avatarInitials: initialsOf("", email),
              role: "Engineer",
              status: "invited",
              organisationId: ctx.org.id,
            },
          });
          await audit(tx, ctx, "member.invited", email);
        }
        await tx.onboarding.update({
          where: { id: onboarding.id },
          data: {
            invitedEmails: payload.skip ? onboarding.invitedEmails : emails.join("\n"),
            currentStep: nextStep,
          },
        });
      });
      break;
    }
    case 7:
      await prisma.onboarding.update({ where: { id: onboarding.id }, data: { completedAt: new Date(), currentStep: TOTAL_STEPS } });
      await audit(prisma, ctx, "onboarding.completed", ctx.org.slug);
      break;
  }

  const state = await loadOnboardingState(ctx.org.id);
  const next = payload.step >= TOTAL_STEPS ? "/dashboard/overview" : `/onboarding/${payload.step + 1}`;
  return NextResponse.json({ state, next });
}

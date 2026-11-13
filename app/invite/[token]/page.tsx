import type { Metadata } from "next";
import Link from "next/link";
import { InviteForm } from "@/components/auth/InviteForm";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Accept your invitation" };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.teamInvite.findUnique({
    where: { token },
    include: { organisation: { select: { name: true } } },
  });
  const invalid = !invite || invite.status !== "pending" || invite.expiresAt.getTime() < Date.now();
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-lg items-center px-4 py-10">
      <div className="w-full rounded-2xl border border-line bg-white p-8 shadow-xl shadow-brand-900/5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">QASyn team invitation</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{invalid ? "This invitation is no longer valid" : `Join ${invite.organisation.name}`}</h1>
        {invalid ? (
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            <p>The link may have expired or already been accepted. Ask your workspace admin to send a fresh invitation.</p>
            <Link href="/login" className="font-semibold text-brand-600 hover:underline">Go to sign in</Link>
          </div>
        ) : (
          <div className="mt-6">
            <InviteForm token={token} email={invite.email} organisationName={invite.organisation.name} role={invite.role} />
          </div>
        )}
      </div>
    </main>
  );
}

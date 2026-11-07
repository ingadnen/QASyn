import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyForm } from "@/components/auth/VerifyForm";
import { getSession, nextPathFor } from "@/lib/auth";

export const metadata: Metadata = { title: "Verify your e-mail" };
export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.emailVerifiedAt) redirect(await nextPathFor(session.user));
  return <VerifyForm email={session.user.email} />;
}

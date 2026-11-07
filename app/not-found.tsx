import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-navy-950 px-6 text-center text-white">
      <Logo inverted />
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-400">404</p>
        <h1 className="mt-2 text-2xl font-semibold">This page doesn&apos;t exist.</h1>
      </div>
      <div className="flex gap-3 text-sm">
        <Link href="/signup" className="rounded-lg bg-brand-600 px-4 py-2 font-medium hover:bg-brand-500">
          Create organisation
        </Link>
        <Link href="/dashboard/overview" className="rounded-lg border border-white/15 px-4 py-2 font-medium hover:bg-white/5">
          Open dashboard
        </Link>
      </div>
    </main>
  );
}

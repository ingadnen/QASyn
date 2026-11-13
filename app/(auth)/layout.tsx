import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

/** Accounts area (login / signup / verify): centred card on a soft brand backdrop. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_0%,rgba(61,46,224,0.10),transparent_70%)]"
      />
      <header className="relative flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" aria-label="QASyn home">
          <Logo />
        </Link>
        <span className="text-xs text-muted">© 2026 QASyn Inc. · Enterprise Security &amp; Compliance</span>
      </header>
      <main className="relative flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:pt-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

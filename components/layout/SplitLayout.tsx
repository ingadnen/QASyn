import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

/**
 * Layout split-pane asymétrique :
 * volet gauche clair (formulaire) / volet droit navy (aperçu flottant).
 */
export function SplitLayout({
  children,
  aside,
  header,
  wide = false,
}: {
  children: React.ReactNode;
  aside: React.ReactNode;
  header?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <main className="flex min-h-screen flex-col bg-white px-6 py-6 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="QASyn home">
            <Logo />
          </Link>
          {header}
        </div>
        <div className={cn("mx-auto w-full flex-1 py-10 lg:py-14", wide ? "max-w-2xl" : "max-w-lg")}>{children}</div>
        <footer className="flex justify-between border-t border-line pt-4 text-xs text-muted">
          <span>© {new Date().getFullYear()} QASyn Inc. All rights reserved.</span>
          <span>Autonomous AI Quality Engineering · Enterprise SaaS</span>
        </footer>
      </main>

      <aside className="relative hidden overflow-hidden bg-navy-950 lg:flex lg:items-center lg:justify-center lg:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(61,46,224,0.45),transparent_45%),radial-gradient(circle_at_80%_85%,rgba(34,211,238,0.14),transparent_40%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px]"
        />
        <div className="relative w-full max-w-md">{aside}</div>
      </aside>
    </div>
  );
}

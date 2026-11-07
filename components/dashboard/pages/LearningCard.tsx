"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/Button";
import type { LearningModule } from "@/lib/learning";
import { cn } from "@/lib/utils";

export function LearningCard({ mod, status, readOnly }: { mod: LearningModule; status?: string; readOnly: boolean }) {
  const { run, pending } = useAction();
  const router = useRouter();
  const [done, setDone] = useState(status === "completed");

  async function setStatus(s: "in_progress" | "completed") {
    const res = await run("l", "/api/dashboard/learning/progress", { json: { moduleId: mod.id, status: s } });
    if (res) {
      setDone(s === "completed");
      router.refresh();
    }
  }

  return (
    <article
      className={cn(
        "flex flex-col rounded-xl border bg-white p-4 shadow-sm transition",
        done ? "border-emerald-200" : "border-slate-200 hover:border-brand-300",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand-700 uppercase">{mod.kind}</span>
        <span className="text-xs text-slate-400">{mod.minutes} min</span>
        {done && <span className="ml-auto text-xs font-semibold text-emerald-600">✓ Completed</span>}
      </div>
      <h3 className="mt-2 text-sm font-semibold text-slate-900">{mod.title}</h3>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500">{mod.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href={mod.href} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500">
          {mod.cta} →
        </Link>
        {!done ? (
          <Button variant="ghost" size="sm" disabled={readOnly} loading={pending === "l"} onClick={() => void setStatus("completed")}>
            Mark complete
          </Button>
        ) : (
          <Button variant="ghost" size="sm" disabled={readOnly} loading={pending === "l"} onClick={() => void setStatus("in_progress")}>
            Reopen
          </Button>
        )}
      </div>
    </article>
  );
}

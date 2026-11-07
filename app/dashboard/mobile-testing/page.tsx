import type { Metadata } from "next";
import { MobileStudio } from "@/components/dashboard/pages/EnginesClient";
import { Card, PageHeader, StatusPill } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Mobile testing" };
export const dynamic = "force-dynamic";

export default async function MobileTestingPage() {
  const ctx = await requireOrgContext();
  const [apps, tests] = await Promise.all([
    prisma.mobileApp.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } }),
    prisma.mobileTest.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" }, include: { app: { select: { name: true, platform: true } } } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader kicker="MOBILE TESTING STUDIO" title="Mobile testing" description="Upload APK/IPA builds, pick devices (iOS 14+, Android API 21+), edit gestures and run on the device grid." />
      <Card title="Studio"><div className="px-5 py-4"><MobileStudio apps={apps.map((a) => ({ id: a.id, name: a.name, platform: a.platform, version: a.version }))} readOnly={ctx.readOnly} /></div></Card>
      <Card title="Device frames">
        <div className="grid gap-6 px-5 py-5 sm:grid-cols-2">
          {[
            { name: "iPhone 15", os: "iOS 17", frame: "rounded-[2rem] border-slate-900" },
            { name: "Pixel 8", os: "Android 14", frame: "rounded-[1.5rem] border-slate-700" },
          ].map((d) => (
            <div key={d.name} className={`mx-auto w-44 border-8 bg-slate-900 p-2 shadow-xl ${d.frame}`}>
              <div className="flex h-64 flex-col rounded-[1.2rem] bg-white p-3">
                <p className="text-center text-[10px] font-semibold text-slate-700">{d.name}</p>
                <p className="text-center text-[9px] text-slate-400">{d.os} · FaceID/Touch ready</p>
                <div className="mt-3 flex-1 rounded-lg bg-slate-100 p-2">
                  <div className="h-2 w-3/4 rounded bg-slate-200" />
                  <div className="mt-2 h-2 w-1/2 rounded bg-slate-200" />
                  <div className="mt-3 h-8 rounded bg-brand-100" />
                </div>
                <p className="mt-2 text-center text-[9px] text-slate-400">gesture canvas</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Uploaded builds">
          <ul className="divide-y divide-slate-100 px-5 py-2">
            {apps.length === 0 && <li className="py-3 text-sm text-slate-500">No builds yet.</li>}
            {apps.map((a) => (
              <li key={a.id} className="py-2 text-sm">
                <span className="font-medium">{a.name}</span> <span className="text-xs text-slate-500">{a.platform} {a.version} · {a.fileUrl} · {timeAgo(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Mobile tests">
          <ul className="divide-y divide-slate-100 px-5 py-2">
            {tests.length === 0 && <li className="py-3 text-sm text-slate-500">No mobile tests yet.</li>}
            {tests.map((t) => (
              <li key={t.id} className="py-2 text-sm">
                <span className="font-medium">{t.name}</span> <StatusPill value={t.status === "passed" ? "passing" : t.status === "failed" ? "failing" : "draft"} label={t.status} />{" "}
                <span className="text-xs text-slate-500">{t.device}{t.app ? ` · ${t.app.name}` : ""}{t.lastRunAt ? ` · ${timeAgo(t.lastRunAt)}` : ""}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

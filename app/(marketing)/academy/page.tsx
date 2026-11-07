import type { Metadata } from "next";
import { AcademyQuiz } from "@/components/marketing/AcademyQuiz";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Academy" };
export const dynamic = "force-dynamic";

export default async function AcademyPage({ searchParams }: { searchParams: Promise<{ cert?: string }> }) {
  const courses = await prisma.course.findMany({ orderBy: { title: "asc" } });
  const { cert } = await searchParams;
  let verified = false;
  if (cert) {
    const record = await prisma.certification.findUnique({ where: { certCode: cert.toUpperCase() } });
    verified = !!record;
  }
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <p className="text-xs font-semibold tracking-[0.16em] text-brand-600 uppercase">Resources · Academy</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">QA Certification Academy</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Interactive courses, quizzes and digital certificates for autonomous quality engineering.</p>
      {cert && (
        <p className={`mt-4 rounded-lg px-4 py-3 text-sm font-medium ${verified ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {verified ? `✓ Certificate ${cert} verified authentic.` : `Certificate ${cert} not found.`}
        </p>
      )}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {courses.map((c) => {
          let syllabus: Array<{ module: string; lessons: string[] }> = [];
          try {
            syllabus = JSON.parse(c.syllabusJson || "[]");
          } catch {
            syllabus = [];
          }
          return (
            <article key={c.slug} className="rounded-xl border border-line bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold tracking-widest text-brand-600 uppercase">{c.level} · {c.durationHours}h</p>
              <h2 className="mt-2 text-base font-semibold text-ink">{c.title}</h2>
              <p className="mt-2 text-sm text-muted">{c.description}</p>
              <ul className="mt-3 space-y-1">
                {syllabus.map((m) => (
                  <li key={m.module} className="text-xs text-slate-600"><strong>{m.module}</strong>: {m.lessons.join(", ")}</li>
                ))}
              </ul>
              <p className="mt-3 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">🏅 {c.badgeName}</p>
              <AcademyQuiz badgeName={c.badgeName} />
            </article>
          );
        })}
      </div>
      {courses.length === 0 && <p className="mt-8 text-sm text-muted">No courses yet — run <code>npm run db:seed</code>.</p>}
    </div>
  );
}

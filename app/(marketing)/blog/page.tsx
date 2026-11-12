import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Blog" };
export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const posts = await prisma.blogPost.findMany({ orderBy: [{ featured: "desc" }, { publishedAt: "desc" }], take: 20 });
  return (
    <div className="mx-auto max-w-[1440px] px-6 sm:px-8 lg:px-12 py-12">
      <p className="text-xs font-semibold tracking-[0.16em] text-brand-600 uppercase">Resources · Blog</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">QA engineering blog</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">High-yield, opinionated essays on agentic testing, self-healing and release engineering.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <Link key={p.slug} href={`/blog/${p.slug}`} className="flex flex-col rounded-xl border border-line bg-white p-5 shadow-sm transition hover:border-brand-300">
            <p className="text-[11px] font-semibold tracking-widest text-brand-600 uppercase">{p.tags}</p>
            <h2 className="mt-2 text-base font-semibold text-ink">{p.title}</h2>
            <p className="mt-2 flex-1 text-sm text-muted">{p.summary}</p>
            <p className="mt-3 text-xs text-slate-400">{p.authorName} · {p.readTimeMin} min read · {p.publishedAt.toLocaleDateString()}</p>
          </Link>
        ))}
      </div>
      {posts.length === 0 && <p className="mt-8 text-sm text-muted">No posts yet — run <code>npm run db:seed</code>.</p>}
    </div>
  );
}

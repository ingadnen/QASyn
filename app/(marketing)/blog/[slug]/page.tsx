import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Blog post" };
export const dynamic = "force-dynamic";

export default async function BlogSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({ where: { slug } });
  if (!post) notFound();
  let results: Array<{ metric: string; label: string }> = [];
  try {
    results = JSON.parse(post.tags.includes("case") ? "{}" : "{}");
  } catch {
    results = [];
  }
  void results;
  const paragraphs = post.contentHtml.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <article className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-xs font-semibold tracking-[0.16em] text-brand-600 uppercase">{post.tags}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{post.title}</h1>
      <p className="mt-3 text-sm text-muted">
        {post.authorName} · {post.authorRole} · {post.readTimeMin} min read · {post.publishedAt.toLocaleDateString()}
      </p>
      <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-slate-700">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </article>
  );
}

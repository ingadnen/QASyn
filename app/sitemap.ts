import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default async function Sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://qasyn.local";
  let posts: Array<{ slug: string }> = [];
  let studies: Array<{ slug: string }> = [];
  let terms: Array<{ slug: string }> = [];
  try {
    const { prisma } = await import("@/lib/db");
    [posts, studies, terms] = await Promise.all([
      prisma.blogPost.findMany({ select: { slug: true } }),
      prisma.caseStudy.findMany({ select: { slug: true } }),
      prisma.glossaryTerm.findMany({ select: { slug: true } }),
    ]);
  } catch {
    // SQLite unavailable/locked during build — serve static paths only.
    posts = [];
    studies = [];
    terms = [];
  }
  const staticPaths = [
    "", "/ship", "/integrations", "/learning", "/signup", "/login",
    "/platform", "/platform/at-a-glance", "/platform/enterprise-apps-testing", "/platform/ai-agents-testing",
    "/platform/ai-based-self-healing", "/platform/root-cause-analysis", "/platform/code-export", "/platform/mcp",
    "/platform/ai-insights-analytics", "/platform/impact-analysis", "/platform/continuous-testing", "/platform/test-infrastructure",
    "/solutions", "/solutions/web-automation", "/solutions/mobile-testing", "/solutions/api-testing", "/solutions/salesforce-testing",
    "/solutions/erp-sap-testing", "/solutions/database-testing", "/solutions/security-testing", "/solutions/performance-accessibility",
    "/solutions/performance-testing", "/solutions/visual-regression", "/solutions/email-testing", "/solutions/voice-agent-testing",
    "/solutions/risk-based-testing", "/solutions/saas-ai-tools", "/industries",
    "/integrations/claude", "/integrations/chatgpt", "/integrations/cursor",
    "/resources", "/blog", "/case-study", "/roi-calculator", "/podcast", "/webinars", "/tutorials",
    "/ebooks", "/whitepapers", "/glossary", "/academy", "/free-tools", "/comparison", "/newsletter",
    "/about-us", "/why-qasyn", "/careers", "/channel-partners", "/partner-program", "/pilot-program",
    "/media-coverage", "/community", "/faqs", "/contact-us", "/pricing",
    "/terms-of-service", "/privacy-policy", "/data-privacy-policy", "/data-processing-agreement", "/cookie-policy",
  ];
  const dynamicPaths = [
    ...posts.map((p) => `/blog/${p.slug}`),
    ...studies.map((s) => `/case-study/${s.slug}`),
    ...terms.map(() => `/glossary`),
  ];
  return [...staticPaths, ...dynamicPaths].map((p) => ({
    url: `${base}${p}`,
    lastModified: new Date(),
  }));
}

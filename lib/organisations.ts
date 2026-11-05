import { RESERVED_SLUGS } from "./constants";
import { prisma } from "./db";
import { isValidSlug } from "./utils";

export type SlugAvailability =
  | { available: true; slug: string }
  | { available: false; slug: string; reason: "invalid" | "reserved" | "taken"; suggestion: string | null };

/** Premier slug libre de la forme "base-2", "base-3"… */
async function findSuggestion(base: string): Promise<string | null> {
  const stem = base.slice(0, 36);
  const existing = await prisma.organisation.findMany({
    where: { slug: { startsWith: stem } },
    select: { slug: true },
  });
  const taken = new Set(existing.map((o) => o.slug));
  for (let i = 2; i < 100; i++) {
    const candidate = `${stem}-${i}`;
    if (!taken.has(candidate) && !RESERVED_SLUGS.has(candidate)) return candidate;
  }
  return null;
}

export async function checkSlugAvailability(slug: string): Promise<SlugAvailability> {
  if (!isValidSlug(slug)) return { available: false, slug, reason: "invalid", suggestion: null };
  if (RESERVED_SLUGS.has(slug)) {
    return { available: false, slug, reason: "reserved", suggestion: await findSuggestion(slug) };
  }
  const existing = await prisma.organisation.findUnique({ where: { slug }, select: { id: true } });
  if (existing) return { available: false, slug, reason: "taken", suggestion: await findSuggestion(slug) };
  return { available: true, slug };
}

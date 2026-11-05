import { NextResponse } from "next/server";
import { checkSlugAvailability } from "@/lib/organisations";
import { slugify } from "@/lib/utils";

/**
 * GET /api/onboard/check-slug?slug=gmailad  (ou ?name=Gmailad)
 * Vérification en temps réel de la disponibilité du slug (SELECT).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("slug") ?? searchParams.get("name") ?? "";
  const slug = slugify(raw.slice(0, 80));
  const result = await checkSlugAvailability(slug);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

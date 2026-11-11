import { NextResponse } from "next/server";
import { z } from "zod";
import { CONTEXT7_LIBRARIES, resolveContext7 } from "@/lib/context7";
import { readJson, validationError } from "@/lib/http";
import { guardPermission } from "@/lib/rbac-server";

const bodySchema = z.object({
  query: z.string().trim().min(1).max(2000),
});

/** GET /api/dashboard/context7 — library catalogue and live documentation status. */
export async function GET() {
  const guard = await guardPermission("mcp");
  if (!guard.ok) return guard.response;
  return NextResponse.json(
    {
      libraries: CONTEXT7_LIBRARIES.map((library) => ({
        id: library.id,
        name: library.name,
        version: library.version,
        docsUrl: library.docsUrl,
        rules: library.rules.length,
      })),
      mode: "local-deterministic",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** POST /api/dashboard/context7 — resolve a task to versioned library guidance. */
export async function POST(request: Request) {
  const guard = await guardPermission("mcp");
  if (!guard.ok) return guard.response;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  return NextResponse.json(resolveContext7(parsed.data.query), { headers: { "Cache-Control": "no-store" } });
}

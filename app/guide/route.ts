import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves the self-contained interactive user guide at /guide.
 *
 * The source of truth is `public/user-guide.html` so the guide can also be
 * opened directly (and downloaded) without the Next.js runtime.
 */
export async function GET() {
  try {
    const html = await readFile(path.join(process.cwd(), "public", "user-guide.html"), "utf8");
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response("User guide not found.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

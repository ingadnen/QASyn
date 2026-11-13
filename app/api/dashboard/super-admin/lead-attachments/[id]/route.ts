import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { dataUrlBase64, dataUrlMimeType, readLeadAttachments } from "@/lib/lead-attachments";
import { isSuperAdmin } from "@/lib/rbac";
import { guardPermission } from "@/lib/rbac-server";

type Params = { params: Promise<{ id: string }> };

function safeFilename(value: string): string {
  return value.replace(/[\r\n"\\/]+/g, "_").trim() || "attachment";
}

/** GET /api/dashboard/super-admin/lead-attachments/[id]?kind=cv|cover-letter */
export async function GET(request: Request, { params }: Params) {
  const guard = await guardPermission("settingsManage", { write: true });
  if (!guard.ok) return guard.response;
  if (!isSuperAdmin(guard.ctx.user.role)) return jsonError("Super Admin access required.", 403);

  const { id } = await params;
  const kind = new URL(request.url).searchParams.get("kind");
  const attachments = await readLeadAttachments(id);
  const file = kind === "cover-letter" ? attachments?.coverLetter : attachments?.cv;
  if (!file) return jsonError("Attachment not found.", 404);

  const base64 = dataUrlBase64(file.dataUrl);
  if (!base64) return jsonError("Attachment is empty.", 404);
  const mimeType = file.mimeType || dataUrlMimeType(file.dataUrl, "application/octet-stream");

  return new NextResponse(new Uint8Array(Buffer.from(base64, "base64")), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${safeFilename(file.fileName)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

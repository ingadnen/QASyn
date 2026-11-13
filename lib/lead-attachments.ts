import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface LeadAttachmentFile {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  uploadedAt: string;
}

export interface LeadAttachmentBundle {
  cv?: LeadAttachmentFile;
  coverLetter?: LeadAttachmentFile;
}

const SAFE_ID = /^[a-zA-Z0-9_-]{1,80}$/;

function attachmentDirectory() {
  return path.join(process.cwd(), ".qasyn-data", "lead-attachments");
}

export function leadAttachmentPath(leadId: string): string {
  if (!SAFE_ID.test(leadId)) throw new Error("Invalid lead identifier.");
  return path.join(attachmentDirectory(), `${leadId}.json`);
}

export async function saveLeadAttachments(leadId: string, bundle: LeadAttachmentBundle): Promise<void> {
  await mkdir(attachmentDirectory(), { recursive: true });
  await writeFile(leadAttachmentPath(leadId), JSON.stringify(bundle), { encoding: "utf8", mode: 0o600 });
}

export async function readLeadAttachments(leadId: string): Promise<LeadAttachmentBundle | null> {
  try {
    const raw = await readFile(leadAttachmentPath(leadId), "utf8");
    return JSON.parse(raw) as LeadAttachmentBundle;
  } catch {
    return null;
  }
}

/** Extracts the base64 payload from a browser FileReader data URL. */
export function dataUrlBase64(dataUrl: string): string {
  return dataUrl.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
}

export function dataUrlMimeType(dataUrl: string, fallback: string): string {
  const match = /^data:([^;]+);base64,/.exec(dataUrl);
  return match?.[1] || fallback;
}

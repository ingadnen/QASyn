/**
 * Visual regression: hash-based pixel comparison (simulated environment),
 * threshold management and diff summaries. No native deps.
 */
import { createHash } from "node:crypto";

export function pixelHash(screenshotB64: string): string {
  return createHash("sha256").update(screenshotB64).digest("hex").slice(0, 16);
}

/** Compares two Base64 screenshots: returns mismatch percentage. */
export function compareScreenshots(baselineB64: string, currentB64: string): { mismatchPercent: number; identical: boolean } {
  if (baselineB64 === currentB64) return { mismatchPercent: 0, identical: true };
  // Simulated pixel diff: derive a stable mismatch from both hashes.
  const a = pixelHash(baselineB64);
  const b = pixelHash(currentB64);
  let diff = 0;
  for (let i = 0; i < 16; i++) if (a[i] !== b[i]) diff++;
  return { mismatchPercent: Math.round((diff / 16) * 1000) / 10, identical: false };
}

export function visualVerdict(mismatchPercent: number, threshold = 1): "approved" | "pending" | "rejected" {
  if (mismatchPercent <= threshold) return "approved";
  if (mismatchPercent > threshold * 5) return "rejected";
  return "pending";
}

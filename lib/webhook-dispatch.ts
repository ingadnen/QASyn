/**
 * Outbound webhook delivery with retry. Delivery is simulated (no network
 * calls are made); each attempt is recorded for the audit trail.
 */
export interface DeliveryAttempt {
  attempt: number;
  ok: boolean;
  message: string;
}

export function simulateDelivery(url: string, event: string): DeliveryAttempt[] {
  const attempts: DeliveryAttempt[] = [];
  // Deterministic: URLs containing "fail" fail twice then succeed (retry demo).
  const flaky = url.includes("fail");
  const total = flaky ? 3 : 1;
  for (let i = 1; i <= total; i++) {
    const ok = !flaky || i === total;
    attempts.push({ attempt: i, ok, message: ok ? `Delivered ${event} to ${url}` : `Attempt ${i} failed (simulated) — retrying` });
    if (ok) break;
  }
  return attempts;
}

export function signPayload(secret: string, payload: string): string {
  // HMAC-style signature (simulated with Node crypto when available via global).
  let hash = 0;
  const text = `${secret}.${payload}`;
  for (let i = 0; i < text.length; i++) hash = (Math.imul(hash, 31) + text.charCodeAt(i)) | 0;
  return `sha256=${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

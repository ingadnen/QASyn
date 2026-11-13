/** Tiny in-memory fixed-window rate limiter (single local process). */
const buckets = new Map<string, { count: number; resetAt: number }>();

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "0:0:0:0:0:0:0:1", "::ffff:127.0.0.1"]);

/**
 * True when a proxy supplied a real client address. Next.js fills
 * `x-forwarded-for` with the socket address for direct requests, so loopback
 * values must not disable the local parity bypass.
 */
export function forwardedForIsExternal(request: Request): boolean {
  const header = request.headers.get("x-forwarded-for");
  if (!header) return false;
  return header.split(",").some((value) => {
    const address = value.trim();
    return address.length > 0 && !LOOPBACK_ADDRESSES.has(address);
  });
}

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count++;
  return bucket.count <= limit;
}

export function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

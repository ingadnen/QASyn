"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the Server Components periodically while something is pending (PR analysis, indexing…). */
export function AutoRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [router, intervalMs]);
  return null;
}

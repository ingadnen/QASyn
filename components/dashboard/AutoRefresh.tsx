"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the Server Components periodically while something is pending (PR analysis, indexing…).
 *  Refreshes at most every 15 s and only while the tab is visible. */
export function AutoRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(t);
  }, [router, intervalMs]);
  return null;
}

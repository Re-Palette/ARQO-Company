"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Phase 0 live updates by polling; Supabase Realtime replaces this in Phase 1. */
export function AutoRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}

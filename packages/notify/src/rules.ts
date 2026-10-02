import type { NotificationCategory, Severity } from "@friday/core";

const SEVERITY_ORDER: Record<Severity, number> = { info: 0, success: 1, warning: 2, critical: 3 };

export interface Rule {
  category: NotificationCategory;
  minSeverity: Severity;
  channelIds: string[];
  enabled: boolean;
}

/** In-app is always included so nothing CEO-relevant can be lost. */
export function channelsFor(rules: Rule[], category: NotificationCategory, severity: Severity): string[] {
  const ids = new Set<string>(["in_app"]);
  for (const r of rules) {
    if (r.enabled && r.category === category && SEVERITY_ORDER[severity] >= SEVERITY_ORDER[r.minSeverity]) {
      r.channelIds.forEach((c) => ids.add(c));
    }
  }
  return [...ids];
}

/** Quiet hours, e.g. { start: "00:00", end: "06:30" } in company time. Critical always passes. */
export function inQuietHours(hhmm: string, quiet: { start: string; end: string } | null | undefined): boolean {
  if (!quiet) return false;
  const { start, end } = quiet;
  return start <= end ? hhmm >= start && hhmm < end : hhmm >= start || hhmm < end;
}

import type { ReportStatus } from "./enums";

const TRANSITIONS: Record<ReportStatus, readonly ReportStatus[]> = {
  generating: ["ready", "failed"],
  ready: ["pending_review"],
  pending_review: ["approved", "rejected", "revision_requested"],
  revision_requested: ["generating"],
  approved: ["archiving"],
  archiving: ["archived", "approved"],
  archived: [],
  rejected: [],
  failed: ["generating"],
};

export function canTransitionReport(from: ReportStatus, to: ReportStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

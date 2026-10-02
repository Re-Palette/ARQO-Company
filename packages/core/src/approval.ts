import type { ApprovalKind } from "./policy";
import { isApprovalAction } from "./policy";

export const APPROVAL_STATUSES = [
  "pending", "approved", "rejected", "revision_requested", "expired",
  "cancelled", "executing", "executed", "execution_failed",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export type ApprovalDecision = "approve" | "reject" | "request_revision";

const TRANSITIONS: Record<ApprovalStatus, readonly ApprovalStatus[]> = {
  pending: ["approved", "rejected", "revision_requested", "expired", "cancelled"],
  approved: ["executing"],
  executing: ["executed", "execution_failed"],
  execution_failed: ["pending"],
  rejected: [],
  revision_requested: [],
  expired: [],
  cancelled: [],
  executed: [],
};

export function canTransition(from: ApprovalStatus, to: ApprovalStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function decisionToStatus(decision: ApprovalDecision): ApprovalStatus {
  return decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "revision_requested";
}

/** Only approved *actions* move on to execution; reviews finish at approved. */
export function needsExecution(kind: ApprovalKind): boolean {
  return isApprovalAction(kind);
}

const RISK_WEIGHT = { low: 10, medium: 20, high: 30, critical: 40 } as const;
const PRIORITY_WEIGHT = { p0: 20, p1: 10, p2: 5, p3: 0 } as const;

/** CEO ACTION REQUIRED ordering score (docs/design/12-approval-flow.md 12.5). */
export function actionScore(input: {
  risk: keyof typeof RISK_WEIGHT;
  priority: keyof typeof PRIORITY_WEIGHT;
  dueAt?: Date | null;
  createdAt: Date;
  blockingCount?: number;
  now?: Date;
}): number {
  const now = input.now ?? new Date();
  let urgency = 0;
  if (input.dueAt) {
    const hours = (input.dueAt.getTime() - now.getTime()) / 3_600_000;
    urgency = hours < 1 ? 40 : hours < 6 ? 30 : hours < 24 ? 20 : 0;
  }
  const blocking = Math.min((input.blockingCount ?? 0) * 3, 15);
  const ageHours = Math.max(0, (now.getTime() - input.createdAt.getTime()) / 3_600_000);
  const age = Math.min(Math.floor(ageHours), 10);
  return RISK_WEIGHT[input.risk] + urgency + blocking + PRIORITY_WEIGHT[input.priority] + age;
}

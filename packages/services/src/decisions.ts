import { decideApproval } from "./approvals";
import type { ServiceContext } from "./context";
import { onReportDecision } from "./reports";

/**
 * CEO decision entry point: records the decision, then runs follow-ups
 * (report archive, …). Action execution for external actions is Phase 3/7.
 */
export async function decide(ctx: ServiceContext, approvalId: string, input: unknown) {
  const approval = await decideApproval(ctx, approvalId, input);
  let followUp: unknown = null;
  if (approval.kind === "report_review" && approval.subjectId &&
      (approval.status === "approved" || approval.status === "rejected" || approval.status === "revision_requested")) {
    followUp = await onReportDecision(ctx, approval.subjectId, approval.status);
  }
  return { approval, followUp };
}

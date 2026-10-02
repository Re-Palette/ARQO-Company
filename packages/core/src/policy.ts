/**
 * AI Operating Rules (docs/design/02-ai-operating-rules.md).
 *
 * This file is the code-level floor of the policy. The approval-required list
 * can be extended from settings but never relaxed; tests pin its contents.
 */

/** Article 1: work AI employees may do autonomously. */
export const AUTONOMOUS_ACTIVITIES = ["propose", "analyze", "research", "create"] as const;
export type AutonomousActivity = (typeof AUTONOMOUS_ACTIVITIES)[number];

/** Article 2: actions that always require CEO approval before execution. */
export const APPROVAL_REQUIRED_ACTIONS = [
  "email_send",
  "sns_post",
  "external_publish",
  "deploy",
  "contract",
  "payment",
  "external_integration",
  "pdf_submission",
] as const;
export type ApprovalActionKind = (typeof APPROVAL_REQUIRED_ACTIONS)[number];

/** Article 3: internal reviews that need a CEO decision to move forward. */
export const REVIEW_KINDS = ["report_review", "proposal_review", "deliverable_review", "board_decision"] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];

export const APPROVAL_KINDS = [...APPROVAL_REQUIRED_ACTIONS, ...REVIEW_KINDS] as const;
export type ApprovalKind = (typeof APPROVAL_KINDS)[number];

/** Article 4: never done, even with approval. */
export const PROHIBITED_ACTIONS = [
  "approve_on_behalf_of_ceo",
  "modify_own_permissions",
  "delete_vault_history",
  "send_restricted_personal_data_to_model",
  "execute_payload_different_from_approved",
  "impersonate_ceo",
] as const;
export type ProhibitedAction = (typeof PROHIBITED_ACTIONS)[number];

export const ACTION_LABELS_JA: Record<ApprovalKind, string> = {
  email_send: "メール送信",
  sns_post: "SNS投稿",
  external_publish: "外部公開",
  deploy: "デプロイ",
  contract: "契約",
  payment: "支払い",
  external_integration: "外部サービス連携",
  pdf_submission: "PDF提出",
  report_review: "レポート確認",
  proposal_review: "提案レビュー",
  deliverable_review: "成果物レビュー",
  board_decision: "Board決議",
};

export const DEFAULT_RISK: Record<ApprovalKind, "low" | "medium" | "high" | "critical"> = {
  email_send: "high",
  sns_post: "high",
  external_publish: "high",
  deploy: "high",
  contract: "critical",
  payment: "critical",
  external_integration: "high",
  pdf_submission: "critical",
  report_review: "low",
  proposal_review: "medium",
  deliverable_review: "low",
  board_decision: "medium",
};

export function isApprovalAction(kind: string): kind is ApprovalActionKind {
  return (APPROVAL_REQUIRED_ACTIONS as readonly string[]).includes(kind);
}

export function isReviewKind(kind: string): kind is ReviewKind {
  return (REVIEW_KINDS as readonly string[]).includes(kind);
}

export function approvalCategory(kind: ApprovalKind): "action" | "review" {
  return isApprovalAction(kind) ? "action" : "review";
}

/** Article 5: grey-zone test. Any "yes" means approval is required (fail-safe). */
export interface GreyZoneAnswers {
  reachesOutside: boolean;
  createsMoneyOrObligation: boolean;
  hardToUndo: boolean;
  usesCeoNameOrBrand: boolean;
}

export function greyZoneRequiresApproval(a: GreyZoneAnswers): boolean {
  return a.reachesOutside || a.createsMoneyOrObligation || a.hardToUndo || a.usesCeoNameOrBrand;
}

/**
 * Settings may add approval-required kinds (free-form keys) but must keep
 * every kind of the floor. Returns the effective list or throws.
 */
export function effectiveApprovalRequired(additions: readonly string[]): string[] {
  return Array.from(new Set([...APPROVAL_REQUIRED_ACTIONS, ...additions]));
}

export function assertPolicyNotRelaxed(proposed: readonly string[]): void {
  const missing = APPROVAL_REQUIRED_ACTIONS.filter((k) => !proposed.includes(k));
  if (missing.length > 0) {
    throw new PolicyViolationError(`承認必須の行為は緩和できません: ${missing.join(", ")}`);
  }
}

export class PolicyViolationError extends Error {
  readonly code = "POLICY_VIOLATION";
}

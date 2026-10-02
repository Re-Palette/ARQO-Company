// Values that define system behaviour. Things the company grows (divisions,
// projects, categories) are data, not enums.

export const AGENT_LEVELS = ["executive", "lead", "specialist"] as const;
export type AgentLevel = (typeof AGENT_LEVELS)[number];

export const MODEL_TIERS = ["fast", "standard", "deep"] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

export const PRESENCE_STATES = [
  "idle", "thinking", "researching", "coding", "writing", "designing",
  "meeting", "waiting_approval", "blocked", "offline",
] as const;
export type PresenceState = (typeof PRESENCE_STATES)[number];

export const DIVISION_KINDS = ["executive", "corporate", "business_unit"] as const;
export type DivisionKind = (typeof DIVISION_KINDS)[number];

export const PROJECT_STATUSES = ["proposed", "planning", "active", "on_hold", "completed", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_HEALTH = ["on_track", "at_risk", "off_track"] as const;
export const DATA_SENSITIVITY = ["normal", "confidential", "restricted"] as const;
export type DataSensitivity = (typeof DATA_SENSITIVITY)[number];

export const PRIORITIES = ["p0", "p1", "p2", "p3"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const DIRECTIVE_SOURCES = ["ceo", "universal_agent", "scheduler", "system"] as const;
export type DirectiveSource = (typeof DIRECTIVE_SOURCES)[number];

export const DIRECTIVE_STATUSES = [
  "received", "understanding", "clarifying", "planning", "in_progress",
  "integrating", "awaiting_ceo", "completed", "cancelled", "failed",
] as const;
export type DirectiveStatus = (typeof DIRECTIVE_STATUSES)[number];

export const TASK_STATUSES = [
  "queued", "blocked", "in_progress", "waiting_approval", "review", "done", "failed", "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const DELIVERABLE_STATUSES = ["draft", "in_review", "approved", "rejected", "published"] as const;

export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const REPORT_TYPES = [
  "morning_briefing", "daily_executive", "weekly_board", "board_pack",
  "division", "project", "repalette_monthly", "impact",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_STATUSES = [
  "generating", "ready", "pending_review", "revision_requested", "approved",
  "rejected", "archiving", "archived", "failed",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const ACTOR_TYPES = ["ceo", "agent", "system", "client"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const EVENT_VISIBILITY = ["timeline", "internal"] as const;

export const NOTIFICATION_CATEGORIES = ["action_required", "report", "project", "task", "system", "alert"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const SEVERITIES = ["info", "success", "warning", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const MEMORY_KINDS = [
  "conversation", "active_task", "decision", "project_context", "plan", "finding", "preference",
] as const;

export const METRIC_CALC_TYPES = ["count", "ratio", "sum", "avg_duration"] as const;
export const METRIC_SCOPES = ["common", "division", "agent"] as const;

export const BACKUP_KINDS = ["vault", "db", "reports", "restore_test"] as const;

import { z } from "zod";
import { APPROVAL_KINDS } from "./policy";
import {
  AGENT_LEVELS, DATA_SENSITIVITY, MODEL_TIERS, PRIORITIES, PROJECT_STATUSES, REPORT_TYPES, RISK_LEVELS,
} from "./enums";

const slug = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "英小文字・数字・ハイフンのみ");

export const CreateProjectInput = z.object({
  slug,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(64).default("general"),
  templateKey: z.string().min(1),
  parentSlug: slug.optional(),
  ownerDivisionId: z.string().min(1),
  status: z.enum(PROJECT_STATUSES).default("active"),
  pinned: z.boolean().default(false),
  color: z.string().max(32).optional(),
  icon: z.string().max(32).optional(),
  dataSensitivity: z.enum(DATA_SENSITIVITY).default("normal"),
  customFields: z.record(z.string(), z.unknown()).default({}),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

export const CreateAgentInput = z.object({
  id: slug,
  displayName: z.string().min(1).max(80),
  title: z.string().min(1).max(80),
  divisionId: z.string().min(1),
  level: z.enum(AGENT_LEVELS).default("specialist"),
  reportsTo: z.string().optional(),
  persona: z.string().max(4000).default(""),
  responsibilities: z.array(z.string()).default([]),
  deliverableTypes: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  modelTier: z.enum(MODEL_TIERS).default("standard"),
  metricSet: z.array(z.string()).max(3).default([]),
  runtime: z.enum(["mock", "llm"]).default("mock"),
  enabled: z.boolean().default(true),
});
export type CreateAgentInput = z.infer<typeof CreateAgentInput>;

export const CreateDirectiveInput = z.object({
  text: z.string().min(1).max(8000),
  type: z.enum(["task", "research", "analysis"]).default("task"),
  project: slug.optional(),
  priority: z.enum(PRIORITIES).default("p2"),
  deadline: z.iso.datetime({ offset: true }).optional(),
  hints: z.object({ divisions: z.array(z.string()).optional() }).optional(),
  callback: z.boolean().default(false),
});
export type CreateDirectiveInput = z.infer<typeof CreateDirectiveInput>;

export const CreateApprovalInput = z.object({
  kind: z.enum(APPROVAL_KINDS),
  title: z.string().min(1).max(200),
  summary: z.string().max(2000).default(""),
  requestedByAgentId: z.string().min(1),
  projectSlug: slug.optional(),
  subjectType: z.string().optional(),
  subjectId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  preview: z.record(z.string(), z.unknown()).default({}),
  riskLevel: z.enum(RISK_LEVELS).optional(),
  priority: z.enum(PRIORITIES).default("p2"),
  dueAt: z.iso.datetime({ offset: true }).optional(),
  blockingCount: z.number().int().min(0).default(0),
});
export type CreateApprovalInput = z.infer<typeof CreateApprovalInput>;

export const DecideApprovalInput = z.object({
  decision: z.enum(["approve", "reject", "request_revision"]),
  payloadHash: z.string().length(64).optional(),
  comment: z.string().max(4000).optional(),
}).refine((v) => v.decision !== "approve" || !!v.payloadHash, {
  message: "承認には表示中の payload_hash が必要です", path: ["payloadHash"],
}).refine((v) => v.decision !== "request_revision" || !!v.comment, {
  message: "差し戻しにはコメントが必要です", path: ["comment"],
});
export type DecideApprovalInput = z.infer<typeof DecideApprovalInput>;

export const CreateReportInput = z.object({
  type: z.enum(REPORT_TYPES).default("daily_executive"),
  date: z.iso.date().optional(),
});
export type CreateReportInput = z.infer<typeof CreateReportInput>;

export const MockRunInput = z.object({
  task: z.string().min(1).max(500).optional(),
  projectSlug: slug.optional(),
});

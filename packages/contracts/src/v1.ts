/**
 * Public contract v1 between F.R.I.D.A.Y. and external clients such as the
 * Universal AI. This package is the ONLY code the two systems share.
 */
import { z } from "zod";
import { CreateDirectiveInput } from "@friday/core";

export const CONTRACT_VERSION = "v1";

export const SCOPES = [
  "read:status", "write:directives", "read:directives", "read:reports",
  "read:deliverables", "read:knowledge", "read:approvals", "read:events",
] as const;
export type Scope = (typeof SCOPES)[number];
// Note: there is intentionally no scope that can approve anything.

export const DirectiveRequest = CreateDirectiveInput;
export type DirectiveRequest = z.infer<typeof DirectiveRequest>;

export const DirectiveAccepted = z.object({
  directive_id: z.string(),
  status: z.string(),
  links: z.object({ self: z.string() }),
});
export type DirectiveAccepted = z.infer<typeof DirectiveAccepted>;

export const WEBHOOK_EVENT_TYPES = [
  "directive.accepted", "directive.clarification_needed", "directive.completed",
  "directive.failed", "report.approved", "deliverable.created",
] as const;

export const EventEnvelope = z.object({
  id: z.string(),
  type: z.string(),
  contract_version: z.literal(CONTRACT_VERSION),
  created_at: z.string(),
  data: z.record(z.string(), z.unknown()),
});
export type EventEnvelope = z.infer<typeof EventEnvelope>;

export const EventsPage = z.object({
  data: z.array(EventEnvelope),
  next_cursor: z.string().nullable(),
});
export type EventsPage = z.infer<typeof EventsPage>;

export const HealthResponse = z.object({
  status: z.enum(["ok", "degraded"]),
  web: z.literal("ok"),
  database: z.enum(["ok", "down"]),
  worker: z.enum(["ok", "unknown", "down"]),
  contract_version: z.literal(CONTRACT_VERSION),
  time: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

export const ApiErrorBody = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

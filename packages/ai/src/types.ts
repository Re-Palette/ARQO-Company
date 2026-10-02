import type { z } from "zod";
import type { DataSensitivity } from "@friday/core";

/** Tier is what callers ask for. "mock" pins the deterministic mock route. */
export type Tier = "fast" | "standard" | "deep" | "mock";

/**
 * Cost policy: every tier runs on the low-cost default model. The router moves
 * a request to the "escalation" route (a stronger model) only for one of these
 * reasons, and only if that reason is enabled in the route's params.
 */
export const ESCALATION_REASONS = [
  "long_document",          // long input, detected automatically by size
  "complex_reasoning",
  "cross_source_analysis",
  "ceo_deep_request",       // the CEO explicitly asked for deep processing
  "low_confidence",         // the default model's answer was not good enough
] as const;
export type EscalationReason = (typeof ESCALATION_REASONS)[number];

/** Route tier that holds the stronger model used for escalation. */
export const ESCALATION_TIER = "escalation";

/** Stored in model_routes.params.escalation of the escalation route. */
export interface EscalationPolicy {
  reasons: EscalationReason[];
  /** Inputs longer than this (characters) count as long_document. */
  longInputChars?: number;
}

export type ProviderKind = "gemini" | "claude" | "openai" | "openrouter" | "mock" | (string & {});

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateRequest {
  tier: Tier;
  purpose: string;
  system?: string;
  messages: ChatMessage[];
  agentId?: string;
  runId?: string;
  sensitivity?: DataSensitivity;
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** Call exactly this route (no fallback). Used by the settings "connection test". */
  pinRouteId?: string;
  /** Ask for the stronger model. Ignored unless the reason is enabled in the escalation route. */
  escalation?: EscalationReason;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface GenerateResult {
  text: string;
  usage: Usage;
  provider: ProviderKind;
  model: string;
  finishReason: string;
  latencyMs: number;
  /** Route IDs tried before the one that answered (fallback trail). */
  fallbackFrom: string[];
  /** Why the stronger model was used, or null when the default model served the request. */
  escalation: EscalationReason | null;
}

export interface ObjectResult<T> extends Omit<GenerateResult, "text"> {
  object: T;
}

export interface Capabilities {
  jsonSchema: boolean;
  tools: boolean;
  vision: boolean;
}

/** What an adapter receives after routing. Secrets are resolved by the router. */
export interface AdapterCall {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  system?: string;
  messages: ChatMessage[];
  maxOutputTokens: number;
  temperature?: number;
  timeoutMs: number;
  params: Record<string, unknown>;
}

export interface AdapterObjectCall<T> extends AdapterCall {
  schema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
  schemaName: string;
}

export interface AdapterResult {
  text: string;
  usage: Usage;
  finishReason: string;
}

export interface ProviderAdapter {
  readonly kind: ProviderKind;
  capabilities(): Capabilities;
  generateText(call: AdapterCall): Promise<AdapterResult>;
  /** Returns raw JSON text matching the schema; the client validates it. */
  generateJson<T>(call: AdapterObjectCall<T>): Promise<AdapterResult>;
}

/** Provider and route configuration as stored in provider_configs / model_routes. */
export interface ProviderConfig {
  id: string;
  provider: ProviderKind;
  enabled: boolean;
  baseUrl?: string | null;
  apiKeyEnv?: string | null;
  rateLimits: { rpm?: number; rpd?: number };
  /** "may_train" (e.g. free tiers) | "no_train" | "local" | "depends_on_model" */
  dataPolicy: string;
}

export interface ModelRoute {
  id: string;
  tier: string;
  providerConfigId: string;
  modelId: string;
  params: Record<string, unknown>;
  fallbackRouteId?: string | null;
  active: boolean;
}

export interface RouteStore {
  load(): Promise<{ providers: ProviderConfig[]; routes: ModelRoute[] }>;
}

export interface UsageRecord {
  runId?: string;
  agentId?: string;
  purpose: string;
  provider: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: "ok" | "error";
  error?: string;
}

export interface UsageRecorder {
  record(u: UsageRecord): Promise<void>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly retryable: boolean,
    readonly status?: number,
    /** The model answered, but not in the requested structure. */
    readonly schemaFailure = false,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** No route can serve the request without breaking a rule (e.g. sensitivity). */
export class RoutingError extends Error {
  readonly code = "NO_ELIGIBLE_ROUTE";
  constructor(message: string, readonly reasons: string[], readonly schemaFailure = false) {
    super(message);
    this.name = "RoutingError";
  }
}

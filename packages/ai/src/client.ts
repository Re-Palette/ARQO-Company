import { z } from "zod";
import type { DataSensitivity } from "@friday/core";
import { getAdapter } from "./registry";
import { RateLimiter } from "./rate-limit";
import type {
  AdapterCall, EscalationPolicy, EscalationReason, GenerateRequest, GenerateResult, ModelRoute, ObjectResult,
  ProviderConfig, RouteStore, UsageRecorder,
} from "./types";
import { ESCALATION_REASONS, ESCALATION_TIER, ProviderError, RoutingError } from "./types";

export interface AIClientOptions {
  routes: RouteStore;
  usage?: UsageRecorder;
  env?: Record<string, string | undefined>;
  rateLimiter?: RateLimiter;
  defaultMaxOutputTokens?: number;
  defaultTimeoutMs?: number;
}

interface ResolvedRoute {
  route: ModelRoute;
  provider: ProviderConfig;
}

type RouteData = Awaited<ReturnType<RouteStore["load"]>>;

const DEFAULT_LONG_INPUT_CHARS = 40_000;

/** Escalation policy of the active escalation route, or null when escalation is off. */
export function escalationPolicy(routes: ModelRoute[]): EscalationPolicy | null {
  const route = routes.find((r) => r.tier === ESCALATION_TIER && r.active);
  if (!route) return null;
  const raw = (route.params?.escalation ?? {}) as { reasons?: string[]; long_input_chars?: number };
  return {
    reasons: (raw.reasons ?? [...ESCALATION_REASONS]).filter((r): r is EscalationReason =>
      (ESCALATION_REASONS as readonly string[]).includes(r)),
    longInputChars: raw.long_input_chars ?? DEFAULT_LONG_INPUT_CHARS,
  };
}

/** Router-only keys that must never reach a provider request body. */
function providerParams(params: Record<string, unknown> | undefined): Record<string, unknown> {
  const { escalation: _policy, ...rest } = params ?? {};
  return rest;
}

/** Which provider data policies may receive data of a given sensitivity. */
export function sensitivityAllows(sensitivity: DataSensitivity, dataPolicy: string): boolean {
  if (sensitivity === "normal") return true;
  return dataPolicy === "no_train" || dataPolicy === "local";
}

/**
 * Provider-agnostic AI client. Callers ask for a tier; the router picks the
 * active route, walks the fallback chain on retryable failures, enforces data
 * sensitivity and rate limits, and records usage.
 */
export class AIClient {
  private readonly env: Record<string, string | undefined>;
  private readonly limiter: RateLimiter;

  constructor(private readonly opts: AIClientOptions) {
    this.env = opts.env ?? process.env;
    this.limiter = opts.rateLimiter ?? new RateLimiter();
  }

  async generateText(req: GenerateRequest): Promise<GenerateResult> {
    return this.run(req, async (adapter, call) => adapter.generateText(call), (r) => r);
  }

  /**
   * Structured output. On the default model, a response that does not match
   * the schema — or that `escalateIf` judges not good enough — is retried once
   * on the escalation route as "low_confidence" (if that reason is enabled).
   */
  async generateObject<T>(
    req: GenerateRequest & { schema: z.ZodType<T>; schemaName?: string; escalateIf?: (object: T) => boolean },
  ): Promise<ObjectResult<T>> {
    const retryEscalated = () => this.generateObjectOnce({ ...req, escalation: "low_confidence" });
    const canEscalate = async () => !req.escalation && !req.pinRouteId &&
      (await this.decideEscalation({ ...req, escalation: "low_confidence" })) !== null;
    let result: ObjectResult<T>;
    try {
      result = await this.generateObjectOnce(req);
    } catch (e) {
      if (e instanceof RoutingError && e.schemaFailure && (await canEscalate())) return retryEscalated();
      throw e;
    }
    if (result.escalation === null && req.escalateIf?.(result.object) && (await canEscalate())) return retryEscalated();
    return result;
  }

  private async generateObjectOnce<T>(req: GenerateRequest & { schema: z.ZodType<T>; schemaName?: string }): Promise<ObjectResult<T>> {
    const jsonSchema = z.toJSONSchema(req.schema, { target: "draft-2020-12" }) as Record<string, unknown>;
    return this.run(
      req,
      (adapter, call) => adapter.generateJson({ ...call, schema: req.schema, jsonSchema, schemaName: req.schemaName ?? "result" }),
      (r) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(r.text);
        } catch {
          throw new ProviderError(`${r.provider}: response was not valid JSON`, r.provider, true, undefined, true);
        }
        const result = req.schema.safeParse(parsed);
        if (!result.success) throw new ProviderError(`${r.provider}: response did not match schema`, r.provider, true, undefined, true);
        const { text: _text, ...rest } = r;
        return { ...rest, object: result.data };
      },
    );
  }

  /** Resolve the route chain for a tier without calling anything (used by settings and tests). */
  async plan(
    tier: string,
    sensitivity: DataSensitivity = "normal",
    pinRouteId?: string,
    data?: RouteData,
  ): Promise<{ chain: ResolvedRoute[]; skipped: string[] }> {
    const { providers, routes } = data ?? (await this.opts.routes.load());
    const byId = new Map(routes.map((r) => [r.id, r]));
    const providerById = new Map(providers.map((p) => [p.id, p]));
    const start = pinRouteId ? byId.get(pinRouteId) : routes.find((r) => r.tier === tier && r.active);
    const chain: ResolvedRoute[] = [];
    const skipped: string[] = [];
    const seen = new Set<string>();
    let cur = start;
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      const provider = providerById.get(cur.providerConfigId);
      if (!provider) skipped.push(`${cur.id}: provider missing`);
      else if (!provider.enabled) skipped.push(`${cur.id}: provider ${provider.id} disabled`);
      else if (!getAdapter(provider.provider)) skipped.push(`${cur.id}: no adapter for ${provider.provider}`);
      else if (!sensitivityAllows(sensitivity, provider.dataPolicy)) {
        skipped.push(`${cur.id}: ${provider.id} (${provider.dataPolicy}) cannot receive ${sensitivity} data`);
      } else if (provider.apiKeyEnv && !this.env[provider.apiKeyEnv]) {
        skipped.push(`${cur.id}: ${provider.apiKeyEnv} is not set`);
      } else chain.push({ route: cur, provider });
      cur = !pinRouteId && cur.fallbackRouteId ? byId.get(cur.fallbackRouteId) : undefined;
    }
    if (!start) skipped.push(pinRouteId ? `route "${pinRouteId}" not found` : `no active route for tier "${tier}"`);
    return { chain, skipped };
  }

  /**
   * Decide whether this request goes to the escalation route. Only an enabled
   * reason escalates: an explicit one from the caller, or "long_document"
   * detected from the input size. Everything else stays on the default model.
   */
  async decideEscalation(req: GenerateRequest, data?: RouteData): Promise<EscalationReason | null> {
    if (req.pinRouteId || req.tier === "mock") return null;
    const policy = escalationPolicy((data ?? (await this.opts.routes.load())).routes);
    if (!policy) return null;
    const inputChars = (req.system?.length ?? 0) + req.messages.reduce((n, m) => n + m.content.length, 0);
    const reason = req.escalation
      ?? (policy.longInputChars !== undefined && inputChars > policy.longInputChars ? "long_document" : null);
    return reason && policy.reasons.includes(reason) ? reason : null;
  }

  private async run<R>(
    req: GenerateRequest,
    invoke: (adapter: NonNullable<ReturnType<typeof getAdapter>>, call: AdapterCall) => Promise<{ text: string; usage: GenerateResult["usage"]; finishReason: string }>,
    finish: (r: GenerateResult) => R,
  ): Promise<R> {
    const data = await this.opts.routes.load();
    const escalation = await this.decideEscalation(req, data);
    // Escalated requests start on the stronger model; its fallback leads back to the default model.
    const tier = escalation ? ESCALATION_TIER : req.tier;
    const { chain, skipped } = await this.plan(tier, req.sensitivity ?? "normal", req.pinRouteId, data);
    if (chain.length === 0) {
      throw new RoutingError(`No eligible AI route for tier "${tier}"`, skipped);
    }
    const purpose = escalation ? `${req.purpose}#escalated:${escalation}` : req.purpose;
    const tried: string[] = [];
    const errors: string[] = [...skipped];
    let schemaFailure = false;
    for (const { route, provider } of chain) {
      const adapter = getAdapter(provider.provider)!;
      const limit = this.limiter.tryAcquire(`${provider.id}:${route.modelId}`, provider.rateLimits ?? {});
      if (!limit.ok) {
        errors.push(limit.reason);
        tried.push(route.id);
        continue;
      }
      const call: AdapterCall = {
        model: route.modelId,
        apiKey: provider.apiKeyEnv ? this.env[provider.apiKeyEnv] : undefined,
        baseUrl: provider.baseUrl ?? undefined,
        system: req.system,
        messages: req.messages,
        maxOutputTokens: req.maxOutputTokens ?? this.opts.defaultMaxOutputTokens ?? 4096,
        temperature: req.temperature,
        timeoutMs: req.timeoutMs ?? this.opts.defaultTimeoutMs ?? 60_000,
        params: providerParams(route.params),
      };
      const started = Date.now();
      try {
        const raw = await invoke(adapter, call);
        const result: GenerateResult = {
          ...raw,
          provider: provider.provider,
          model: route.modelId,
          latencyMs: Date.now() - started,
          fallbackFrom: tried,
          escalation: route.tier === ESCALATION_TIER ? escalation : null,
        };
        const out = finish(result);
        await this.opts.usage?.record({
          runId: req.runId, agentId: req.agentId, purpose, provider: provider.provider,
          modelId: route.modelId, inputTokens: raw.usage.inputTokens, outputTokens: raw.usage.outputTokens,
          latencyMs: result.latencyMs, status: "ok",
        });
        return out;
      } catch (e) {
        const err = e instanceof ProviderError ? e : new ProviderError((e as Error).message, provider.provider, false);
        await this.opts.usage?.record({
          runId: req.runId, agentId: req.agentId, purpose, provider: provider.provider,
          modelId: route.modelId, inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - started,
          status: "error", error: err.message.slice(0, 500),
        });
        errors.push(err.message);
        tried.push(route.id);
        schemaFailure ||= err.schemaFailure;
        if (!err.retryable) throw err;
      }
    }
    throw new RoutingError(`All AI routes failed for tier "${tier}"`, errors, schemaFailure);
  }
}

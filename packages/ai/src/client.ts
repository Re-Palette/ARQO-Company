import { z } from "zod";
import type { DataSensitivity } from "@friday/core";
import { getAdapter } from "./registry";
import { RateLimiter } from "./rate-limit";
import type {
  AdapterCall, GenerateRequest, GenerateResult, ModelRoute, ObjectResult, ProviderConfig, RouteStore, UsageRecorder,
} from "./types";
import { ProviderError, RoutingError } from "./types";

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

  async generateObject<T>(req: GenerateRequest & { schema: z.ZodType<T>; schemaName?: string }): Promise<ObjectResult<T>> {
    const jsonSchema = z.toJSONSchema(req.schema, { target: "draft-2020-12" }) as Record<string, unknown>;
    return this.run(
      req,
      (adapter, call) => adapter.generateJson({ ...call, schema: req.schema, jsonSchema, schemaName: req.schemaName ?? "result" }),
      (r) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(r.text);
        } catch {
          throw new ProviderError(`${r.provider}: response was not valid JSON`, r.provider, true);
        }
        const result = req.schema.safeParse(parsed);
        if (!result.success) throw new ProviderError(`${r.provider}: response did not match schema`, r.provider, true);
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
  ): Promise<{ chain: ResolvedRoute[]; skipped: string[] }> {
    const { providers, routes } = await this.opts.routes.load();
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

  private async run<R>(
    req: GenerateRequest,
    invoke: (adapter: NonNullable<ReturnType<typeof getAdapter>>, call: AdapterCall) => Promise<{ text: string; usage: GenerateResult["usage"]; finishReason: string }>,
    finish: (r: GenerateResult) => R,
  ): Promise<R> {
    const { chain, skipped } = await this.plan(req.tier, req.sensitivity ?? "normal", req.pinRouteId);
    if (chain.length === 0) {
      throw new RoutingError(`No eligible AI route for tier "${req.tier}"`, skipped);
    }
    const tried: string[] = [];
    const errors: string[] = [...skipped];
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
        params: route.params ?? {},
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
        };
        const out = finish(result);
        await this.opts.usage?.record({
          runId: req.runId, agentId: req.agentId, purpose: req.purpose, provider: provider.provider,
          modelId: route.modelId, inputTokens: raw.usage.inputTokens, outputTokens: raw.usage.outputTokens,
          latencyMs: result.latencyMs, status: "ok",
        });
        return out;
      } catch (e) {
        const err = e instanceof ProviderError ? e : new ProviderError((e as Error).message, provider.provider, false);
        await this.opts.usage?.record({
          runId: req.runId, agentId: req.agentId, purpose: req.purpose, provider: provider.provider,
          modelId: route.modelId, inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - started,
          status: "error", error: err.message.slice(0, 500),
        });
        errors.push(err.message);
        tried.push(route.id);
        if (!err.retryable) throw err;
      }
    }
    throw new RoutingError(`All AI routes failed for tier "${req.tier}"`, errors);
  }
}

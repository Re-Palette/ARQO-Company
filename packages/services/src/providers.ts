import { schema } from "@friday/db";
import { desc, eq } from "drizzle-orm";
import type { ServiceContext } from "./context";
import { ServiceError } from "./errors";
import { registeredProviders } from "@friday/ai";

/** Settings view of the Provider Layer (keys are reported as set/unset only). */
export async function providerOverview(ctx: ServiceContext) {
  const [providers, routes, usage] = await Promise.all([
    ctx.db.select().from(schema.providerConfigs).orderBy(desc(schema.providerConfigs.priority)),
    ctx.db.select().from(schema.modelRoutes),
    ctx.db.select().from(schema.llmUsage).orderBy(desc(schema.llmUsage.createdAt)).limit(20),
  ]);
  const plans = Object.fromEntries(await Promise.all(["fast", "standard", "deep", "escalation"].map(async (t) => [t, await ctx.ai.plan(t)])));
  return {
    adapters: registeredProviders(),
    providers: providers.map((p) => ({ ...p, apiKeySet: p.apiKeyEnv ? Boolean(ctx.env[p.apiKeyEnv]) : null })),
    routes,
    resolution: Object.fromEntries(Object.entries(plans).map(([t, p]) => [t, {
      chain: (p as Awaited<ReturnType<typeof ctx.ai.plan>>).chain.map((c) => `${c.provider.id}/${c.route.modelId}`),
      skipped: (p as Awaited<ReturnType<typeof ctx.ai.plan>>).skipped,
    }])),
    recentUsage: usage,
  };
}

/** "Connection test": call one provider's route directly, no fallback. */
export async function testProvider(ctx: ServiceContext, providerId: string) {
  const route = (await ctx.db.select().from(schema.modelRoutes).where(eq(schema.modelRoutes.providerConfigId, providerId)))
    .sort((a, b) => Number(b.active) - Number(a.active))[0];
  if (!route) throw new ServiceError("NOT_FOUND", `no route for provider "${providerId}"`);
  const res = await ctx.ai.generateText({
    tier: route.tier as "fast", pinRouteId: route.id, purpose: "connection_test", maxOutputTokens: 64,
    messages: [{ role: "user", content: "「F.R.I.D.A.Y. 接続テスト成功」とだけ返してください。" }],
  });
  return { provider: res.provider, model: res.model, text: res.text, latencyMs: res.latencyMs, usage: res.usage };
}

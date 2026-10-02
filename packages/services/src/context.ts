import { AIClient, type ModelRoute, type ProviderConfig } from "@friday/ai";
import { newId } from "@friday/core";
import { getDb, schema, type Db } from "@friday/db";
import { sql } from "drizzle-orm";
import { vaultPath } from "./env";
import { VaultService } from "./vault-service";

export interface ServiceContext {
  db: Db;
  vault: VaultService;
  ai: AIClient;
  env: Record<string, string | undefined>;
}

export function createAIClient(db: Db, env: Record<string, string | undefined>): AIClient {
  return new AIClient({
    env,
    routes: {
      load: async () => {
        const [providers, routes] = await Promise.all([db.select().from(schema.providerConfigs), db.select().from(schema.modelRoutes)]);
        return {
          providers: providers.map((p): ProviderConfig => ({
            id: p.id, provider: p.provider, enabled: p.enabled, baseUrl: p.baseUrl, apiKeyEnv: p.apiKeyEnv,
            rateLimits: p.rateLimits as ProviderConfig["rateLimits"], dataPolicy: p.dataPolicy,
          })),
          routes: routes.map((r): ModelRoute => ({
            id: r.id, tier: r.tier, providerConfigId: r.providerConfigId, modelId: r.modelId,
            params: r.params as Record<string, unknown>, fallbackRouteId: r.fallbackRouteId, active: r.active,
          })),
        };
      },
    },
    usage: {
      record: async (u) => {
        await db.insert(schema.llmUsage).values({ id: newId(), ...u });
      },
    },
  });
}

/** Advisory lock key for vault writes (one writer across web + worker). */
const VAULT_LOCK_KEY = 7_204_225_001;

export function vaultLock(db: Db) {
  return <T>(fn: () => Promise<T>) => db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${VAULT_LOCK_KEY})`);
    return fn();
  });
}

const globalForCtx = globalThis as unknown as { __fridayCtx?: ServiceContext };

/** Process-wide context built from environment variables. */
export function getContext(env: Record<string, string | undefined> = process.env): ServiceContext {
  if (globalForCtx.__fridayCtx) return globalForCtx.__fridayCtx;
  const db = getDb(env.DATABASE_URL);
  const ctx: ServiceContext = {
    db,
    env,
    vault: new VaultService(vaultPath(env), env.VAULT_GIT_REMOTE || undefined, vaultLock(db)),
    ai: createAIClient(db, env),
  };
  globalForCtx.__fridayCtx = ctx;
  return ctx;
}

/** For tests: build a context explicitly. */
export function buildContext(db: Db, vaultRoot: string, env: Record<string, string | undefined> = {}, remote?: string): ServiceContext {
  return { db, env, vault: new VaultService(vaultRoot, remote, vaultLock(db)), ai: createAIClient(db, env) };
}

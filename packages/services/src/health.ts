import { CONTRACT_VERSION, type HealthResponse } from "@friday/contracts";
import { schema } from "@friday/db";
import { sql } from "drizzle-orm";
import type { ServiceContext } from "./context";

export async function health(ctx: ServiceContext): Promise<HealthResponse> {
  let database: "ok" | "down" = "ok";
  let worker: "ok" | "unknown" | "down" = "unknown";
  try {
    await ctx.db.execute(sql`select 1`);
    const s = (await ctx.db.select({ hb: schema.companySettings.workerHeartbeatAt }).from(schema.companySettings))[0];
    if (s?.hb) worker = Date.now() - s.hb.getTime() < 3 * 60_000 ? "ok" : "down";
  } catch {
    database = "down";
  }
  return {
    status: database === "ok" && worker !== "down" ? "ok" : "degraded",
    web: "ok", database, worker, contract_version: CONTRACT_VERSION, time: new Date().toISOString(),
  };
}

export async function workerHeartbeat(ctx: ServiceContext) {
  await ctx.db.update(schema.companySettings).set({ workerHeartbeatAt: new Date() });
}

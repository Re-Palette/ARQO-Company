import { CreateAgentInput, newId, type PresenceState } from "@friday/core";
import { schema, type DbOrTx } from "@friday/db";
import { asc, eq } from "drizzle-orm";
import { agentActor, CEO, type Actor } from "./actors";
import type { ServiceContext } from "./context";
import { ServiceError } from "./errors";
import { emitEvent } from "./events";
import { writeAgentProfile } from "./memory-notes";

/** Agent Registry: AI employees are data. Hiring one needs no code change. */
export async function registerAgent(ctx: ServiceContext, raw: unknown, actor: Actor = CEO) {
  const parsed = CreateAgentInput.safeParse(raw);
  if (!parsed.success) throw new ServiceError("VALIDATION_ERROR", "invalid agent", parsed.error.issues);
  const input = parsed.data;
  const db = ctx.db;
  const division = (await db.select().from(schema.divisions).where(eq(schema.divisions.id, input.divisionId)))[0];
  if (!division) throw new ServiceError("VALIDATION_ERROR", `unknown division "${input.divisionId}"`);
  if ((await db.select({ id: schema.agents.id }).from(schema.agents).where(eq(schema.agents.id, input.id))).length) {
    throw new ServiceError("CONFLICT", `agent "${input.id}" already exists`);
  }
  // Approval-required actions are never granted as tools; only request_* exist.
  const forbidden = input.tools.filter((t) => !t.startsWith("request_") && /send|post|publish|deploy|pay|contract|submit/.test(t));
  if (forbidden.length) throw new ServiceError("POLICY_VIOLATION", `AI社員に直接実行ツールは付与できません: ${forbidden.join(", ")}`);

  const agent = await db.transaction(async (tx) => {
    const [a] = await tx.insert(schema.agents).values({
      id: input.id, displayName: input.displayName, title: input.title, divisionId: division.id, level: input.level,
      reportsTo: input.reportsTo ?? null, persona: input.persona, responsibilities: input.responsibilities,
      deliverableTypes: input.deliverableTypes, tools: input.tools, modelTier: input.modelTier, metricSet: input.metricSet,
      runtime: input.runtime, enabled: input.enabled, vaultPath: `04_AI Employees/${input.id}`,
    }).returning();
    await tx.insert(schema.agentPresence).values({ agentId: a!.id, state: "idle" });
    await tx.insert(schema.agentWorkingContext).values({ agentId: a!.id });
    await emitEvent(tx, {
      type: "agent.registered", actor, subjectType: "agent", subjectId: a!.id, divisionId: division.id, importance: 4,
      data: { displayName: a!.displayName, title: a!.title, runtime: a!.runtime },
    });
    return a!;
  });
  await ctx.vault.exclusive(async () => {
    await writeAgentProfile(ctx, agent, division.nameJa);
    await ctx.vault.commit(ctx.db, `friday: agent.registered ${agent.id}`);
  });
  return agent;
}

export async function listAgents(db: DbOrTx) {
  const rows = await db.select({ a: schema.agents, p: schema.agentPresence, d: schema.divisions })
    .from(schema.agents)
    .innerJoin(schema.divisions, eq(schema.divisions.id, schema.agents.divisionId))
    .leftJoin(schema.agentPresence, eq(schema.agentPresence.agentId, schema.agents.id))
    .orderBy(asc(schema.divisions.sortOrder), asc(schema.agents.createdAt));
  return rows.map(({ a, p, d }) => ({
    id: a.id, displayName: a.displayName, title: a.title, level: a.level, runtime: a.runtime, enabled: a.enabled,
    modelTier: a.modelTier, metricSet: a.metricSet, responsibilities: a.responsibilities, deliverableTypes: a.deliverableTypes,
    division: { id: d.id, name: d.nameJa, color: d.color, kind: d.kind },
    presence: { state: p?.state ?? "offline", label: p?.activityLabel ?? null, progress: p?.progress ?? null, at: p?.lastHeartbeatAt?.toISOString() ?? null },
  }));
}

export async function getAgent(db: DbOrTx, id: string) {
  const a = (await db.select().from(schema.agents).where(eq(schema.agents.id, id)))[0];
  if (!a) throw new ServiceError("NOT_FOUND", `agent "${id}" not found`);
  return a;
}

export async function setPresence(db: DbOrTx, agentId: string, state: PresenceState, label: string | null, extra: { taskId?: string | null; progress?: number | null } = {}) {
  await db.insert(schema.agentPresence).values({
    agentId, state, activityLabel: label, currentTaskId: extra.taskId ?? null, progress: extra.progress ?? null, lastHeartbeatAt: new Date(),
  }).onConflictDoUpdate({
    target: schema.agentPresence.agentId,
    set: { state, activityLabel: label, currentTaskId: extra.taskId ?? null, progress: extra.progress ?? null, lastHeartbeatAt: new Date() },
  });
  await emitEvent(db, {
    type: "agent.state_changed", actor: agentActor(agentId), subjectType: "agent", subjectId: agentId,
    importance: 1, visibility: "internal", data: { state, label },
  });
}

export async function listDivisions(db: DbOrTx) {
  return db.select().from(schema.divisions).orderBy(asc(schema.divisions.sortOrder));
}

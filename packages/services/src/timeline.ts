import { companyTime, renderTemplate } from "@friday/core";
import { schema, type DbOrTx } from "@friday/db";
import { and, desc, gte, inArray, lt, eq } from "drizzle-orm";

export interface TimelineItem {
  id: string;
  at: string;
  time: string;
  type: string;
  icon: string;
  actor: { type: string; id: string; name: string };
  text: string;
  importance: number;
  projectId: string | null;
  subject: { type: string | null; id: string | null };
}

async function actorNames(db: DbOrTx, events: (typeof schema.activityEvents.$inferSelect)[]) {
  const agentIds = [...new Set(events.filter((e) => e.actorType === "agent").map((e) => e.actorId))];
  const clientIds = [...new Set(events.filter((e) => e.actorType === "client").map((e) => e.actorId))];
  const names = new Map<string, string>();
  if (agentIds.length) {
    for (const a of await db.select({ id: schema.agents.id, n: schema.agents.displayName }).from(schema.agents).where(inArray(schema.agents.id, agentIds))) {
      names.set(`agent:${a.id}`, a.n);
    }
  }
  if (clientIds.length) {
    for (const c of await db.select({ id: schema.apiClients.id, n: schema.apiClients.name }).from(schema.apiClients).where(inArray(schema.apiClients.id, clientIds))) {
      names.set(`client:${c.id}`, c.n);
    }
  }
  return (type: string, id: string) =>
    type === "ceo" ? "CEO" : type === "system" ? "System" : names.get(`${type}:${id}`) ?? id;
}

/**
 * Company Timeline: human-readable, importance-filtered, rendered from data
 * templates (timeline_templates). Raw events are available via listActivity.
 */
export async function listTimeline(db: DbOrTx, opts: { limit?: number; minImportance?: number; before?: string; since?: Date; projectId?: string } = {}): Promise<TimelineItem[]> {
  const events = await db.select().from(schema.activityEvents).where(and(
    eq(schema.activityEvents.visibility, "timeline"),
    gte(schema.activityEvents.importance, opts.minImportance ?? 2),
    opts.before ? lt(schema.activityEvents.id, opts.before) : undefined,
    opts.since ? gte(schema.activityEvents.createdAt, opts.since) : undefined,
    opts.projectId ? eq(schema.activityEvents.projectId, opts.projectId) : undefined,
  )).orderBy(desc(schema.activityEvents.id)).limit(opts.limit ?? 30);
  const templates = new Map((await db.select().from(schema.timelineTemplates)).map((t) => [t.eventType, t]));
  const name = await actorNames(db, events);
  return events.map((e) => {
    const t = templates.get(e.type);
    const actor = name(e.actorType, e.actorId);
    return {
      id: e.id, at: e.createdAt.toISOString(), time: companyTime(e.createdAt), type: e.type,
      icon: t?.icon ?? "•",
      actor: { type: e.actorType, id: e.actorId, name: actor },
      text: t ? renderTemplate(t.templateJa, { actor, data: e.data }) : `${actor}: ${e.type}`,
      importance: e.importance, projectId: e.projectId,
      subject: { type: e.subjectType, id: e.subjectId },
    };
  });
}

/** Raw activity feed (includes internal/system events). */
export async function listActivity(db: DbOrTx, opts: { limit?: number; before?: string } = {}) {
  const events = await db.select().from(schema.activityEvents)
    .where(opts.before ? lt(schema.activityEvents.id, opts.before) : undefined)
    .orderBy(desc(schema.activityEvents.id)).limit(opts.limit ?? 50);
  const name = await actorNames(db, events);
  return events.map((e) => ({
    id: e.id, at: e.createdAt.toISOString(), time: companyTime(e.createdAt), type: e.type,
    actor: name(e.actorType, e.actorId), actorType: e.actorType, visibility: e.visibility,
    subjectType: e.subjectType, subjectId: e.subjectId, data: e.data,
  }));
}

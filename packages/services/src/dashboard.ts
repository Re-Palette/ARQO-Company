import { schema } from "@friday/db";
import { and, count, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { companyDate } from "@friday/core";
import { listAgents } from "./agents";
import { actionQueue } from "./approvals";
import type { ServiceContext } from "./context";
import { listProjects } from "./projects";
import { companyDayWindow, listReports } from "./reports";
import { listActivity, listTimeline } from "./timeline";

/** Everything Home needs in one round trip (docs/design/16-api.md GET /dashboard). */
export async function getDashboard(ctx: ServiceContext) {
  const db = ctx.db;
  const { start, end } = companyDayWindow(companyDate());
  const [queue, agents, projects, timeline, activity, reports] = await Promise.all([
    actionQueue(db), listAgents(db), listProjects(db), listTimeline(db, { limit: 30 }), listActivity(db, { limit: 30 }), listReports(db),
  ]);
  const [tasksToday] = await db.select({
    total: count(),
    done: sql<number>`count(*) filter (where ${schema.tasks.status} = 'done')::int`,
    inProgress: sql<number>`count(*) filter (where ${schema.tasks.status} = 'in_progress')::int`,
    waiting: sql<number>`count(*) filter (where ${schema.tasks.status} = 'waiting_approval')::int`,
  }).from(schema.tasks).where(and(gte(schema.tasks.createdAt, start), lt(schema.tasks.createdAt, end)));
  const [unread] = await db.select({ n: count() }).from(schema.notifications).where(and(isNull(schema.notifications.readAt), isNull(schema.notifications.archivedAt)));
  const headlineKpis = await db.select({ k: schema.kpiDefinitions, project: schema.projects.slug }).from(schema.kpiDefinitions)
    .leftJoin(schema.projects, eq(schema.projects.id, schema.kpiDefinitions.projectId)).where(eq(schema.kpiDefinitions.isHeadline, true));
  const values = headlineKpis.length
    ? await db.select().from(schema.kpiValues).where(inArray(schema.kpiValues.kpiId, headlineKpis.map((h) => h.k.id)))
    : [];
  const latest = new Map<string, string>();
  for (const v of values.sort((a, b) => a.periodStart.localeCompare(b.periodStart))) latest.set(v.kpiId, v.value);
  const settings = (await db.select().from(schema.companySettings))[0];

  const active = projects.filter((p) => p.status === "active" || p.status === "planning");
  const pinned = projects.filter((p) => p.pinned);
  const progressBase = pinned.length ? pinned : active;
  return {
    company: { name: settings?.companyName ?? "", paused: settings?.paused ?? false },
    actionRequired: queue,
    kpis: {
      agents: { total: agents.length, active: agents.filter((a) => !["idle", "offline"].includes(a.presence.state)).length },
      tasksToday: tasksToday!,
      projects: { total: projects.length, active: active.length },
      approvals: queue.counts,
      companyProgress: progressBase.length ? Math.round(progressBase.reduce((s, p) => s + p.progress, 0) / progressBase.length) : 0,
      unreadNotifications: unread!.n,
      headline: headlineKpis.map(({ k, project }) => ({ key: k.key, name: k.name, unit: k.unit, project, value: latest.get(k.id) ?? null })),
    },
    agents,
    projects,
    timeline,
    activity,
    reports: reports.slice(0, 5),
  };
}

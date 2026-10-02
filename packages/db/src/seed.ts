import { newId } from "@friday/core";
import { sql } from "drizzle-orm";
import type { Db } from "./client";
import * as s from "./schema";
import * as system from "./seed/system";
import * as arqo from "./seed/companies/arqo";

const COMPANIES = { arqo } as const;
export type SeedProfile = keyof typeof COMPANIES | "system";

/**
 * Idempotent seed. `system` = what every install needs; a company profile adds
 * that company's divisions, agents, projects and KPIs on top.
 */
export async function seed(db: Db, profile: SeedProfile = "arqo"): Promise<void> {
  await db.transaction(async (tx) => {
    for (const t of system.projectTemplates) {
      await tx.insert(s.projectTemplates).values(t).onConflictDoNothing();
    }
    for (const t of system.timelineTemplates) {
      await tx.insert(s.timelineTemplates).values(t)
        .onConflictDoUpdate({ target: s.timelineTemplates.eventType, set: { templateJa: t.templateJa, icon: t.icon } });
    }
    for (const c of system.notificationChannels) await tx.insert(s.notificationChannels).values(c).onConflictDoNothing();
    for (const r of system.notificationRules) await tx.insert(s.notificationRules).values({ ...r, channelIds: [...r.channelIds] }).onConflictDoNothing();
    for (const p of system.providerConfigs) await tx.insert(s.providerConfigs).values(p).onConflictDoNothing();
    for (const r of [...system.modelRoutes, ...system.inactiveModelRoutes]) {
      await tx.insert(s.modelRoutes).values(r).onConflictDoNothing();
    }
    await tx.insert(s.companySettings).values(system.companySettings).onConflictDoNothing();

    if (profile === "system") return;
    const company = COMPANIES[profile];
    await tx.update(s.companySettings).set({ companyName: company.companyName });

    for (const d of company.divisions) {
      await tx.insert(s.divisions).values(d as typeof s.divisions.$inferInsert).onConflictDoNothing();
    }
    for (const a of company.agents) {
      await tx.insert(s.agents).values({
        ...(a as typeof s.agents.$inferInsert), runtime: "mock", vaultPath: `04_AI Employees/${a.id}`,
      }).onConflictDoNothing();
      await tx.insert(s.agentPresence).values({ agentId: a.id, state: "idle" }).onConflictDoNothing();
      await tx.insert(s.agentWorkingContext).values({ agentId: a.id }).onConflictDoNothing();
    }
    for (const d of company.divisions) {
      const lead = company.agents.find((a) => a.divisionId === d.id);
      if (lead) await tx.update(s.divisions).set({ leadAgentId: lead.id }).where(sql`${s.divisions.id} = ${d.id}`);
    }

    // Metric definitions reference divisions, so they come with the company.
    for (const m of system.metricDefinitions) {
      const divisionExists = !("divisionId" in m) || company.divisions.some((d) => d.id === m.divisionId);
      if (divisionExists) await tx.insert(s.metricDefinitions).values(m as typeof s.metricDefinitions.$inferInsert).onConflictDoNothing();
    }

    const ids = new Map<string, string>();
    const existing = await tx.select({ id: s.projects.id, slug: s.projects.slug }).from(s.projects);
    for (const p of existing) ids.set(p.slug, p.id);
    for (const p of company.projects) {
      if (ids.has(p.slug)) continue;
      const id = newId();
      ids.set(p.slug, id);
      const { parent, ...rest } = p as typeof p & { parent?: string };
      await tx.insert(s.projects).values({
        ...(rest as Omit<typeof s.projects.$inferInsert, "id">),
        id,
        parentProjectId: parent ? ids.get(parent) : null,
        vaultPath: `05_Projects/${p.slug}`,
      });
      await tx.insert(s.projectDivisions).values({ projectId: id, divisionId: p.ownerDivisionId, role: "owner" }).onConflictDoNothing();
    }

    for (const k of company.kpis) {
      const { project, ...rest } = k;
      await tx.insert(s.kpiDefinitions).values({ ...rest, id: newId(), projectId: ids.get(project) ?? null, divisionId: "repalette" })
        .onConflictDoNothing();
    }
  });
}

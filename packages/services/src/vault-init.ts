import { schema } from "@friday/db";
import { eq } from "drizzle-orm";
import type { ServiceContext } from "./context";
import { writeAgentProfile, writeDailyNote, writeMeetingNote, writeProjectNote } from "./memory-notes";
import { actionQueue } from "./approvals";
import { SYSTEM } from "./actors";
import { emitEvent } from "./events";
import { listTimeline } from "./timeline";
import { companyDate } from "@friday/core";

/**
 * Bring the vault up to date with the database: folder structure, agent
 * profiles, project notes, today's daily note, the weekly board note, and
 * the activity log for events not yet written. Then commit (and push).
 */
export async function syncVault(ctx: ServiceContext) {
  const db = ctx.db;
  const settings = (await db.select().from(schema.companySettings))[0];
  await ctx.vault.ensureInitialized(settings?.companyName ?? "Company");
  const result = await ctx.vault.exclusive(async () => {
    const divisions = new Map((await db.select().from(schema.divisions)).map((d) => [d.id, d.nameJa]));
    for (const agent of await db.select().from(schema.agents)) {
      await writeAgentProfile(ctx, agent, divisions.get(agent.divisionId) ?? agent.divisionId);
    }
    for (const project of await db.select().from(schema.projects)) await writeProjectNote(ctx, db, project);

    const queue = await actionQueue(db);
    const today = await listTimeline(db, { limit: 10, minImportance: 4 });
    await writeDailyNote(ctx, [
      `## 判断待ち（${queue.counts.total}件）`,
      ...queue.data.slice(0, 5).map((i) => `- [${i.riskLevel.toUpperCase()}] ${i.label}: ${i.title}`),
      "", "## 最近の出来事", ...today.map((t) => `- ${t.time} ${t.text}`),
    ]);
    await writeMeetingNote(ctx, "Weekly Board Meeting（準備）", ["各部署の週次報告", "判断待ちの確認", "翌週の重点"]);

    const pending = await db.select().from(schema.activityEvents)
      .where(eq(schema.activityEvents.visibility, "timeline")).orderBy(schema.activityEvents.id);
    const unsynced = pending.filter((e) => !(e.processed as { vault?: boolean }).vault);
    if (unsynced.length) {
      const rendered = new Map((await listTimeline(db, { limit: 500, minImportance: 1 })).map((t) => [t.id, t]));
      await ctx.vault.appendActivity(unsynced.map((e) => ({ at: e.createdAt, text: rendered.get(e.id)?.text ?? e.type })));
      for (const e of unsynced) {
        await db.update(schema.activityEvents).set({ processed: { ...(e.processed as object), vault: true } }).where(eq(schema.activityEvents.id, e.id));
      }
    }
    return ctx.vault.commit(db, `friday: vault.sync ${companyDate()}`);
  });
  if (result.committed) {
    await emitEvent(db, { type: "vault.synced", actor: SYSTEM, importance: 1, visibility: "internal",
      data: { files: result.filesChanged, commit: result.commitSha, pushed: result.pushed } });
  }
  return result;
}

export async function vaultStatus(ctx: ServiceContext) {
  const last = await ctx.db.select().from(schema.vaultSyncLog).orderBy(schema.vaultSyncLog.createdAt);
  const tail = last.at(-1) ?? null;
  return {
    root: ctx.vault.store.root,
    remoteConfigured: Boolean(ctx.env.VAULT_GIT_REMOTE),
    head: await ctx.vault.git.head().catch(() => null),
    lastSync: tail,
    folders: await ctx.vault.store.list("."),
  };
}

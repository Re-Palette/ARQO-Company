import { CreateReportInput, canTransitionReport, companyDate, newId, sha256, type ReportStatus } from "@friday/core";
import { schema, type DbOrTx } from "@friday/db";
import { renderNote, safeName, VAULT_DIRS, yearMonth } from "@friday/vault";
import { and, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
import { agentActor, SYSTEM } from "./actors";
import { createApproval } from "./approvals";
import type { ServiceContext } from "./context";
import { ServiceError } from "./errors";
import { emitEvent } from "./events";
import { notify } from "./notifications";

const REPORT_TITLES: Record<string, string> = {
  daily_executive: "Daily Executive Report",
  morning_briefing: "Morning Briefing",
  weekly_board: "Weekly Board Report",
};

/** Company-day window in UTC for a YYYY-MM-DD date in Asia/Tokyo. */
export function companyDayWindow(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00+09:00`);
  return { start, end: new Date(start.getTime() + 24 * 3600 * 1000) };
}

async function collectSnapshot(db: DbOrTx, start: Date, end: Date) {
  const inWindow = (col: AnyPgColumn) => and(gte(col, start), lt(col, end));
  const [tasksDone] = await db.select({ n: count() }).from(schema.tasks).where(and(eq(schema.tasks.status, "done"), inWindow(schema.tasks.completedAt)));
  const [tasksOpen] = await db.select({ n: count() }).from(schema.tasks).where(sql`${schema.tasks.status} in ('queued','in_progress','waiting_approval','review','blocked')`);
  const deliverables = await db.select({ title: schema.deliverables.title, kind: schema.deliverables.kind, agent: schema.agents.displayName })
    .from(schema.deliverables).innerJoin(schema.agents, eq(schema.agents.id, schema.deliverables.authorAgentId))
    .where(inWindow(schema.deliverables.createdAt)).orderBy(desc(schema.deliverables.createdAt)).limit(20);
  const [pending] = await db.select({ n: count() }).from(schema.approvalRequests).where(eq(schema.approvalRequests.status, "pending"));
  const projects = await db.select({ name: schema.projects.name, status: schema.projects.status, progress: schema.projects.progress, health: schema.projects.health })
    .from(schema.projects).where(eq(schema.projects.pinned, true)).orderBy(schema.projects.sortOrder);
  const agentActivity = await db.select({ agent: schema.agents.displayName, n: count() }).from(schema.activityEvents)
    .innerJoin(schema.agents, eq(schema.agents.id, schema.activityEvents.actorId))
    .where(and(eq(schema.activityEvents.actorType, "agent"), gte(schema.activityEvents.createdAt, start), lt(schema.activityEvents.createdAt, end)))
    .groupBy(schema.agents.displayName);
  const [events] = await db.select({ n: count() }).from(schema.activityEvents).where(and(gte(schema.activityEvents.createdAt, start), lt(schema.activityEvents.createdAt, end)));
  return {
    tasksCompleted: tasksDone!.n, tasksOpen: tasksOpen!.n, deliverables, pendingApprovals: pending!.n,
    projects, agentActivity, eventCount: events!.n,
  };
}

const Narrative = z.object({
  executiveSummary: z.array(z.string()).max(3),
  ceoProposals: z.array(z.object({ title: z.string(), reason: z.string() })).max(3),
});

function renderMarkdown(title: string, date: string, snap: Awaited<ReturnType<typeof collectSnapshot>>, narrative: z.infer<typeof Narrative>) {
  const lines = [
    `# ${title} — ${date}`, "",
    "## Executive Summary", ...narrative.executiveSummary.map((s) => `- ${s}`), "",
    "## 本日の成果",
    `- 完了タスク: ${snap.tasksCompleted} 件 / 進行中・待機: ${snap.tasksOpen} 件`,
    ...snap.deliverables.map((d) => `- ${d.agent}: ${d.title}（${d.kind}）`), "",
    "## プロジェクト進捗", "| プロジェクト | 状態 | 進捗 | 健康度 |", "|---|---|---|---|",
    ...snap.projects.map((p) => `| ${p.name} | ${p.status} | ${p.progress}% | ${p.health} |`), "",
    "## AI社員活動", ...snap.agentActivity.map((a) => `- ${a.agent}: ${a.n} 件の活動`), "",
    "## CEO提案", ...narrative.ceoProposals.map((p, i) => `${i + 1}. **${p.title}** — ${p.reason}`), "",
    "## 判断待ち", `- ${snap.pendingApprovals} 件`, "",
    `> 数値は data_snapshot から自動挿入。文章は AI（COO）が作成。`,
  ];
  return lines.join("\n");
}

/**
 * Generate a report. Numbers come only from the snapshot; the model writes
 * interpretation. Phase 0 produces Markdown; PDF rendering arrives in Phase 4.
 */
export async function createReport(ctx: ServiceContext, raw: unknown = {}) {
  const input = CreateReportInput.parse(raw ?? {});
  const db = ctx.db;
  const date = input.date ?? companyDate();
  const { start, end } = companyDayWindow(date);
  const author = (await db.select().from(schema.agents).where(eq(schema.agents.level, "executive")))[0];
  if (!author) throw new ServiceError("CONFLICT", "no executive (COO) agent registered");
  const title = REPORT_TITLES[input.type] ?? input.type;

  const [report] = await db.insert(schema.reports).values({
    id: newId(), type: input.type, title: `${title} ${date}`, periodStart: start, periodEnd: end, authorAgentId: author.id, status: "generating",
  }).returning();
  await emitEvent(db, {
    type: "report.generation_started", actor: agentActor(author.id), subjectType: "report", subjectId: report!.id,
    importance: 3, data: { title: report!.title },
  });

  try {
    const snap = await collectSnapshot(db, start, end);
    const narrative = await ctx.ai.generateObject({
      tier: author.runtime === "mock" ? "mock" : author.modelTier, purpose: "report_narrative", agentId: author.id,
      system: "あなたはAI会社のCOOです。与えられた数値だけを根拠に、CEO向けの要約と提案を日本語で書いてください。数値を新たに作らないこと。",
      messages: [{ role: "user", content: JSON.stringify(snap) }], schema: Narrative, schemaName: "report_narrative",
    }).then((r) => r.object).catch(() => ({ executiveSummary: [`完了タスク ${snap.tasksCompleted} 件、判断待ち ${snap.pendingApprovals} 件。`], ceoProposals: [] }));
    if (author.runtime === "mock") {
      narrative.executiveSummary = [
        `本日は ${snap.deliverables.length} 件の成果物が作成され、完了タスクは ${snap.tasksCompleted} 件でした。`,
        `CEO の判断待ちは ${snap.pendingApprovals} 件です。`,
      ];
      narrative.ceoProposals = snap.pendingApprovals > 0 ? [{ title: "判断待ちの解消", reason: "承認待ちがタスクを止めています。" }] : [];
    }
    const contentMd = renderMarkdown(title, date, snap, narrative);
    const { year, month } = yearMonth(date);
    const draftPath = `${VAULT_DIRS.draftReports}/${year}/${month}/${date}_${safeName(title)} v${report!.version}.md`;
    const [ready] = await db.update(schema.reports).set({
      dataSnapshot: snap, content: narrative, contentMd, status: "pending_review", vaultPath: draftPath, updatedAt: new Date(),
    }).where(eq(schema.reports.id, report!.id)).returning();

    await emitEvent(db, { type: "report.ready", actor: agentActor(author.id), subjectType: "report", subjectId: report!.id, importance: 4, data: { title: ready!.title } });
    await notify(ctx, db, { category: "report", title: `${ready!.title} が完成しました`, link: `/reports/${ready!.id}` });
    const approval = await createApproval(ctx, {
      kind: "report_review", title: ready!.title, summary: narrative.executiveSummary.join(" "), requestedByAgentId: author.id,
      subjectType: "report", subjectId: ready!.id, payload: { reportId: ready!.id, version: ready!.version, contentSha256: sha256(contentMd) },
    });
    await ctx.vault.exclusive(async () => {
      await ctx.vault.store.write(draftPath, renderNote({
        frontmatter: { id: ready!.id, type: "report", title: ready!.title, status: "pending_review", version: ready!.version, date, friday_managed: true, tags: ["friday/report", `report/${input.type}`] },
        body: contentMd,
      }));
      await ctx.vault.commit(ctx.db, `friday: report.ready ${ready!.id.slice(-6)}`);
    });
    return { report: ready!, approval };
  } catch (e) {
    await db.update(schema.reports).set({ status: "failed", updatedAt: new Date() }).where(eq(schema.reports.id, report!.id));
    throw e;
  }
}

async function transition(db: DbOrTx, id: string, to: ReportStatus) {
  const r = (await db.select().from(schema.reports).where(eq(schema.reports.id, id)))[0];
  if (!r) throw new ServiceError("NOT_FOUND", "report not found");
  if (!canTransitionReport(r.status, to)) throw new ServiceError("CONFLICT", `report ${r.status} → ${to} is not allowed`);
  const [u] = await db.update(schema.reports).set({ status: to, updatedAt: new Date(), ...(to === "approved" ? { approvedAt: new Date() } : {}) })
    .where(eq(schema.reports.id, id)).returning();
  return u!;
}

/**
 * After CEO approval: Approved Reports (immutable) → Obsidian → Git/GitHub.
 * The next Daily Backup carries it to long-term storage (R2).
 */
export async function archiveReport(ctx: ServiceContext, reportId: string) {
  const db = ctx.db;
  let report = await transition(db, reportId, "approved");
  report = await transition(db, reportId, "archiving");
  const date = companyDate(report.periodStart);
  const { year, month } = yearMonth(date);
  const baseName = `${date}_${safeName(report.title.replace(` ${date}`, ""))}`;
  const notePath = `${VAULT_DIRS.approvedReports}/${year}/${month}/${baseName}.md`;
  const contentSha = sha256(report.contentMd);

  const commit = await ctx.vault.exclusive(async () => {
    await ctx.vault.createOnce(notePath, renderNote({
      frontmatter: {
        id: report.id, type: "report", title: report.title, status: "approved", version: report.version,
        approved_at: report.approvedAt?.toISOString(), approved_by: "ceo", content_sha256: contentSha,
        friday_managed: true, tags: ["friday/report", "report/approved"],
      },
      body: `> ✅ Approved by CEO — ${report.approvedAt?.toISOString()}\n\n${report.contentMd}`,
    }));
    const indexPath = `${VAULT_DIRS.approvedReports}/${year}/${month}/_Index.md`;
    const index = (await ctx.vault.store.read(indexPath)) ?? `# Approved Reports ${year}-${month}\n`;
    await ctx.vault.store.write(indexPath, `${index.trimEnd()}\n- [[${baseName}]]\n`);
    return ctx.vault.commit(ctx.db, `friday: report.archived ${report.id.slice(-6)}`);
  });

  await db.transaction(async (tx) => {
    await tx.insert(schema.reportArchives).values({
      id: newId(), reportId: report.id, contentSha256: contentSha, vaultNotePath: notePath,
      vaultCommit: commit.commitSha, githubPushedAt: commit.pushed ? new Date() : null,
    });
    await tx.update(schema.reports).set({ status: "archived", updatedAt: new Date() }).where(eq(schema.reports.id, report.id));
    await emitEvent(tx, { type: "report.archived", actor: SYSTEM, subjectType: "report", subjectId: report.id, importance: 3, data: { title: report.title, path: notePath } });
    await emitEvent(tx, { type: "report.approved", actor: SYSTEM, subjectType: "report", subjectId: report.id, visibility: "internal",
      data: { report_id: report.id, title: report.title, content_sha256: contentSha } });
  });
  return { notePath, commit };
}

export async function onReportDecision(ctx: ServiceContext, reportId: string, decision: "approved" | "rejected" | "revision_requested") {
  if (decision === "approved") return archiveReport(ctx, reportId);
  await transition(ctx.db, reportId, decision);
  return null;
}

export async function listReports(db: DbOrTx, opts: { approvedOnly?: boolean } = {}) {
  return db.select({
    id: schema.reports.id, type: schema.reports.type, title: schema.reports.title, status: schema.reports.status,
    version: schema.reports.version, createdAt: schema.reports.createdAt, approvedAt: schema.reports.approvedAt,
    vaultPath: schema.reports.vaultPath,
  }).from(schema.reports)
    .where(opts.approvedOnly ? sql`${schema.reports.status} in ('approved','archiving','archived')` : undefined)
    .orderBy(desc(schema.reports.createdAt)).limit(50);
}

export async function getReport(db: DbOrTx, id: string) {
  const r = (await db.select().from(schema.reports).where(eq(schema.reports.id, id)))[0];
  if (!r) throw new ServiceError("NOT_FOUND", "report not found");
  const archive = (await db.select().from(schema.reportArchives).where(eq(schema.reportArchives.reportId, id)))[0] ?? null;
  return { ...r, archive };
}

import { MockRunInput, newId, type ApprovalKind, type PresenceState } from "@friday/core";
import { schema } from "@friday/db";
import { renderNote } from "@friday/vault";
import { eq, sql } from "drizzle-orm";
import { agentActor } from "./actors";
import { getAgent, setPresence } from "./agents";
import { createApproval } from "./approvals";
import type { ServiceContext } from "./context";
import { ServiceError } from "./errors";
import { emitEvent } from "./events";
import { appendAgentJournal, deliverablePath } from "./memory-notes";

interface Script {
  presence: PresenceState;
  label: string;
  kind: string;
  title: string;
  summary: string;
  body: string;
  memoryKind: "finding" | "plan" | "project_context" | "active_task";
  timelineEvent?: string;
  approval?: { kind: ApprovalKind; payload: Record<string, unknown>; riskLevel?: "low" | "medium" | "high" | "critical" };
  projectSlug?: string;
}

/** Scripted behaviour for Phase 0 mock agents (no real model needed). */
const SCRIPTS: Record<string, (n: number, task?: string) => Script> = {
  research_report: (n, task) => {
    const topics = [
      { title: "助成金情報を発見: 地域福祉活動支援助成（締切 11/15）", body: "- 対象: 美容福祉・居場所づくり\n- 上限: 100万円\n- Re-Palette 適合度: 高", slug: "repalette" },
      { title: "AIニュース: 主要モデルのアップデート 3件", body: "- 新しい Flash モデルの提供開始\n- エージェント向け API の機能追加\n- 価格改定", slug: "friday" },
      { title: "美容業界のAI活用事例 5件を調査", body: "- カウンセリング支援\n- 肌診断\n- 予約最適化\n- 在庫管理\n- SNS 運用", slug: "newtone" },
    ];
    const t = topics[n % topics.length]!;
    return {
      presence: "researching", label: task ?? t.title, kind: "research_report", title: task ?? t.title,
      summary: "調査結果の要点をまとめました。", body: `## 要点\n${t.body}\n\n## 出典\n- （Mock）`, memoryKind: "finding",
      timelineEvent: "research.finding", projectSlug: t.slug,
    };
  },
  sns_post_draft: (n, task) => {
    const caption = ["10月の Re-Palette 美容福祉イベントのお知らせ。地域の皆さまのご参加をお待ちしています。",
      "AI と一緒に働く会社づくり、はじめました。F.R.I.D.A.Y. の開発日記 #1"][n % 2]!;
    return {
      presence: "writing", label: task ?? "Instagram 投稿案の作成", kind: "sns_post_draft", title: task ?? "投稿案: 10月の告知",
      summary: "Instagram 投稿案（画像1枚・ハッシュタグ5個）", body: `## キャプション\n${caption}\n\n## ハッシュタグ\n#RePalette #美容福祉 #地域 #イベント #AI`,
      memoryKind: "plan", projectSlug: n % 2 === 0 ? "repalette" : "friday",
      approval: { kind: "sns_post", payload: { platform: "instagram", caption, hashtags: ["RePalette", "美容福祉", "地域", "イベント", "AI"] } },
    };
  },
  proposal: (_n, task) => ({
    presence: "thinking", label: task ?? "今週の重点施策を統合", kind: "proposal", title: task ?? "今週の重点施策の提案",
    summary: "部署の成果を統合し、今週の重点施策を3つに絞りました。",
    body: "## 推奨\n1. Re-Palette 助成金申請の準備開始\n2. Instagram 週3回投稿の定着\n3. F.R.I.D.A.Y. Phase 1（ダッシュボード）着手\n\n## 根拠\n各部署の今週の成果物より。",
    memoryKind: "project_context", projectSlug: "arqo",
    approval: { kind: "proposal_review", payload: { proposals: ["助成金申請準備", "Instagram週3回", "Phase 1 着手"] } },
  }),
};

function scriptFor(deliverableTypes: string[]): (n: number, task?: string) => Script {
  for (const t of deliverableTypes) if (SCRIPTS[t]) return SCRIPTS[t]!;
  return (_n, task) => ({
    presence: "writing", label: task ?? "作業中", kind: deliverableTypes[0] ?? "note", title: task ?? "作業メモ",
    summary: "Mock 成果物", body: "（Mock）", memoryKind: "active_task",
  });
}

/**
 * Run one unit of work for a mock agent: presence → task → (provider call) →
 * deliverable → memory → approval request when the policy requires it → vault.
 */
export async function runMockAgent(ctx: ServiceContext, agentId: string, raw: unknown = {}) {
  const input = MockRunInput.parse(raw ?? {});
  const db = ctx.db;
  const agent = await getAgent(db, agentId);
  if (!agent.enabled) throw new ServiceError("CONFLICT", `${agent.displayName} is disabled`);
  const [{ n }] = (await db.select({ n: sql<number>`count(*)::int` }).from(schema.deliverables)
    .where(eq(schema.deliverables.authorAgentId, agentId))) as [{ n: number }];
  const script = scriptFor(agent.deliverableTypes)(n, input.task);
  const projectSlug = input.projectSlug ?? script.projectSlug;
  const project = projectSlug ? (await db.select().from(schema.projects).where(eq(schema.projects.slug, projectSlug)))[0] : undefined;
  const actor = agentActor(agent.id);
  const coo = (await db.select({ id: schema.agents.id }).from(schema.agents).where(eq(schema.agents.level, "executive")))[0];

  await setPresence(db, agent.id, script.presence, script.label, { progress: 10 });
  const task = await db.transaction(async (tx) => {
    const [t] = await tx.insert(schema.tasks).values({
      id: newId(), projectId: project?.id, title: script.label, divisionId: agent.divisionId, assigneeAgentId: agent.id,
      status: "in_progress", deliverableType: script.kind, startedAt: new Date(),
    }).returning();
    await emitEvent(tx, {
      type: "task.created", actor: coo && coo.id !== agent.id ? agentActor(coo.id) : actor, subjectType: "task", subjectId: t!.id,
      projectId: project?.id, divisionId: agent.divisionId, importance: 2, data: { title: t!.title, assignee: agent.id },
    });
    await emitEvent(tx, {
      type: "task.started", actor, subjectType: "task", subjectId: t!.id, projectId: project?.id, divisionId: agent.divisionId,
      importance: 2, data: { title: t!.title },
    });
    return t!;
  });

  const [run] = await db.insert(schema.agentRuns).values({ id: newId(), taskId: task.id, agentId: agent.id }).returning();
  let notes = "";
  try {
    const res = await ctx.ai.generateText({
      tier: agent.runtime === "mock" ? "mock" : agent.modelTier, purpose: "agent_run", agentId: agent.id, runId: run!.id,
      system: agent.persona, messages: [{ role: "user", content: script.label }], maxOutputTokens: 1024,
    });
    notes = res.text;
    await db.update(schema.agentRuns).set({
      status: "succeeded", endedAt: new Date(), stepCount: 1, inputTokens: res.usage.inputTokens, outputTokens: res.usage.outputTokens,
    }).where(eq(schema.agentRuns.id, run!.id));
  } catch (e) {
    await db.update(schema.agentRuns).set({ status: "failed", endedAt: new Date(), error: (e as Error).message }).where(eq(schema.agentRuns.id, run!.id));
    await db.update(schema.tasks).set({ status: "failed", updatedAt: new Date() }).where(eq(schema.tasks.id, task.id));
    await emitEvent(db, { type: "task.closed", actor, subjectType: "task", subjectId: task.id, visibility: "internal", data: { status: "failed" } });
    await setPresence(db, agent.id, "blocked", `失敗: ${script.label}`);
    throw e;
  }

  const deliverable = await db.transaction(async (tx) => {
    const [d] = await tx.insert(schema.deliverables).values({
      id: newId(), taskId: task.id, projectId: project?.id, authorAgentId: agent.id, kind: script.kind, title: script.title,
      summary: script.summary, contentMd: script.body, status: script.approval ? "in_review" : "draft",
      vaultPath: deliverablePath(project?.vaultPath, script.title, task.id),
    }).returning();
    await emitEvent(tx, {
      type: "deliverable.created", actor, subjectType: "deliverable", subjectId: d!.id, projectId: project?.id,
      divisionId: agent.divisionId, importance: script.timelineEvent ? 2 : 4,
      visibility: script.timelineEvent ? "internal" : "timeline", data: { title: d!.title, kind: d!.kind },
    });
    if (script.timelineEvent) {
      await emitEvent(tx, {
        type: script.timelineEvent, actor, subjectType: "deliverable", subjectId: d!.id, projectId: project?.id,
        divisionId: agent.divisionId, importance: 4, data: { title: d!.title },
      });
    }
    await tx.insert(schema.agentMemoryItems).values({
      id: newId(), agentId: agent.id, kind: script.memoryKind, content: `${d!.title} — ${d!.summary}`, importance: 3,
      sourceType: "deliverable", sourceId: d!.id, projectId: project?.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    });
    await tx.insert(schema.agentWorkingContext).values({ agentId: agent.id }).onConflictDoNothing();
    await tx.update(schema.agentWorkingContext).set({
      card: sql`jsonb_set(coalesce(${schema.agentWorkingContext.card}, '{}'::jsonb), '{recent}', ${JSON.stringify([d!.title])}::jsonb)`,
      cardText: `直近の成果物: ${d!.title}`, version: sql`${schema.agentWorkingContext.version} + 1`, updatedAt: new Date(),
    }).where(eq(schema.agentWorkingContext.agentId, agent.id));
    const finalStatus = script.approval ? "waiting_approval" : "done";
    await tx.update(schema.tasks).set({ status: finalStatus, completedAt: finalStatus === "done" ? new Date() : null, updatedAt: new Date() })
      .where(eq(schema.tasks.id, task.id));
    if (finalStatus === "done") {
      await emitEvent(tx, { type: "task.completed", actor, subjectType: "task", subjectId: task.id, projectId: project?.id,
        divisionId: agent.divisionId, importance: 2, data: { title: task.title } });
      await emitEvent(tx, { type: "task.closed", actor, subjectType: "task", subjectId: task.id, visibility: "internal", data: { status: "done" } });
    }
    return d!;
  });

  const approval = script.approval
    ? await createApproval(ctx, {
      kind: script.approval.kind, title: script.title, summary: script.summary, requestedByAgentId: agent.id,
      projectSlug: project?.slug, subjectType: "deliverable", subjectId: deliverable.id,
      payload: script.approval.payload, preview: { body: script.body }, blockingCount: 1,
    })
    : null;

  await setPresence(db, agent.id, approval ? "waiting_approval" : "idle", approval ? `承認待ち: ${script.title}` : null);

  await ctx.vault.exclusive(async () => {
    await ctx.vault.createOnce(deliverable.vaultPath!, renderNote({
      frontmatter: {
        id: deliverable.id, type: "deliverable", title: deliverable.title, kind: deliverable.kind, author: agent.id,
        project: project?.slug ?? null, status: deliverable.status, friday_managed: true, tags: ["friday/deliverable"],
      },
      body: `# ${deliverable.title}\n\n${deliverable.summary}\n\n${deliverable.contentMd}\n\n---\n作業メモ: ${notes}\n`,
    }));
    await appendAgentJournal(ctx, agent.id, `${deliverable.title}（${deliverable.kind}）`);
    await ctx.vault.commit(ctx.db, `friday: deliverable.created ${deliverable.id.slice(-6)} (${agent.id})`);
  });

  return { task, deliverable, approval };
}

import {
  ACTION_LABELS_JA, actionScore, approvalCategory, canTransition, CreateApprovalInput, DEFAULT_RISK, DecideApprovalInput,
  decisionToStatus, companyDate, needsExecution, newId, payloadHash, sha256, stableStringify, type ApprovalStatus,
} from "@friday/core";
import { schema, type DbOrTx } from "@friday/db";
import { renderNote, safeName, VAULT_DIRS, yearMonth } from "@friday/vault";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { actorKey, agentActor, CEO } from "./actors";
import type { ServiceContext } from "./context";
import { ServiceError } from "./errors";
import { emitEvent } from "./events";
import { notify } from "./notifications";

type ApprovalRow = typeof schema.approvalRequests.$inferSelect;

/**
 * Approval Gate: the only way an AI employee can get a side effect executed
 * (docs/design/12-approval-flow.md). The payload is frozen by hash.
 */
export async function createApproval(ctx: ServiceContext, raw: unknown, opts: { idempotencyKey?: string } = {}) {
  const input = CreateApprovalInput.parse(raw);
  const db = ctx.db;
  const agent = (await db.select().from(schema.agents).where(eq(schema.agents.id, input.requestedByAgentId)))[0];
  if (!agent) throw new ServiceError("NOT_FOUND", `agent ${input.requestedByAgentId} not found`);
  const project = input.projectSlug
    ? (await db.select().from(schema.projects).where(eq(schema.projects.slug, input.projectSlug)))[0]
    : undefined;
  if (input.projectSlug && !project) throw new ServiceError("NOT_FOUND", `project ${input.projectSlug} not found`);

  const hash = payloadHash(input.payload);
  const idempotencyKey = opts.idempotencyKey
    ?? sha256(stableStringify({ kind: input.kind, subjectType: input.subjectType, subjectId: input.subjectId, hash, agent: agent.id }));
  const existing = (await db.select().from(schema.approvalRequests).where(eq(schema.approvalRequests.idempotencyKey, idempotencyKey)))[0];
  if (existing) return existing;

  const category = approvalCategory(input.kind);
  const risk = input.riskLevel ?? DEFAULT_RISK[input.kind];
  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(schema.approvalRequests).values({
      id: newId(), category, kind: input.kind, title: input.title, summary: input.summary,
      requestedByAgentId: agent.id, divisionId: agent.divisionId, projectId: project?.id,
      subjectType: input.subjectType, subjectId: input.subjectId, payload: input.payload, payloadHash: hash,
      preview: input.preview, riskLevel: risk, priority: input.priority, blockingCount: input.blockingCount,
      dueAt: input.dueAt ? new Date(input.dueAt) : null, idempotencyKey,
    }).returning();
    await tx.insert(schema.approvalEvents).values({
      id: newId(), approvalRequestId: created!.id, fromStatus: null, toStatus: "pending", actor: actorKey(agentActor(agent.id)),
    });
    await emitEvent(tx, {
      type: "approval.requested", actor: agentActor(agent.id), subjectType: "approval_request", subjectId: created!.id,
      projectId: project?.id, divisionId: agent.divisionId, importance: 4,
      data: { title: created!.title, kind: created!.kind, risk },
    });
    await notify(ctx, tx, {
      category: "action_required", severity: risk === "critical" || risk === "high" ? "warning" : "info",
      title: `${ACTION_LABELS_JA[input.kind]}: ${created!.title}`,
      body: `${agent.displayName} · リスク ${risk.toUpperCase()}`,
      link: `/approvals/${created!.id}`, approvalRequestId: created!.id, dedupeKey: `approval:${created!.id}`,
    });
    return created!;
  });
  return row;
}

/**
 * CEO decision. Must be called only from an authenticated CEO session: it
 * sets `friday.actor = 'ceo'` for the transaction, which the DB trigger
 * requires for the "approved" transition.
 */
export async function decideApproval(ctx: ServiceContext, id: string, raw: unknown) {
  const input = DecideApprovalInput.parse(raw);
  const result = await ctx.db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('friday.actor', 'ceo', true)`);
    const row = (await tx.select().from(schema.approvalRequests).where(eq(schema.approvalRequests.id, id)).for("update"))[0];
    if (!row) throw new ServiceError("NOT_FOUND", "approval request not found");
    const to = decisionToStatus(input.decision);
    if (!canTransition(row.status, to)) {
      throw new ServiceError("CONFLICT", `cannot ${input.decision} a request in status ${row.status}`);
    }
    if (input.decision === "approve" && input.payloadHash !== row.payloadHash) {
      throw new ServiceError("APPROVAL_HASH_MISMATCH", "表示中の内容と承認対象が一致しません。再読み込みしてください。");
    }
    const [updated] = await tx.update(schema.approvalRequests).set({
      status: to, decidedAt: new Date(), decisionComment: input.comment ?? null, updatedAt: new Date(),
    }).where(eq(schema.approvalRequests.id, id)).returning();
    await tx.insert(schema.approvalEvents).values({
      id: newId(), approvalRequestId: id, fromStatus: row.status, toStatus: to, actor: "ceo", comment: input.comment,
    });
    const eventType = to === "approved" ? "approval.approved" : to === "rejected" ? "approval.rejected" : "approval.revision_requested";
    await emitEvent(tx, {
      type: eventType, actor: CEO, subjectType: "approval_request", subjectId: id, projectId: row.projectId,
      divisionId: row.divisionId, importance: 5, data: { title: row.title, kind: row.kind, comment: input.comment ?? null },
    });
    await emitEvent(tx, {
      type: "approval.decided", actor: CEO, subjectType: "approval_request", subjectId: id, visibility: "internal",
      data: { kind: row.kind, decision: input.decision, agentId: row.requestedByAgentId },
    });
    if (row.subjectType === "deliverable" && row.subjectId) {
      await tx.update(schema.deliverables).set({
        status: to === "approved" ? "approved" : to === "rejected" ? "rejected" : "in_review",
        adopted: to === "approved" ? true : to === "rejected" ? false : null, updatedAt: new Date(),
      }).where(eq(schema.deliverables.id, row.subjectId));
    }
    await tx.update(schema.notifications).set({ readAt: new Date() })
      .where(and(eq(schema.notifications.approvalRequestId, id), isNull(schema.notifications.readAt)));
    return { before: row, after: updated! };
  });

  await recordDecisionNote(ctx, result.after);
  return result.after;
}

async function recordDecisionNote(ctx: ServiceContext, row: ApprovalRow) {
  await ctx.vault.exclusive(async () => {
    const date = companyDate(row.decidedAt ?? new Date());
    const { year, month } = yearMonth(date);
    const label = { approved: "承認", rejected: "却下", revision_requested: "差し戻し" }[row.status as string] ?? row.status;
    await ctx.vault.createOnce(`${VAULT_DIRS.decisions}/${year}/${month}/${date}_${label}_${safeName(row.title)} (${row.id.slice(-4)}).md`, renderNote({
      frontmatter: {
        id: row.id, type: "decision", title: row.title, kind: row.kind, decision: row.status, decided_at: row.decidedAt?.toISOString(),
        requested_by: row.requestedByAgentId, risk: row.riskLevel, payload_sha256: row.payloadHash, friday_managed: true,
        tags: ["friday/decision", `decision/${row.status}`],
      },
      body: `# ${label}: ${row.title}\n\n${row.summary}\n\n**CEOコメント**: ${row.decisionComment ?? "—"}\n`,
    }));
    await ctx.vault.commit(ctx.db, `friday: approval.${row.status} ${row.id.slice(-6)} (ceo)`);
  });
}

/** Approved actions waiting for the Action Executor (implemented per action in Phase 3/7). */
export function awaitingExecution(row: ApprovalRow): boolean {
  return row.status === "approved" && needsExecution(row.kind);
}

export async function getApproval(db: DbOrTx, id: string) {
  const row = (await db.select().from(schema.approvalRequests).where(eq(schema.approvalRequests.id, id)))[0];
  if (!row) throw new ServiceError("NOT_FOUND", "approval request not found");
  const history = await db.select().from(schema.approvalEvents)
    .where(eq(schema.approvalEvents.approvalRequestId, id)).orderBy(schema.approvalEvents.createdAt);
  return { ...row, history, awaitingExecution: awaitingExecution(row) };
}

export async function listApprovals(db: DbOrTx, status?: ApprovalStatus) {
  return db.select().from(schema.approvalRequests)
    .where(status ? eq(schema.approvalRequests.status, status) : undefined)
    .orderBy(desc(schema.approvalRequests.createdAt)).limit(100);
}

/** CEO ACTION REQUIRED: only items that cannot move without a CEO decision. */
export async function actionQueue(db: DbOrTx, now = new Date()) {
  const rows = await db.select({
    a: schema.approvalRequests, agentName: schema.agents.displayName, projectName: schema.projects.name, projectSlug: schema.projects.slug,
  }).from(schema.approvalRequests)
    .innerJoin(schema.agents, eq(schema.agents.id, schema.approvalRequests.requestedByAgentId))
    .leftJoin(schema.projects, eq(schema.projects.id, schema.approvalRequests.projectId))
    .where(eq(schema.approvalRequests.status, "pending"));
  const items = rows.map(({ a, agentName, projectName, projectSlug }) => ({
    id: a.id, type: "approval" as const, kind: a.kind, category: a.category, label: ACTION_LABELS_JA[a.kind],
    title: a.title, summary: a.summary, riskLevel: a.riskLevel, priority: a.priority,
    requestedBy: { agentId: a.requestedByAgentId, name: agentName },
    project: projectSlug ? { slug: projectSlug, name: projectName } : null,
    dueAt: a.dueAt?.toISOString() ?? null, createdAt: a.createdAt.toISOString(),
    blocking: { tasks: a.blockingCount }, payloadHash: a.payloadHash, preview: a.preview,
    score: actionScore({ risk: a.riskLevel, priority: a.priority, dueAt: a.dueAt, createdAt: a.createdAt, blockingCount: a.blockingCount, now }),
  }));
  items.sort((x, y) => y.score - x.score);
  return {
    data: items,
    counts: {
      total: items.length,
      critical: items.filter((i) => i.riskLevel === "critical").length,
      high: items.filter((i) => i.riskLevel === "high").length,
    },
  };
}

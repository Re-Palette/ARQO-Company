import { createServer, type Server } from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LocalBackupStorage } from "@friday/backup";
import { verifyWebhook } from "@friday/contracts";
import { createDb, schema, type Db } from "@friday/db";
import { runMigrations } from "@friday/db/migrate";
import { seed } from "@friday/db/seed";
import { eq, sql } from "drizzle-orm";
import {
  actionQueue, authenticateApiKey, buildContext, createApiClient, createDirective, createProject, createReport,
  createWebhookSubscription, decide, dispatchWebhooks, getDashboard, getReport, listContractEvents, listTimeline,
  registerAgent, runMockAgent, runVaultBackup, syncVault, ServiceError, type ServiceContext,
} from "../src";

const URL = process.env.TEST_DATABASE_URL ?? "postgres://friday:friday@localhost:5432/friday_test";

/** Drizzle wraps driver errors; the Postgres message is on `cause`. */
const causeMatches = (re: RegExp) => (e: unknown) => re.test(String((e as { cause?: { message?: string } }).cause?.message ?? e));

let db: Db;
let close: () => Promise<void>;
let ctx: ServiceContext;
let vaultRoot: string;
let remote: string;

beforeAll(async () => {
  const admin = postgres(URL, { max: 1, onnotice: () => {} });
  await admin.unsafe("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;");
  await admin.end();
  ({ db, close } = createDb(URL));
  await runMigrations(db);
  await seed(db, "arqo");
  vaultRoot = await mkdtemp(join(tmpdir(), "friday-vault-"));
  remote = await mkdtemp(join(tmpdir(), "friday-remote-"));
  execFileSync("git", ["init", "--bare", "-b", "main", remote]);
  ctx = buildContext(db, vaultRoot, { WEBHOOK_SECRET: "whsec" }, remote);
  // A normal write before the first sync must still land in the vault's own repo.
  await registerAgent(ctx, { id: "early-bird", displayName: "Early", title: "x", divisionId: "operations" });
  await syncVault(ctx);
}, 60_000);

afterAll(async () => close?.());

describe("Phase 0 flow", () => {
  it("creates the vault structure with Projects, Reports, Meetings, Agents and Daily", async () => {
    const dirs = await ctx.vault.store.list(".");
    for (const d of ["01_CEO", "04_AI Employees", "05_Projects", "07_Meetings", "08_Reports", "99_System"]) expect(dirs).toContain(d);
    expect(await ctx.vault.store.exists("04_AI Employees/researcher/Profile.md")).toBe(true);
    expect(await ctx.vault.store.exists("05_Projects/friday/F.R.I.D.A.Y..md")).toBe(true);
    expect(await ctx.vault.store.list("01_CEO/Daily")).toContain(String(new Date().getFullYear()));
    expect(execFileSync("git", ["--git-dir", remote, "log", "--oneline"]).toString()).toMatch(/vault.sync/);
  });

  it("registers a new mock agent from data and refuses direct side-effect tools", async () => {
    const a = await registerAgent(ctx, { id: "designer", displayName: "Designer AI", title: "デザイン部長", divisionId: "creative" });
    expect(a.runtime).toBe("mock");
    await expect(registerAgent(ctx, { id: "rogue", displayName: "X", title: "X", divisionId: "creative", tools: ["sns_post"] }))
      .rejects.toMatchObject({ code: "POLICY_VIOLATION" });
  });

  it("creates a project from a template without code changes", async () => {
    const p = await createProject(ctx, {
      slug: "arqo-labs", name: "ARQO Labs", templateKey: "venture", parentSlug: "future-ventures", ownerDivisionId: "strategy",
      customFields: { hypothesis: "AI社員で小さく検証" },
    });
    expect(p.parentProjectId).not.toBeNull();
    expect(await ctx.vault.store.exists("05_Projects/arqo-labs/Research/.gitkeep")).toBe(true);
    await expect(createProject(ctx, { slug: "bad", name: "x", templateKey: "venture", ownerDivisionId: "strategy", customFields: { hypothesis: 1 } }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("runs mock agents: research finding, SNS draft that needs approval", async () => {
    const research = await runMockAgent(ctx, "researcher");
    expect(research.approval).toBeNull();
    expect(research.task.status).toBe("in_progress"); // returned row is the pre-completion snapshot
    const marketing = await runMockAgent(ctx, "cmo");
    expect(marketing.approval?.kind).toBe("sns_post");
    expect(marketing.approval?.category).toBe("action");
    const queue = await actionQueue(db);
    expect(queue.data[0]!.kind).toBe("sns_post");
    const memory = await db.select().from(schema.agentMemoryItems).where(eq(schema.agentMemoryItems.agentId, "researcher"));
    expect(memory).toHaveLength(1);
    const usage = await db.select().from(schema.llmUsage);
    expect(usage.every((u) => u.provider === "mock")).toBe(true);
  });

  it("enforces CEO-only approval in the database itself", async () => {
    const pending = (await actionQueue(db)).data[0]!;
    await expect(db.update(schema.approvalRequests).set({ status: "approved" }).where(eq(schema.approvalRequests.id, pending.id)))
      .rejects.toSatisfy(causeMatches(/only the CEO can approve/));
    await expect(db.update(schema.approvalRequests).set({ payload: { caption: "changed" } }).where(eq(schema.approvalRequests.id, pending.id)))
      .rejects.toSatisfy(causeMatches(/immutable/));
  });

  it("rejects approval of content the CEO did not see, then approves the right hash", async () => {
    const pending = (await actionQueue(db)).data.find((i) => i.kind === "sns_post")!;
    await expect(decide(ctx, pending.id, { decision: "approve", payloadHash: "0".repeat(64) }))
      .rejects.toMatchObject({ code: "APPROVAL_HASH_MISMATCH" });
    const { approval } = await decide(ctx, pending.id, { decision: "approve", payloadHash: pending.payloadHash });
    expect(approval.status).toBe("approved");
    await expect(decide(ctx, pending.id, { decision: "reject" })).rejects.toBeInstanceOf(ServiceError);
    const deliverable = (await db.select().from(schema.deliverables).where(eq(schema.deliverables.id, approval.subjectId!)))[0]!;
    expect(deliverable.adopted).toBe(true);
  });

  it("creates a report, and on approval archives it to Approved Reports in Obsidian", async () => {
    const { report, approval } = await createReport(ctx, { type: "daily_executive" });
    expect(report.status).toBe("pending_review");
    expect(report.contentMd).toContain("本日の成果");
    const { followUp } = await decide(ctx, approval.id, { decision: "approve", payloadHash: approval.payloadHash });
    const archived = await getReport(db, report.id);
    expect(archived.status).toBe("archived");
    expect(archived.archive?.vaultCommit).toBeTruthy();
    const path = (followUp as { notePath: string }).notePath;
    expect(path).toMatch(/^08_Reports\/Approved\/\d{4}\/\d{2}\//);
    expect(await readFile(join(vaultRoot, path), "utf8")).toContain("Approved by CEO");
    await expect(db.delete(schema.reportArchives)).rejects.toSatisfy(causeMatches(/append-only/));
  });

  it("produces notifications and a readable timeline", async () => {
    const notifications = await db.select().from(schema.notifications);
    expect(notifications.some((n) => n.category === "action_required")).toBe(true);
    const deliveries = await db.select().from(schema.notificationDeliveries);
    expect(deliveries.some((d) => d.channelId === "in_app" && d.status === "sent")).toBe(true);
    expect(deliveries.some((d) => d.channelId === "web_push" && d.status === "skipped")).toBe(true);
    const texts = (await listTimeline(db, { limit: 50 })).map((t) => t.text);
    expect(texts).toContain("CEO 承認: 投稿案: 10月の告知");
    expect(texts.some((t) => t.startsWith("Research AI 助成金情報を発見"))).toBe(true);
    expect(texts.some((t) => t.startsWith("Marketing AI 投稿案"))).toBe(true);
  });

  it("bridges the Universal AI: API key, idempotent directives, event feed, signed webhooks with retry", async () => {
    const { client, apiKey } = await createApiClient(db, "Universal AI (dummy)");
    const authed = await authenticateApiKey(db, `Bearer ${apiKey}`);
    expect(authed?.id).toBe(client.id);
    expect(await authenticateApiKey(db, `Bearer ${apiKey}x`)).toBeNull();

    // Universal AI webhook endpoint is DOWN: the directive is still accepted.
    await createWebhookSubscription(db, client.id, "http://127.0.0.1:9/down", ["directive.accepted"], "env:WEBHOOK_SECRET");
    const first = await createDirective(ctx, { text: "美容業界のAI活用事例を調査して", type: "research" }, { client, idempotencyKey: "k1" });
    const again = await createDirective(ctx, { text: "美容業界のAI活用事例を調査して", type: "research" }, { client, idempotencyKey: "k1" });
    expect(again.replayed).toBe(true);
    expect(again.response).toEqual(first.response);
    await expect(createDirective(ctx, { text: "別の依頼", type: "research" }, { client, idempotencyKey: "k1" }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    expect((await dispatchWebhooks(ctx)).retry).toBe(1);

    // It comes back: a receiver that verifies the signature.
    const received: unknown[] = [];
    const server: Server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const ok = verifyWebhook("whsec", body, req.headers["x-friday-signature"] as string);
        if (ok) received.push(JSON.parse(body));
        res.statusCode = ok ? 200 : 401;
        res.end();
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;
    await db.update(schema.webhookSubscriptions).set({ url: `http://127.0.0.1:${port}/hook` });
    await db.update(schema.webhookOutbox).set({ nextRetryAt: new Date(0) });
    expect((await dispatchWebhooks(ctx)).sent).toBe(1);
    server.close();
    expect(received).toHaveLength(1);
    expect((received[0] as { type: string }).type).toBe("directive.accepted");

    const feed = await listContractEvents(db, {});
    expect(feed.data.some((e) => e.type === "directive.accepted")).toBe(true);
    const timeline = await listTimeline(db, { limit: 10 });
    expect(timeline.map((t) => t.text)).toContain("Universal AI (dummy) から依頼を受付: 美容業界のAI活用事例を調査して");
  });

  it("backs up the vault off-site and verifies the restore", async () => {
    const storage = new LocalBackupStorage(await mkdtemp(join(tmpdir(), "friday-bk-")));
    const run = await runVaultBackup(ctx, storage);
    expect(run.status).toBe("ok");
    expect(run.verified).toBe(true);
    expect(run.sha256).toHaveLength(64);
  });

  it("serves the dashboard in one call", async () => {
    const d = await getDashboard(ctx);
    expect(d.agents.length).toBe(5);
    expect(d.projects.length).toBe(8);
    expect(d.timeline.length).toBeGreaterThan(5);
    expect(d.kpis.headline).toHaveLength(5);
    expect(d.actionRequired.counts.total).toBe(0);
    const [{ n }] = (await db.execute(sql`select count(*)::int as n from activity_events`)) as unknown as [{ n: number }];
    expect(n).toBeGreaterThan(10);
  });
});

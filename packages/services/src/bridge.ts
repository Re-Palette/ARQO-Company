import { randomBytes } from "node:crypto";
import { CreateDirectiveInput, newId, sha256, stableStringify } from "@friday/core";
import { CONTRACT_VERSION, SCOPES, signWebhook, WEBHOOK_EVENT_TYPES, type EventEnvelope, type Scope } from "@friday/contracts";
import { schema, type DbOrTx } from "@friday/db";
import { and, asc, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import { clientActor, CEO, type Actor } from "./actors";
import type { ServiceContext } from "./context";
import { ServiceError } from "./errors";
import { emitEvent } from "./events";

type ApiClient = typeof schema.apiClients.$inferSelect;

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

/** Issue an API key. The plaintext is returned once; only its hash is stored. */
export async function createApiClient(db: DbOrTx, name: string, scopes: Scope[] = [...SCOPES]) {
  const unknown = scopes.filter((s) => !(SCOPES as readonly string[]).includes(s));
  if (unknown.length) throw new ServiceError("VALIDATION_ERROR", `unknown scopes: ${unknown.join(", ")}`);
  const prefix = randomBytes(6).toString("hex");
  const key = `fri_live_${prefix}_${randomBytes(24).toString("base64url")}`;
  const [client] = await db.insert(schema.apiClients).values({
    id: newId(), name, keyPrefix: prefix, keyHash: sha256(key), scopes,
  }).returning();
  await emitEvent(db, { type: "api_client.created", actor: CEO, subjectType: "api_client", subjectId: client!.id, visibility: "internal", data: { name, scopes } });
  return { client: client!, apiKey: key };
}

export async function authenticateApiKey(db: DbOrTx, authorization: string | null): Promise<ApiClient | null> {
  const m = /^Bearer (fri_live_([0-9a-f]{12})_[A-Za-z0-9_-]+)$/.exec(authorization ?? "");
  if (!m) return null;
  const client = (await db.select().from(schema.apiClients).where(eq(schema.apiClients.keyPrefix, m[2]!)))[0];
  if (!client || client.revokedAt || client.keyHash !== sha256(m[1]!)) return null;
  await db.update(schema.apiClients).set({ lastUsedAt: new Date() }).where(eq(schema.apiClients.id, client.id));
  return client;
}

export function requireScope(client: ApiClient, scope: Scope) {
  if (!client.scopes.includes(scope)) throw new ServiceError("FORBIDDEN", `missing scope ${scope}`);
}

export async function revokeApiClient(db: DbOrTx, id: string) {
  await db.update(schema.apiClients).set({ revokedAt: new Date() }).where(eq(schema.apiClients.id, id));
}

// ---------------------------------------------------------------------------
// Inbound: directives (CEO via dashboard, or external clients via API key)
// ---------------------------------------------------------------------------

export async function createDirective(ctx: ServiceContext, raw: unknown, opts: { actor?: Actor; client?: ApiClient; idempotencyKey?: string } = {}) {
  const parsed = CreateDirectiveInput.safeParse(raw);
  if (!parsed.success) throw new ServiceError("VALIDATION_ERROR", "invalid directive", parsed.error.issues);
  const input = parsed.data;
  const db = ctx.db;
  const client = opts.client;
  const requestHash = sha256(stableStringify(input));

  if (client && opts.idempotencyKey) {
    const prior = (await db.select().from(schema.idempotencyKeys)
      .where(and(eq(schema.idempotencyKeys.apiClientId, client.id), eq(schema.idempotencyKeys.key, opts.idempotencyKey))))[0];
    if (prior) {
      if (prior.requestHash !== requestHash) throw new ServiceError("CONFLICT", "Idempotency-Key was reused with a different request");
      return { replayed: true, response: prior.response as Record<string, unknown> };
    }
  }

  const project = input.project ? (await db.select().from(schema.projects).where(eq(schema.projects.slug, input.project)))[0] : undefined;
  if (input.project && !project) throw new ServiceError("VALIDATION_ERROR", `unknown project "${input.project}"`);
  const actor = opts.actor ?? (client ? clientActor(client.id) : CEO);

  const response = await db.transaction(async (tx) => {
    const [d] = await tx.insert(schema.directives).values({
      id: newId(), source: client ? "universal_agent" : actor.type === "ceo" ? "ceo" : "system", apiClientId: client?.id,
      type: input.type, rawText: input.text, priority: input.priority, projectId: project?.id,
      deadline: input.deadline ? new Date(input.deadline) : null, callback: input.callback,
      spec: { hints: input.hints ?? null },
    }).returning();
    const summary = input.text.length > 60 ? `${input.text.slice(0, 60)}…` : input.text;
    if (client) {
      await emitEvent(tx, { type: "bridge.request_received", actor, subjectType: "directive", subjectId: d!.id, projectId: project?.id, importance: 4, data: { summary, type: input.type } });
    } else {
      await emitEvent(tx, { type: "directive.received", actor, subjectType: "directive", subjectId: d!.id, projectId: project?.id, importance: 4, data: { summary } });
    }
    // Contract event; only delivered to subscribers (outbox), never shown on the timeline.
    await emitEvent(tx, { type: "directive.accepted", actor, subjectType: "directive", subjectId: d!.id, visibility: "internal",
      data: { directive_id: d!.id, status: d!.status, source: d!.source } });
    const body = { directive_id: d!.id, status: d!.status, links: { self: `/api/v1/directives/${d!.id}` } };
    if (client && opts.idempotencyKey) {
      await tx.insert(schema.idempotencyKeys).values({ key: opts.idempotencyKey, apiClientId: client.id, requestHash, response: body });
    }
    return body;
  });
  return { replayed: false, response };
}

export async function getDirective(db: DbOrTx, id: string, client?: ApiClient) {
  const d = (await db.select().from(schema.directives).where(eq(schema.directives.id, id)))[0];
  if (!d || (client && d.apiClientId !== client.id)) throw new ServiceError("NOT_FOUND", "directive not found");
  return d;
}

// ---------------------------------------------------------------------------
// Event feed (pull) — lets an external system catch up after downtime
// ---------------------------------------------------------------------------

export async function listContractEvents(db: DbOrTx, opts: { after?: string; limit?: number }): Promise<{ data: EventEnvelope[]; next_cursor: string | null }> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const rows = await db.select().from(schema.activityEvents).where(and(
    inArray(schema.activityEvents.type, [...WEBHOOK_EVENT_TYPES]),
    opts.after ? gt(schema.activityEvents.id, opts.after) : undefined,
  )).orderBy(asc(schema.activityEvents.id)).limit(limit);
  return {
    data: rows.map((e) => ({
      id: `evt_${e.id}`, type: e.type, contract_version: CONTRACT_VERSION, created_at: e.createdAt.toISOString(),
      data: e.data as Record<string, unknown>,
    })),
    next_cursor: rows.length === limit ? rows.at(-1)!.id : null,
  };
}

// ---------------------------------------------------------------------------
// Outbound: webhook subscriptions + outbox dispatcher
// ---------------------------------------------------------------------------

/** secretRef is "env:NAME"; the secret itself is never stored in the database. */
export async function createWebhookSubscription(db: DbOrTx, apiClientId: string, url: string, events: string[], secretRef: string) {
  if (!secretRef.startsWith("env:")) throw new ServiceError("VALIDATION_ERROR", 'secretRef must be "env:NAME"');
  const bad = events.filter((e) => !(WEBHOOK_EVENT_TYPES as readonly string[]).includes(e));
  if (bad.length) throw new ServiceError("VALIDATION_ERROR", `unknown events: ${bad.join(", ")}`);
  const [sub] = await db.insert(schema.webhookSubscriptions).values({ id: newId(), apiClientId, url, events, secretRef }).returning();
  return sub!;
}

const MAX_AGE_MS = 72 * 3600 * 1000;

/**
 * Deliver due outbox rows. Failures only reschedule (exponential backoff,
 * up to 72h, then "dead"); they never affect F.R.I.D.A.Y.'s own work.
 */
export async function dispatchWebhooks(ctx: ServiceContext, now = new Date()) {
  const db = ctx.db;
  const due = await db.select({ o: schema.webhookOutbox, s: schema.webhookSubscriptions }).from(schema.webhookOutbox)
    .innerJoin(schema.webhookSubscriptions, eq(schema.webhookSubscriptions.id, schema.webhookOutbox.subscriptionId))
    .where(and(eq(schema.webhookOutbox.status, "pending"), lte(schema.webhookOutbox.nextRetryAt, now)))
    .orderBy(asc(schema.webhookOutbox.createdAt)).limit(50);
  const summary = { sent: 0, retry: 0, dead: 0 };
  for (const { o, s } of due) {
    const secret = ctx.env[s.secretRef.slice(4)];
    const body = JSON.stringify(o.payload);
    let error: string | null = null;
    if (!secret) error = `${s.secretRef} is not set`;
    else {
      try {
        const res = await fetch(s.url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-friday-signature": signWebhook(secret, body), "x-friday-event": (o.payload as { type: string }).type },
          body, signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) error = `HTTP ${res.status}`;
      } catch (e) {
        error = (e as Error).message;
      }
    }
    const attempts = o.attempts + 1;
    if (!error) {
      await db.update(schema.webhookOutbox).set({ status: "sent", attempts, lastError: null }).where(eq(schema.webhookOutbox.id, o.id));
      summary.sent++;
    } else if (now.getTime() - o.createdAt.getTime() > MAX_AGE_MS) {
      await db.update(schema.webhookOutbox).set({ status: "dead", attempts, lastError: error }).where(eq(schema.webhookOutbox.id, o.id));
      summary.dead++;
    } else {
      const backoffMs = Math.min(60_000 * 2 ** (attempts - 1), 6 * 3600 * 1000);
      await db.update(schema.webhookOutbox).set({ attempts, lastError: error, nextRetryAt: new Date(now.getTime() + backoffMs) })
        .where(eq(schema.webhookOutbox.id, o.id));
      summary.retry++;
    }
  }
  return summary;
}

export async function bridgeStatus(db: DbOrTx) {
  const clients = await db.select().from(schema.apiClients).where(isNull(schema.apiClients.revokedAt));
  const subs = await db.select().from(schema.webhookSubscriptions);
  const outbox = await db.select({ status: schema.webhookOutbox.status }).from(schema.webhookOutbox);
  const count = (s: string) => outbox.filter((o) => o.status === s).length;
  return {
    contractVersion: CONTRACT_VERSION,
    clients: clients.map((c) => ({ id: c.id, name: c.name, scopes: c.scopes, lastUsedAt: c.lastUsedAt })),
    subscriptions: subs.map((s) => ({ id: s.id, url: s.url, events: s.events, active: s.active })),
    outbox: { pending: count("pending"), sent: count("sent"), dead: count("dead") },
  };
}

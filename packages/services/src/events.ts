import { newId } from "@friday/core";
import { schema, type DbOrTx } from "@friday/db";
import { CONTRACT_VERSION, WEBHOOK_EVENT_TYPES } from "@friday/contracts";
import { and, eq, isNull, or, lte, sql } from "drizzle-orm";
import type { Actor } from "./actors";

export interface EmitInput {
  type: string;
  actor: Actor;
  subjectType?: string;
  subjectId?: string;
  projectId?: string | null;
  divisionId?: string | null;
  data?: Record<string, unknown>;
  importance?: number;
  visibility?: "timeline" | "internal";
}

/**
 * Append an activity event. Webhook deliveries for external subscribers are
 * written to the outbox in the same transaction (outbox pattern), so the
 * business operation never waits on, or fails because of, an external system.
 */
export async function emitEvent(db: DbOrTx, input: EmitInput) {
  const [event] = await db.insert(schema.activityEvents).values({
    id: newId(),
    type: input.type,
    actorType: input.actor.type,
    actorId: input.actor.id,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    projectId: input.projectId ?? null,
    divisionId: input.divisionId ?? null,
    data: input.data ?? {},
    importance: input.importance ?? 3,
    visibility: input.visibility ?? "timeline",
  }).returning();
  if ((WEBHOOK_EVENT_TYPES as readonly string[]).includes(input.type)) {
    const now = new Date();
    const subs = await db.select().from(schema.webhookSubscriptions).where(and(
      eq(schema.webhookSubscriptions.active, true),
      or(isNull(schema.webhookSubscriptions.pausedUntil), lte(schema.webhookSubscriptions.pausedUntil, now)),
      sql`${input.type} = ANY(${schema.webhookSubscriptions.events})`,
    ));
    for (const sub of subs) {
      await db.insert(schema.webhookOutbox).values({
        id: newId(), subscriptionId: sub.id, eventId: event!.id,
        payload: {
          id: `evt_${event!.id}`, type: input.type, contract_version: CONTRACT_VERSION,
          created_at: event!.createdAt.toISOString(), data: input.data ?? {},
        },
      });
    }
  }
  return event!;
}

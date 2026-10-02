import { newId, type NotificationCategory, type Severity } from "@friday/core";
import { schema, type DbOrTx } from "@friday/db";
import { channelsFor, getNotificationProvider, type Rule } from "@friday/notify";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { ServiceContext } from "./context";

export interface NotifyInput {
  category: NotificationCategory;
  severity?: Severity;
  title: string;
  body?: string;
  link?: string;
  approvalRequestId?: string;
  dedupeKey?: string;
}

/**
 * Create a notification and deliver it through every channel the rules select.
 * Unknown or unconfigured channels are recorded as skipped, never thrown.
 */
export async function notify(ctx: ServiceContext, db: DbOrTx, input: NotifyInput) {
  if (input.dedupeKey) {
    const dup = await db.select({ id: schema.notifications.id }).from(schema.notifications)
      .where(and(eq(schema.notifications.dedupeKey, input.dedupeKey), isNull(schema.notifications.readAt))).limit(1);
    if (dup.length) return null;
  }
  const severity = input.severity ?? "info";
  const [n] = await db.insert(schema.notifications).values({
    id: newId(), category: input.category, severity, title: input.title, body: input.body ?? "",
    link: input.link, approvalRequestId: input.approvalRequestId, dedupeKey: input.dedupeKey,
  }).returning();
  const rules = (await db.select().from(schema.notificationRules)) as Rule[];
  const channelIds = channelsFor(rules, input.category, severity);
  const channels = await db.select().from(schema.notificationChannels).where(inArray(schema.notificationChannels.id, channelIds));
  for (const ch of channels) {
    const provider = getNotificationProvider(ch.provider);
    let result: { status: string; providerMessageId?: string; error?: string };
    if (!ch.enabled) result = { status: "skipped", error: "channel disabled" };
    else if (!provider) result = { status: "skipped", error: `no provider "${ch.provider}"` };
    else {
      try {
        result = await provider.send(
          { id: n!.id, category: n!.category, severity, title: n!.title, body: n!.body, deepLink: n!.link ?? undefined, dedupeKey: n!.dedupeKey ?? undefined },
          { id: ch.id, provider: ch.provider, enabled: ch.enabled, config: ch.config as Record<string, unknown> },
          ctx.env,
        );
      } catch (e) {
        result = { status: "failed", error: (e as Error).message };
      }
    }
    await db.insert(schema.notificationDeliveries).values({
      id: newId(), notificationId: n!.id, channelId: ch.id, status: result.status,
      providerMessageId: result.providerMessageId, error: result.error, sentAt: result.status === "sent" ? new Date() : null,
    });
  }
  return n!;
}

export async function listNotifications(db: DbOrTx, opts: { unreadOnly?: boolean; limit?: number } = {}) {
  return db.select().from(schema.notifications)
    .where(and(isNull(schema.notifications.archivedAt), opts.unreadOnly ? isNull(schema.notifications.readAt) : undefined))
    .orderBy(desc(schema.notifications.createdAt)).limit(opts.limit ?? 50);
}

export async function markNotificationRead(db: DbOrTx, id?: string) {
  await db.update(schema.notifications).set({ readAt: new Date() })
    .where(and(isNull(schema.notifications.readAt), id ? eq(schema.notifications.id, id) : undefined));
}

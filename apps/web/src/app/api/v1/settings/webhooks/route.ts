import { route, body } from "@/lib/api";
import { createWebhookSubscription, dispatchWebhooks } from "@friday/services";

export const POST = route({ auth: "ceo" }, async ({ req, ctx }) => {
  const b = (await body(req)) as { api_client_id: string; url: string; events: string[]; secret_ref: string };
  return createWebhookSubscription(ctx.db, b.api_client_id, b.url, b.events, b.secret_ref);
});

/** Manual dispatch (the worker does this every minute). */
export const PUT = route({ auth: "ceo" }, ({ ctx }) => dispatchWebhooks(ctx));

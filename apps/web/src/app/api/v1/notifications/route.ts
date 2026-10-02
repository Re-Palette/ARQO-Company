import { route } from "@/lib/api";
import { listNotifications } from "@friday/services";

export const GET = route({ auth: "ceo" }, async ({ req, ctx }) =>
  ({ data: await listNotifications(ctx.db, { unreadOnly: req.nextUrl.searchParams.get("unread") === "true" }) }));

import { route } from "@/lib/api";
import { markNotificationRead } from "@friday/services";

export const POST = route<{ id: string }>({ auth: "ceo" }, async ({ ctx, params }) => {
  await markNotificationRead(ctx.db, params.id);
  return { ok: true };
});

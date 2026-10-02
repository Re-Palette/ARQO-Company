import { route } from "@/lib/api";
import { markNotificationRead } from "@friday/services";

export const POST = route({ auth: "ceo" }, async ({ ctx }) => {
  await markNotificationRead(ctx.db);
  return { ok: true };
});

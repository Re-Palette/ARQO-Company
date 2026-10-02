import { route } from "@/lib/api";
import { listActivity } from "@friday/services";

export const GET = route({ auth: "ceo" }, async ({ req, ctx }) => {
  const q = req.nextUrl.searchParams;
  return { data: await listActivity(ctx.db, { limit: Math.min(Number(q.get("limit") ?? 50), 200), before: q.get("before") ?? undefined }) };
});

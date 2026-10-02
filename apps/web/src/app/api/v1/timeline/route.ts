import { route } from "@/lib/api";
import { listTimeline } from "@friday/services";

export const GET = route({ auth: "ceo" }, async ({ req, ctx }) => {
  const q = req.nextUrl.searchParams;
  return { data: await listTimeline(ctx.db, {
    limit: Math.min(Number(q.get("limit") ?? 30), 200), before: q.get("before") ?? undefined,
    minImportance: q.get("min_importance") ? Number(q.get("min_importance")) : undefined,
  }) };
});

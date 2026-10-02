import { route } from "@/lib/api";
import { listContractEvents } from "@friday/services";

/** Event feed for external systems to catch up after downtime (contract v1). */
export const GET = route({ auth: "ceo_or_key", scope: "read:events" }, ({ req, ctx }) => {
  const q = req.nextUrl.searchParams;
  return listContractEvents(ctx.db, { after: q.get("after") ?? undefined, limit: Number(q.get("limit") ?? 50) });
});

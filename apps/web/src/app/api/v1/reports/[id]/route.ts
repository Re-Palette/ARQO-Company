import { route } from "@/lib/api";
import { getReport, ServiceError } from "@friday/services";

export const GET = route<{ id: string }>({ auth: "ceo_or_key", scope: "read:reports" }, async ({ ctx, caller, params }) => {
  const r = await getReport(ctx.db, params.id);
  if (caller.kind === "client" && !["approved", "archiving", "archived"].includes(r.status)) throw new ServiceError("NOT_FOUND", "report not found");
  return r;
});

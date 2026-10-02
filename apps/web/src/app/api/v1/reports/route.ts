import { route } from "@/lib/api";
import { listReports } from "@friday/services";

/** API keys only ever see approved reports. */
export const GET = route({ auth: "ceo_or_key", scope: "read:reports" }, async ({ ctx, caller }) =>
  ({ data: await listReports(ctx.db, { approvedOnly: caller.kind === "client" }) }));

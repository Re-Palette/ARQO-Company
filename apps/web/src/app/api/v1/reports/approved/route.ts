import { route } from "@/lib/api";
import { listReports } from "@friday/services";

export const GET = route({ auth: "ceo_or_key", scope: "read:reports" }, async ({ ctx }) => ({ data: await listReports(ctx.db, { approvedOnly: true }) }));

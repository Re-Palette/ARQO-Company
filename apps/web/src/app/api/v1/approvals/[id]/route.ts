import { route } from "@/lib/api";
import { getApproval } from "@friday/services";

export const GET = route<{ id: string }>({ auth: "ceo_or_key", scope: "read:approvals" }, ({ ctx, params }) => getApproval(ctx.db, params.id));

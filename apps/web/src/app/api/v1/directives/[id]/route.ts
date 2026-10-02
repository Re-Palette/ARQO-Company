import { route } from "@/lib/api";
import { getDirective } from "@friday/services";

export const GET = route<{ id: string }>({ auth: "ceo_or_key", scope: "read:directives" }, ({ ctx, caller, params }) =>
  getDirective(ctx.db, params.id, caller.client));

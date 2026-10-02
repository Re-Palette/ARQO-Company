import { route } from "@/lib/api";
import { getAgent } from "@friday/services";

export const GET = route<{ id: string }>({ auth: "ceo" }, ({ ctx, params }) => getAgent(ctx.db, params.id));

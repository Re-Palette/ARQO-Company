import { route, body } from "@/lib/api";
import { listAgents, registerAgent } from "@friday/services";

export const GET = route({ auth: "ceo" }, async ({ ctx }) => ({ data: await listAgents(ctx.db) }));
export const POST = route({ auth: "ceo" }, async ({ req, ctx }) => registerAgent(ctx, await body(req)));

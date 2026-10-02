import { route, body } from "@/lib/api";
import { runMockAgent } from "@friday/services";

/** Phase 0: run one unit of scripted work for a mock agent. */
export const POST = route<{ id: string }>({ auth: "ceo" }, async ({ req, ctx, params }) => runMockAgent(ctx, params.id, await body(req)));

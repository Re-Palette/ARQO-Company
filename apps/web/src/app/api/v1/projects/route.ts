import { route, body } from "@/lib/api";
import { createProject, listProjects } from "@friday/services";

export const GET = route({ auth: "ceo" }, async ({ ctx }) => ({ data: await listProjects(ctx.db) }));
export const POST = route({ auth: "ceo" }, async ({ req, ctx }) => createProject(ctx, await body(req)));

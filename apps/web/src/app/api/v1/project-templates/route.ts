import { route } from "@/lib/api";
import { listProjectTemplates } from "@friday/services";

export const GET = route({ auth: "ceo" }, async ({ ctx }) => ({ data: await listProjectTemplates(ctx.db) }));
